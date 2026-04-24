"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/diaries", label: "목록", match: "/diaries" },
  { href: "/calendar", label: "달력", match: "/calendar" },
] as const;

export function AppNav() {
  const pathname = usePathname() ?? "";

  return (
    <nav aria-label="앱 주요 네비게이션" className="flex items-center gap-1">
      {ITEMS.map((item) => {
        const active =
          pathname === item.match || pathname.startsWith(`${item.match}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "rounded-md px-2.5 py-1.5 text-sm transition-colors",
              active
                ? "bg-muted font-semibold text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
