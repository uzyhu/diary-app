import "server-only";

function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Missing ${name} — .env.local 확인`);
  }
  return value;
}

export function getSupabaseServiceRoleKey(): string {
  return required(
    "SUPABASE_SERVICE_ROLE_KEY",
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}

export function getGeminiApiKey(): string {
  return required("GEMINI_API_KEY", process.env.GEMINI_API_KEY);
}
