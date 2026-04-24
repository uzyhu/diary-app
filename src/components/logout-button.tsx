"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

export function LogoutButton() {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);

  async function handleClick() {
    setIsPending(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  // 모바일: 아이콘 전용(공간 절약, aria-label로 접근성 확보).
  // 데스크탑(sm 이상): 기존 outline 텍스트 버튼 느낌 유지.
  const label = isPending ? "로그아웃 중..." : "로그아웃";

  return (
    <>
      {/* 모바일 (sm 미만): 아이콘 버튼 */}
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        onClick={handleClick}
        disabled={isPending}
        aria-label={label}
        title={label}
        className="sm:hidden"
      >
        <LogOut aria-hidden="true" className="size-4" />
      </Button>
      {/* 데스크탑: 기존 텍스트 버튼 */}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleClick}
        disabled={isPending}
        className="hidden sm:inline-flex"
      >
        {label}
      </Button>
    </>
  );
}
