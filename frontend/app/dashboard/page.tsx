"use client"
import { useEffect, useState } from "react"
import AppLayout from "@/components/layout/AppLayout"
import { api } from "@/lib/api"
import { CAMPAIGN_STATUS_META } from "@/lib/utils"
import {
  Users, TrendingUp, Mail, CheckCircle,
  ArrowRight, Zap, Calendar, MessageSquare
} from "lucide-react"
import Link from "next/link"
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell
} from "recharts"

export default function DashboardPage() {
  const [buyers, setBuyers]     = useState<any[]>([])
  const [campaigns, setCampaigns] = useState<any[]>([])
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    Promise.all([api.buyers.list(), api.campaigns.list()])
      .then(([b, c]) => { setBuyers(b); setCampaigns(c) })
      .finally(() => setLoading(false))
  }, [])

  // ── 통계 계산 (contact_logs 기반) ──────────────────────────
  const total = buyers.length

  // 모든 contact_logs 평탄화
  const allLogs = buyers.flatMap((b: any) => (b.contact_logs || []).map((l: any) => ({ ...l, buyer: b })))

  // 컨택 수 = contact_logs 전체 건수 (총 시도 횟수)
  const contacted = allLogs.length

  // 회신 수 = contact_logs 중 replied=true인 바이어 수 (중복 제거)
  const repliedBuyerIds = new Set(allLogs.filter(l => l.replied === true).map(l => l.buyer_id))
  const replied = repliedBuyerIds.size

  const replyRate = contacted > 0 ? Math.round((replied / contacted) * 100) : 0

  // ── 이번 주 데이터 ──────────────────────────────────────────
  const now = new Date()
  const weekStart = new Date(now)
  weekStart.setDate(now.getDate() - now.getDay()) // 이번주 일요일
  weekStart.setHours(0, 0, 0, 0)

  // 이번주 contact_logs
  const thisWeekLogs = allLogs.filter(l => {
    if (!l.contact_date) return false
    const d = new Date(l.contact_date.split(" ")[0].replace(/\./g, "-"))
    return d >= weekStart
  })

  const thisWeekContacted = new Set(thisWeekLogs.map(l => l.buyer_id)).size
  const thisWeekReplied   = thisWeekLogs.filter(l => l.replied === true).length

  // 이번주 요일별 연락 건수
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
  const weeklyChart = dayNames.map((day, i) => {
    const dayLogs = thisWeekLogs.filter(l => {
      const d = new Date(l.contact_date?.split(" ")[0]?.replace(/\./g, "-"))
      return d.getDay() === i
    })
    return {
      day,
      contacted: dayLogs.length,
      replied: dayLogs.filter(l => l.replied === true).length,
    }
  })

  // 이번주 회신Y 바이어 리스트
  const thisWeekRepliedList = thisWeekLogs
    .filter(l => l.replied === true)
    .map(l => ({
      company: l.buyer?.company,
      country: l.buyer?.country,
      email: l.buyer?.email,
      date: l.contact_date,
      result: l.result,
      attempt: l.attempt_no,
    }))
    .filter((v, i, arr) => arr.findIndex(x => x.company === v.company) === i) // 중복 제거

  const recentCampaigns = campaigns.slice(0, 5)

  if (loading) return (
    <AppLayout>
      <div className="flex items-center justify-center h-screen">
        <div className="flex gap-2 items-center text-slate-400">
          <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm">Loading...</span>
        </div>
      </div>
    </AppLayout>
  )

  return (
    <AppLayout>
      <div className="p-8 max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
            <p className="text-sm text-slate-500 mt-1">Overall buyer outreach overview</p>
          </div>
          <Link href="/campaigns/new"
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-colors">
            <Zap size={15} />
            Start New Project
          </Link>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          {[
            { label: "Total Buyers",  value: total,           icon: Users,        color: "#4F46E5", bg: "#EEF2FF" },
            { label: "Contacted",     value: contacted,       icon: Mail,         color: "#2563EB", bg: "#EFF6FF" },
            { label: "Replied",       value: replied,         icon: CheckCircle,  color: "#059669", bg: "#ECFDF5" },
            { label: "Reply Rate",    value: `${replyRate}%`, icon: TrendingUp,   color: "#F59E0B", bg: "#FFFBEB" },
          ].map(({ label, value, icon: Icon, color, bg }) => (
            <div key={label} className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-slate-500">{label}</span>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: bg }}>
                  <Icon size={15} style={{ color }} />
                </div>
              </div>
              <div className="text-2xl font-bold text-slate-900">{value}</div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-6 mb-6">
          {/* 이번주 연락 현황 차트 */}
          <div className="col-span-2 bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Calendar size={15} className="text-indigo-500" />
                <h2 className="text-sm font-semibold text-slate-800">This Week's Outreach</h2>
              </div>
              <div className="flex items-center gap-4 text-xs text-slate-500">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-indigo-400 inline-block" />
                  Contacted: <span className="font-bold text-slate-700">{thisWeekContacted}</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block" />
                  Replied: <span className="font-bold text-slate-700">{thisWeekReplied}</span>
                </span>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={weeklyChart} barSize={18} barGap={4}>
                <XAxis dataKey="day" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={25} />
                <Tooltip
                  contentStyle={{ borderRadius: 10, border: "none", boxShadow: "0 4px 20px rgba(0,0,0,0.1)", fontSize: 12 }}
                  cursor={{ fill: "#F1F5F9" }}
                />
                <Bar dataKey="contacted" name="Contacted" fill="#818CF8" radius={[4, 4, 0, 0]} />
                <Bar dataKey="replied"   name="Replied"   fill="#34D399" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* 이번주 회신 Y 리스트 */}
          <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex flex-col">
            <div className="flex items-center gap-2 mb-4">
              <MessageSquare size={15} className="text-emerald-500" />
              <h2 className="text-sm font-semibold text-slate-800">This Week's Replies</h2>
              <span className="ml-auto text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                {thisWeekRepliedList.length}
              </span>
            </div>
            {thisWeekRepliedList.length === 0 ? (
              <div className="flex-1 flex items-center justify-center text-center">
                <div>
                  <p className="text-2xl mb-2">📭</p>
                  <p className="text-xs text-slate-400">No replies this week yet</p>
                </div>
              </div>
            ) : (
              <div className="space-y-2.5 overflow-y-auto flex-1">
                {thisWeekRepliedList.map((r, i) => (
                  <div key={i} className="flex items-start gap-2.5 p-2.5 bg-emerald-50 rounded-xl border border-emerald-100">
                    <div className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                      ✓
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-800 truncate">{r.company}</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">{r.country} · #{r.attempt}차</p>
                      {r.result && <p className="text-[10px] text-emerald-700 mt-0.5 truncate">{r.result}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Recent Projects */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-800">Recent Projects</h2>
            <Link href="/campaigns" className="text-xs text-indigo-600 hover:underline flex items-center gap-1">
              View all <ArrowRight size={12} />
            </Link>
          </div>
          <div className="divide-y divide-slate-50">
            {recentCampaigns.length === 0 && (
              <div className="py-10 text-center text-sm text-slate-400">
                No projects yet.{" "}
                <Link href="/campaigns/new" className="text-indigo-600 underline">Start a new project</Link>
              </div>
            )}
            {recentCampaigns.map(c => {
              const meta = CAMPAIGN_STATUS_META[c.status] || { label: c.status, color: "#64748B" }
              const info = c.campaign_info || {}
              return (
                <Link key={c.id} href={`/campaigns/${c.id}`}
                  className="flex items-center gap-4 px-5 py-3.5 hover:bg-slate-50 transition-colors">
                  <div className="w-8 h-8 rounded-xl bg-indigo-50 flex items-center justify-center">
                    <Zap size={14} className="text-indigo-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-slate-800 truncate">
                      {info.company_name} — {info.target_country}
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5">{info.product_description}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full"
                      style={{ color: meta.color, background: meta.color + "15" }}>
                      {meta.label}
                    </span>
                    <ArrowRight size={14} className="text-slate-300" />
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
