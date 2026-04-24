// DB의 check 제약(supabase/migrations/0001_init.sql)과 반드시 일치해야 한다.
// 값이 바뀌면 migration도 함께 수정할 것.
export const CATEGORIES = ["일상", "운동", "여행", "업무", "감정", "기타"] as const;

export type Category = (typeof CATEGORIES)[number];

export function isCategory(value: unknown): value is Category {
  return (
    typeof value === "string" && (CATEGORIES as readonly string[]).includes(value)
  );
}
