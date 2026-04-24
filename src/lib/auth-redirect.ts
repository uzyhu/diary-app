const DEFAULT_NEXT = "/diaries";

export function sanitizeNext(raw: string | null | undefined): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) {
    return DEFAULT_NEXT;
  }
  return raw;
}
