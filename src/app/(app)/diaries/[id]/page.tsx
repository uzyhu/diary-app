import { Pencil } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { CategoryBadge } from "@/components/category-badge";
import { buttonVariants } from "@/components/ui/button";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { DIARY_PHOTOS_BUCKET } from "@/lib/storage";

import { DeleteButton } from "./delete-button";
import { ReanalyzeButton } from "./reanalyze-button";
import { ShareManager } from "./share-manager";

export const metadata = {
  title: "일기 · AI 일기장",
};

type Params = Promise<{ id: string }>;
type SearchParams = Promise<{
  error?: string | string[];
  notice?: string | string[];
}>;

// Next.js는 쿼리 파라미터가 중복되면 배열을 넘긴다(예: ?error=a&error=b).
// switch로 분기하기 전에 단일 문자열로 좁혀 사용 지점에서 타입 고민을 없앤다.
function firstValue(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" ? value : undefined;
}

// signed URL 만료. 상세 페이지 체류 시간을 넉넉히 덮는 값으로 1시간.
const PHOTO_SIGNED_URL_TTL_SECONDS = 60 * 60;

const WEEKDAYS_KO = ["일", "월", "화", "수", "목", "금", "토"] as const;

type DiaryDateParts = {
  year: string;
  month: number;
  day: number;
  weekday: string;
};

function parseDiaryDate(isoDate: string): DiaryDateParts {
  const [year, month, day] = isoDate.split("-");
  // Date 생성자에 ISO 문자열을 직접 넣으면 UTC로 해석돼 타임존에 따라 요일이 하루씩 밀릴 수 있다.
  // 숫자 인자로 주면 로컬 타임존 기준으로 해석되어 "일기 날짜 == 표시 요일" 불변식이 지켜진다.
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  return {
    year,
    month: Number(month),
    day: Number(day),
    weekday: WEEKDAYS_KO[date.getDay()],
  };
}

function errorMessage(code: string | undefined): string | null {
  switch (code) {
    case "delete_failed":
      return "삭제 중 오류가 발생했어요. 잠시 후 다시 시도해주세요.";
    case "forbidden_or_missing":
      return "삭제할 수 없는 일기입니다.";
    default:
      return null;
  }
}

// 모든 notice 문구는 "사진 편집" / "재분석" 같이 소유자만 수행 가능한 액션을 전제로 한다.
// 비소유자에게 보이면 수정/재분석 버튼이 없어 안내가 모순된다(QA M2).
// 소유자 여부를 받아 비소유자에게는 아무 notice도 보여주지 않는다.
function noticeMessage(
  code: string | undefined,
  isOwner: boolean,
): string | null {
  if (!isOwner) return null;
  switch (code) {
    case "photo_upload_failed":
      return "일기는 저장됐지만 사진 업로드에 실패했어요. 편집에서 다시 시도해주세요.";
    case "photo_update_failed":
      return "일기는 저장됐지만 사진 변경에 실패했어요. 편집에서 다시 시도해주세요.";
    case "analysis_failed":
      return "AI 분석에 실패했어요. 아래 '재분석' 버튼을 눌러주세요.";
    default:
      return null;
  }
}

