"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { createBrowserClient } from "@supabase/ssr"
import { Zap, Mail, Lock, Eye, EyeOff, ExternalLink, X } from "lucide-react"
import { cn } from "@/lib/utils"

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
    if (!email || !password) { setError("Please enter email and password"); return }
    setLoading(true)
    setError("")
    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password })
      if (authError) { setError(authError.message); return }

      // 권한 확인
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", data.user.id)
        .single()

      const role = profile?.role || "viewer"

      // 권한에 따라 이동
      if (["editor", "manager", "viewer"].includes(role)) {
        router.push("/dashboard")
      } else {
        setError("Access denied. Contact your administrator.")
        await supabase.auth.signOut()
      }
    } catch {
      setError("Connection error. Please try again.")
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
          <h1 className="text-3xl font-bold text-white">BuyerOS</h1>
          <p className="text-slate-400 text-sm mt-1">Overseas Buyer Outreach Platform</p>
        </div>

        {/* 로그인 카드 */}
        <div className="bg-white rounded-2xl p-8 shadow-2xl">
          <h2 className="text-lg font-bold text-slate-800 mb-6">Team Login</h2>
          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Email</label>
              <div className="relative">
                <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleLogin()}
                  type="email"
                  placeholder="your@email.com"
                  className="w-full border border-slate-200 rounded-xl pl-9 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Password</label>
              <div className="relative">
                <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleLogin()}
                  type={showPw ? "text" : "password"}
                  placeholder="Enter password"
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
                ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Signing in...</>
                : "Sign In"}
            </button>
          </div>
        </div>

        {/* 고객사 안내 */}
        <div className="mt-5 bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-5">
          <p className="text-xs font-semibold text-slate-300 mb-3 flex items-center gap-1.5">
            <ExternalLink size={12} />
            For Clients — Project Dashboard
          </p>
          <p className="text-xs text-slate-400 mb-3 leading-relaxed">
            If you are a client, please access your dedicated project dashboard using the URL provided by your project manager.
          </p>
          <div className="bg-white/10 rounded-xl px-3 py-2.5">
            <p className="text-xs text-indigo-300 font-mono">deta.ai.kr/client/<span className="text-white">[your-slug]</span></p>
          </div>
          <p className="text-[11px] text-slate-500 mt-2">
            e.g. deta.ai.kr/client/sammi — Contact your manager if you don't have the URL.
          </p>
        </div>

      </div>
    </div>
  )
}
