"use client";

import { useActionState, useEffect, useRef, useTransition } from "react";

import { addShare, removeShare } from "@/app/(app)/diaries/actions";
import {
  INITIAL_SHARE_STATE,
  type ShareFormState,
} from "@/app/(app)/diaries/form-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type ShareItem = {
  id: string;
  shared_with_email: string;
};

type ShareManagerProps = {
  diaryId: string;
  shares: ShareItem[];
};

export function ShareManager({ diaryId, shares }: ShareManagerProps) {
  // diaryId를 고정한 바인딩 액션. useActionState의 시그니처에 맞추기 위해 얇게 감싼다.
  const addAction = async (
    prevState: ShareFormState,
    formData: FormData,
  ): Promise<ShareFormState> => {
    return addShare(diaryId, prevState, formData);
  };

  const [state, formAction, isPending] = useActionState(
    addAction,
    INITIAL_SHARE_STATE,
  );
  const formRef = useRef<HTMLFormElement>(null);

  // 성공 시 입력 필드를 비워준다. 에러면 입력을 남겨 재시도 비용을 줄인다.
  useEffect(() => {
    if (state.status === "success") {
      formRef.current?.reset();
    }
  }, [state]);

  return (
    <section
      aria-labelledby="share-manager-heading"
      className="rounded-sm border border-border/80 bg-card p-5"
    >
      <h2
        id="share-manager-heading"
        className="font-display text-xl tracking-wide"
      >
        공유 대상 관리
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">
        초대한 이메일로 로그인한 사용자가 이 일기를 읽기 전용으로 볼 수 있어요.
      </p>

      <form
        ref={formRef}
        action={formAction}
        className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-end"
      >
        <div className="flex-1 space-y-1">
          <Label htmlFor="share-email" className="text-xs">
            이메일
          </Label>
          <Input
            id="share-email"
            name="email"
            type="email"
            autoComplete="off"
            placeholder="friend@example.com"
            required
            aria-invalid={state.status === "error" ? true : undefined}
          />
        </div>
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? "추가 중..." : "추가"}
        </Button>
      </form>

      {state.message ? (
        <p
          role={state.status === "error" ? "alert" : "status"}
          className={
            state.status === "error"
              ? "mt-2 text-xs text-destructive"
              : "mt-2 text-xs text-muted-foreground"
          }
        >
          {state.message}
        </p>
      ) : null}

      <div className="mt-5">
        {shares.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            아직 공유한 사람이 없어요.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {shares.map((share) => (
              <li
                key={share.id}
                className="flex items-center justify-between gap-3 rounded-md border border-border/60 bg-background px-3 py-2"
              >
                <span className="truncate text-sm" title={share.shared_with_email}>
                  {share.shared_with_email}
                </span>
                <RemoveShareButton diaryId={diaryId} shareId={share.id} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

type RemoveShareButtonProps = {
  diaryId: string;
  shareId: string;
};

function RemoveShareButton({ diaryId, shareId }: RemoveShareButtonProps) {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      await removeShare(diaryId, shareId);
    });
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="xs"
      onClick={handleClick}
      disabled={isPending}
    >
      {isPending ? "제거 중..." : "제거"}
    </Button>
  );
}
