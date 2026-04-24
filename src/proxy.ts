import { NextResponse, type NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/middleware";

const PROTECTED_PREFIXES = ["/diaries", "/calendar"];
const LOGIN_PATH = "/login";
const POST_LOGIN_PATH = "/diaries";

export async function proxy(request: NextRequest) {
  const { response, user } = await updateSession(request);
  const { pathname, search } = request.nextUrl;

  const isProtected = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );

  if (isProtected && !user) {
    // 원래 URL의 쿼리스트링도 보존해야 로그인 후 탭/검색어 등이 유실되지 않는다.
    const originalUrl = `${pathname}${search}`;
    const target = `${request.nextUrl.origin}${LOGIN_PATH}?next=${encodeURIComponent(originalUrl)}`;
    return NextResponse.redirect(target);
  }

  if (pathname === LOGIN_PATH && user) {
    const target = `${request.nextUrl.origin}${POST_LOGIN_PATH}`;
    return NextResponse.redirect(target);
  }

  return response;
}

export const config = {
  matcher: [
    // 정적 자원·파비콘·이미지·콜백 라우트는 건너뛴다.
    // 콜백은 쿼리 파라미터를 훼손 없이 통과시켜야 하므로 예외 처리한다.
    "/((?!_next/static|_next/image|favicon.ico|auth/callback|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
