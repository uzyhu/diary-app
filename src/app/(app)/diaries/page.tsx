import Link from "next/link";

import { DiaryCard } from "@/components/diary-card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { isValidDateString } from "@/lib/date";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/server";

export const metadata = {
  title: "일기 · AI 일기장",
};

const LIST_LIMIT = 50;
const QUERY_MAX_LENGTH = 100;

const TAB_VALUES = ["mine", "shared"] as const;
type Tab = (typeof TAB_VALUES)[number];

type SearchParams = Promise<{
  tab?: string | string[];
  q?: string | string[];
  date?: string | string[];
}>;

function firstValue(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function parseTab(raw: string | undefined): Tab {
  return (TAB_VALUES as readonly string[]).includes(raw ?? "")
    ? (raw as Tab)
    : "mine";
}

function normalizeQuery(raw: string | undefined): string {
  if (!raw) return "";
  // 100자 초과는 자르기. ilike DoS 방지 + UX상 필요 없음. 해시태그는 20자 상한이라 여유.
  return raw.trim().slice(0, QUERY_MAX_LENGTH);
}

function escapeIlikeWildcards(value: string): string {
  // Postgres ilike 기본 ESCAPE는 '\'. 사용자 입력의 % _ \ 를 리터럴로 취급하려면 앞에 \ 를 붙인다.
  return value.replace(/[\\%_]/g, (match) => `\\${match}`);
}

function formatDateLabel(isoDate: string): string {
  const [year, month, day] = isoDate.split("-");
  return `${year}년 ${Number(month)}월 ${Number(day)}일`;
}

function buildClearLink(tab: Tab, query: string): string {
  // date 필터만 해제하고 검색/탭은 유지한다.
  const params = new URLSearchParams({ tab });
  if (query) params.set("q", query);
  return `/diaries?${params.toString()}`;
}

export default async function DiariesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { tab: rawTab, q: rawQuery, date: rawDate } = await searchParams;
  const tab = parseTab(firstValue(rawTab));
  const query = normalizeQuery(firstValue(rawQuery));
  const isHashtagQuery = query.startsWith("#");
  const hasQuery = query.length > 0;
  const rawDateValue = firstValue(rawDate) ?? "";
  // 잘못된 date는 조용히 무시. 사용자에게 별도 에러를 띄울 필요는 없다.
  const dateFilter = isValidDateString(rawDateValue) ? rawDateValue : "";
  const hasDate = dateFilter.length > 0;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // RLS 정책(`diaries_select_own_or_shared`)이 "내 것 + 공유받은 것" 합집합을 돌려준다.
  // 목록에서 두 흐름을 분리해 보여주려면 앱단에서 user_id 필터로 갈라야 한다.
  // user가 null인 경로는 미들웨어에서 차단되지만 layout에서도 redirect 처리되므로 여기선 조건만.
  let dbQuery = supabase
    .from("diaries")
    .select("id,date,category,content,emotion_emoji,hashtags,photo_path,user_id")
    .order("date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(LIST_LIMIT);

  if (user) {
    dbQuery = tab === "mine"
      ? dbQuery.eq("user_id", user.id)
      : dbQuery.neq("user_id", user.id);
  }

  if (hasQuery) {
    if (isHashtagQuery) {
      // 해시태그는 `#` 접두 포함 정확 매칭만 지원.
      // 부분 일치는 unnest/ILIKE 조합 또는 tsvector가 필요해 MVP 오버스펙 → Phase 8 이후 검토.
      dbQuery = dbQuery.contains("hashtags", [query]);
    } else {
      dbQuery = dbQuery.ilike("content", `%${escapeIlikeWildcards(query)}%`);
    }
  }

  if (hasDate) {
    dbQuery = dbQuery.eq("date", dateFilter);
  }

  const { data: diaries, error } = await dbQuery;

  const isMine = tab === "mine";
  const heading = isMine ? "내 일기" : "공유받은 일기";
  const description = isMine
    ? "날짜와 감정을 함께 남겨보세요."
    : "다른 사람이 나에게 공유한 일기예요. 읽기만 가능해요.";
  const emptyMessage = hasDate
    ? "그 날짜에 작성된 일기가 없어요."
    : hasQuery
      ? `'${query}' 검색 결과가 없어요.`
      : isMine
        ? "아직 일기가 없어요. 첫 일기를 작성해보세요."
        : "아직 공유받은 일기가 없어요.";
  const clearSearchHref = `/diaries?tab=${tab}`;
  const clearDateHref = buildClearLink(tab, query);

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-6 sm:py-10">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="min-w-0 space-y-1">
          <h1 className="font-display text-3xl tracking-tight sm:text-4xl">
            {heading}
          </h1>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        {isMine ? (
          <Link
            href="/diaries/new"
            className={buttonVariants({ size: "sm", className: "shrink-0" })}
          >
            새 일기 쓰기
          </Link>
        ) : null}
      </header>

      <nav
        aria-label="일기 탭"
        className="mb-6 flex flex-wrap gap-1 border-b border-border"
      >
        <TabLink href="/diaries" active={isMine} label="내 일기" />
        <TabLink
          href="/diaries?tab=shared"
          active={!isMine}
          label="공유받은 일기"
        />
      </nav>

      <form
        method="get"
        action="/diaries"
        role="search"
        className="mb-4 flex flex-wrap items-center gap-2"
      >
        {/* 탭/날짜 컨텍스트 유지: form submit 시 현재 필터를 쿼리스트링에 같이 실어보낸다. */}
        <input type="hidden" name="tab" value={tab} />
        {hasDate ? <input type="hidden" name="date" value={dateFilter} /> : null}
        <label htmlFor="diary-search" className="sr-only">
          일기 검색
        </label>
        <Input
          id="diary-search"
          type="search"
          name="q"
          defaultValue={query}
          placeholder="본문 또는 #해시태그 검색"
          maxLength={QUERY_MAX_LENGTH}
          autoComplete="off"
          className="flex-1"
        />
        <Button type="submit" size="sm">
          검색
        </Button>
      </form>

      {hasQuery ? (
        <div className="mb-4 flex items-center gap-2 text-xs text-muted-foreground">
          <span>
            &apos;<span className="font-medium text-foreground">{query}</span>&apos; 검색 결과
          </span>
          <Link href={clearSearchHref} className="underline underline-offset-2 hover:text-foreground">
            검색 해제
          </Link>
        </div>
      ) : null}

      {hasDate ? (
        <div className="mb-4 flex items-center gap-2 text-xs text-muted-foreground">
          <span>
            <span className="font-medium text-foreground">
              {formatDateLabel(dateFilter)}
            </span>
            의 일기
          </span>
          <Link
            href={clearDateHref}
            className="underline underline-offset-2 hover:text-foreground"
          >
            날짜 해제
          </Link>
        </div>
      ) : null}

      {error ? (
        <section
          role="alert"
          className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive"
        >
          일기 목록을 불러오지 못했습니다: {error.message}
        </section>
      ) : diaries && diaries.length > 0 ? (
        <>
          <ul className="space-y-3">
            {diaries.map((diary) => (
              <li key={diary.id}>
                <DiaryCard diary={diary} sharedBadge={!isMine} />
              </li>
            ))}
          </ul>
          {diaries.length >= LIST_LIMIT ? (
            <p className="mt-6 text-center text-xs text-muted-foreground">
              최근 {LIST_LIMIT}건까지 표시됩니다.
            </p>
          ) : null}
        </>
      ) : (
        <section className="rounded-sm border border-dashed border-border bg-card/40 p-8 text-center sm:p-10">
          <p className="font-display text-lg text-muted-foreground">
            {emptyMessage}
          </p>
          {isMine && !hasQuery && !hasDate ? (
            <Link
              href="/diaries/new"
              className={buttonVariants({ size: "sm", className: "mt-4" })}
            >
              새 일기 쓰기
            </Link>
          ) : null}
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
