"use client";

import "react-day-picker/style.css";

import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { DayPicker } from "react-day-picker";
import { ko } from "date-fns/locale";

type CalendarViewProps = {
  // YYYY-MM-DD 배열. 이 달에 일기가 존재하는 날짜들.
  writtenDates: string[];
  // 표시할 월. "YYYY-MM" → Date(첫날)로 RDP에 전달.
  monthValue: string;
  // 클릭 시 목록 탭과 일관되게 유지할 "mine" | "shared".
  tab: string;
};

function parseMonth(monthValue: string): Date {
  const [year, month] = monthValue.split("-").map(Number);
  // RDP의 `month` prop은 표시할 달의 "어떤 Date"든 받는다. UTC 1일 정오를 써서 타임존 경계 버그를 피한다.
  return new Date(Date.UTC(year, month - 1, 1, 12));
}

function formatLocalYmd(date: Date): string {
  // 사용자가 클릭한 "셀의 날짜"는 로컬(브라우저) 캘린더상의 날짜다.
  // DB의 diaries.date도 각 사용자의 현지 날짜로 입력되므로 로컬 기준으로 문자열화한다.
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function CalendarView({ writtenDates, monthValue, tab }: CalendarViewProps) {
  const router = useRouter();

  // Set으로 바꾸어 modifier에서 O(1) 조회.
  const writtenSet = useMemo(() => new Set(writtenDates), [writtenDates]);

  const displayedMonth = useMemo(() => parseMonth(monthValue), [monthValue]);

  // RDP modifier: 작성된 날짜만 "written"으로 표시 → CSS로 점 강조.
  const modifiers = useMemo(
    () => ({
      written: (day: Date) => writtenSet.has(formatLocalYmd(day)),
    }),
    [writtenSet],
  );

  return (
    <>
      <DayPicker
        mode="single"
        month={displayedMonth}
        // 월 이동/월 레이블은 페이지 바깥의 Link/h2가 담당하므로, RDP의 내장 네비·캡션은 통째로 렌더하지 않는다.
        // `hideNavigation` + `classNames`의 `sr-only`는 RDP 기본 CSS가 뒤에 로드되면서 덮어써 실패했으므로,
        // 더 확실한 `components` prop으로 null 컴포넌트를 주입해 아예 렌더에서 제외한다.
        hideNavigation
        components={{
          MonthCaption: () => <></>,
          Nav: () => <></>,
          Chevron: () => <></>,
        }}
        onSelect={(day) => {
          if (!day) return;
          // 날짜 클릭 UX: 항상 그 일자로 필터된 목록으로 이동. 0/1/다건 모두 일관.
          const params = new URLSearchParams({ tab, date: formatLocalYmd(day) });
          router.push(`/diaries?${params.toString()}`);
        }}
        locale={ko}
        weekStartsOn={0}
        showOutsideDays
        modifiers={modifiers}
        modifiersClassNames={{
          written: "diary-calendar-written",
        }}
        classNames={{
          root: "rdp-root text-foreground flex justify-center",
          months: "flex flex-col sm:flex-row gap-4",
          weekday: "text-xs text-muted-foreground font-medium py-2",
          day: "text-sm",
          today: "font-semibold text-foreground",
          selected: "bg-primary text-primary-foreground rounded-md",
          outside: "text-muted-foreground/40",
        }}
      />
      <style jsx global>{`
        /* 모바일 320px에서도 7칸이 가로로 안 터지도록 RDP 셀 크기를 축소한다.
           기본 44px × 7 = 308px, 컨테이너 패딩까지 합치면 320px 오버플로 위험.
           RDP v9는 --rdp-day-height / --rdp-day-width / --rdp-day_button-* 변수 사용. */
        .rdp-root {
          --rdp-day-height: 38px;
          --rdp-day-width: 38px;
          --rdp-day_button-height: 36px;
          --rdp-day_button-width: 36px;
          --rdp-accent-color: var(--primary);
          --rdp-accent-background-color: color-mix(
            in oklch,
            var(--primary) 15%,
            transparent
          );
        }
        @media (min-width: 480px) {
          .rdp-root {
            --rdp-day-height: 44px;
            --rdp-day-width: 44px;
            --rdp-day_button-height: 42px;
            --rdp-day_button-width: 42px;
          }
        }
        .rdp-root .rdp-month {
          max-width: 100%;
        }

        /* 작성된 날짜에 하단 점 강조. RDP의 day 버튼 위에 ::after로 점을 띄운다.
           다크모드 대응을 위해 currentColor를 사용. */
        .diary-calendar-written > button,
        .diary-calendar-written {
          position: relative;
          font-weight: 600;
        }
        .diary-calendar-written > button::after {
          content: "";
          position: absolute;
          left: 50%;
          bottom: 4px;
          width: 4px;
          height: 4px;
          border-radius: 9999px;
          background-color: currentColor;
          transform: translateX(-50%);
          opacity: 0.9;
        }
      `}</style>
    </>
  );
}
