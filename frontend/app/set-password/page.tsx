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

  const [ready, setReady]         = useState(false)
  const [hasToken, setHasToken]   = useState(false)
  const [password, setPassword]   = useState("")
  const [confirm, setConfirm]     = useState("")
  const [showPw, setShowPw]       = useState(false)
  const [showCf, setShowCf]       = useState(false)
  const [saving, setSaving]       = useState(false)
  const [done, setDone]           = useState(false)
  const [error, setError]         = useState("")
  const [userEmail, setUserEmail] = useState("")

  useEffect(() => {
    // URL hash에서 access_token 직접 파싱
    const hash = window.location.hash.substring(1)
    const params = new URLSearchParams(hash)
    const accessToken  = params.get("access_token")
    const refreshToken = params.get("refresh_token")
    const errorCode    = params.get("error_code")

    if (errorCode) {
      setReady(true)
      setHasToken(false)
      return
    }

    if (accessToken && refreshToken) {
      // 토큰으로 세션 직접 설정
      supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
        .then(({ data, error: err }) => {
          if (err || !data.session) {
            setHasToken(false)
          } else {
            setUserEmail(data.session.user?.email || "")
            setHasToken(true)
          }
          setReady(true)
        })
    } else {
      // hash에 토큰 없으면 현재 세션 확인
      supabase.auth.getSession().then(({ data }) => {
        if (data.session) {
          setUserEmail(data.session.user?.email || "")
          setHasToken(true)
        } else {
          setHasToken(false)
        }
        setReady(true)
      })
    }
  }, [])

  const handleSubmit = async () => {
    setError("")
    if (password.length < 8) { setError("비밀번호는 8자 이상이어야 합니다"); return }
    if (password !== confirm) { setError("비밀번호가 일치하지 않습니다"); return }
    setSaving(true)
    try {
      const { error: err } = await supabase.auth.updateUser({ password })
      if (err) { setError(err.message); return }
      setDone(true)
      setTimeout(() => router.push("/dashboard"), 2000)
    } catch {
      setError("오류가 발생했습니다. 다시 시도해주세요.")
    } finally {
      setSaving(false)
    }
  }

  if (!ready) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (!hasToken) return (
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
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-indigo-500/30">
            <Globe size={26} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">BuyerOS에 오신 것을 환영합니다</h1>
          {userEmail && <p className="text-slate-400 text-sm mt-1.5">{userEmail}</p>}
        </div>

        <div className="bg-white rounded-2xl p-7 shadow-2xl">
          <h2 className="text-base font-bold text-slate-800 mb-1">비밀번호 설정</h2>
          <p className="text-xs text-slate-400 mb-5">로그인에 사용할 비밀번호를 설정해주세요</p>

          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1.5 block">비밀번호 *</label>
              <div className="relative">
                <input value={password} onChange={e => { setPassword(e.target.value); setError("") }}
                  type={showPw ? "text" : "password"} placeholder="8자 이상 입력"
                  className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 pr-10" />
                <button onClick={() => setShowPw(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {password.length > 0 && (
                <div className="flex gap-1 mt-2 items-center">
                  {[1,2,3].map(i => (
                    <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${
                      password.length >= 8 ? "bg-green-400" :
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

            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1.5 block">비밀번호 확인 *</label>
              <div className="relative">
                <input value={confirm} onChange={e => { setConfirm(e.target.value); setError("") }}
                  onKeyDown={e => e.key === "Enter" && handleSubmit()}
                  type={showCf ? "text" : "password"} placeholder="비밀번호 재입력"
                  className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 pr-10" />
                <button onClick={() => setShowCf(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  {showCf ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {confirm.length > 0 && (
                <p className={`text-[11px] mt-1.5 flex items-center gap-1 ${password === confirm ? "text-green-500" : "text-red-400"}`}>
                  {password === confirm
                    ? <><CheckCircle2 size={11} />비밀번호가 일치합니다</>
                    : <><X size={11} />비밀번호가 일치하지 않습니다</>}
                </p>
              )}
            </div>

            {error && (
              <p className="text-xs text-red-500 flex items-center gap-1.5 bg-red-50 px-3 py-2 rounded-lg">
                <X size={12} /> {error}
              </p>
            )}

            <button onClick={handleSubmit} disabled={saving || !password || !confirm}
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
