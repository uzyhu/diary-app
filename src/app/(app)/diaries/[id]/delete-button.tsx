"use client";

import { Trash2 } from "lucide-react";
import { useTransition } from "react";

import { Button } from "@/components/ui/button";
import { deleteDiary } from "@/app/(app)/diaries/actions";

type DeleteButtonProps = {
  diaryId: string;
};

export function DeleteButton({ diaryId }: DeleteButtonProps) {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    const confirmed = window.confirm(
      "이 일기를 삭제할까요? 되돌릴 수 없습니다.",
    );
    if (!confirmed) return;

    startTransition(async () => {
      await deleteDiary(diaryId);
    });
  }

  const label = isPending ? "삭제 중..." : "삭제";

  return (
    <Button
      type="button"
      variant="destructive"
      size="sm"
      onClick={handleClick}
      disabled={isPending}
      aria-label={label}
      title={label}
    >
      <Trash2 aria-hidden="true" />
      <span className="hidden sm:inline">{label}</span>
    </Button>
  );
}
