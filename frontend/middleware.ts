import { createMiddlewareClient } from "@supabase/auth-helpers-nextjs"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()
  const supabase = createMiddlewareClient({ req, res })

  const { data: { session } } = await supabase.auth.getSession()

  const { pathname } = req.nextUrl

  // 로그인/고객 페이지는 인증 불필요
  if (pathname.startsWith("/login") || pathname.startsWith("/client")) {
    // 이미 로그인된 팀원이 /login 접근 시 대시보드로
    if (pathname === "/login" && session) {
      return NextResponse.redirect(new URL("/dashboard", req.url))
    }
    return res
  }

  // 나머지 페이지는 로그인 필요
  if (!session) {
    return NextResponse.redirect(new URL("/login", req.url))
  }

  return res
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api).*)"],
}
