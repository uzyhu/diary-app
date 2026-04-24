import { NextResponse, type NextRequest } from "next/server";

import { sanitizeNext } from "@/lib/auth-redirect";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = sanitizeNext(searchParams.get("next"));

  if (!code) {
    return NextResponse.redirect(buildLoginError(origin, "missing_code"));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(buildLoginError(origin, "exchange_failed"));
  }

  return NextResponse.redirect(new URL(next, origin));
}

function buildLoginError(origin: string, reason: string): URL {
  const url = new URL("/login", origin);
  url.searchParams.set("error", reason);
  return url;
}
