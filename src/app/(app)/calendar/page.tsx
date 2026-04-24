import Link from "next/link";

import { cn } from "@/lib/utils";
import {
  currentMonthInSeoul,
  isValidMonthString,
  monthRange,
  shiftMonth,
} from "@/lib/date";
import { createClient } from "@/lib/supabase/server";
import { CalendarView } from "./calendar-view";

export const metadata = {
  title: "달력 · AI 일기장",
};

const TAB_VALUES = ["mine", "shared"] as const;
type Tab = (typeof TAB_VALUES)[number];

// 한 달치 조회 상한. 한 사람이 하루 1건 쓰더라도 31건 + 여유 버퍼면 충분.
const MONTH_QUERY_LIMIT = 200;

type SearchParams = Promise<{
  month?: string | string[];
  tab?: string | string[];
}>;

function firstValue(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function parseTab(raw: string | undefined): Tab {
  return (TAB_VALUES as readonly string[]).includes(raw ?? "")
    ? (raw as Tab)
    : "mine";
}

function parseMonth(raw: string | undefined): string {
  if (raw && isValidMonthString(raw)) {
    return raw;
  }
  return currentMonthInSeoul();
}

function formatMonthLabel(month: string): string {
  const [year, m] = month.split("-");
  return `${year}년 ${Number(m)}월`;
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { month: rawMonth, tab: rawTab } = await searchParams;
  const month = parseMonth(firstValue(rawMonth));
  const tab = parseTab(firstValue(rawTab));
  const { start, end } = monthRange(month);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // RLS가 "내 일기 + 공유받은 일기"를 합쳐 돌려주므로, 탭에 따라 앱단에서 user_id로 분리한다.
  // user가 null인 경로는 미들웨어에서 차단되지만 레이아웃에서도 redirect 처리된다.
  let dbQuery = supabase
    .from("diaries")
    .select("id,date,user_id")
    .gte("date", start)
    .lte("date", end)
    .limit(MONTH_QUERY_LIMIT);

  if (user) {
    dbQuery = tab === "mine"
      ? dbQuery.eq("user_id", user.id)
      : dbQuery.neq("user_id", user.id);
  }

  const { data: rows, error } = await dbQuery;

  // 중복 제거된 "그 달에 일기가 존재하는 날짜" 집합.
  const writtenDates = Array.from(
    new Set((rows ?? []).map((row) => row.date)),
  );

  const prevMonth = shiftMonth(month, -1);
  const nextMonth = shiftMonth(month, 1);
  const isMine = tab === "mine";
  const monthLabel = formatMonthLabel(month);

  const navLink = (targetMonth: string) => {
    const params = new URLSearchParams({ month: targetMonth, tab });
    return `/calendar?${params.toString()}`;
  };

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-6 sm:py-10">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0 space-y-1">
          <h1 className="font-display text-3xl tracking-tight sm:text-4xl">
            달력
          </h1>
          <p className="text-sm text-muted-foreground">
            {isMine
              ? "내가 작성한 날짜에 점이 표시돼요."
              : "공유받은 일기가 있는 날짜에 점이 표시돼요."}
          </p>
        </div>
      </header>

      <nav
        aria-label="달력 탭"
        className="mb-6 flex flex-wrap gap-1 border-b border-border"
      >
        <TabLink
          href={`/calendar?month=${month}`}
          active={isMine}
          label="내 일기"
        />
        <TabLink
          href={`/calendar?month=${month}&tab=shared`}
          active={!isMine}
          label="공유받은 일기"
        />
      </nav>

      <div className="mb-4 flex items-center justify-between gap-2">
        <Link
          href={navLink(prevMonth)}
          aria-label="이전 달"
          className="inline-flex h-10 w-10 items-center justify-center rounded-sm border border-border text-base outline-none transition-colors hover:bg-muted focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          &lt;
        </Link>
        <h2
          className="font-display text-xl sm:text-2xl"
          aria-live="polite"
        >
          {monthLabel}
        </h2>
        <Link
          href={navLink(nextMonth)}
          aria-label="다음 달"
          className="inline-flex h-10 w-10 items-center justify-center rounded-sm border border-border text-base outline-none transition-colors hover:bg-muted focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          &gt;
        </Link>
      </div>

      {error ? (
        <section
          role="alert"
          className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive"
        >
          달력을 불러오지 못했습니다: {error.message}
        </section>
      ) : (
        <section className="rounded-sm border border-border bg-card p-3 sm:p-4">
          <CalendarView
            writtenDates={writtenDates}
            monthValue={month}
            tab={tab}
          />
          <p className="mt-4 text-xs text-muted-foreground">
            날짜를 누르면 해당 일자의 일기 목록으로 이동해요.
          </p>
        </section>
      )}
    </main>
  );
}

type TabLinkProps = {
  href: string;
  active: boolean;
  label: string;
};

function TabLink({ href, active, label }: TabLinkProps) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "-mb-px border-b-2 px-3 py-2 text-sm transition-colors",
        active
          ? "border-foreground font-semibold text-foreground"
          : "border-transparent text-muted-foreground hover:text-foreground",
      )}
    >
      {label}
    </Link>
  );
}
