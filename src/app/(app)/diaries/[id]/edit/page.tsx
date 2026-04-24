import { notFound } from "next/navigation";

import { DiaryForm } from "@/components/diary-form";
import { updateDiary } from "@/app/(app)/diaries/actions";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { DIARY_PHOTOS_BUCKET } from "@/lib/storage";

export const metadata = {
  title: "일기 수정 · AI 일기장",
};

type Params = Promise<{ id: string }>;

// 편집 화면 체류 시간을 덮는 signed URL TTL.
const PHOTO_SIGNED_URL_TTL_SECONDS = 60 * 60;

export default async function EditDiaryPage({ params }: { params: Params }) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 본인 일기만 수정 가능. 공유받은 일기는 RLS select는 통과해도 UI에서 수정 진입을 막는다.
  const { data: diary } = await supabase
    .from("diaries")
    .select("id,user_id,date,category,content,photo_path")
    .eq("id", id)
    .maybeSingle();

  if (!diary || !user || diary.user_id !== user.id) {
    // 권한 없음과 부재를 의도적으로 구분하지 않음 — 타인의 id 존재 여부 유출 방지.
    notFound();
  }

  let initialPhotoUrl: string | undefined;
  if (diary.photo_path) {
    const admin = createAdminClient();
    const { data: signed, error: signError } = await admin.storage
      .from(DIARY_PHOTOS_BUCKET)
      .createSignedUrl(diary.photo_path, PHOTO_SIGNED_URL_TTL_SECONDS);
    if (signError) {
      console.error(
        "[diary-photos] failed to create signed url for edit",
        signError.message,
      );
    } else {
      initialPhotoUrl = signed.signedUrl;
    }
  }

  const boundUpdate = updateDiary.bind(null, diary.id);

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8 sm:px-6 sm:py-10">
      <header className="mb-6 space-y-1">
        <h1 className="font-display text-3xl tracking-tight sm:text-4xl">
          일기 수정
        </h1>
      </header>
      <DiaryForm
        action={boundUpdate}
        submitLabel="수정 저장"
        pendingLabel="저장 중..."
        cancelHref={`/diaries/${diary.id}`}
        initialValues={{
          date: diary.date,
          category: diary.category,
          content: diary.content,
        }}
        initialPhotoUrl={initialPhotoUrl}
      />
    </main>
  );
}
