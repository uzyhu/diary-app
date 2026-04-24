import Link from "next/link";

import { CategoryBadge } from "@/components/category-badge";
import type { DiaryRow } from "@/types/database.types";

const CONTENT_PREVIEW_MAX = 120;

function formatDate(isoDate: string): string {
  // `YYYY-MM-DD` 포맷을 한국 로케일로 표기. Date 파싱을 피하려고 수동 포매팅.
  const [year, month, day] = isoDate.split("-");
  return `${year}년 ${Number(month)}월 ${Number(day)}일`;
}

function truncate(text: string): string {
  const normalized = text.trim();
  if (normalized.length <= CONTENT_PREVIEW_MAX) {
    return normalized;
  }
  return `${normalized.slice(0, CONTENT_PREVIEW_MAX)}...`;
}

type DiaryCardProps = {
  diary: Pick<
    DiaryRow,
    | "id"
    | "date"
    | "category"
    | "content"
    | "emotion_emoji"
    | "hashtags"
    | "photo_path"
  >;
  // 공유받은 일기 탭에서 "공유받음" 배지를 붙이는 용도. 기본 false.
  sharedBadge?: boolean;
};

export function DiaryCard({ diary, sharedBadge = false }: DiaryCardProps) {
  const hasPhoto = Boolean(diary.photo_path);

  return (
    <Link
      href={`/diaries/${diary.id}`}
      className="block rounded-sm border border-border bg-card p-4 shadow-sm transition-all hover:border-ring hover:bg-muted/40 hover:shadow-md"
    >
      <div className="mb-2 flex items-center gap-2">
        {diary.emotion_emoji ? (
          <span aria-label="감정 이모지" className="text-2xl leading-none">
            {diary.emotion_emoji}
          </span>
        ) : null}
        <span className="font-display text-lg leading-none">
          {formatDate(diary.date)}
        </span>
        <CategoryBadge category={diary.category} />
        {hasPhoto ? (
          <span
            aria-label="사진 첨부됨"
            title="사진 첨부됨"
            className="text-sm text-muted-foreground"
          >
            📎
          </span>
        ) : null}
        {sharedBadge ? (
          <span className="font-display ml-auto border border-border bg-transparent px-2 py-0.5 text-xs text-muted-foreground">
            공유받음
          </span>
        ) : null}
      </div>

      <p className="text-sm text-muted-foreground whitespace-pre-wrap break-words">
        {truncate(diary.content)}
      </p>

      {diary.hashtags.length > 0 ? (
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {diary.hashtags.map((tag) => (
            <li
              key={tag}
              className="font-display border border-border bg-transparent px-2 py-0.5 text-xs text-foreground"
            >
              {tag}
            </li>
          ))}
        </ul>
      ) : null}
    </Link>
  );
}
