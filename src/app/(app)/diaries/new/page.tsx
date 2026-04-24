import { DiaryForm } from "@/components/diary-form";
import { createDiary } from "@/app/(app)/diaries/actions";

export const metadata = {
  title: "새 일기 · AI 일기장",
};

export default function NewDiaryPage() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8 sm:px-6 sm:py-10">
      <header className="mb-6 space-y-1">
        <h1 className="font-display text-3xl tracking-tight sm:text-4xl">
          새 일기 쓰기
        </h1>
        <p className="text-sm text-muted-foreground">
          오늘의 기록을 남겨보세요.
        </p>
      </header>
      <DiaryForm
        action={createDiary}
        submitLabel="저장하기"
        pendingLabel="저장 중..."
        cancelHref="/diaries"
      />
    </main>
  );
}
