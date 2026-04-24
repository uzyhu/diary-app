"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { CATEGORIES, isCategory } from "@/lib/categories";
import { isValidDateString, todayInSeoul } from "@/lib/date";
import { analyzeDiary } from "@/lib/gemini";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  ALLOWED_PHOTO_MIME_TYPES,
  DIARY_PHOTOS_BUCKET,
  MAX_PHOTO_SIZE,
  buildPhotoPath,
  extensionFromMimeType,
  isAllowedPhotoMimeType,
} from "@/lib/storage";
import type { DiaryFormState, ShareFormState } from "./form-state";

const CONTENT_MAX_LENGTH = 10_000;
// 간이 정규식. RFC 5322를 완전히 따르진 않지만 MVP 입력 오류 거르기엔 충분하다.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Supabase/PostgreSQL의 unique violation SQLSTATE. graceful handling에 사용.
const UNIQUE_VIOLATION_CODE = "23505";
const PHOTO_ACTION_VALUES = ["keep", "replace", "remove"] as const;
type PhotoAction = (typeof PHOTO_ACTION_VALUES)[number];

type ParsedFields = {
  date: string;
  category: (typeof CATEGORIES)[number];
  content: string;
};

type ParsedPhoto =
  | { action: "keep" }
  | { action: "remove" }
  | { action: "replace"; file: File };

function parseFields(formData: FormData):
  | { ok: true; fields: ParsedFields }
  | { ok: false; state: DiaryFormState } {
  const date = String(formData.get("date") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim();
  const content = String(formData.get("content") ?? "");

  const fieldErrors: NonNullable<DiaryFormState["fieldErrors"]> = {};

  if (!isValidDateString(date)) {
    fieldErrors.date = "올바른 날짜를 입력해주세요.";
  } else if (date > todayInSeoul()) {
    fieldErrors.date = "미래 날짜에는 일기를 쓸 수 없어요.";
  }
  if (!isCategory(category)) {
    fieldErrors.category = "카테고리를 선택해주세요.";
  }
  const trimmedContent = content.trim();
  if (trimmedContent.length === 0) {
    fieldErrors.content = "본문을 입력해주세요.";
  } else if (trimmedContent.length > CONTENT_MAX_LENGTH) {
    fieldErrors.content = `본문은 최대 ${CONTENT_MAX_LENGTH.toLocaleString("ko-KR")}자까지 입력할 수 있습니다.`;
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      ok: false,
      state: {
        status: "error",
        fieldErrors,
        values: { date, category, content },
      },
    };
  }

  return {
    ok: true,
    fields: {
      date,
      category: category as (typeof CATEGORIES)[number],
      content: trimmedContent,
    },
  };
}

// 폼의 photo_action 값과 업로드된 File을 검사해 3상태(keep/replace/remove) 중 하나로 정규화한다.
// 실패하면 fieldErrors.photo에 들어갈 메시지를 반환.
//
// 폼 상태에서 이미 replace/remove/keep이 배타적으로 정해지므로 서버는 photo_action 값만 신뢰한다.
// remove 체크박스가 함께 전송되어도 photo_action 우선.
//
// `mode`는 create/update 분기를 구분한다.
// - create: "첨부 안 함"이 합법이라 replace인데 파일이 비면 조용히 keep으로 강등.
// - update: replace는 "명시적으로 새 파일을 올린다"는 의사이므로 파일이 비면 즉시 에러.
function parsePhoto(
  formData: FormData,
  mode: "create" | "update",
): { ok: true; photo: ParsedPhoto } | { ok: false; error: string } {
  const rawAction = String(formData.get("photo_action") ?? "keep");
  const action: PhotoAction = (PHOTO_ACTION_VALUES as readonly string[]).includes(
    rawAction,
  )
    ? (rawAction as PhotoAction)
    : "keep";

  if (action !== "replace") {
    return { ok: true, photo: { action } };
  }

  const file = formData.get("photo");
  if (!(file instanceof File) || file.size === 0) {
    if (mode === "update") {
      return { ok: false, error: "사진 파일이 비어있습니다. 다시 선택해주세요." };
    }
    // create: 첨부 없이 저장하는 것도 정상 흐름이므로 keep으로 강등.
    return { ok: true, photo: { action: "keep" } };
  }
  if (file.size > MAX_PHOTO_SIZE) {
    return { ok: false, error: "사진은 5MB 이하여야 합니다." };
  }
  if (!isAllowedPhotoMimeType(file.type)) {
    return {
      ok: false,
      error: `지원하지 않는 파일 형식입니다. (${ALLOWED_PHOTO_MIME_TYPES.join(", ")})`,
    };
  }
  return { ok: true, photo: { action: "replace", file } };
}

