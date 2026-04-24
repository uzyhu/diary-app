import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { AppNav } from "@/components/app-nav";
import { LogoutButton } from "@/components/logout-button";
import { ThemeToggle } from "@/components/theme-toggle";
import { createClient } from "@/lib/supabase/server";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 미들웨어가 이미 걸러주지만, 레이아웃에서도 한 번 더 확인해 서버 렌더 직전 안전망을 둔다.
  if (!user) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="border-b border-border">
        {/* 모바일: 한 줄 컴팩트 레이아웃(h-14). 브랜드+네비는 왼쪽, 테마/로그아웃은 오른쪽.
            이메일은 데스크탑에서만 노출(공간 절약). 로그아웃은 LogoutButton 내부에서 아이콘/텍스트 토글. */}
        <div className="mx-auto flex h-14 w-full max-w-4xl items-center justify-between gap-2 px-4 sm:h-16 sm:gap-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3 sm:gap-4">
            <Link
              href="/diaries"
              className="font-display truncate text-xl leading-none tracking-tight sm:text-2xl"
            >
              일기장
            </Link>
            <AppNav />
          </div>
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-3">
            <span
              className="hidden max-w-[180px] truncate text-sm text-muted-foreground sm:inline"
              title={user.email ?? undefined}
            >
              {user.email}
            </span>
            <ThemeToggle />
            <LogoutButton />
          </div>
        </div>
      </header>
      <div className="flex flex-1 flex-col">{children}</div>
    </div>
  );
}
