"use client";

import { RefreshCcw } from "lucide-react";
import { useTransition } from "react";

import { Button } from "@/components/ui/button";
import { reanalyzeDiary } from "@/app/(app)/diaries/actions";

type ReanalyzeButtonProps = {
  diaryId: string;
};

export function ReanalyzeButton({ diaryId }: ReanalyzeButtonProps) {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      await reanalyzeDiary(diaryId);
    });
  }

  const label = isPending ? "분석 중..." : "재분석";

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={handleClick}
      disabled={isPending}
      aria-label={label}
      title={label}
    >
      <RefreshCcw aria-hidden="true" />
      <span className="hidden sm:inline">{label}</span>
    </Button>
  );
}