// Storage 호출은 admin 클라이언트로 한다.
// 사유: @supabase/ssr + server action 조합에서 user session이 storage 요청에 자동 전파되지
// 않는 이슈를 관찰. 경로는 서버에서 `auth.getUser()` 결과 id로만 조립하므로
// RLS 우회해도 사용자 간 격리는 유지된다.
async function uploadDiaryPhoto(
  userId: string,
  diaryId: string,
  file: File,
): Promise<{ path: string } | { error: string }> {
  const ext = extensionFromMimeType(file.type);
  if (!ext) {
    return { error: "지원하지 않는 파일 형식입니다." };
  }
  const path = buildPhotoPath(userId, diaryId, ext);
  const admin = createAdminClient();
  const { error } = await admin.storage
    .from(DIARY_PHOTOS_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: true });
  if (error) {
    return { error: error.message };
  }
  return { path };
}

// 저장된 일기에 AI 분석 결과를 반영한다. 호출부가 photoWarning과 병렬로 처리할 수 있게
// "분석에 실패했는가"만 boolean으로 돌려준다. 실패는 일기 저장 자체를 무효화하지 않는다.
async function applyAnalysis(
  diaryId: string,
  content: string,
  category: string,
): Promise<{ ok: boolean }> {
  const result = await analyzeDiary(content, category);

  // emotion_emoji와 hashtags를 원자적으로 덮어쓴다. 실패 시에는 null/빈 배열로 리셋해
  // "오래된 분석 결과가 잘못된 본문에 붙어 있는" 상황을 방지한다.
  const supabase = await createClient();
  if (result.ok) {
    const { error } = await supabase
      .from("diaries")
      .update({
        emotion_emoji: result.emotion_emoji,
        hashtags: result.hashtags,
      })
      .eq("id", diaryId);
    if (error) {
      console.error("[analyze] AI 결과 저장 실패", error.message);
      return { ok: false };
    }
    return { ok: true };
  }

  const { error } = await supabase
    .from("diaries")
    .update({ emotion_emoji: null, hashtags: [] })
    .eq("id", diaryId);
  if (error) {
    console.error("[analyze] AI 실패 리셋 실패", error.message);
  }
  return { ok: false };
}

async function removeDiaryPhoto(path: string): Promise<void> {
  // best-effort: 삭제 실패해도 DB 상태와 일치시키는 게 우선이라 조용히 삼키고 로그만.
  const admin = createAdminClient();
  const { error } = await admin.storage
    .from(DIARY_PHOTOS_BUCKET)
    .remove([path]);
  if (error) {
    console.error("[diary-photos] failed to remove object", path, error.message);
  }
}

