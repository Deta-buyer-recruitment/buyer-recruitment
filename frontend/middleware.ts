import { createServerClient } from "@supabase/ssr"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) { return req.cookies.get(name)?.value },
        set(name: string, value: string, options: any) {
          res.cookies.set({ name, value, ...options })
        },
        remove(name: string, options: any) {
          res.cookies.set({ name, value: "", ...options })
        },
      },
    }
  )

  const { data: { session } } = await supabase.auth.getSession()
  const { pathname } = req.nextUrl

  // 로그인 / 고객 페이지 / 비밀번호 설정 페이지는 인증 불필요
  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/client") ||
    pathname.startsWith("/set-password")
  ) {
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
