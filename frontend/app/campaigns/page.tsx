"use client"
import { useEffect, useState } from "react"
import AppLayout from "@/components/layout/AppLayout"
import { api } from "@/lib/api"
import { CAMPAIGN_STATUS_META } from "@/lib/utils"
import { Zap, Plus, ArrowRight } from "lucide-react"
import Link from "next/link"

export default function ProjectsPage() {
  const [campaigns, setCampaigns] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.campaigns.list().then(setCampaigns).finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <AppLayout>
      <div className="flex items-center justify-center h-screen">
        <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    </AppLayout>
  )

  return (
    <AppLayout>
      <div className="p-8 max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Projects</h1>
            <p className="text-sm text-slate-500 mt-1">Manage all buyer outreach campaigns</p>
          </div>
          <Link href="/campaigns/new"
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-colors">
            <Plus size={15} /> New Project
          </Link>
        </div>

        {campaigns.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm py-20 text-center">
            <Zap size={32} className="mx-auto mb-4 text-slate-200" />
            <p className="text-slate-500 font-medium">No projects yet</p>
            <p className="text-slate-400 text-sm mt-1 mb-6">Start by creating your first buyer outreach project</p>
            <Link href="/campaigns/new"
              className="inline-flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-indigo-700">
              <Plus size={14} /> Start New Project
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {campaigns.map(c => {
              const meta = CAMPAIGN_STATUS_META[c.status] || { label: c.status, color: "#64748B" }
              const info = c.campaign_info || {}
              return (
                <Link key={c.id} href={`/campaigns/${c.id}`}
                  className="flex items-center gap-4 bg-white rounded-2xl px-6 py-4 border border-slate-100 shadow-sm hover:shadow-md hover:border-indigo-100 transition-all">
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
                    <Zap size={16} className="text-indigo-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-slate-800 truncate">{info.company_name || "Unnamed Project"}</p>
                      <span className="text-xs text-slate-400 shrink-0">{info.target_country}</span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5 truncate">{info.product_description}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full"
                      style={{ color: meta.color, background: meta.color + "15" }}>
                      {meta.label}
                    </span>
                    <span className="text-xs text-slate-400">
                      {new Date(c.created_at).toLocaleDateString("en")}
                    </span>
                    <ArrowRight size={14} className="text-slate-300" />
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </AppLayout>
  )
}
