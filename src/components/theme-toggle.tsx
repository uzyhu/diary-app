"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ThemeValue = "system" | "light" | "dark";

const THEME_CYCLE: ThemeValue[] = ["system", "light", "dark"];

const THEME_LABEL: Record<ThemeValue, string> = {
  system: "시스템",
  light: "라이트",
  dark: "다크",
};

// 서버/클라이언트의 스냅샷을 다르게 돌려줘서 "클라에서만 true"인 값을 얻는다.
// setState-in-effect 없이 hydration mismatch를 피하기 위한 표준 패턴.
const subscribeNoop = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(
    subscribeNoop,
    getClientSnapshot,
    getServerSnapshot,
  );

  if (!mounted) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className={className}
        aria-hidden="true"
        tabIndex={-1}
        disabled
      />
    );
  }

  const current: ThemeValue = isThemeValue(theme) ? theme : "system";
  const next = THEME_CYCLE[(THEME_CYCLE.indexOf(current) + 1) % THEME_CYCLE.length];
  const label = `테마: ${THEME_LABEL[current]}. 클릭하면 ${THEME_LABEL[next]}로 전환`;

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      onClick={() => setTheme(next)}
      aria-label={label}
      title={label}
      className={cn(className)}
    >
      <ThemeIcon theme={current} />
    </Button>
  );
}

function ThemeIcon({ theme }: { theme: ThemeValue }) {
  if (theme === "light") return <Sun aria-hidden="true" />;
  if (theme === "dark") return <Moon aria-hidden="true" />;
  return <Monitor aria-hidden="true" />;
}

function isThemeValue(value: string | undefined): value is ThemeValue {
  return value === "system" || value === "light" || value === "dark";
}
