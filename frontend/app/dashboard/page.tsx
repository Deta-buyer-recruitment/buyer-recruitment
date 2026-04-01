"use client"
import { useEffect, useState } from "react"
import AppLayout from "@/components/layout/AppLayout"
import { api } from "@/lib/api"
import { STATUS_META, CAMPAIGN_STATUS_META } from "@/lib/utils"
import {
  Users, TrendingUp, Mail, CheckCircle,
  ArrowRight, Zap, Globe
} from "lucide-react"
import Link from "next/link"
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell
} from "recharts"

export default function DashboardPage() {
  const [buyers, setBuyers] = useState<any[]>([])
  const [campaigns, setCampaigns] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([api.buyers.list(), api.campaigns.list()])
      .then(([b, c]) => { setBuyers(b); setCampaigns(c) })
      .finally(() => setLoading(false))
  }, [])

  const total = buyers.length
  const contacted = buyers.filter(b => b.status !== "pending").length
  const replied = buyers.filter(b => ["replied", "meeting", "closed"].includes(b.status)).length
  const replyRate = contacted > 0 ? Math.round((replied / contacted) * 100) : 0

  const byCountry = Object.entries(
    buyers.reduce((acc: Record<string, number>, b) => {
      acc[b.country] = (acc[b.country] || 0) + 1; return acc
    }, {})
  ).sort((a, b) => b[1] - a[1]).slice(0, 8)
    .map(([country, count]) => ({ country, count }))

  const byStatus = Object.entries(STATUS_META).map(([k, v]) => ({
    status: v.label,
    count: buyers.filter(b => b.status === k).length,
    color: v.color,
    bg: v.bg,
  })).filter(s => s.count > 0)

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
            { label: "Total Buyers",   value: total,       icon: Users,        color: "#4F46E5", bg: "#EEF2FF" },
            { label: "Contacted",      value: contacted,   icon: Mail,         color: "#2563EB", bg: "#EFF6FF" },
            { label: "Replied",        value: replied,     icon: CheckCircle,  color: "#059669", bg: "#ECFDF5" },
            { label: "Reply Rate",     value: `${replyRate}%`, icon: TrendingUp, color: "#F59E0B", bg: "#FFFBEB" },
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
          {/* Country Distribution */}
          <div className="col-span-2 bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <Globe size={15} className="text-indigo-500" />
              <h2 className="text-sm font-semibold text-slate-800">Buyer Distribution by Country</h2>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={byCountry} barSize={28}>
                <XAxis dataKey="country" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={30} />
                <Tooltip
                  contentStyle={{ borderRadius: 10, border: "none", boxShadow: "0 4px 20px rgba(0,0,0,0.1)" }}
                  cursor={{ fill: "#F1F5F9" }}
                />
                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                  {byCountry.map((_, i) => (
                    <Cell key={i} fill={`hsl(${235 + i * 18}, 70%, ${55 + i * 3}%)`} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Status Breakdown */}
          <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-800 mb-4">Status Breakdown</h2>
            <div className="space-y-2.5">
              {byStatus.map(({ status, count, color }) => (
                <div key={status} className="flex items-center gap-3">
                  <div className="flex-1 flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ background: color }} />
                    <span className="text-xs text-slate-600">{status}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 rounded-full" style={{
                      width: `${Math.max(8, (count / total) * 80)}px`,
                      background: color, opacity: 0.3
                    }} />
                    <span className="text-xs font-semibold text-slate-700 w-6 text-right">{count}</span>
                  </div>
                </div>
              ))}
            </div>
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
