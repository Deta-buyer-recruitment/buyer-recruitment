"use client"
import { useEffect, useState } from "react"
import { createBrowserClient } from "@supabase/ssr"
import { useRouter } from "next/navigation"
import { Globe, Lock, Eye, EyeOff, CheckCircle2, X } from "lucide-react"

export default function SetPasswordPage() {
  const router = useRouter()
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const [session, setSession]     = useState<any>(null)
  const [checking, setChecking]   = useState(true)
  const [password, setPassword]   = useState("")
  const [confirm, setConfirm]     = useState("")
  const [showPw, setShowPw]       = useState(false)
  const [showCf, setShowCf]       = useState(false)
  const [saving, setSaving]       = useState(false)
  const [done, setDone]           = useState(false)
  const [error, setError]         = useState("")

  // Supabase가 URL의 #access_token 을 자동으로 처리해 세션을 만들어줌
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setChecking(false)
    })
    // 초대 링크에서 넘어올 때 onAuthStateChange로 세션 감지
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess)
      setChecking(false)
    })
    return () => subscription.unsubscribe()
  }, [])

  const validate = () => {
    if (password.length < 8) { setError("비밀번호는 8자 이상이어야 합니다"); return false }
    if (password !== confirm) { setError("비밀번호가 일치하지 않습니다"); return false }
    return true
  }

  const handleSubmit = async () => {
    setError("")
    if (!validate()) return
    setSaving(true)
    try {
      const { error: err } = await supabase.auth.updateUser({ password })
      if (err) { setError(err.message); return }
      setDone(true)
      // 2초 후 대시보드로 이동
      setTimeout(() => router.push("/dashboard"), 2000)
    } catch {
      setError("오류가 발생했습니다. 다시 시도해주세요.")
    } finally {
      setSaving(false)
    }
  }

  if (checking) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  // 세션 없으면 (유효하지 않은 링크)
  if (!session) return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-8 w-full max-w-sm shadow-2xl text-center">
        <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <X size={22} className="text-red-500" />
        </div>
        <h2 className="text-lg font-bold text-slate-800 mb-2">링크가 만료되었습니다</h2>
        <p className="text-sm text-slate-500 mb-5">초대 링크가 유효하지 않거나 이미 사용되었습니다.<br />관리자에게 다시 초대를 요청해주세요.</p>
        <button onClick={() => router.push("/login")}
          className="w-full bg-indigo-600 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-colors">
          로그인 페이지로
        </button>
      </div>
    </div>
  )

  // 설정 완료
  if (done) return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-8 w-full max-w-sm shadow-2xl text-center">
        <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 size={24} className="text-green-500" />
        </div>
        <h2 className="text-lg font-bold text-slate-800 mb-2">비밀번호 설정 완료!</h2>
        <p className="text-sm text-slate-500">대시보드로 이동합니다...</p>
        <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mt-4" />
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* 헤더 */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-indigo-500/30">
            <Globe size={26} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">BuyerOS에 오신 것을 환영합니다</h1>
          <p className="text-slate-400 text-sm mt-1.5">
            {session.user?.email}
          </p>
        </div>

        <div className="bg-white rounded-2xl p-7 shadow-2xl">
          <h2 className="text-base font-bold text-slate-800 mb-1">비밀번호 설정</h2>
          <p className="text-xs text-slate-400 mb-5">로그인에 사용할 비밀번호를 설정해주세요</p>

          <div className="space-y-4">
            {/* 비밀번호 */}
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1.5 block">비밀번호 *</label>
              <div className="relative">
                <input
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError("") }}
                  type={showPw ? "text" : "password"}
                  placeholder="8자 이상 입력"
                  className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 pr-10" />
                <button onClick={() => setShowPw(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {/* 강도 표시 */}
              {password.length > 0 && (
                <div className="flex gap-1 mt-2">
                  {[1,2,3].map(i => (
                    <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${
                      password.length >= 8 && i <= 3 ? "bg-green-400" :
                      password.length >= 5 && i <= 2 ? "bg-yellow-400" :
                      i <= 1 ? "bg-red-400" : "bg-slate-100"
                    }`} />
                  ))}
                  <span className="text-[10px] text-slate-400 ml-1">
                    {password.length >= 8 ? "강함" : password.length >= 5 ? "보통" : "약함"}
                  </span>
                </div>
              )}
            </div>

            {/* 비밀번호 확인 */}
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1.5 block">비밀번호 확인 *</label>
              <div className="relative">
                <input
                  value={confirm}
                  onChange={e => { setConfirm(e.target.value); setError("") }}
                  onKeyDown={e => e.key === "Enter" && handleSubmit()}
                  type={showCf ? "text" : "password"}
                  placeholder="비밀번호 재입력"
                  className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 pr-10" />
                <button onClick={() => setShowCf(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  {showCf ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {/* 일치 여부 */}
              {confirm.length > 0 && (
                <p className={`text-[11px] mt-1.5 flex items-center gap-1 ${password === confirm ? "text-green-500" : "text-red-400"}`}>
                  {password === confirm
                    ? <><CheckCircle2 size={11} /> 비밀번호가 일치합니다</>
                    : <><X size={11} /> 비밀번호가 일치하지 않습니다</>}
                </p>
              )}
            </div>

            {/* 에러 메시지 */}
            {error && (
              <p className="text-xs text-red-500 flex items-center gap-1.5 bg-red-50 px-3 py-2 rounded-lg">
                <X size={12} /> {error}
              </p>
            )}

            {/* 제출 버튼 */}
            <button
              onClick={handleSubmit}
              disabled={saving || !password || !confirm}
              className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white py-3 rounded-xl text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-colors mt-2">
              {saving
                ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />설정 중...</>
                : <><Lock size={14} />비밀번호 설정하기</>}
            </button>
          </div>
        </div>
        <p className="text-center text-slate-500 text-xs mt-4">문의사항은 관리자에게 연락해주세요</p>
      </div>
    </div>
  )
}