export async function createDiary(
  _prevState: DiaryFormState,
  formData: FormData,
): Promise<DiaryFormState> {
  const parsed = parseFields(formData);
  if (!parsed.ok) return parsed.state;

  const photoParsed = parsePhoto(formData, "create");
  if (!photoParsed.ok) {
    return {
      status: "error",
      fieldErrors: { photo: photoParsed.error },
      values: parsed.fields,
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/diaries/new");
  }

  const { data, error } = await supabase
    .from("diaries")
    .insert({
      user_id: user.id,
      date: parsed.fields.date,
      category: parsed.fields.category,
      content: parsed.fields.content,
    })
    .select("id")
    .single();

  if (error || !data) {
    return {
      status: "error",
      message: error?.message ?? "일기 저장에 실패했습니다.",
      values: parsed.fields,
    };
  }

  let photoWarning: string | null = null;
  if (photoParsed.photo.action === "replace") {
    const uploaded = await uploadDiaryPhoto(
      user.id,
      data.id,
      photoParsed.photo.file,
    );
    if ("error" in uploaded) {
      // 본문은 이미 저장됐으므로 롤백하지 않는다. 사용자가 편집에서 재시도하도록 안내만.
      console.error("[diary-photos] upload failed on create", uploaded.error);
      photoWarning = "photo_upload_failed";
    } else {
      const { error: updateError } = await supabase
        .from("diaries")
        .update({ photo_path: uploaded.path })
        .eq("id", data.id);
      if (updateError) {
        console.error(
          "[diary-photos] photo_path update failed",
          updateError.message,
        );
        // 업로드는 성공했지만 DB 동기화만 실패. 이 경우 orphan이 생기므로 Storage에서도 정리.
        await removeDiaryPhoto(uploaded.path);
        photoWarning = "photo_upload_failed";
      }
    }
  }

  // AI 분석은 동기 호출. Gemini Flash가 1~3초 내 응답하므로 폼 pending 상태로 충분히 덮인다.
  const analysis = await applyAnalysis(
    data.id,
    parsed.fields.content,
    parsed.fields.category,
  );

  revalidatePath("/diaries");
  // 새로 만든 상세 경로는 아직 캐시에 없어 사실상 no-op이지만, update/reanalyze와 일관성을 맞춘다.
  revalidatePath(`/diaries/${data.id}`);
  // photoWarning과 analysis_failed 둘 다 발생 가능하지만 쿼리는 하나만 실어 보낸다.
  // 사진 실패가 사용자 행동(재첨부)을 유도하므로 더 시급하다고 판단해 우선 노출.
  const notice = photoWarning ?? (analysis.ok ? null : "analysis_failed");
  const redirectUrl = notice
    ? `/diaries/${data.id}?notice=${notice}`
    : `/diaries/${data.id}`;
  redirect(redirectUrl);
}

export async function updateDiary(
  id: string,
  _prevState: DiaryFormState,
  formData: FormData,
): Promise<DiaryFormState> {
  const parsed = parseFields(formData);
  if (!parsed.ok) return parsed.state;

  const photoParsed = parsePhoto(formData, "update");
  if (!photoParsed.ok) {
    return {
      status: "error",
      fieldErrors: { photo: photoParsed.error },
      values: parsed.fields,
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=/diaries/${id}/edit`);
  }

  // 기존 photo_path를 알아야 "확장자 변경 시 이전 객체 삭제"와 "제거" 처리 경로를 결정할 수 있다.
  // content/category도 함께 읽어 본문·카테고리 변경 여부로 재분석 조건을 결정한다.
  const { data: existing, error: loadError } = await supabase
    .from("diaries")
    .select("id,user_id,photo_path,content,category")
    .eq("id", id)
    .maybeSingle();

  if (loadError) {
    return {
      status: "error",
      message: loadError.message,
      values: parsed.fields,
    };
  }
  if (!existing || existing.user_id !== user.id) {
    return {
      status: "error",
      message: "수정 권한이 없거나 일기를 찾을 수 없습니다.",
      values: parsed.fields,
    };
  }

  // RLS가 1차 방어. 업데이트 결과 row가 0건이면 권한 없거나 id가 틀린 것으로 간주.
  const { data: updated, error: updateError } = await supabase
    .from("diaries")
    .update({
      date: parsed.fields.date,
      category: parsed.fields.category,
      content: parsed.fields.content,
    })
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (updateError) {
    return {
      status: "error",
      message: updateError.message,
      values: parsed.fields,
    };
  }

  if (!updated) {
    return {
      status: "error",
      message: "수정 권한이 없거나 일기를 찾을 수 없습니다.",
      values: parsed.fields,
    };
  }

  let photoWarning: string | null = null;
  if (photoParsed.photo.action === "remove" && existing.photo_path) {
    // DB를 먼저 비워야 "DB는 존재하지 않는 경로를 가리키는" 상태를 피할 수 있다.
    // Storage 삭제는 best-effort — 실패해도 orphan 파일만 남고 사용자 경험은 정상.
    const { error: clearError } = await supabase
      .from("diaries")
      .update({ photo_path: null })
      .eq("id", id);
    if (clearError) {
      // DB 업데이트 실패 시 Storage는 건드리지 않는다. DB/Storage 모두 이전 상태 유지.
      console.error("[diary-photos] clearing photo_path failed", clearError.message);
      photoWarning = "photo_update_failed";
    } else {
      await removeDiaryPhoto(existing.photo_path);
    }
  } else if (photoParsed.photo.action === "replace") {
    const uploaded = await uploadDiaryPhoto(
      user.id,
      id,
      photoParsed.photo.file,
    );
    if ("error" in uploaded) {
      console.error("[diary-photos] upload failed on update", uploaded.error);
      photoWarning = "photo_update_failed";
    } else {
      // 새 파일 업로드 → DB 경로 업데이트까지 성공해야만 이전 파일을 정리한다.
      // 이 순서를 지키지 않으면 DB update가 실패했을 때 이전 파일이 이미 사라져
      // 사용자가 상세 페이지에서 404를 보게 된다.
      const { error: pathError } = await supabase
        .from("diaries")
        .update({ photo_path: uploaded.path })
        .eq("id", id);
      if (pathError) {
        console.error(
          "[diary-photos] photo_path update failed",
          pathError.message,
        );
        // DB가 이전 경로를 여전히 가리키므로 방금 올린 새 파일만 정리한다.
        // 이전 파일은 절대 건드리지 않는다 — DB와 Storage가 이전 상태로 일관.
        await removeDiaryPhoto(uploaded.path);
        photoWarning = "photo_update_failed";
      } else if (existing.photo_path && existing.photo_path !== uploaded.path) {
        // 확장자가 바뀌면 이전 경로에 orphan이 남는다. upsert: true는 같은 경로만 덮어쓴다.
        // best-effort — 실패해도 DB는 이미 새 경로를 가리키므로 사용자 영향 없음(orphan만 잔류).
        await removeDiaryPhoto(existing.photo_path);
      }
    }
  }

  // 본문이나 카테고리가 바뀐 경우에만 재분석한다. 사진만 바꾼 경우 Gemini 호출을 낭비하지 않는다.
  // 카테고리가 바뀌면 맥락이 바뀌어 감정/해시태그도 갱신되어야 한다.
  let analysisWarning: string | null = null;
  if (
    existing.content !== parsed.fields.content ||
    existing.category !== parsed.fields.category
  ) {
    const analysis = await applyAnalysis(
      id,
      parsed.fields.content,
      parsed.fields.category,
    );
    if (!analysis.ok) {
      analysisWarning = "analysis_failed";
    }
  }

  revalidatePath("/diaries");
  revalidatePath(`/diaries/${id}`);
  const notice = photoWarning ?? analysisWarning;
  const redirectUrl = notice
    ? `/diaries/${id}?notice=${notice}`
    : `/diaries/${id}`;
  redirect(redirectUrl);
}

export async function deleteDiary(id: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=/diaries/${id}`);
  }

  // 삭제 전 photo_path를 읽어 두어야 Storage에서도 정리할 수 있다.
  // 실패해도 DB 삭제는 진행(Storage orphan 용인). 로그만 남긴다.
  const { data: existing, error: loadError } = await supabase
    .from("diaries")
    .select("photo_path")
    .eq("id", id)
    .maybeSingle();

  if (loadError) {
    console.error("[deleteDiary] photo_path 로드 실패", loadError);
  }

  // delete는 매칭 row가 0이어도 error가 null이다. .select로 실제 삭제된 id를 확인해야
  // "RLS에 막혔거나 이미 없는 id"를 감지할 수 있다.
  const { data, error } = await supabase
    .from("diaries")
    .delete()
    .eq("id", id)
    .select("id");

  if (error) {
    redirect(`/diaries/${id}?error=delete_failed`);
  }

  if (!data || data.length === 0) {
    // 타인의 id 존재 여부를 유출하지 않기 위해 "권한 없음/부재"를 구분하지 않는다.
    redirect(`/diaries/${id}?error=forbidden_or_missing`);
  }

  // best-effort. Storage 실패가 DB 삭제 성공을 무효화하지 않도록 독립적으로 처리.
  if (existing?.photo_path) {
    await removeDiaryPhoto(existing.photo_path);
  }

  revalidatePath("/diaries");
  redirect("/diaries");
}

// 상세 페이지 "재분석" 버튼에서 호출. 본인 일기에 한해 Gemini를 재호출한다.
// RLS가 1차 방어지만, service_role을 쓰는 코드 경로가 아니더라도 앱단에서 user_id 확인한다.
export async function reanalyzeDiary(id: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=/diaries/${id}`);
  }

  const { data: diary, error } = await supabase
    .from("diaries")
    .select("id,user_id,content,category")
    .eq("id", id)
    .maybeSingle();

  // 소유자가 아닌 경우와 분석 실패를 같은 notice로 수렴시켜 id 존재 여부 유출을 막는다.
  if (error || !diary || diary.user_id !== user.id) {
    redirect(`/diaries/${id}?notice=analysis_failed`);
  }

  const analysis = await applyAnalysis(diary.id, diary.content, diary.category);

  revalidatePath("/diaries");
  revalidatePath(`/diaries/${id}`);
  redirect(analysis.ok ? `/diaries/${id}` : `/diaries/${id}?notice=analysis_failed`);
}

// 일기 상세의 "공유 대상 관리"에서 호출. 소유자가 이메일을 등록하면 해당 이메일로
// 로그인한 사용자가 diaries SELECT 정책을 통해 읽기 가능해진다.
// RLS가 1차 방어(소유자만 insert 가능). 앱단 검증은 UX용 — 잘못된 이메일/본인 이메일/중복을
// 명확한 에러 메시지로 돌려준다.
export async function addShare(
  diaryId: string,
  _prevState: ShareFormState,
  formData: FormData,
): Promise<ShareFormState> {
  const rawEmail = String(formData.get("email") ?? "").trim().toLowerCase();

  if (!rawEmail) {
    return { status: "error", message: "이메일을 입력해주세요." };
  }
  if (!EMAIL_PATTERN.test(rawEmail)) {
    return { status: "error", message: "올바른 이메일 형식이 아닙니다." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=/diaries/${diaryId}`);
  }

  if (user.email && user.email.toLowerCase() === rawEmail) {
    return {
      status: "error",
      message: "본인 이메일은 추가할 필요가 없어요.",
    };
  }

  // 소유자 선제 확인. RLS insert 정책이 최종 방어막이지만,
  // 권한 없을 때 unique-violation 대신 명확한 메시지를 주려고 한 단계 더 본다.
  const { data: diary, error: loadError } = await supabase
    .from("diaries")
    .select("id,user_id")
    .eq("id", diaryId)
    .maybeSingle();

  if (loadError) {
    return { status: "error", message: loadError.message };
  }
  if (!diary || diary.user_id !== user.id) {
    return {
      status: "error",
      message: "공유 권한이 없거나 일기를 찾을 수 없습니다.",
    };
  }

  const { error: insertError } = await supabase.from("diary_shares").insert({
    diary_id: diaryId,
    shared_with_email: rawEmail,
    invited_by: user.id,
  });

  if (insertError) {
    // unique(diary_id, shared_with_email) 충돌은 "이미 공유되어 있음"이므로 성공으로 수렴.
    // 상세 페이지 revalidate로 목록이 정확히 갱신되기만 하면 UX상 재추가 시도도 문제 없다.
    if (insertError.code !== UNIQUE_VIOLATION_CODE) {
      return { status: "error", message: insertError.message };
    }
  }

  revalidatePath(`/diaries/${diaryId}`);
  return { status: "success", message: "공유 목록에 추가했어요." };
}

// 소유자가 공유 항목을 제거. RLS delete 정책이 소유자만 허용하지만,
// "권한 없음" vs "이미 지워짐"을 구분하지 않고 조용히 revalidate만 한다(id 유출 방지).
export async function removeShare(
  diaryId: string,
  shareId: string,
): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=/diaries/${diaryId}`);
  }

  const { error } = await supabase
    .from("diary_shares")
    .delete()
    .eq("id", shareId)
    .eq("diary_id", diaryId);

  if (error) {
    console.error("[diary_shares] delete failed", error.message);
  }

  revalidatePath(`/diaries/${diaryId}`);
}
