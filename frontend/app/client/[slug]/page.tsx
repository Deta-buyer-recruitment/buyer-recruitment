"use client"
import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import {
  CheckCircle2, Clock, Circle, Download, Calendar,
  MessageSquare, FileText, Globe,
  Bell, Plus, X, ChevronRight, Users, Lock, Eye, EyeOff,
  ChevronDown
} from "lucide-react"
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts"
import { cn } from "@/lib/utils"

const API = process.env.NEXT_PUBLIC_API_URL || "https://buyer-recruitment-production.up.railway.app"
const STORAGE_KEY = (slug: string) => `client_auth_${slug}`

const CATEGORY_LABELS: Record<string, string> = {
  buyer_list: "Buyer List", report: "Report", strategy: "Strategy Doc", other: "Other",
}

type Tab = "overview" | "files" | "meetings" | "inquiry"

export default function ClientPage() {
  const { slug } = useParams<{ slug: string }>()

  const [authed, setAuthed]             = useState(false)
  const [authChecking, setAuthChecking] = useState(true)
  const [loginId, setLoginId]           = useState("")
  const [loginPw, setLoginPw]           = useState("")
  const [showPw, setShowPw]             = useState(false)
  const [loginError, setLoginError]     = useState("")
  const [loginLoading, setLoginLoading] = useState(false)
  const [customerId, setCustomerId]     = useState("")
  const [data, setData]                 = useState<any>(null)
  const [loading, setLoading]           = useState(false)
  const [activeTab, setActiveTab]       = useState<Tab>("overview")
  const [newMeetings, setNewMeetings]   = useState(0)
  const [inquiryOpen, setInquiryOpen]   = useState(false)
  const [inquiryForm, setInquiryForm]   = useState({ author_name: "", title: "", content: "" })
  const [submitting, setSubmitting]     = useState(false)
  const [exportingLogs, setExportingLogs] = useState(false)  // ← 추가

  useEffect(() => {
    const saved = sessionStorage.getItem(STORAGE_KEY(slug))
    if (saved) {
      const { customer_id } = JSON.parse(saved)
      setCustomerId(customer_id)
      setAuthed(true)
    }
    setAuthChecking(false)
  }, [slug])

  useEffect(() => {
    if (authed && customerId) loadData()
  }, [authed, customerId])

  const loadData = () => {
    setLoading(true)
    fetch(`${API}/api/client/dashboard/${customerId}`)
      .then(r => r.json())
      .then(d => { setData(d); setNewMeetings(d.stats?.meetings || 0) })
      .finally(() => setLoading(false))
  }

  const handleLogin = async () => {
    if (!loginId || !loginPw) { setLoginError("Please enter ID and password"); return }
    setLoginLoading(true); setLoginError("")
    try {
      const res = await fetch(`${API}/api/client/login`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, access_id: loginId, access_password: loginPw }),
      })
      const result = await res.json()
      if (!res.ok) { setLoginError(result.detail || "Invalid credentials"); return }
      sessionStorage.setItem(STORAGE_KEY(slug), JSON.stringify({ customer_id: result.customer_id, customer_name: result.customer_name }))
      setCustomerId(result.customer_id); setAuthed(true)
    } catch { setLoginError("Connection error. Please try again.") }
    finally { setLoginLoading(false) }
  }

  const handleLogout = () => {
    sessionStorage.removeItem(STORAGE_KEY(slug))
    setAuthed(false); setData(null); setLoginId(""); setLoginPw("")
  }

  const submitInquiry = async () => {
    if (!inquiryForm.title || !inquiryForm.content) return
    setSubmitting(true)
    await fetch(`${API}/api/client/inquiries/${data.customer.id}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(inquiryForm),
    })
    setInquiryOpen(false)
    setInquiryForm({ author_name: "", title: "", content: "" })
    setSubmitting(false)
    loadData()
  }

  // ── 컨택 로그 엑셀 다운로드 ──────────────────────────────────
  const downloadContactLogs = async () => {
    if (!customerId) return
    setExportingLogs(true)
    try {
      const res = await fetch(`${API}/api/client/contact-logs/${customerId}/export`)
      if (!res.ok) throw new Error("Export failed")
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      const cname = data?.customer?.name?.replace(/\s+/g, "_") || "client"
      const today = new Date().toISOString().slice(0, 10).replace(/-/g, "")
      a.download = `${cname}_contact_logs_${today}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      alert("컨택 로그 다운로드에 실패했습니다.")
    } finally {
      setExportingLogs(false)
    }
  }

  if (authChecking) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (!authed) return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-indigo-500/30">
            <Globe size={26} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Project Dashboard</h1>
          <p className="text-slate-400 text-sm mt-1">Sign in to view your project</p>
        </div>
        <div className="bg-white rounded-2xl p-7 shadow-2xl">
          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1.5 block">ID</label>
              <input value={loginId} onChange={e => setLoginId(e.target.value)} onKeyDown={e => e.key === "Enter" && handleLogin()}
                placeholder="Enter your ID"
                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Password</label>
              <div className="relative">
                <input value={loginPw} onChange={e => setLoginPw(e.target.value)} onKeyDown={e => e.key === "Enter" && handleLogin()}
                  type={showPw ? "text" : "password"} placeholder="Enter your password"
                  className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 pr-10" />
                <button onClick={() => setShowPw(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            {loginError && <p className="text-xs text-red-500 flex items-center gap-1.5"><X size={12} /> {loginError}</p>}
            <button onClick={handleLogin} disabled={loginLoading}
              className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white py-3 rounded-xl text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-colors mt-2">
              {loginLoading ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Signing in...</> : <><Lock size={14} />Sign In</>}
            </button>
          </div>
        </div>
        <p className="text-center text-slate-500 text-xs mt-4">Contact your project manager if you need access</p>
      </div>
    </div>
  )

  if (loading || !data) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="w-10 h-10 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sm text-slate-500">Loading project data...</p>
      </div>
    </div>
  )

  const { customer, timeline, progress, stats, files, meetings, inquiries } = data
  const countries = (data.target_countries && data.target_countries.length > 0)
    ? data.target_countries
    : Array.from(new Set((data.buyers || []).map((b: any) => b.country).filter(Boolean))) as string[]
  const weeklyData = buildWeeklyData(stats, data.weekly_data)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-40 shadow-sm">
        <div className="max-w-5xl mx-auto px-6 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
              <Globe size={15} className="text-white" />
            </div>
            <div>
              <p className="text-xs text-slate-400 leading-none">Project Management Dashboard</p>
              <p className="text-sm font-bold text-slate-800 leading-tight mt-0.5">{customer.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* 문의 버튼 - 우측 상단 */}
            <button onClick={() => setInquiryOpen(true)}
              className="flex items-center gap-1.5 bg-indigo-50 text-indigo-600 border border-indigo-200 text-xs font-semibold px-3 py-2 rounded-xl hover:bg-indigo-100 transition-colors">
              <MessageSquare size={13} />
              문의
            </button>
            {newMeetings > 0 && (
              <button onClick={() => { setActiveTab("meetings"); setNewMeetings(0) }}
                className="flex items-center gap-1.5 bg-orange-500 text-white text-xs font-bold px-3 py-1.5 rounded-full animate-bounce hover:animate-none hover:bg-orange-600 transition-colors">
                <Bell size={11} /> New Meetings {newMeetings}
              </button>
            )}
            <div className="text-right">
              <p className="text-[10px] text-slate-400">Overall Progress</p>
              <p className="text-base font-bold text-indigo-600">{progress}%</p>
            </div>
            <button onClick={handleLogout}
              className="text-xs text-slate-400 hover:text-slate-600 px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors">
              Sign out
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-6">
        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-white rounded-xl p-1 border border-gray-100 shadow-sm w-fit">
          {([
            { key: "overview", label: "Dashboard" },
            { key: "files",    label: `Files (${files?.length || 0})` },
            { key: "meetings", label: `Meetings (${stats.meetings})` },
            { key: "inquiry",  label: `문의 (${inquiries?.length || 0})` },
          ] as { key: Tab; label: string }[]).map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={cn("px-4 py-2 text-sm font-medium rounded-lg transition-all",
                activeTab === tab.key ? "bg-indigo-600 text-white shadow-sm" : "text-slate-500 hover:text-slate-700")}>
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── Overview ── */}
        {activeTab === "overview" && (
          <div className="space-y-5">
            {/* Timeline */}
            <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-bold text-slate-800">프로젝트 진행 현황</h2>
                <span className="text-xs text-slate-400 bg-slate-50 px-3 py-1.5 rounded-full border border-slate-100">
                  {timeline?.filter((t: any) => t.status === "done").length || 0} / {timeline?.length || 0} 단계 완료
                </span>
              </div>
              <div className="overflow-x-auto pb-2">
                <div className="flex items-start gap-0 min-w-max">
                  {(timeline || []).map((step: any, i: number) => (
                    <div key={step.step_no} className="flex items-start">
                      <TimelineCard step={step} index={i} />
                      {i < (timeline.length - 1) && (
                        <div className="flex items-center mt-7 mx-1">
                          <div className={cn("w-6 h-0.5", step.status === "done" ? "bg-green-400" : "bg-gray-200")} />
                          <ChevronRight size={12} className={step.status === "done" ? "text-green-400" : "text-gray-300"} />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Countries */}
            {countries.length > 0 && (
              <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
                <h2 className="text-base font-bold text-slate-800 mb-3">진출 대상국</h2>
                <div className="flex flex-wrap gap-2">
                  {countries.map(c => (
                    <span key={c} className="px-4 py-1.5 bg-indigo-50 border border-indigo-100 text-indigo-700 text-sm rounded-full font-medium">{c}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Contact Stats — 다운로드 버튼 추가 */}
            <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-base font-bold text-slate-800">컨택 현황</h2>
                {/* ★ 컨택 로그 다운로드 버튼 */}
                <button
                  onClick={downloadContactLogs}
                  disabled={exportingLogs}
                  className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50">
                  {exportingLogs
                    ? <><div className="w-3 h-3 border border-emerald-500 border-t-transparent rounded-full animate-spin" />다운로드 중...</>
                    : <><Download size={12} />컨택 로그 다운로드</>}
                </button>
              </div>
              <div className="grid grid-cols-3 gap-4 mb-6">
                {[
                  { label: "총 컨택 수",   value: stats.contacted, color: "blue",   icon: Users },
                  { label: "회신 수",       value: stats.replied,   color: "green",  icon: MessageSquare },
                  { label: "미팅 확정",     value: stats.meetings,  color: "orange", icon: Calendar },
                ].map(({ label, value, color, icon: Icon }) => (
                  <div key={label} className={cn("rounded-2xl p-4",
                    color === "blue" ? "bg-blue-50" : color === "green" ? "bg-green-50" : "bg-orange-50")}>
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs text-slate-500">{label}</p>
                      <Icon size={14} className={color === "blue" ? "text-blue-400" : color === "green" ? "text-green-400" : "text-orange-400"} />
                    </div>
                    <p className={cn("text-3xl font-bold",
                      color === "blue" ? "text-blue-700" : color === "green" ? "text-green-700" : "text-orange-600")}>
                      {value}
                    </p>
                  </div>
                ))}
              </div>
              <p className="text-sm font-bold text-slate-600 mb-3">주간 진행 추이</p>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={weeklyData} margin={{ left: -10 }}>
                  <XAxis dataKey="week" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={28} />
                  <Tooltip contentStyle={{ borderRadius: 10, border: "none", boxShadow: "0 4px 24px rgba(0,0,0,0.08)", fontSize: 12 }} />
                  <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: 11 }} />
                  <Line type="monotone" dataKey="contacted" name="총 컨택" stroke="#3B82F6" strokeWidth={2.5} dot={{ r: 4, fill: "#3B82F6", strokeWidth: 0 }} />
                  <Line type="monotone" dataKey="replied"   name="회신"   stroke="#10B981" strokeWidth={2.5} dot={{ r: 4, fill: "#10B981", strokeWidth: 0 }} />
                  <Line type="monotone" dataKey="meetings"  name="미팅"   stroke="#F59E0B" strokeWidth={2.5} dot={{ r: 4, fill: "#F59E0B", strokeWidth: 0 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* ── Files ── */}
        {activeTab === "files" && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="text-base font-bold text-slate-800">프로젝트 파일</h2>
              <p className="text-xs text-slate-400 mt-0.5">바이어 리스트, 리포트, 전략 문서를 확인하세요</p>
            </div>
            {!files?.length ? (
              <div className="py-16 text-center">
                <FileText size={32} className="mx-auto mb-3 text-slate-200" />
                <p className="text-sm text-slate-400">공유된 파일이 없습니다</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {files.map((f: any) => (
                  <FileRow key={f.id} file={f} customerId={customer.id} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Meetings ── */}
        {activeTab === "meetings" && (
          <div className="space-y-3">
            {!meetings?.length ? (
              <div className="bg-white rounded-2xl p-16 text-center border border-gray-100 shadow-sm">
                <Calendar size={32} className="mx-auto mb-3 text-slate-200" />
                <p className="text-sm text-slate-400">예정된 미팅이 없습니다</p>
              </div>
            ) : meetings.map((m: any) => (
              <div key={m.id} className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm flex items-center gap-4">
                <div className={cn("w-11 h-11 rounded-xl flex items-center justify-center shrink-0",
                  m.status === "done" ? "bg-green-100" : m.status === "cancelled" ? "bg-red-50" : "bg-indigo-50")}>
                  <Calendar size={18} className={m.status === "done" ? "text-green-600" : m.status === "cancelled" ? "text-red-400" : "text-indigo-600"} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-800 text-sm">{m.title}</p>
                  {m.buyers && <p className="text-xs text-slate-500 mt-0.5">{m.buyers.company} · {m.buyers.country}</p>}
                  {m.location && (
                    <a href={m.location.startsWith("http") ? m.location : undefined} target="_blank" rel="noreferrer"
                      className="text-xs text-indigo-500 hover:underline mt-0.5 block truncate">{m.location}</a>
                  )}
                </div>
                <div className="text-right shrink-0">
                  {m.meeting_date && (
                    <p className="text-sm font-semibold text-slate-700">
                      {new Date(m.meeting_date).toLocaleDateString("ko", { month: "long", day: "numeric", weekday: "short" })}
                    </p>
                  )}
                  <span className={cn("text-[11px] font-bold mt-1 inline-block",
                    m.status === "done" ? "text-green-600" : m.status === "cancelled" ? "text-red-400" : "text-indigo-600")}>
                    {m.status === "done" ? "완료" : m.status === "cancelled" ? "취소" : "예정"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── 문의 탭 ── */}
        {activeTab === "inquiry" && (
          <div className="space-y-3">
            {inquiries?.map((q: any) => (
              <div key={q.id} className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div>
                    <p className="font-semibold text-slate-800 text-sm">{q.title}</p>
                    {q.author_name && <p className="text-xs text-slate-400 mt-0.5">{q.author_name}</p>}
                  </div>
                  <span className={cn("badge shrink-0 text-[11px]",
                    q.status === "answered" ? "bg-green-50 text-green-700" : q.status === "closed" ? "bg-gray-100 text-gray-400" : "bg-yellow-50 text-yellow-700")}>
                    {q.status === "answered" ? "답변완료" : q.status === "closed" ? "종료" : "답변대기"}
                  </span>
                </div>
                <p className="text-sm text-slate-600">{q.content}</p>
                {q.answer && (
                  <div className="mt-3 bg-indigo-50 rounded-xl p-3.5 border-l-2 border-indigo-400">
                    <p className="text-[11px] font-bold text-indigo-600 mb-1">📌 답변</p>
                    <p className="text-sm text-slate-700">{q.answer}</p>
                  </div>
                )}
                <p className="text-[11px] text-slate-300 mt-2">{new Date(q.created_at).toLocaleDateString("ko")}</p>
              </div>
            ))}
            {!inquiries?.length && <div className="text-center py-10 text-slate-400 text-sm">아직 문의가 없습니다</div>}
          </div>
        )}
      </div>

      {/* 문의 모달 */}
      {inquiryOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-slate-800">문의하기</h3>
              <button onClick={() => setInquiryOpen(false)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400">
                <X size={16} />
              </button>
            </div>
            <div className="space-y-3">
              <input value={inquiryForm.author_name} onChange={e => setInquiryForm(p => ({ ...p, author_name: e.target.value }))}
                placeholder="이름 (선택)"
                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
              <input value={inquiryForm.title} onChange={e => setInquiryForm(p => ({ ...p, title: e.target.value }))}
                placeholder="제목 *"
                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
              <textarea value={inquiryForm.content} onChange={e => setInquiryForm(p => ({ ...p, content: e.target.value }))}
                placeholder="문의 내용을 입력해주세요 *" rows={4}
                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none" />
              <button disabled={!inquiryForm.title || !inquiryForm.content || submitting}
                onClick={submitInquiry}
                className="w-full bg-indigo-600 text-white py-3 rounded-xl text-sm font-semibold hover:bg-indigo-700 disabled:opacity-40 transition-colors">
                {submitting ? "제출 중..." : "문의 제출"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Timeline Card ────────────────────────────────────────────
function TimelineCard({ step, index }: { step: any; index: number }) {
  const isDone = step.status === "done"
  const isProgress = step.status === "in_progress"
  return (
    <div className="flex flex-col items-center gap-2 w-36 shrink-0">
      <div className="w-6 h-6 rounded-full bg-slate-700 text-white text-[11px] font-bold flex items-center justify-center">{index + 1}</div>
      <div className={cn("w-14 h-14 rounded-full border-2 flex items-center justify-center shadow-sm transition-all",
        isDone ? "bg-green-500 border-green-500 shadow-green-200" : isProgress ? "bg-white border-indigo-500 shadow-indigo-100" : "bg-white border-gray-200")}>
        {isDone ? <CheckCircle2 size={26} className="text-white" /> : isProgress ? <Clock size={24} className="text-indigo-500 animate-pulse" /> : <Circle size={24} className="text-gray-300" />}
      </div>
      <p className="text-xs font-semibold text-slate-700 text-center leading-tight px-1">{step.step_name}</p>
      {(step.start_date || step.end_date) && (
        <p className="text-[10px] text-slate-400 text-center leading-tight">
          {step.start_date && step.end_date ? `${step.start_date}~${step.end_date}` : step.start_date || step.end_date}
        </p>
      )}
      <span className={cn("text-[11px] font-bold px-2.5 py-0.5 rounded-full",
        isDone ? "bg-green-100 text-green-700" : isProgress ? "bg-indigo-100 text-indigo-700" : "bg-gray-100 text-gray-400")}>
        {isDone ? "완료" : isProgress ? "진행중" : "대기"}
      </span>
    </div>
  )
}

// ── File Row (미리보기 + 다운로드) ───────────────────────────
function FileRow({ file, customerId }: { file: any; customerId: string }) {
  const [downloading, setDownloading] = useState(false)
  const [previewing, setPreviewing]   = useState(false)
  const [previewUrl, setPreviewUrl]   = useState<string | null>(null)
  const [previewType, setPreviewType] = useState<"pdf" | "excel" | null>(null)
  const [excelData, setExcelData]     = useState<any[][] | null>(null)
  const [loadingPreview, setLoadingPreview] = useState(false)

  const isPdf   = file.name.toLowerCase().endsWith(".pdf")
  const isExcel = file.name.toLowerCase().match(/\.(xlsx|xls)$/)
  const canPreview = isPdf || isExcel

  const getSignedUrl = async () => {
    const res = await fetch(`${API}/api/client/files/${customerId}/download/${file.id}`)
    const { signed_url } = await res.json()
    return signed_url
  }

  const handleDownload = async () => {
    setDownloading(true)
    try {
      const url = await getSignedUrl()
      const a = document.createElement("a"); a.href = url; a.download = file.name; a.click()
    } finally { setDownloading(false) }
  }

  const handlePreview = async () => {
    if (previewing) { setPreviewing(false); setPreviewUrl(null); setExcelData(null); return }
    setLoadingPreview(true)
    try {
      const url = await getSignedUrl()
      if (isPdf) {
        setPreviewUrl(url)
        setPreviewType("pdf")
      } else if (isExcel) {
        const response = await fetch(url)
        const buffer = await response.arrayBuffer()
        const XLSX = await import("xlsx")
        const wb = XLSX.read(buffer, { type: "array" })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][]
        setExcelData(rows.slice(0, 30))
        setPreviewType("excel")
      }
      setPreviewing(true)
    } catch { alert("미리보기를 불러올 수 없습니다") }
    finally { setLoadingPreview(false) }
  }

  return (
    <div>
      <div className="px-6 py-4 flex items-center gap-4">
        <div className="w-9 h-9 bg-indigo-50 rounded-xl flex items-center justify-center shrink-0">
          <FileText size={15} className="text-indigo-500" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-slate-700 text-sm truncate">{file.name}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[10px] bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full font-medium">{CATEGORY_LABELS[file.category] || file.category}</span>
            <span className="text-[10px] text-slate-400">{new Date(file.created_at).toLocaleDateString("ko")}</span>
            <span className="text-[10px] text-slate-400">{file.size_bytes ? `${(file.size_bytes/1024).toFixed(0)} KB` : ""}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {canPreview && (
            <button onClick={handlePreview} disabled={loadingPreview}
              className={cn("flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors",
                previewing ? "bg-slate-100 text-slate-600 border-slate-200" : "bg-white text-slate-600 border-slate-200 hover:border-indigo-300 hover:text-indigo-600")}>
              {loadingPreview
                ? <div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
                : <ChevronDown size={13} className={cn("transition-transform", previewing && "rotate-180")} />}
              미리보기
            </button>
          )}
          <button onClick={handleDownload} disabled={downloading}
            className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-800 disabled:opacity-40 transition-colors px-3 py-1.5 rounded-lg border border-indigo-200 hover:bg-indigo-50">
            {downloading ? <div className="w-3 h-3 border border-indigo-400 border-t-transparent rounded-full animate-spin" /> : <Download size={13} />}
            다운로드
          </button>
        </div>
      </div>

      {/* 미리보기 영역 */}
      {previewing && (
        <div className="mx-6 mb-4 rounded-xl border border-slate-200 overflow-hidden bg-slate-50">
          {previewType === "pdf" && previewUrl && (
            <iframe src={previewUrl} className="w-full h-[500px]" title={file.name} />
          )}
          {previewType === "excel" && excelData && (
            <div className="overflow-auto max-h-96">
              <table className="text-xs border-collapse w-full">
                <tbody>
                  {excelData.map((row, ri) => (
                    <tr key={ri} className={ri === 0 ? "bg-indigo-50 font-semibold" : ri % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                      {(row as any[]).map((cell, ci) => (
                        <td key={ci} className="border border-slate-200 px-3 py-1.5 whitespace-nowrap text-slate-700">
                          {cell !== null && cell !== undefined ? String(cell) : ""}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-[10px] text-slate-400 text-center py-2">최대 30행까지 미리보기 표시</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function buildWeeklyData(stats: any, weeklyData?: any[]) {
  // 실제 차수별 데이터가 있으면 사용
  if (weeklyData && weeklyData.length > 0) return weeklyData
  // 없으면 통계 기반 추정
  const weeks = ["1차", "2차", "3차", "4차", "5차", "6차"]
  const n = weeks.length
  const totalContacted = stats?.contacted || 0
  const totalReplied = stats?.replied || 0
  return weeks.map((week, i) => ({
    week,
    contacted: Math.round(totalContacted * (i + 1) / n),
    replied:   Math.round(totalReplied * (i + 1) / n),
    meetings:  i < 2 ? 0 : Math.round((stats?.meetings || 0) * (i - 1) / (n - 2)),
  }))
}
