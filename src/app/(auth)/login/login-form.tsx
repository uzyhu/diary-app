"use client";

import { useSearchParams } from "next/navigation";
import { useState, type SyntheticEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { sanitizeNext } from "@/lib/auth-redirect";
import { createClient } from "@/lib/supabase/client";

type Status = "idle" | "sending" | "sent" | "error";

const CALLBACK_ERROR_MESSAGES: Record<string, string> = {
  missing_code: "로그인 링크가 유효하지 않습니다. 다시 보내주세요.",
  exchange_failed:
    "로그인 링크가 만료되었거나 이미 사용되었습니다. 다시 보내주세요.",
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function LoginForm() {
  const searchParams = useSearchParams();
  const next = sanitizeNext(searchParams.get("next"));
  const callbackError = searchParams.get("error");

  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(
    callbackError ? (CALLBACK_ERROR_MESSAGES[callbackError] ?? null) : null,
  );

  async function handleSubmit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmed = email.trim();
    if (!EMAIL_PATTERN.test(trimmed)) {
      setStatus("error");
      setErrorMessage("올바른 이메일 주소를 입력해주세요.");
      return;
    }

    setStatus("sending");
    setErrorMessage(null);

    const supabase = createClient();
    const redirectTo = new URL("/auth/callback", window.location.origin);
    redirectTo.searchParams.set("next", next);

    const { error } = await supabase.auth.signInWithOtp({
      email: trimmed,
      options: { emailRedirectTo: redirectTo.toString() },
    });

    if (error) {
      setStatus("error");
      setErrorMessage(error.message);
      return;
    }

    setStatus("sent");
  }

  if (status === "sent") {
    return (
      <div className="rounded-lg border border-border bg-muted/40 p-4 text-sm">
        <p className="font-medium">메일함을 확인하세요</p>
        <p className="mt-1 text-muted-foreground">
          <strong>{email.trim()}</strong>로 로그인 링크를 보냈습니다. 링크를
          누르면 이 페이지로 돌아오지 않고 앱으로 이동합니다.
        </p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="mt-3"
          onClick={() => {
            setStatus("idle");
            setEmail("");
          }}
        >
          다른 이메일로 다시 보내기
        </Button>
      </div>
    );
  }

  const isSending = status === "sending";
  const isSubmitDisabled = isSending || email.trim().length === 0;

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="space-y-2">
        <Label htmlFor="email">이메일</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          placeholder="you@example.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          disabled={isSending}
        />
      </div>

      <div
        role="status"
        aria-live="polite"
        className="min-h-5 text-sm text-destructive"
      >
        {errorMessage}
      </div>

      <Button
        type="submit"
        size="lg"
        className="w-full"
        disabled={isSubmitDisabled}
      >
        {isSending ? "전송 중..." : "매직링크 보내기"}
      </Button>
    </form>
  );
}
