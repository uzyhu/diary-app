import { Suspense } from "react";

import { ThemeToggle } from "@/components/theme-toggle";

import { LoginForm } from "./login-form";

export const metadata = {
  title: "로그인 · AI 일기장",
};

export default function LoginPage() {
  return (
    <main className="relative flex flex-1 items-center justify-center px-4 py-12 sm:px-6 sm:py-16">
      {/* 공개 페이지에는 전역 헤더가 없으므로 우측 상단에 고정 배치한다. */}
      <ThemeToggle className="fixed top-3 right-3 z-50 sm:top-4 sm:right-4" />
      <div className="w-full max-w-sm space-y-6">
        <header className="space-y-2 text-center">
          <h1 className="font-display text-3xl tracking-tight sm:text-4xl">
            로그인
          </h1>
          <p className="text-sm text-muted-foreground">
            이메일로 매직링크를 보내드립니다. 받은 링크를 누르면 로그인이
            완료됩니다.
          </p>
        </header>
        <Suspense fallback={null}>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}
