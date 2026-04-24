// 앱은 Asia/Seoul 사용자를 대상으로 한다. 서버의 시스템 타임존에 의존하지 않도록
// "오늘"과 "현재 월"은 Intl을 통해 서울 기준 문자열로 고정해 반환한다.

const SEOUL_TIME_ZONE = "Asia/Seoul";
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_PATTERN = /^\d{4}-\d{2}$/;

export function todayInSeoul(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: SEOUL_TIME_ZONE }).format(
    new Date(),
  );
}

export function currentMonthInSeoul(): string {
  return todayInSeoul().slice(0, 7);
}

export function isValidDateString(date: string): boolean {
  if (!DATE_PATTERN.test(date)) return false;
  // "2024-02-30" 같은 존재하지 않는 날짜를 round-trip으로 거른다.
  const parsed = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return false;
  return parsed.toISOString().slice(0, 10) === date;
}

export function isValidMonthString(month: string): boolean {
  if (!MONTH_PATTERN.test(month)) return false;
  const [year, m] = month.split("-").map(Number);
  return m >= 1 && m <= 12 && year >= 1970 && year <= 9999;
}

// YYYY-MM 문자열 → 그 달의 첫날과 말일을 YYYY-MM-DD로 반환.
export function monthRange(month: string): { start: string; end: string } {
  const [year, m] = month.split("-").map(Number);
  // Date.UTC(year, month, 0)의 month는 1-indexed로 다음 달을 주면 그 달의 "0일" = 이전 달 말일.
  const lastDay = new Date(Date.UTC(year, m, 0)).getUTCDate();
  const mm = String(m).padStart(2, "0");
  return {
    start: `${year}-${mm}-01`,
    end: `${year}-${mm}-${String(lastDay).padStart(2, "0")}`,
  };
}

// YYYY-MM을 월 단위로 이동한다. offset은 -1(이전) / +1(다음) 등.
export function shiftMonth(month: string, offset: number): string {
  const [year, m] = month.split("-").map(Number);
  const base = new Date(Date.UTC(year, m - 1 + offset, 1));
  const y = base.getUTCFullYear();
  const mm = String(base.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${mm}`;
}