export default async function DiaryDetailPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const { id } = await params;
  const { error: rawError, notice: rawNotice } = await searchParams;
  const errorCode = firstValue(rawError);
  const noticeCode = firstValue(rawNotice);
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // RLS가 본인 + 공유받은 일기만 돌려준다. 권한 없으면 null.
  const { data: diary } = await supabase
    .from("diaries")
    .select(
      "id,user_id,date,category,content,emotion_emoji,hashtags,photo_path",
    )
    .eq("id", id)
    .maybeSingle();

  if (!diary) {
    // 권한 없음과 부재를 의도적으로 구분하지 않음 — 타인의 id 존재 여부 유출 방지.
    notFound();
  }

  const isOwner = user?.id === diary.user_id;
  const deleteError = errorMessage(errorCode);
  const notice = noticeMessage(noticeCode, isOwner);
  const dateParts = parseDiaryDate(diary.date);

  // 공유 목록은 소유자에게만 필요. diary_shares의 select 정책은 invited_by = auth.uid()
  // 또는 shared_with_email = auth.email()만 허용하므로, 소유자가 아닌 경로에서 쿼리해도
  // 결과만 비는 게 정상이지만 불필요한 왕복을 피하기 위해 조건부로 호출한다.
  let shares: Array<{ id: string; shared_with_email: string }> = [];
  if (isOwner) {
    const { data: sharesData, error: sharesError } = await supabase
      .from("diary_shares")
      .select("id, shared_with_email")
      .eq("diary_id", diary.id)
      .order("created_at", { ascending: true });
    if (sharesError) {
      console.error("[diary_shares] list failed", sharesError.message);
    } else if (sharesData) {
      shares = sharesData;
    }
  }

  // Storage SELECT 정책이 없으므로 이미지를 보여주려면 서버에서 signed URL을 발급해야 한다.
  // 공유받은 사용자도 이 서버 렌더링 경로를 통해서만 이미지에 접근하게 된다.
  // admin 클라이언트로 발급 — user session 전파 이슈를 우회하고 권한은 상위에서 보장.
  let photoUrl: string | null = null;
  if (diary.photo_path) {
    const admin = createAdminClient();
    const { data: signed, error: signError } = await admin.storage
      .from(DIARY_PHOTOS_BUCKET)
      .createSignedUrl(diary.photo_path, PHOTO_SIGNED_URL_TTL_SECONDS);
    if (signError) {
      console.error(
        "[diary-photos] failed to create signed url",
        signError.message,
      );
    } else {
      photoUrl = signed.signedUrl;
    }
  }

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10 sm:px-6">
      {/* 상단 네비게이션: 목록 링크 + (소유자 한정) 액션 버튼 묶음.
          참조 이미지엔 버튼이 없지만 기능 유지 원칙상 남긴다. */}
      <nav className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/diaries"
          className="text-sm text-muted-foreground hover:underline"
        >
          ← 목록으로
        </Link>
        {isOwner ? (
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            <ReanalyzeButton diaryId={diary.id} />
            <Link
              href={`/diaries/${diary.id}/edit`}
              aria-label="수정"
              title="수정"
              className={`${buttonVariants({ variant: "outline", size: "sm" })} border-foreground/40 bg-card text-foreground no-underline`}
            >
              <Pencil aria-hidden="true" />
              <span className="hidden sm:inline">수정</span>
            </Link>
            <DeleteButton diaryId={diary.id} />
          </div>
        ) : null}
      </nav>

      {/* 메타 줄: "5월 6일 (월)" + 감정 이모지 + 카테고리 배지.
          - 참조 이미지(초등 일기장/4컷 만화)의 "헤더 한 줄" 감각을 위해 박스/DIARY 라벨 제거.
          - 한 줄 flex, 모바일에서 자연스럽게 아래로 wrap.
          - 아래 얇은 구분선으로 섹션 경계를 만든다. */}
      <header className="mb-5">
        <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
          <h1 className="font-display text-3xl leading-none tracking-wide sm:text-4xl">
            {dateParts.month}월 {dateParts.day}일
            <span className="ml-2 text-xl text-muted-foreground sm:text-2xl">
              ({dateParts.weekday})
            </span>
          </h1>

          <div className="flex items-center gap-3">
            {diary.emotion_emoji ? (
              <span
                aria-label="감정 이모지"
                className="text-2xl leading-none sm:text-3xl"
              >
                {diary.emotion_emoji}
              </span>
            ) : null}
            {/* 상세 페이지는 목록보다 조금 크게(text-sm + 여유 padding).
                색/테두리/radius는 CategoryBadge 기본 스타일(빈티지 earthy)을 그대로 따른다. */}
            <CategoryBadge
              category={diary.category}
              className="px-2.5 py-1 text-sm rounded-full"
            />
          </div>
        </div>
        {/* 참조 이미지에서 날짜 줄 아래 얇은 구분선 존재 → 동일하게. */}
        <hr className="mt-3 border-foreground/40" />
      </header>

      {deleteError ? (
        <section
          role="alert"
          className="border-destructive/60 bg-destructive/5 text-destructive mb-4 border-2 p-3 text-sm"
        >
          {deleteError}
        </section>
      ) : null}

      {notice ? (
        <section
          role="status"
          className="mb-4 border-2 border-amber-600/50 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-300"
        >
          {notice}
        </section>
      ) : null}

      {/* 사진 박스 — 폴라로이드 스타일 (사용자 요청으로 복구).
          - 흰 프레임(p-3 pb-10) + 아래쪽 여백이 넓은 폴라로이드 실루엣.
          - 약한 회전(-1deg)과 shadow-md로 "책상 위에 놓인 사진" 느낌.
          - aspect-auto + max-h-[60vh] + object-contain 으로 원본 비율 유지.
            → 플로우차트 같은 세로 긴 이미지도 잘리지 않고 자연스럽게 축소.
          - 다크 모드에선 완전한 흰색 대신 따뜻한 크림색(oklch)으로 톤 다운. */}
      {photoUrl ? (
        <figure className="mx-auto mb-8 w-fit max-w-full -rotate-[1deg] bg-white p-3 pb-10 shadow-md dark:bg-[oklch(0.92_0.04_85)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photoUrl}
            alt="첨부 사진"
            className="block h-auto max-h-[60vh] w-auto max-w-full object-contain"
          />
        </figure>
      ) : null}

      {/* 본문 줄노트 — 사진 아래.
          - 박스 테두리 제거. 대신 내부 텍스트 요소에 `notepaper-text` 배경을 직접 얹어
            본문이 실제로 차지하는 라인만큼만 줄이 그려지게 한다 (빈 공간엔 줄 없음).
          - leading-7(= 1.75rem)과 notepaper-text의 줄 간격이 정확히 일치해야 글자가
            줄 위에 얹힌다. 패딩은 상하 제거(상단 텍스트가 첫 줄에 정렬되도록).
          - 좌우 여백은 바깥 main에 이미 있으므로 본문은 추가 좌우 패딩 없음.
          - whitespace-pre-wrap으로 작성 시 줄바꿈 보존. */}
      <article className="mb-2">
        <div className="notepaper-text text-foreground break-words whitespace-pre-wrap text-base leading-7">
          {diary.content}
        </div>
      </article>

      {diary.hashtags.length > 0 ? (
        <section aria-labelledby="tags-heading" className="mt-4 sm:mt-6">
          <h2 id="tags-heading" className="sr-only">
            해시태그
          </h2>
          <div className="flex flex-wrap items-center gap-1.5">
            <span aria-hidden="true" className="text-base leading-none">
              🏷
            </span>
            <ul className="flex flex-wrap gap-1.5">
              {diary.hashtags.map((tag) => (
                <li
                  key={tag}
                  className="font-display border-foreground/60 text-foreground border bg-transparent px-2 py-0.5 text-sm"
                >
                  {tag}
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}

      {/* 공유 섹션: ShareManager 내부에 "공유 대상 관리" 타이틀이 이미 있어
          외부 "📮 공유" 라벨은 중복이라 제거. 섹션 위 여백도 mt-6로 컴팩트하게. */}
      {isOwner ? (
        <div className="mt-6">
          <ShareManager diaryId={diary.id} shares={shares} />
        </div>
      ) : null}
    </main>
  );
}
