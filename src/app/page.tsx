import Link from "next/link";
import { redirect } from "next/navigation";

import { ThemeToggle } from "@/components/theme-toggle";
import { buttonVariants } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/diaries");
  }

  return (
    <main className="relative flex flex-1 flex-col items-center justify-center gap-5 px-4 py-12 text-center sm:gap-6 sm:px-6 sm:py-16">
      {/* 공개 페이지에는 전역 헤더가 없으므로 우측 상단에 고정 배치한다. */}
      <ThemeToggle className="fixed top-3 right-3 z-50 sm:top-4 sm:right-4" />
      <h1 className="font-display text-4xl tracking-tight sm:text-5xl lg:text-6xl">
        일기장
      </h1>
      <p className="max-w-md text-balance text-sm text-muted-foreground sm:text-base">
        매일의 기록에 AI가 감정 이모지와 해시태그를 달아드립니다.
      </p>
      <Link href="/login" className={buttonVariants({ size: "lg" })}>
        로그인
      </Link>
    </main>
  );
}
