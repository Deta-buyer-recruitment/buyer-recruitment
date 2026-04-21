"use client"
import { useEffect, useRef, useState } from "react"
import { useParams } from "next/navigation"
import AppLayout from "@/components/layout/AppLayout"
import { api } from "@/lib/api"
import { CAMPAIGN_STATUS_META, cn } from "@/lib/utils"
import { toast } from "sonner"
import {
  Play, Send, ArrowLeft, RefreshCw, ChevronDown, ChevronUp,
  Upload, Edit2, Save, X, Users, Search, Mail, Brain, FileText,
  MessageSquare, CheckSquare, Square, Image, Paperclip, Bot, User, Zap,
  Trash2, AlertTriangle, Plus, ChevronRight
} from "lucide-react"
import Link from "next/link"

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
type LogLine = { message: string; level: string; timestamp: string }
type Tab = "overview" | "templates"

const STEPS = [
  { key: "website",   label: "Website Search",   icon: Search,   desc: "Search official websites" },
  { key: "hunter",    label: "Extract Contacts",  icon: Mail,     desc: "Hunter.io — up to 3 contacts" },
  { key: "abm",       label: "ABM Analysis",      icon: Brain,    desc: "Analyze & strategize" },
  { key: "templates", label: "Email Templates",   icon: FileText, desc: "Generate personalized emails" },
]

const INFO_FIELDS = [
  { key: "company_name",        label: "Company Name" },
  { key: "target_country",      label: "Target Country" },
  { key: "product_description", label: "Product Description" },
  { key: "hs_code",             label: "HS Code" },
  { key: "company_website",     label: "Website" },
  { key: "usp",                 label: "USP", multiline: true },
  { key: "signature_name",      label: "Sender Name" },
  { key: "signature_title",     label: "Sender Title" },
  { key: "signature_phone",     label: "Sender Phone" },
]

