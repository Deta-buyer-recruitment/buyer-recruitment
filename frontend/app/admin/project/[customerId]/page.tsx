"use client"
import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import AppLayout from "@/components/layout/AppLayout"
import { toast } from "sonner"
import { Plus, Trash2, Upload, ArrowLeft, ExternalLink, MessageSquare, Save, X } from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
const STATUS_OPTIONS = [
  { value: "pending",     label: "Not Started" },
  { value: "in_progress", label: "In Progress" },
  { value: "done",        label: "Done" },
]
const CATEGORY_OPTIONS = [
  { value: "buyer_list", label: "Buyer List" },
  { value: "report",     label: "Report" },
  { value: "strategy",   label: "Strategy Doc" },
  { value: "other",      label: "Other" },
]

export default function AdminProjectPage() {
  const { customerId } = useParams<{ customerId: string }>()
  const [data, setData]         = useState<any>(null)
  const [loading, setLoading]   = useState(true)
  const [activeTab, setActiveTab] = useState<"timeline" | "files" | "inquiry">("timeline")
  const [addStepOpen, setAddStepOpen] = useState(false)
  const [newStepName, setNewStepName] = useState("")
  const [uploadFile, setUploadFile]   = useState<File | null>(null)
  const [uploadCategory, setUploadCategory] = useState("report")
  const [uploading, setUploading]     = useState(false)
  const [savingStep, setSavingStep]   = useState<number | null>(null)
  const [timelineEdits, setTimelineEdits] = useState<Record<number, any>>({})
  const [answerEdits, setAnswerEdits] = useState<Record<string, string>>({})
  const [answeringSaving, setAnsweringSaving] = useState<string | null>(null)

  const load = () => {
    setLoading(true)
    fetch(`${API}/api/client/dashboard/${customerId}`)
      .then(r => r.json()).then(setData).finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [customerId])

  const setEdit = (stepNo: number, field: string, val: string) =>
    setTimelineEdits(p => ({ ...p, [stepNo]: { ...p[stepNo], [field]: val } }))

  const saveStep = async (stepNo: number) => {
    setSavingStep(stepNo)
    await fetch(`${API}/api/client/timeline/${customerId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ step_no: stepNo, ...timelineEdits[stepNo] }),
    })
    toast.success(`Step ${stepNo} saved`)
    setSavingStep(null)
    load()
  }

  const addStep = async () => {
    if (!newStepName.trim()) return
    await fetch(`${API}/api/client/timeline/${customerId}/add-step`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ step_name: newStepName }),
    })
    toast.success(`Step '${newStepName}' added`)
    setAddStepOpen(false); setNewStepName(""); load()
  }

  const deleteStep = async (stepNo: number) => {
    if (!confirm(`Delete step ${stepNo}?`)) return
    await fetch(`${API}/api/client/timeline/${customerId}/step/${stepNo}`, { method: "DELETE" })
    toast.success("Step deleted"); load()
  }

  const uploadProjectFile = async () => {
    if (!uploadFile) return
    setUploading(true)
    const form = new FormData()
    form.append("file", uploadFile)
    form.append("category", uploadCategory)
    form.append("uploader_id", "admin")
    await fetch(`${API}/api/client/files/${customerId}/upload`, { method: "POST", body: form })
    toast.success("File uploaded"); setUploadFile(null); setUploading(false); load()
  }

  const deleteFile = async (fileId: string) => {
    if (!confirm("Delete this file?")) return
    await fetch(`${API}/api/client/files/${customerId}/${fileId}`, { method: "DELETE" })
    toast.success("Deleted"); load()
  }

  const saveAnswer = async (inquiryId: string) => {
    const answer = answerEdits[inquiryId]
    if (!answer?.trim()) return
    setAnsweringSaving(inquiryId)
    await fetch(`${API}/api/client/inquiries/${inquiryId}/answer`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answer }),
    })
    toast.success("Reply posted")
    setAnsweringSaving(null)
    setAnswerEdits(p => { const n = { ...p }; delete n[inquiryId]; return n })
    load()
  }

  if (loading || !data) return (
    <AppLayout><div className="flex items-center justify-center h-screen">
      <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
    </div></AppLayout>
  )

  const { customer, timeline, progress, files, inquiries } = data
  const unanswered = inquiries?.filter((q: any) => q.status === "open").length || 0

  return (
    <AppLayout>
      <div className="p-8 max-w-5xl mx-auto">
        <Link href="/dashboard" className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-5">
          <ArrowLeft size={14} /> Dashboard
        </Link>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-slate-900">{customer?.name}</h1>
            <p className="text-sm text-slate-500 mt-0.5">Overall progress <span className="font-bold text-indigo-600">{progress}%</span></p>
          </div>
          <a href={`${typeof window !== "undefined" ? window.location.origin : ""}/client/${customer?.slug}`}
            target="_blank" rel="noreferrer"
            className="flex items-center gap-1.5 text-sm text-indigo-600 border border-indigo-200 px-4 py-2 rounded-xl hover:bg-indigo-50 transition-colors">
            <ExternalLink size={13} /> View Client Dashboard
          </a>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-white rounded-xl p-1 border border-slate-100 w-fit shadow-sm">
          {[
            { key: "timeline", label: "Timeline" },
            { key: "files",    label: `Files (${files?.length || 0})` },
            { key: "inquiry",  label: `Inquiries${unanswered > 0 ? ` (${unanswered})` : ""}` },
          ].map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key as any)}
              className={cn("px-4 py-2 text-sm font-medium rounded-lg transition-all",
                activeTab === tab.key ? "bg-indigo-600 text-white shadow-sm" : "text-slate-500 hover:text-slate-700")}>
              {tab.key === "inquiry" && unanswered > 0 && <span className="inline-block w-2 h-2 bg-red-400 rounded-full mr-1.5 align-middle" />}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Timeline */}
        {activeTab === "timeline" && (
          <div className="space-y-3">
            {timeline?.map((step: any) => {
              const edit = timelineEdits[step.step_no] || {}
              const merged = { ...step, ...edit }
              const isDirty = Object.keys(edit).length > 0
              return (
                <div key={step.step_no} className={cn("bg-white rounded-2xl p-5 border shadow-sm transition-all",
                  isDirty ? "border-indigo-200" : "border-slate-100")}>
                  <div className="flex items-center gap-4">
                    <div className={cn("w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0",
                      merged.status === "done" ? "bg-green-500 text-white" :
                      merged.status === "in_progress" ? "bg-indigo-500 text-white" : "bg-gray-100 text-gray-500")}>
                      {step.step_no}
                    </div>
                    <input value={merged.step_name}
                      onChange={e => setEdit(step.step_no, "step_name", e.target.value)}
                      className="font-semibold text-slate-800 text-sm bg-transparent border-b border-transparent hover:border-slate-200 focus:border-indigo-300 focus:outline-none px-1 py-0.5 w-44" />
                    <select value={merged.status} onChange={e => setEdit(step.step_no, "status", e.target.value)}
                      className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white">
                      {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                    <div className="flex items-center gap-1 text-xs">
                      <input type="date" value={merged.start_date || ""} onChange={e => setEdit(step.step_no, "start_date", e.target.value)}
                        className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                      <span className="text-slate-400">~</span>
                      <input type="date" value={merged.end_date || ""} onChange={e => setEdit(step.step_no, "end_date", e.target.value)}
                        className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                    </div>
                    <div className="ml-auto flex items-center gap-2 shrink-0">
                      <button onClick={() => saveStep(step.step_no)} disabled={!isDirty || savingStep === step.step_no}
                        className={cn("flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all",
                          isDirty ? "bg-indigo-600 text-white hover:bg-indigo-700" : "bg-slate-100 text-slate-300 cursor-not-allowed")}>
                        {savingStep === step.step_no ? <div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" /> : <Save size={11} />}
                        Save
                      </button>
                      {step.step_no > 6 && (
                        <button onClick={() => deleteStep(step.step_no)}
                          className="p-1.5 text-slate-300 hover:text-red-400 rounded-lg hover:bg-red-50 transition-colors">
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="mt-3 ml-12">
                    <input value={merged.memo || ""} onChange={e => setEdit(step.step_no, "memo", e.target.value)}
                      placeholder="Notes (optional)"
                      className="w-full text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-200 border border-transparent focus:border-indigo-200" />
                  </div>
                </div>
              )
            })}

            {!addStepOpen ? (
              <button onClick={() => setAddStepOpen(true)}
                className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-indigo-200 text-indigo-600 py-3.5 rounded-2xl text-sm font-medium hover:bg-indigo-50 transition-colors">
                <Plus size={15} /> Add Step (e.g. 3rd Contact)
              </button>
            ) : (
              <div className="bg-white rounded-2xl p-5 border border-indigo-200 shadow-sm">
                <div className="flex items-center gap-3">
                  <input value={newStepName} onChange={e => setNewStepName(e.target.value)}
                    placeholder="Step name e.g. 3rd Contact" autoFocus
                    onKeyDown={e => e.key === "Enter" && addStep()}
                    className="flex-1 text-sm border border-slate-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                  <button onClick={addStep} disabled={!newStepName.trim()}
                    className="bg-indigo-600 text-white text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-indigo-700 disabled:opacity-40">Add</button>
                  <button onClick={() => { setAddStepOpen(false); setNewStepName("") }}
                    className="p-2.5 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100"><X size={15} /></button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Files */}
        {activeTab === "files" && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-700 mb-4">Upload File</h3>
              <div className="flex items-center gap-3">
                <select value={uploadCategory} onChange={e => setUploadCategory(e.target.value)}
                  className="text-sm border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white">
                  {CATEGORY_OPTIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
                <label className={cn("flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium cursor-pointer transition-all",
                  uploadFile ? "border-indigo-300 bg-indigo-50 text-indigo-700" : "border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300")}>
                  <Upload size={14} />
                  {uploadFile ? uploadFile.name : "Select file"}
                  <input type="file" className="hidden" onChange={e => setUploadFile(e.target.files?.[0] || null)} />
                </label>
                <button onClick={uploadProjectFile} disabled={!uploadFile || uploading}
                  className="bg-indigo-600 text-white text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-indigo-700 disabled:opacity-40 transition-colors">
                  {uploading ? "Uploading..." : "Upload"}
                </button>
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              {!files?.length ? (
                <div className="py-12 text-center text-slate-400 text-sm">No files uploaded yet</div>
              ) : (
                <table className="data-table">
                  <thead><tr><th>Filename</th><th>Category</th><th>Uploaded</th><th>Size</th><th></th></tr></thead>
                  <tbody>
                    {files.map((f: any) => (
                      <tr key={f.id}>
                        <td className="font-medium text-slate-700 text-sm">{f.name}</td>
                        <td><span className="badge" style={{ background: "#EEF2FF", color: "#4F46E5" }}>{CATEGORY_OPTIONS.find(c => c.value === f.category)?.label || f.category}</span></td>
                        <td className="text-xs text-slate-500">{new Date(f.created_at).toLocaleDateString("en")}</td>
                        <td className="text-xs text-slate-400">{f.size_bytes ? `${(f.size_bytes/1024).toFixed(0)} KB` : "—"}</td>
                        <td><button onClick={() => deleteFile(f.id)} className="text-slate-300 hover:text-red-400 transition-colors p-1 rounded-lg hover:bg-red-50"><Trash2 size={13} /></button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* Inquiries */}
        {activeTab === "inquiry" && (
          <div className="space-y-3">
            {!inquiries?.length ? (
              <div className="bg-white rounded-2xl p-16 text-center border border-slate-100 shadow-sm">
                <MessageSquare size={32} className="mx-auto mb-3 text-slate-200" />
                <p className="text-sm text-slate-400">No inquiries yet</p>
              </div>
            ) : inquiries.map((q: any) => (
              <div key={q.id} className={cn("bg-white rounded-2xl p-5 border shadow-sm", q.status === "open" ? "border-orange-200" : "border-slate-100")}>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <p className="font-semibold text-slate-800 text-sm">{q.title}</p>
                    {q.author_name && <p className="text-xs text-slate-400 mt-0.5">{q.author_name} · {new Date(q.created_at).toLocaleDateString("en")}</p>}
                  </div>
                  <span className={cn("badge text-[11px] shrink-0",
                    q.status === "answered" ? "bg-green-50 text-green-700" : q.status === "closed" ? "bg-gray-100 text-gray-400" : "bg-orange-50 text-orange-700")}>
                    {q.status === "answered" ? "Answered" : q.status === "closed" ? "Closed" : "Pending"}
                  </span>
                </div>
                <p className="text-sm text-slate-600 mb-3">{q.content}</p>
                {q.answer && (
                  <div className="bg-indigo-50 rounded-xl p-3.5 mb-3 border-l-2 border-indigo-400">
                    <p className="text-[11px] font-bold text-indigo-600 mb-1">Reply</p>
                    <p className="text-sm text-slate-700">{q.answer}</p>
                  </div>
                )}
                {q.status === "open" && (
                  <div className="flex gap-2 mt-2">
                    <input value={answerEdits[q.id] || ""} onChange={e => setAnswerEdits(p => ({ ...p, [q.id]: e.target.value }))}
                      placeholder="Type your reply..."
                      className="flex-1 text-sm border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                    <button onClick={() => saveAnswer(q.id)} disabled={!answerEdits[q.id]?.trim() || answeringSaving === q.id}
                      className="bg-indigo-600 text-white text-xs font-semibold px-4 py-2 rounded-xl hover:bg-indigo-700 disabled:opacity-40 shrink-0">
                      {answeringSaving === q.id ? "Saving..." : "Post Reply"}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  )
}
