"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { createBrowserClient } from "@supabase/ssr"
import { Zap, Mail, Lock, Eye, EyeOff, ExternalLink, X } from "lucide-react"

export default function LoginPage() {
  const router = useRouter()
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const [email, setEmail]       = useState("")
  const [password, setPassword] = useState("")
  const [showPw, setShowPw]     = useState(false)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState("")

  const handleLogin = async () => {
    if (!email || !password) { setError("이메일과 비밀번호를 입력해주세요"); return }
    setLoading(true)
    setError("")
    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password })
      if (authError) { setError("이메일 또는 비밀번호가 올바르지 않습니다"); return }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", data.user.id)
        .single()

      const role = profile?.role || "viewer"

      if (["editor", "manager", "viewer"].includes(role)) {
        router.push("/dashboard")
      } else {
        setError("접근 권한이 없습니다. 관리자에게 문의해주세요.")
        await supabase.auth.signOut()
      }
    } catch {
      setError("연결 오류가 발생했습니다. 다시 시도해주세요.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">

        {/* 로고 */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-indigo-500/30">
            <Zap size={28} className="text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white">DETA Buyer Project OS</h1>
          <p className="text-slate-400 text-sm mt-1">해외 바이어 발굴 플랫폼</p>
        </div>

        {/* 로그인 카드 */}
        <div className="bg-white rounded-2xl p-8 shadow-2xl">
          <h2 className="text-lg font-bold text-slate-800 mb-6">DETA PM Login</h2>
          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1.5 block">이메일</label>
              <div className="relative">
                <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleLogin()}
                  type="email"
                  placeholder="이메일을 입력하세요"
                  className="w-full border border-slate-200 rounded-xl pl-9 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1.5 block">비밀번호</label>
              <div className="relative">
                <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleLogin()}
                  type={showPw ? "text" : "password"}
                  placeholder="비밀번호를 입력하세요"
                  className="w-full border border-slate-200 rounded-xl pl-9 pr-10 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                />
                <button onClick={() => setShowPw(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">
                <X size={13} className="text-red-500 shrink-0" />
                <p className="text-xs text-red-600">{error}</p>
              </div>
            )}

            <button
              onClick={handleLogin}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white py-3 rounded-xl text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-colors mt-2">
              {loading
                ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />로그인 중...</>
                : "로그인"}
            </button>
          </div>
        </div>

        {/* 고객사 안내 */}
        <div className="mt-5 bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-5">
          <p className="text-xs font-semibold text-slate-300 mb-3 flex items-center gap-1.5">
            <ExternalLink size={12} />
            고객사 프로젝트 대시보드 안내
          </p>
          <p className="text-xs text-slate-400 mb-3 leading-relaxed">
            고객사 담당자분께서는 이 페이지가 아닌, 담당 PM으로부터 별도로 안내받으신
            <span className="text-white font-medium"> 전용 URL</span>로 접속해 주세요.
          </p>
          <div className="bg-white/10 rounded-xl px-3 py-2.5">
            <p className="text-xs text-indigo-300 font-mono">deta.ai.kr/client/<span className="text-white">[고객사 ID]</span></p>
          </div>
          <div className="bg-white/10 rounded-xl px-3 py-2.5">
            <p className="text-xs text-indigo-300 font-mono">담당 PM : 김훈기 팀장 <span className="text-white">[hunki.kim@industryarc.com]</span></p>
          </div>
          <p className="text-[11px] text-slate-500 mt-2">
            예시: deta.ai.kr/client/deta · URL을 모르시는 경우 담당 PM에게 문의해 주세요.
          </p>
          
        </div>

      </div>
    </div>
  )
}
