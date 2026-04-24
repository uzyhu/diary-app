import "server-only";

import { createClient } from "@supabase/supabase-js";

import { getSupabaseUrl } from "@/lib/env";
import { getSupabaseServiceRoleKey } from "@/lib/env.server";
import type { Database } from "@/types/database.types";

// service_role 키로 만든 admin 클라이언트. Storage/DB 모두 RLS를 우회한다.
// 반드시 서버에서만 사용. 호출 전 `auth.getUser()`로 로그인 확인 + 경로를
// 사용자 id prefix로 강제해 보안 경계를 유지한다.
export function createAdminClient() {
  return createClient<Database>(
    getSupabaseUrl(),
    getSupabaseServiceRoleKey(),
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}