// ── 접기/펼치기 섹션 컴포넌트 ──────────────────────────────────────
function CollapsibleSection({
  title, children, defaultOpen = true, badge
}: {
  title: string; children: React.ReactNode; defaultOpen?: boolean; badge?: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{title}</h2>
          {badge}
        </div>
        {open ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
      </button>
      {open && <div className="px-5 pb-5">{children}</div>}
    </div>
  )
}

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [campaign, setCampaign]   = useState<any>(null)
  const [buyers, setBuyers]       = useState<any[]>([])
  const [logs, setLogs]           = useState<LogLine[]>([])
  const [running, setRunning]     = useState(false)
  const [loading, setLoading]     = useState(true)
  const [tab, setTab]             = useState<Tab>("overview")
  const [sendingRound, setSendingRound] = useState("")
  const [classification, setClassification] = useState<any>(null)
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploading, setUploading]   = useState(false)
  const [editingInfo, setEditingInfo] = useState(false)
  const [editForm, setEditForm]     = useState<Record<string, string>>({})
  const [savingInfo, setSavingInfo] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null)
  const [deleting, setDeleting]     = useState(false)
  const [timeline, setTimeline]     = useState<any[]>([])
  const [savingTimeline, setSavingTimeline] = useState(false)
  const [newStepName, setNewStepName] = useState("")
  const [addingStep, setAddingStep] = useState(false)
  const [projectFile, setProjectFile] = useState<File | null>(null)
  const [uploadingFile, setUploadingFile] = useState(false)
  const [projectFiles, setProjectFiles] = useState<any[]>([])
  const [deletingFileId, setDeletingFileId] = useState<string | null>(null)

  // 바이어 선택 (step 4 — 선별 실행용)
  const [selectedBuyerIds, setSelectedBuyerIds] = useState<Set<string>>(new Set())
  const [runningStep, setRunningStep] = useState<string | null>(null)

  const logEndRef = useRef<HTMLDivElement>(null)
  const esRef = useRef<EventSource | null>(null)

  const load = async () => {
    try {
      const c = await api.campaigns.get(id)
      setCampaign(c)
      setEditForm(c.campaign_info || {})
      const b = await api.buyers.list(c.customer_id)
      setBuyers(b)
      const tlRes = await fetch(`${API}/api/client/timeline/${c.customer_id}`)
      if (tlRes.ok) setTimeline(await tlRes.json())
      const filesRes = await fetch(`${API}/api/client/files/${c.customer_id}`)
      if (filesRes.ok) setProjectFiles(await filesRes.json())
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [id])
  useEffect(() => { logEndRef.current?.scrollIntoView({ behavior: "smooth" }) }, [logs])

  const stopAgent = async () => {
    try {
      esRef.current?.close()
      esRef.current = null
      await fetch(`${API}/api/agent/stop/${id}`, { method: "POST" })
      setRunning(false)
      setRunningStep(null)
      setLogs(prev => [...prev, { message: "⏹ Agent 중지됨", level: "warn", timestamp: new Date().toISOString() }])
    } catch (e) {}
  }

  const openSSE = (url: string, stepKey?: string) => {
    if (running) return
    setRunning(true)
    setRunningStep(stepKey || null)
    setLogs(prev => [...prev, { message: `▶ ${stepKey ? STEPS.find(s => s.key === stepKey)?.label : "Run All"}`, level: "start", timestamp: new Date().toISOString() }])
    const es = new EventSource(url)
    esRef.current = es
    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data)
        if (data.level === "done") { es.close(); esRef.current = null; setRunning(false); setRunningStep(null); load(); return }
        setLogs(prev => [...prev, data])
      } catch {}
    }
    es.onerror = () => { es.close(); esRef.current = null; setRunning(false); setRunningStep(null); load() }
  }

  const runStep = (stepKey: string) => {
    // 선택된 바이어가 있으면 쿼리 파라미터로 전달 (백엔드 지원 시)
    openSSE(`${API}/api/agent/run-step/${id}?step=${stepKey}`, stepKey)
  }

  const runAll = () => {
    setLogs([])
    openSSE(api.agent.runUrl(id))
  }

  const uploadBuyers = async () => {
    if (!uploadFile) return
    setUploading(true)
    try {
      const result = await api.campaigns.uploadBuyers(id, campaign.customer_id, uploadFile)
      toast.success(`${result.inserted} buyers uploaded!`)
      setUploadFile(null); load()
    } catch (e: any) { toast.error(e.message) }
    finally { setUploading(false) }
  }

  const deleteBuyer = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await fetch(`${API}/api/buyers/${deleteTarget.id}`, { method: "DELETE" })
      setDeleteTarget(null); load()
    } catch { }
    finally { setDeleting(false) }
  }

  const addTimelineStep = async () => {
    if (!newStepName.trim()) return
    setAddingStep(true)
    try {
      const res = await fetch(`${API}/api/client/timeline/${campaign.customer_id}/add-step`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ step_name: newStepName.trim() })
      })
      if (res.ok) { setTimeline(prev => [...prev, await res.json()]); setNewStepName("") }
    } catch {} finally { setAddingStep(false) }
  }

  const deleteTimelineStep = async (step_no: number) => {
    try {
      await fetch(`${API}/api/client/timeline/${campaign.customer_id}/step/${step_no}`, { method: "DELETE" })
      setTimeline(prev => prev.filter(t => t.step_no !== step_no))
    } catch {}
  }

  const uploadProjectFile = async () => {
    if (!projectFile) return
    setUploadingFile(true)
    try {
      const form = new FormData()
      form.append("file", projectFile)
      form.append("category", "report")
      form.append("uploader_id", "admin")
      const res = await fetch(`${API}/api/client/files/${campaign.customer_id}/upload`, { method: "POST", body: form })
      if (res.ok) { toast.success(`${projectFile.name} uploaded!`); setProjectFile(null); load() }
      else toast.error("Upload failed")
    } catch { toast.error("Upload error") }
    finally { setUploadingFile(false) }
  }

  const deleteProjectFile = async (fileId: string, fileName: string) => {
    if (!confirm(`"${fileName}" 파일을 삭제하시겠습니까?`)) return
    setDeletingFileId(fileId)
    try {
      const res = await fetch(`${API}/api/client/files/${campaign.customer_id}/${fileId}`, { method: "DELETE" })
      if (res.ok) { toast.success("파일이 삭제되었습니다"); setProjectFiles(prev => prev.filter(f => f.id !== fileId)) }
      else toast.error("삭제에 실패했습니다")
    } catch { toast.error("삭제 중 오류가 발생했습니다") }
    finally { setDeletingFileId(null) }
  }

  const saveTimeline = async (step_no: number, field: string, value: string) => {
    setSavingTimeline(true)
    try {
      await fetch(`${API}/api/client/timeline/${campaign.customer_id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ step_no, [field]: value })
      })
      setTimeline(prev => prev.map(t => t.step_no === step_no ? { ...t, [field]: value } : t))
    } catch { } finally { setSavingTimeline(false) }
  }

  const saveInfo = async () => {
    setSavingInfo(true)
    try {
      await fetch(`${API}/api/campaigns/${id}/info`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaign_info: editForm })
      })
      toast.success("Project info updated"); setEditingInfo(false); load()
    } catch { toast.error("Failed to update") }
    finally { setSavingInfo(false) }
  }

  const sendRound = async (roundKey: string) => {
    setSendingRound(roundKey)
    try {
      const result = await api.agent.send({ campaign_id: id, round_key: roundKey })
      toast.success(`Sent! Success: ${result.success_count} / Failed: ${result.fail_count}`)
      load()
    } catch (e: any) { toast.error(e.message) }
    finally { setSendingRound("") }
  }

  // 바이어 선택 토글
  const toggleBuyerSelect = (buyerId: string) => {
    setSelectedBuyerIds(prev => {
      const next = new Set(prev)
      next.has(buyerId) ? next.delete(buyerId) : next.add(buyerId)
      return next
    })
  }
  const toggleAllBuyers = () => {
    if (selectedBuyerIds.size === buyers.length) setSelectedBuyerIds(new Set())
    else setSelectedBuyerIds(new Set(buyers.map(b => b.id)))
  }

  if (loading) return (
    <AppLayout>
      <div className="flex items-center justify-center h-screen">
        <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    </AppLayout>
  )
  if (!campaign) return <AppLayout><div className="p-8 text-slate-500">Project not found</div></AppLayout>

  const info = campaign.campaign_info || {}
  const statusMeta = CAMPAIGN_STATUS_META[campaign.status] || { label: campaign.status, color: "#64748B" }
  const templates = campaign.email_templates || []
  const canSendR1 = ["review_pending", "templates_done"].includes(campaign.status)
  const canSendR2 = campaign.status === "r1_sent"
  const canSendR3 = campaign.status === "r2_sent"
  const allBuyersSelected = selectedBuyerIds.size === buyers.length && buyers.length > 0

  const LOG_COLORS: Record<string, string> = {
    start: "#4F46E5", step: "#2563EB", success: "#059669",
    warn: "#D97706", error: "#DC2626", done: "#7C3AED", info: "#94A3B8",
  }

  return (
    <AppLayout>
      <div className="p-8 max-w-6xl mx-auto">
        <Link href="/campaigns" className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-4">
          <ArrowLeft size={14} /> Projects
        </Link>

        {/* Header */}
        <div className="flex items-start justify-between mb-5">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-xl font-bold text-slate-900">{info.company_name}</h1>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full"
                style={{ color: statusMeta.color, background: statusMeta.color + "15" }}>
                {statusMeta.label}
              </span>
            </div>
            <p className="text-sm text-slate-500">{info.target_country} · {info.product_description}</p>
            <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
              <Users size={11} /> {buyers.length} buyers · {templates.length} templates
            </p>
          </div>
          <button onClick={load} className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100">
            <RefreshCw size={15} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-white rounded-xl p-1 border border-slate-100 shadow-sm w-fit">
          {[
            { key: "overview",  label: "Overview",  icon: Zap },
            { key: "templates", label: `Templates (${templates.length})`, icon: MessageSquare },
          ].map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => setTab(key as Tab)}
              className={cn("flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all",
                tab === key ? "bg-indigo-600 text-white shadow-sm" : "text-slate-500 hover:text-slate-700")}>
              <Icon size={13} />{label}
            </button>
          ))}
        </div>

        {/* ── Overview Tab ── */}
        {tab === "overview" && (
          <div className="grid grid-cols-3 gap-6">
            {/* ── Left Column ── */}
            <div className="col-span-1 space-y-4">

              {/* Buyer Upload */}
              <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
                <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Buyer List from VOLZA</h2>
                <p className="text-xs text-slate-400 mb-3">{buyers.length > 0 ? `${buyers.length} buyers loaded` : "No buyers yet"}</p>
                <label className={cn("flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-medium cursor-pointer transition-all mb-2",
                  uploadFile ? "border-indigo-300 bg-indigo-50 text-indigo-700" : "border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300")}>
                  <Upload size={12} />
                  {uploadFile ? uploadFile.name : "Select CSV / Excel"}
                  <input type="file" accept=".csv,.xlsx,.xls" className="hidden"
                    onChange={e => setUploadFile(e.target.files?.[0] || null)} />
                </label>
                {uploadFile && (
                  <button onClick={uploadBuyers} disabled={uploading}
                    className="w-full bg-indigo-600 text-white text-xs font-semibold py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-40">
                    {uploading ? "Uploading..." : "Upload Buyers"}
                  </button>
                )}
              </div>

              {/* Run Steps */}
              <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
                <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Run Steps</h2>
                <div className="space-y-2">
                  {STEPS.map(({ key, label, icon: Icon, desc }) => (
                    <button key={key} onClick={() => runStep(key)} disabled={running || buyers.length === 0}
                      className={cn(
                        "w-full flex items-center gap-3 p-2.5 rounded-xl border transition-all text-left group",
                        runningStep === key
                          ? "border-indigo-300 bg-indigo-50"
                          : "border-slate-100 hover:border-indigo-200 hover:bg-indigo-50 disabled:opacity-40 disabled:cursor-not-allowed"
                      )}>
                      <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center shrink-0",
                        runningStep === key ? "bg-indigo-100" : "bg-slate-100 group-hover:bg-indigo-100")}>
                        {runningStep === key
                          ? <div className="w-3.5 h-3.5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                          : <Icon size={13} className="text-slate-500 group-hover:text-indigo-600" />}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-slate-700">{label}</p>
                        <p className="text-[10px] text-slate-400">{desc}</p>
                      </div>
                    </button>
                  ))}
                </div>
                <div className="border-t border-slate-100 mt-3 pt-3 space-y-2">
                  <button onClick={runAll} disabled={running || buyers.length === 0}
                    className={cn("w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold transition-all",
                      running ? "bg-indigo-50 text-indigo-400 cursor-not-allowed" : "bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed")}>
                    {running
                      ? <><div className="w-3.5 h-3.5 border-2 border-indigo-300 border-t-transparent rounded-full animate-spin" />Running...</>
                      : <><Play size={12} />Run All Steps</>}
                  </button>
                  {running && (
                    <button onClick={stopAgent}
                      className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-semibold bg-red-50 text-red-500 hover:bg-red-100 border border-red-200 transition-all">
                      ⏹ Stop Agent
                    </button>
                  )}
                </div>
              </div>

              {/* Agent Log — Run Steps 카드 바로 아래 세로 배치 */}
              {(running || logs.length > 0) && (
                <div className="bg-slate-900 rounded-2xl p-4 border border-slate-800">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="flex gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
                      <div className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
                      <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
                    </div>
                    <span className="text-xs text-slate-400 font-mono">agent.log</span>
                    {running && <div className="ml-auto w-3 h-3 border border-indigo-400 border-t-transparent rounded-full animate-spin" />}
                  </div>
                  <div className="font-mono text-xs space-y-1 max-h-72 overflow-y-auto">
                    {logs.map((log, i) => (
                      <div key={i} className="flex gap-2">
                        <span className="text-slate-600 shrink-0">{new Date(log.timestamp).toLocaleTimeString("en", { hour12: false })}</span>
                        <span style={{ color: LOG_COLORS[log.level] || "#CBD5E1" }}>{log.message}</span>
                      </div>
                    ))}
                    {running && <div className="text-slate-600 animate-pulse">⠋ Processing...</div>}
                    <div ref={logEndRef} />
                  </div>
                </div>
              )}

              {/* Email Sending */}
              {(canSendR1 || canSendR2 || canSendR3) && (
                <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
                  <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Send Emails</h2>
                  <div className="space-y-2">
                    {canSendR1 && (
                      <button onClick={() => sendRound("r1_initial")} disabled={!!sendingRound}
                        className="w-full flex items-center justify-center gap-2 bg-emerald-600 text-white text-xs font-semibold py-2.5 rounded-xl hover:bg-emerald-700 disabled:opacity-50">
                        {sendingRound === "r1_initial"
                          ? <><div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />Sending...</>
                          : <><Send size={12} />Send 1st Email</>}
                      </button>
                    )}
                    {canSendR2 && (
                      <>
                        <button onClick={() => api.contacts.classify(id, 2).then(setClassification)}
                          className="w-full text-xs text-indigo-600 underline py-1">Check reply status</button>
                        <div className="grid grid-cols-2 gap-2">
                          <button onClick={() => sendRound("r2_replied")} disabled={!!sendingRound}
                            className="flex items-center justify-center gap-1 bg-blue-600 text-white text-xs font-semibold py-2 rounded-xl hover:bg-blue-700 disabled:opacity-50">
                            <Send size={11} />Replied
                          </button>
                          <button onClick={() => sendRound("r2_no_reply")} disabled={!!sendingRound}
                            className="flex items-center justify-center gap-1 bg-slate-600 text-white text-xs font-semibold py-2 rounded-xl hover:bg-slate-700 disabled:opacity-50">
                            <Send size={11} />No Reply
                          </button>
                        </div>
                      </>
                    )}
                    {canSendR3 && (
                      <div className="grid grid-cols-2 gap-2">
                        <button onClick={() => sendRound("r3_replied")} disabled={!!sendingRound}
                          className="flex items-center justify-center gap-1 bg-purple-600 text-white text-xs font-semibold py-2 rounded-xl hover:bg-purple-700 disabled:opacity-50">
                          <Send size={11} />Replied
                        </button>
                        <button onClick={() => sendRound("r3_no_reply")} disabled={!!sendingRound}
                          className="flex items-center justify-center gap-1 bg-slate-500 text-white text-xs font-semibold py-2 rounded-xl hover:bg-slate-600 disabled:opacity-50">
                          <Send size={11} />No Reply
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* ── Right Column ── */}
            <div className="col-span-2 space-y-4">

              {/* Project Info — collapsible */}
              <CollapsibleSection
                title="Project Info"
                badge={
                  !editingInfo
                    ? <button onClick={e => { e.stopPropagation(); setEditingInfo(true) }}
                        className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 ml-2">
                        <Edit2 size={11} /> Edit
                      </button>
                    : <div className="flex gap-2 ml-2" onClick={e => e.stopPropagation()}>
                        <button onClick={saveInfo} disabled={savingInfo}
                          className="flex items-center gap-1 text-xs bg-indigo-600 text-white px-3 py-1 rounded-lg hover:bg-indigo-700 disabled:opacity-40">
                          <Save size={11} /> {savingInfo ? "Saving..." : "Save"}
                        </button>
                        <button onClick={() => { setEditingInfo(false); setEditForm(info) }}
                          className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 px-2 py-1">
                          <X size={11} /> Cancel
                        </button>
                      </div>
                }
              >
                <div className="grid grid-cols-2 gap-3 pt-1">
                  {INFO_FIELDS.map(({ key, label, multiline }) => (
                    <div key={key} className={multiline ? "col-span-2" : ""}>
                      <label className="text-[10px] font-semibold text-slate-400 uppercase mb-1 block">{label}</label>
                      {editingInfo ? (
                        multiline ? (
                          <textarea value={editForm[key] || ""} onChange={e => setEditForm(p => ({ ...p, [key]: e.target.value }))}
                            rows={2} className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none" />
                        ) : (
                          <input value={editForm[key] || ""} onChange={e => setEditForm(p => ({ ...p, [key]: e.target.value }))}
                            className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                        )
                      ) : (
                        <p className="text-xs text-slate-700 bg-slate-50 rounded-lg px-3 py-2 min-h-[30px]">
                          {info[key] || <span className="text-slate-300">—</span>}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </CollapsibleSection>

              {/* Client Timeline — collapsible */}
              <CollapsibleSection
                title="Client Timeline Status"
                badge={savingTimeline ? <span className="text-[10px] text-indigo-400 font-normal ml-2">저장 중...</span> : undefined}
              >
                <div className="space-y-2 mb-3 pt-1">
                  {timeline.map(step => (
                    <div key={step.step_no} className="flex items-center gap-2 flex-wrap">
                      <input
                        type="text"
                        value={step.step_name || ""}
                        onChange={e => saveTimeline(step.step_no, "step_name", e.target.value)}
                        className="text-xs border border-slate-200 rounded-lg px-2 py-1 w-28 focus:outline-none focus:ring-1 focus:ring-indigo-300"
                      />
                      <select
                        value={step.status || "pending"}
                        onChange={e => saveTimeline(step.step_no, "status", e.target.value)}
                        className={cn("text-xs border rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-300 bg-white",
                          step.status === "done" ? "border-green-300 text-green-700" :
                          step.status === "in_progress" ? "border-indigo-300 text-indigo-700" :
                          "border-slate-200 text-slate-500")}>
                        <option value="pending">대기</option>
                        <option value="in_progress">진행중</option>
                        <option value="done">완료</option>
                      </select>
                      {/* ① 날짜 input — w-28로 넓혀서 10자리(2026-04-19) 입력 가능 */}
                      <input
                        type="text"
                        value={step.start_date || ""}
                        onChange={e => saveTimeline(step.step_no, "start_date", e.target.value)}
                        placeholder="시작일"
                        maxLength={10}
                        className="text-xs border border-slate-200 rounded-lg px-2 py-1 w-28 focus:outline-none focus:ring-1 focus:ring-indigo-300"
                      />
                      <span className="text-slate-300 text-xs">~</span>
                      <input
                        type="text"
                        value={step.end_date || ""}
                        onChange={e => saveTimeline(step.step_no, "end_date", e.target.value)}
                        placeholder="종료일"
                        maxLength={10}
                        className="text-xs border border-slate-200 rounded-lg px-2 py-1 w-28 focus:outline-none focus:ring-1 focus:ring-indigo-300"
                      />
                      {step.step_no > 6 && (
                        <button onClick={() => deleteTimelineStep(step.step_no)}
                          className="p-1 text-red-300 hover:text-red-500 rounded hover:bg-red-50 transition-colors">
                          <X size={12} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                  <input
                    value={newStepName}
                    onChange={e => setNewStepName(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && addTimelineStep()}
                    placeholder="새 단계 이름 입력..."
                    className="flex-1 text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-300" />
                  <button onClick={addTimelineStep} disabled={!newStepName.trim() || addingStep}
                    className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700 disabled:opacity-40 flex items-center gap-1">
                    <Plus size={11} /> 추가
                  </button>
                </div>
              </CollapsibleSection>

              {/* Upload Files — collapsible */}
              <CollapsibleSection title="Upload Files (고객 공유)">
                <div className="pt-1">
                  <label className={cn("flex items-center gap-2 border-2 border-dashed rounded-xl px-4 py-3 cursor-pointer transition-all",
                    projectFile ? "border-indigo-300 bg-indigo-50" : "border-slate-200 hover:border-indigo-200 hover:bg-slate-50")}>
                    <Upload size={14} className={projectFile ? "text-indigo-500" : "text-slate-400"} />
                    <span className="text-xs text-slate-600 flex-1 truncate">
                      {projectFile ? projectFile.name : "PDF 또는 Excel 파일 선택"}
                    </span>
                    <input type="file" accept=".pdf,.xlsx,.xls,.csv" className="hidden"
                      onChange={e => setProjectFile(e.target.files?.[0] || null)} />
                  </label>
                  {projectFile && (
                    <button onClick={uploadProjectFile} disabled={uploadingFile}
                      className="mt-2 w-full flex items-center justify-center gap-2 bg-indigo-600 text-white py-2 rounded-xl text-xs font-semibold hover:bg-indigo-700 disabled:opacity-50">
                      {uploadingFile
                        ? <><div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />업로드 중...</>
                        : <><Upload size={12} />고객 대시보드에 공유</>}
                    </button>
                  )}
                  <p className="text-[10px] text-slate-400 mt-2">업로드한 파일은 고객 대시보드 Files 섹션에서 확인 가능</p>
                  {projectFiles.length > 0 && (
                    <div className="mt-4 border-t border-slate-100 pt-3">
                      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">공유된 파일 ({projectFiles.length})</p>
                      <div className="space-y-1.5">
                        {projectFiles.map(f => (
                          <div key={f.id} className="flex items-center gap-2 bg-slate-50 rounded-xl px-3 py-2">
                            <FileText size={12} className="text-indigo-400 shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium text-slate-700 truncate">{f.name}</p>
                              <p className="text-[10px] text-slate-400">
                                {new Date(f.created_at).toLocaleDateString("ko")}
                                {f.size_bytes ? ` · ${(f.size_bytes / 1024).toFixed(0)} KB` : ""}
                              </p>
                            </div>
                            <button
                              onClick={() => deleteProjectFile(f.id, f.name)}
                              disabled={deletingFileId === f.id}
                              className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-40 shrink-0">
                              {deletingFileId === f.id
                                ? <div className="w-3 h-3 border border-red-400 border-t-transparent rounded-full animate-spin" />
                                : <Trash2 size={12} />}
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </CollapsibleSection>

              {/* ④ Buyer Results — 선택 체크박스 + 선별 실행 */}
              {buyers.length > 0 && (
                <CollapsibleSection
                  title="Buyer Results"
                  badge={
                    <span className="text-indigo-600 font-bold text-xs ml-1">{buyers.length}</span>
                  }
                >
                  {/* 통계 + 전체선택 */}
                  <div className="flex items-center justify-between mb-3 pt-1">
                    <div className="flex gap-3 text-[10px] text-slate-400">
                      <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-400 inline-block" />웹사이트: {buyers.filter(b => b.website).length}</span>
                      <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-400 inline-block" />이메일: {buyers.filter(b => b.email).length}</span>
                      <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-purple-400 inline-block" />ABM: {campaign.abm_analysis?.length || 0}</span>
                    </div>
                    <button onClick={toggleAllBuyers}
                      className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium">
                      {allBuyersSelected ? <CheckSquare size={13} /> : <Square size={13} />}
                      {allBuyersSelected ? "전체 해제" : "전체 선택"}
                    </button>
                  </div>

                  {/* 선택 시 선별 실행 버튼 */}
                  {selectedBuyerIds.size > 0 && (
                    <div className="mb-3 p-3 bg-indigo-50 rounded-xl border border-indigo-100">
                      <p className="text-xs text-indigo-700 font-medium mb-2">
                        {selectedBuyerIds.size}개 바이어 선택됨 — 선별 실행:
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {STEPS.map(({ key, label, icon: Icon }) => (
                          <button key={key} onClick={() => runStep(key)} disabled={running}
                            className="flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg bg-white border border-indigo-200 text-indigo-700 hover:bg-indigo-100 disabled:opacity-40 transition-colors">
                            {runningStep === key
                              ? <div className="w-3 h-3 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                              : <Icon size={11} />}
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 테이블 */}
                  <div className="overflow-auto max-h-96 rounded-xl border border-slate-100">
                    <table className="w-full text-xs">
                      <thead className="bg-slate-50 sticky top-0">
                        <tr>
                          <th className="px-3 py-2.5">
                            <button onClick={toggleAllBuyers}>
                              <div className={cn("w-4 h-4 rounded border-2 flex items-center justify-center",
                                allBuyersSelected ? "bg-indigo-600 border-indigo-600" : "border-slate-300")}>
                                {allBuyersSelected && <span className="text-white text-[9px] font-bold">✓</span>}
                              </div>
                            </button>
                          </th>
                          <th className="text-left px-3 py-2.5 text-slate-500 font-semibold">No.</th>
                          <th className="text-left px-3 py-2.5 text-slate-500 font-semibold">Company</th>
                          <th className="text-left px-3 py-2.5 text-slate-500 font-semibold">Country</th>
                          <th className="text-left px-3 py-2.5 text-slate-500 font-semibold">Website</th>
                          <th className="text-left px-3 py-2.5 text-slate-500 font-semibold">Email</th>
                          <th className="text-left px-3 py-2.5 text-slate-500 font-semibold">ABM</th>
                          <th className="px-3 py-2.5"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {buyers.map((b: any) => {
                          const abm = campaign.abm_analysis?.find((a: any) => a.id === b.id)
                          const selected = selectedBuyerIds.has(b.id)
                          return (
                            <tr key={b.id} className={cn("hover:bg-slate-50 cursor-pointer", selected && "bg-indigo-50")}
                              onClick={() => toggleBuyerSelect(b.id)}>
                              <td className="px-3 py-2">
                                <div className={cn("w-4 h-4 rounded border-2 flex items-center justify-center",
                                  selected ? "bg-indigo-600 border-indigo-600" : "border-slate-300")}>
                                  {selected && <span className="text-white text-[9px] font-bold">✓</span>}
                                </div>
                              </td>
                              <td className="px-3 py-2 text-slate-400">{b.no}</td>
                              <td className="px-3 py-2 font-medium text-slate-700 max-w-[140px] truncate">{b.company}</td>
                              <td className="px-3 py-2 text-slate-500">{b.country}</td>
                              <td className="px-3 py-2" onClick={e => e.stopPropagation()}>
                                {b.website
                                  ? <a href={b.website} target="_blank" rel="noreferrer" className="text-indigo-500 hover:underline truncate block max-w-[110px]">✓ {b.website.replace(/https?:\/\/(www\.)?/, '')}</a>
                                  : <span className="text-slate-300">—</span>}
                              </td>
                              <td className="px-3 py-2">
                                {b.email
                                  ? <span className="text-green-600 truncate block max-w-[130px]">✓ {b.email}</span>
                                  : <span className="text-slate-300">—</span>}
                              </td>
                              <td className="px-3 py-2">
                                {abm
                                  ? <span className={cn("px-1.5 py-0.5 rounded-full font-bold text-[10px]",
                                      abm.priority === 1 ? "bg-indigo-100 text-indigo-700"
                                      : abm.priority === 2 ? "bg-blue-100 text-blue-700"
                                      : "bg-slate-100 text-slate-500")}>
                                      P{abm.priority}
                                    </span>
                                  : <span className="text-slate-300">—</span>}
                              </td>
                              <td className="px-3 py-2" onClick={e => e.stopPropagation()}>
                                <button onClick={() => setDeleteTarget(b)}
                                  className="p-1 text-slate-300 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors">
                                  <Trash2 size={12} />
                                </button>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </CollapsibleSection>
              )}
            </div>
          </div>
        )}

        {/* ── Templates Tab ── */}
        {tab === "templates" && (
          <TemplateChat
            campaign={campaign}
            buyers={buyers}
            templates={templates}
            onSave={load}
          />
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
                <h3 className="font-bold text-slate-800">Delete Buyer</h3>
                <p className="text-xs text-slate-400 mt-0.5">This action cannot be undone.</p>
              </div>
            </div>
            <div className="bg-red-50 rounded-xl px-4 py-3 mb-5">
              <p className="font-semibold text-slate-800 text-sm">{deleteTarget.company}</p>
              <p className="text-xs text-slate-500 mt-0.5">{deleteTarget.country} · {deleteTarget.email || "No email"}</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setDeleteTarget(null)}
                className="flex-1 border border-slate-200 text-slate-600 py-2.5 rounded-xl text-sm font-medium hover:bg-slate-50">
                Cancel
              </button>
              <button onClick={deleteBuyer} disabled={deleting}
                className="flex-1 bg-red-500 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-red-600 disabled:opacity-50 flex items-center justify-center gap-2">
                {deleting
                  ? <><div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />Deleting...</>
                  : <><Trash2 size={13} />Delete</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  )
}

// ── Template Chat Component ──────────────────────────────────────────────────

type ChatMessage = {
  role: "user" | "assistant"
  content: string
  imageUrl?: string
}

function TemplateChat({ campaign, buyers, templates, onSave }: {
  campaign: any
  buyers: any[]
  templates: any[]
  onSave: () => void
}) {
  const [selectedBuyerIds, setSelectedBuyerIds] = useState<Set<string>>(new Set())
  const [messages, setMessages]   = useState<ChatMessage[]>([])
  const [input, setInput]         = useState("")
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [streaming, setStreaming] = useState(false)
  const [currentTemplates, setCurrentTemplates] = useState<any[]>(templates)
  const [previewTemplate, setPreviewTemplate] = useState<any | null>(null)
  const [previewRound, setPreviewRound] = useState("r1_initial")
  const chatEndRef = useRef<HTMLDivElement>(null)
  const fileRef    = useRef<HTMLInputElement>(null)
  const API = process.env.NEXT_PUBLIC_API_URL || "https://buyer-recruitment-production.up.railway.app"

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }) }, [messages])
  useEffect(() => { setCurrentTemplates(templates) }, [templates])

  const toggleBuyer = (buyerId: string) => {
    setSelectedBuyerIds(prev => {
      const next = new Set(prev)
      next.has(buyerId) ? next.delete(buyerId) : next.add(buyerId)
      return next
    })
  }

  const toggleAll = () => {
    if (selectedBuyerIds.size === buyers.length) setSelectedBuyerIds(new Set())
    else setSelectedBuyerIds(new Set(buyers.map(b => b.id)))
  }

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    setImageFile(f)
    const reader = new FileReader()
    reader.onload = () => setImagePreview(reader.result as string)
    reader.readAsDataURL(f)
  }

  const removeImage = () => { setImageFile(null); setImagePreview(null) }

  const sendMessage = async () => {
    if ((!input.trim() && !imageFile) || streaming) return
    const selectedBuyers = buyers.filter(b => selectedBuyerIds.has(b.id))
    const selectedTemplates = currentTemplates.filter(t =>
      selectedBuyers.some(b => b.company === t.consignee_name || b.email === t.contact_email)
    )
    const userMsg: ChatMessage = { role: "user", content: input, imageUrl: imagePreview || undefined }
    setMessages(prev => [...prev, userMsg])
    setInput("")
    setStreaming(true)
    let imageBase64 = ""
    let imageType = ""
    if (imageFile) {
      imageBase64 = (imagePreview || "").split(",")[1] || ""
      imageType = imageFile.type || "image/jpeg"
    }
    try {
      const systemPrompt = `You are a B2B email template expert for overseas buyer outreach.

Project Info:
- Client: ${campaign.campaign_info?.company_name}
- Product: ${campaign.campaign_info?.product_description}
- USP: ${campaign.campaign_info?.usp}
- Target: ${campaign.campaign_info?.target_country}
- Sender: ${campaign.campaign_info?.signature_name} / ${campaign.campaign_info?.signature_title} / ${campaign.campaign_info?.signature_phone}

Selected buyers (${selectedBuyers.length}):
${selectedBuyers.map(b => `- ${b.company} (${b.country}) / ${b.email || "no email"}`).join("\n")}

Current templates:
${JSON.stringify(selectedTemplates.slice(0, 3), null, 2)}

When user asks to modify/regenerate templates:
1. Return the updated templates as a JSON code block
2. Format: \`\`\`json\n[{"consignee_name":"...","contact_email":"...","priority":1,"r1_initial":{"subject":"...","body":"<html>..."},"r2_replied":{"subject":"...","body":"..."},"r2_no_reply":{"subject":"...","body":"..."},"r3_replied":{"subject":"...","body":"..."},"r3_no_reply":{"subject":"...","body":"..."}}]\n\`\`\`
3. After the JSON, briefly explain what you changed.
4. If user uploads an image, use it as context (e.g., product photo, catalog) to improve the email.
`
      const msgContent: any[] = []
      if (imageBase64) msgContent.push({ type: "image", source: { type: "base64", media_type: imageType, data: imageBase64 } })
      msgContent.push({ type: "text", text: input || "Please review the current templates and suggest improvements." })
      const allMessages = [
        ...messages.map(m => ({
          role: m.role,
          content: m.role === "user" && m.imageUrl
            ? [{ type: "image", source: { type: "url", url: m.imageUrl } }, { type: "text", text: m.content }]
            : m.content
        })),
        { role: "user", content: msgContent }
      ]
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 4000, system: systemPrompt, messages: allMessages })
      })
      const data = await response.json()
      const text = data.content?.[0]?.text || ""
      const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/)
      if (jsonMatch) {
        try {
          const newTemplates = JSON.parse(jsonMatch[1])
          if (Array.isArray(newTemplates)) {
            const updated = [...currentTemplates]
            newTemplates.forEach(nt => {
              const idx = updated.findIndex(t => t.consignee_name === nt.consignee_name || t.contact_email === nt.contact_email)
              if (idx >= 0) { updated[idx] = nt } else { updated.push(nt) }
            })
            setCurrentTemplates(updated)
            await fetch(`${API}/api/campaigns/${campaign.id}/templates`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ email_templates: updated })
            })
            onSave()
          }
        } catch {}
      }
      setMessages(prev => [...prev, { role: "assistant", content: text }])
      removeImage()
    } catch (e: any) {
      toast.error("Claude API error: " + e.message)
    } finally {
      setStreaming(false)
    }
  }

  const ROUND_OPTIONS = [
    { key: "r1_initial",  label: "1st Email" },
    { key: "r2_replied",  label: "2nd (Replied)" },
    { key: "r2_no_reply", label: "2nd (No Reply)" },
    { key: "r3_replied",  label: "3rd (Replied)" },
    { key: "r3_no_reply", label: "3rd (No Reply)" },
  ]

  const allSelected = selectedBuyerIds.size === buyers.length && buyers.length > 0

  return (
    <div className="grid grid-cols-5 gap-5 h-[calc(100vh-260px)]">
      <div className="col-span-2 flex flex-col gap-4 overflow-hidden">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between shrink-0">
            <h3 className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Select Buyers</h3>
            <button onClick={toggleAll} className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800">
              {allSelected ? <CheckSquare size={13} /> : <Square size={13} />}
              {allSelected ? "Deselect All" : "Select All"}
            </button>
          </div>
          <div className="overflow-y-auto flex-1">
            {buyers.length === 0
              ? <div className="py-8 text-center text-xs text-slate-400">No buyers loaded</div>
              : buyers.map(b => {
                  const selected = selectedBuyerIds.has(b.id)
                  const hasTmpl = currentTemplates.some(t => t.consignee_name === b.company || t.contact_email === b.email)
                  return (
                    <button key={b.id} onClick={() => toggleBuyer(b.id)}
                      className={cn("w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-0", selected && "bg-indigo-50")}>
                      <div className={cn("w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors",
                        selected ? "bg-indigo-600 border-indigo-600" : "border-slate-300")}>
                        {selected && <span className="text-white text-[9px] font-bold">✓</span>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-slate-800 truncate">{b.company}</p>
                        <p className="text-[10px] text-slate-400 truncate">{b.country} · {b.email || "no email"}</p>
                      </div>
                      {hasTmpl && <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full shrink-0">✓ tmpl</span>}
                    </button>
                  )
                })}
          </div>
          {selectedBuyerIds.size > 0 && (
            <div className="px-4 py-2.5 bg-indigo-50 border-t border-indigo-100 shrink-0">
              <p className="text-xs text-indigo-700 font-medium">{selectedBuyerIds.size} buyer{selectedBuyerIds.size > 1 ? "s" : ""} selected</p>
            </div>
          )}
        </div>
        {previewTemplate && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col flex-1">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between shrink-0">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-slate-700 truncate">{previewTemplate.consignee_name}</p>
                <p className="text-[10px] text-slate-400 truncate">{previewTemplate.contact_email}</p>
              </div>
              <button onClick={() => setPreviewTemplate(null)} className="text-slate-300 hover:text-slate-500 ml-2">
                <X size={14} />
              </button>
            </div>
            <div className="flex gap-1 px-3 py-2 border-b border-slate-100 shrink-0 flex-wrap">
              {ROUND_OPTIONS.map(r => (
                <button key={r.key} onClick={() => setPreviewRound(r.key)}
                  className={cn("text-[10px] font-medium px-2 py-1 rounded-lg transition-colors",
                    previewRound === r.key ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200")}>
                  {r.label}
                </button>
              ))}
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="text-[10px] font-semibold text-slate-500 px-3 py-2 bg-slate-50 border-b border-slate-100">
                {previewTemplate[previewRound]?.subject}
              </p>
              <iframe srcDoc={previewTemplate[previewRound]?.body || "<p>No template</p>"} className="w-full h-full bg-white" sandbox="allow-same-origin" />
            </div>
          </div>
        )}
      </div>

      <div className="col-span-3 flex flex-col bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-100 flex items-center gap-3 shrink-0">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
            <Bot size={15} className="text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-800">Claude — Template Editor</p>
            <p className="text-xs text-slate-400">
              {selectedBuyerIds.size > 0
                ? `${selectedBuyerIds.size} buyer${selectedBuyerIds.size > 1 ? "s" : ""} selected — ask me to modify their templates`
                : "Select buyers on the left to start editing"}
            </p>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center">
                <MessageSquare size={22} className="text-indigo-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-700">Start editing templates with Claude</p>
                <p className="text-xs text-slate-400 mt-1 max-w-xs">Select buyers, then ask Claude to rewrite, adjust tone, add product images, or translate templates.</p>
              </div>
              <div className="flex flex-wrap gap-2 justify-center mt-2">
                {["Make it more formal", "Add a product photo context", "Translate to German", "Make the subject line more compelling", "Shorten the email body"].map(suggestion => (
                  <button key={suggestion} onClick={() => setInput(suggestion)}
                    className="text-xs bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-600 px-3 py-1.5 rounded-full transition-colors">
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((msg, i) => (
            <div key={i} className={cn("flex gap-3", msg.role === "user" ? "justify-end" : "justify-start")}>
              {msg.role === "assistant" && (
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shrink-0 mt-0.5">
                  <Bot size={13} className="text-white" />
                </div>
              )}
              <div className={cn("max-w-[85%] rounded-2xl px-4 py-3 text-sm",
                msg.role === "user" ? "bg-indigo-600 text-white rounded-br-sm" : "bg-slate-100 text-slate-800 rounded-bl-sm")}>
                {msg.imageUrl && <img src={msg.imageUrl} alt="attached" className="max-h-40 rounded-xl mb-2 object-cover" />}
                {msg.role === "assistant" ? (
                  <div className="prose prose-xs max-w-none">
                    {msg.content.split("```json").map((part, pi) => {
                      if (pi === 0) return <p key={pi} className="whitespace-pre-wrap text-xs">{part}</p>
                      const [jsonPart, ...rest] = part.split("```")
                      let parsed: any[] = []
                      try { parsed = JSON.parse(jsonPart) } catch {}
                      return (
                        <div key={pi}>
                          {parsed.length > 0 && (
                            <div className="bg-white rounded-xl border border-indigo-100 p-3 my-2">
                              <p className="text-[10px] font-semibold text-indigo-600 mb-2">✅ {parsed.length} template{parsed.length > 1 ? "s" : ""} updated</p>
                              <div className="space-y-1">
                                {parsed.map((t: any, ti: number) => (
                                  <button key={ti} onClick={() => { setPreviewTemplate(t); setPreviewRound("r1_initial") }}
                                    className="w-full flex items-center gap-2 text-left hover:bg-indigo-50 rounded-lg px-2 py-1.5 transition-colors">
                                    <FileText size={11} className="text-indigo-500 shrink-0" />
                                    <span className="text-[11px] text-slate-700 truncate">{t.consignee_name}</span>
                                    <span className="text-[10px] text-indigo-500 ml-auto shrink-0">Preview →</span>
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                          {rest.join("```").trim() && <p className="whitespace-pre-wrap text-xs mt-2">{rest.join("```").trim()}</p>}
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <p className="whitespace-pre-wrap text-sm">{msg.content}</p>
                )}
              </div>
              {msg.role === "user" && (
                <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center shrink-0 mt-0.5">
                  <User size={13} className="text-slate-600" />
                </div>
              )}
            </div>
          ))}
          {streaming && (
            <div className="flex gap-3">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shrink-0">
                <Bot size={13} className="text-white" />
              </div>
              <div className="bg-slate-100 rounded-2xl rounded-bl-sm px-4 py-3">
                <div className="flex gap-1.5 items-center">
                  {[0, 1, 2].map(i => (
                    <div key={i} className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                  ))}
                </div>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>
        {imagePreview && (
          <div className="px-5 py-2 border-t border-slate-100 bg-slate-50 shrink-0">
            <div className="relative w-fit">
              <img src={imagePreview} alt="preview" className="h-16 rounded-xl object-cover" />
              <button onClick={removeImage} className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-xs hover:bg-red-600">
                <X size={10} />
              </button>
            </div>
          </div>
        )}
        <div className="px-4 py-3 border-t border-slate-100 shrink-0">
          {selectedBuyerIds.size === 0 && (
            <p className="text-xs text-amber-500 mb-2 flex items-center gap-1">⚠ Select at least one buyer to edit their templates</p>
          )}
          <div className="flex gap-2 items-end">
            <div className="flex-1 bg-slate-50 border border-slate-200 rounded-2xl px-4 py-2.5 focus-within:ring-2 focus-within:ring-indigo-300 focus-within:border-indigo-300">
              <textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
                placeholder="Ask Claude to modify templates... (Shift+Enter for new line)"
                rows={2}
                disabled={streaming || selectedBuyerIds.size === 0}
                className="w-full bg-transparent text-sm text-slate-800 placeholder-slate-400 resize-none focus:outline-none disabled:opacity-50"
              />
            </div>
            <div className="flex flex-col gap-2 shrink-0">
              <button onClick={() => fileRef.current?.click()} title="Attach image"
                className="w-9 h-9 flex items-center justify-center bg-slate-100 hover:bg-slate-200 rounded-xl text-slate-500 transition-colors">
                <Image size={15} />
              </button>
              <button onClick={sendMessage} disabled={streaming || selectedBuyerIds.size === 0 || (!input.trim() && !imageFile)}
                className="w-9 h-9 flex items-center justify-center bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 rounded-xl text-white transition-colors">
                {streaming ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Send size={14} />}
              </button>
            </div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
          </div>
        </div>
      </div>
    </div>
  )
}
