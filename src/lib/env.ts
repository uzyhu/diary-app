// 클라이언트·서버 양쪽에서 안전하게 참조 가능한 public env.
// 서버 전용 변수는 `env.server.ts`에 둔다.

function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Missing ${name} — .env.local 확인`);
  }
  return value;
}

export function getSupabaseUrl(): string {
  return required(
    "NEXT_PUBLIC_SUPABASE_URL",
    process.env.NEXT_PUBLIC_SUPABASE_URL,
  );
}

export function getSupabaseAnonKey(): string {
  return required(
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}
