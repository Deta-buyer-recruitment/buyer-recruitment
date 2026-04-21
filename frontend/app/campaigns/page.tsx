"use client"
import { useEffect, useState } from "react"
import AppLayout from "@/components/layout/AppLayout"
import { api } from "@/lib/api"
import { CAMPAIGN_STATUS_META } from "@/lib/utils"
import { Zap, Plus, ArrowRight, Trash2, AlertTriangle } from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

// 타임라인 기반 status 뱃지 계산
function getTimelineStatus(timeline: any[]): { label: string; color: string } | null {
  if (!timeline || timeline.length === 0) return null

  // 마지막 단계가 완료 → "완료"
  const sorted = [...timeline].sort((a, b) => a.step_no - b.step_no)
  const last = sorted[sorted.length - 1]
  if (last?.status === "done") {
    return { label: "완료", color: "#059669" }
  }

  // 진행중인 단계 → 해당 단계명 표시
  const inProgress = sorted.find(t => t.status === "in_progress")
  if (inProgress) {
    return { label: `${inProgress.step_name} 진행중`, color: "#2E5A8E" }
  }

  return null
}

export default function ProjectsPage() {
  const [campaigns, setCampaigns] = useState<any[]>([])
  const [timelines, setTimelines] = useState<Record<string, any[]>>({})
  const [loading, setLoading] = useState(true)
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null)
  const [deleting, setDeleting] = useState(false)

  const load = async () => {
    const list = await api.campaigns.list()
    setCampaigns(list)

    // 각 캠페인의 customer_id로 타임라인 병렬 조회
    const customerIds = [...new Set(list.map((c: any) => c.customer_id).filter(Boolean))]
    const results = await Promise.allSettled(
      customerIds.map(async (cid: any) => {
        const res = await fetch(`${API}/api/client/timeline/${cid}`)
        if (!res.ok) return { cid, data: [] }
        return { cid, data: await res.json() }
      })
    )
    const tlMap: Record<string, any[]> = {}
    results.forEach(r => {
      if (r.status === "fulfilled") tlMap[r.value.cid] = r.value.data
    })
    setTimelines(tlMap)
  }

  useEffect(() => {
    load().finally(() => setLoading(false))
  }, [])

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await fetch(`${API}/api/campaigns/${deleteTarget.id}`, { method: "DELETE" })
      if (res.ok) {
        toast.success("프로젝트가 삭제되었습니다")
        setCampaigns(prev => prev.filter(c => c.id !== deleteTarget.id))
        setDeleteTarget(null)
      } else {
        toast.error("삭제에 실패했습니다")
      }
    } catch {
      toast.error("삭제 중 오류가 발생했습니다")
    } finally {
      setDeleting(false)
    }
  }

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
              const campaignMeta = CAMPAIGN_STATUS_META[c.status] || { label: c.status, color: "#64748B" }
              const info = c.campaign_info || {}
              const timeline = timelines[c.customer_id] || []
              const timelineMeta = getTimelineStatus(timeline)
              // 타임라인 status가 있으면 우선 표시, 없으면 campaign status
              const displayMeta = timelineMeta || campaignMeta

              return (
                <div key={c.id} className="flex items-center gap-4 bg-white rounded-2xl px-6 py-4 border border-slate-100 shadow-sm hover:shadow-md hover:border-indigo-100 transition-all group">
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
                    <Zap size={16} className="text-indigo-500" />
                  </div>
                  <Link href={`/campaigns/${c.id}`} className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-slate-800 truncate">{info.company_name || "Unnamed Project"}</p>
                      <span className="text-xs text-slate-400 shrink-0">{info.target_country}</span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5 truncate">{info.product_description}</p>
                  </Link>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full"
                      style={{ color: displayMeta.color, background: displayMeta.color + "15" }}>
                      {displayMeta.label}
                    </span>
                    <span className="text-xs text-slate-400">
                      {new Date(c.created_at).toLocaleDateString("en")}
                    </span>
                    {/* 삭제 버튼 — hover 시 표시 */}
                    <button
                      onClick={e => { e.preventDefault(); setDeleteTarget(c) }}
                      className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                      title="프로젝트 삭제">
                      <Trash2 size={14} />
                    </button>
                    <Link href={`/campaigns/${c.id}`}>
                      <ArrowRight size={14} className="text-slate-300" />
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* 삭제 확인 모달 */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                <AlertTriangle size={18} className="text-red-500" />
              </div>
              <div>
                <h3 className="font-bold text-slate-800">프로젝트 삭제</h3>
                <p className="text-xs text-slate-400 mt-0.5">이 작업은 되돌릴 수 없습니다.</p>
              </div>
            </div>
            <div className="bg-red-50 rounded-xl px-4 py-3 mb-5">
              <p className="font-semibold text-slate-800 text-sm">
                {deleteTarget.campaign_info?.company_name || "Unnamed Project"}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                {deleteTarget.campaign_info?.target_country} · {deleteTarget.campaign_info?.product_description}
              </p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setDeleteTarget(null)}
                className="flex-1 border border-slate-200 text-slate-600 py-2.5 rounded-xl text-sm font-medium hover:bg-slate-50">
                취소
              </button>
              <button onClick={handleDelete} disabled={deleting}
                className="flex-1 bg-red-500 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-red-600 disabled:opacity-50 flex items-center justify-center gap-2">
                {deleting
                  ? <><div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />삭제 중...</>
                  : <><Trash2 size={13} />삭제</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  )
}
