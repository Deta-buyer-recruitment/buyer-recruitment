"use client"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import AppLayout from "@/components/layout/AppLayout"
import { api } from "@/lib/api"
import { toast } from "sonner"
import { ArrowLeft, Upload, CheckCircle, Building2, Plus, X } from "lucide-react"
import Link from "next/link"

const API = process.env.NEXT_PUBLIC_API_URL || "https://buyer-recruitment-production.up.railway.app"

const FIELD_GROUPS = [
  {
    title: "Client Information",
    fields: [
      { key: "company_name",        label: "Client Company Name", placeholder: "e.g. ABC Corp",                    required: true },
      { key: "target_country",      label: "Target Country",      placeholder: "e.g. Germany, Pakistan",           required: true },
      { key: "product_description", label: "Product Description", placeholder: "e.g. Industrial plastic packaging", required: true },
      { key: "hs_code",             label: "HS Code",             placeholder: "e.g. 3923.10",                     required: false },
      { key: "company_website",     label: "Client Website",      placeholder: "https://...",                      required: false },
    ]
  },
  {
    title: "USP & Messaging Strategy",
    fields: [
      { key: "usp", label: "USP (Unique Selling Points)", placeholder: "e.g. Food-grade certified, 14-day delivery guarantee, ISO 9001", required: true, multiline: true },
    ]
  },
  {
    title: "Sender Signature",
    fields: [
      { key: "signature_name",  label: "Your Name",  placeholder: "John Kim",               required: true },
      { key: "signature_title", label: "Title",      placeholder: "Overseas Sales Manager",  required: true },
      { key: "signature_phone", label: "Phone",      placeholder: "+82-10-1234-5678",        required: true },
    ]
  },
]

export default function NewProjectPage() {
  const router = useRouter()
  const [form, setForm] = useState<Record<string, string>>({ followup_interval_days: "7" })
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState<"info" | "upload">("info")
  const [customers, setCustomers] = useState<any[]>([])
  const [selectedCustomerId, setSelectedCustomerId] = useState("")

  // 새 고객사 추가 모달
  const [showNewClient, setShowNewClient] = useState(false)
  const [newClientForm, setNewClientForm] = useState({ name: "", slug: "" })
  const [creatingClient, setCreatingClient] = useState(false)

  const loadCustomers = () => {
    fetch(`${API}/api/client/customers`)
      .then(r => r.json())
      .then(data => {
        setCustomers(data)
      })
      .catch(() => {
        // fallback: campaigns에서 추출
        fetch(`${API}/api/campaigns/`)
          .then(r => r.json())
          .then(campaigns => {
            const seen = new Set()
            const unique: any[] = []
            campaigns.forEach((c: any) => {
              if (c.customer_id && !seen.has(c.customer_id)) {
                seen.add(c.customer_id)
                unique.push({ id: c.customer_id, name: c.customers?.name || c.campaign_info?.company_name })
              }
            })
            setCustomers(unique)
          })
      })
  }

  useEffect(() => { loadCustomers() }, [])

  const set = (key: string, val: string) => setForm(p => ({ ...p, [key]: val }))

  // slug 자동 생성
  const handleNewClientName = (name: string) => {
    const slug = name.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "")
    setNewClientForm({ name, slug })
  }

  const createNewClient = async () => {
    if (!newClientForm.name || !newClientForm.slug) {
      toast.error("Company name and slug are required")
      return
    }
    setCreatingClient(true)
    try {
      const res = await fetch(`${API}/api/client/customers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newClientForm.name,
          slug: newClientForm.slug,
        })
      })
      if (!res.ok) {
        const err = await res.json()
        toast.error(err.detail || "Failed to create client")
        return
      }
      const newClient = await res.json()
      toast.success(`${newClientForm.name} created!`)
      setShowNewClient(false)
      setNewClientForm({ name: "", slug: "" })
      loadCustomers()
      setSelectedCustomerId(newClient.id)
    } catch { toast.error("Connection error") }
    finally { setCreatingClient(false) }
  }

  const isInfoComplete = ["company_name","target_country","product_description",
    "usp","signature_name","signature_title","signature_phone"].every(k => form[k])
    && !!selectedCustomerId

  const submit = async () => {
    setLoading(true)
    try {
      const camp = await api.campaigns.create({
        ...form,
        customer_id: selectedCustomerId,
        followup_interval_days: Number(form.followup_interval_days) || 7
      })
      if (file) {
        const uploadResult = await api.campaigns.uploadBuyers(camp.id, camp.customer_id, file)
        toast.success(`Project created! ${uploadResult.inserted} buyers uploaded`)
      } else {
        toast.success("Project created!")
      }
      router.push(`/campaigns/${camp.id}`)
    } catch (e: any) { toast.error(e.message) }
    finally { setLoading(false) }
  }

  return (
    <AppLayout>
      <div className="p-8 max-w-2xl mx-auto">
        <Link href="/campaigns" className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-6">
          <ArrowLeft size={14} /> Projects
        </Link>
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-900">Start New Project</h1>
          <p className="text-sm text-slate-500 mt-1">Enter client info and upload the Volza buyer list</p>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center gap-3 mb-8">
          {["Client Information", "Upload Buyer List"].map((label, i) => {
            const current = step === (i === 0 ? "info" : "upload")
            const done = i === 0 && step === "upload"
            return (
              <div key={label} className="flex items-center gap-2">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold
                  ${done ? "bg-emerald-500 text-white" : current ? "bg-indigo-600 text-white" : "bg-slate-200 text-slate-500"}`}>
                  {done ? "✓" : i + 1}
                </div>
                <span className={`text-sm ${current ? "font-semibold text-slate-800" : "text-slate-400"}`}>{label}</span>
                {i === 0 && <span className="text-slate-300 mx-1">→</span>}
              </div>
            )
          })}
        </div>

        {step === "info" && (
          <div className="space-y-6">
            {/* 고객사 선택 */}
            <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
              <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-1.5">
                <Building2 size={12} /> Client Company
              </h2>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Select Client <span className="text-red-400">*</span>
              </label>
              <div className="flex gap-2">
                <select
                  value={selectedCustomerId}
                  onChange={e => setSelectedCustomerId(e.target.value)}
                  className="flex-1 text-sm border border-slate-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white">
                  <option value="">-- Select client --</option>
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <button onClick={() => setShowNewClient(true)}
                  className="flex items-center gap-1.5 px-3 py-2.5 bg-indigo-50 text-indigo-600 border border-indigo-200 rounded-xl text-sm font-medium hover:bg-indigo-100 transition-colors shrink-0">
                  <Plus size={14} /> New Client
                </button>
              </div>
            </div>

            {FIELD_GROUPS.map(group => (
              <div key={group.title} className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
                <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">{group.title}</h2>
                <div className="space-y-4">
                  {group.fields.map(f => (
                    <div key={f.key}>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">
                        {f.label}{f.required && <span className="text-red-400 ml-0.5">*</span>}
                      </label>
                      {(f as any).multiline ? (
                        <textarea value={form[f.key] || ""} onChange={e => set(f.key, e.target.value)}
                          placeholder={f.placeholder} rows={3}
                          className="w-full text-sm border border-slate-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none" />
                      ) : (
                        <input value={form[f.key] || ""} onChange={e => set(f.key, e.target.value)}
                          placeholder={f.placeholder}
                          className="w-full text-sm border border-slate-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}

            <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
              <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">Follow-up Settings</h2>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Follow-up Interval (days)</label>
                <input type="number" min="1" max="30"
                  value={form.followup_interval_days || "7"} onChange={e => set("followup_interval_days", e.target.value)}
                  className="w-32 text-sm border border-slate-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
              </div>
            </div>

            <button disabled={!isInfoComplete} onClick={() => setStep("upload")}
              className="w-full bg-indigo-600 text-white py-3.5 rounded-xl text-sm font-semibold hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
              Next — Upload Buyer List
            </button>
          </div>
        )}

        {step === "upload" && (
          <div className="space-y-4">
            <div className="bg-indigo-50 rounded-2xl p-4 border border-indigo-100">
              <p className="text-xs text-indigo-700">
                <span className="font-semibold">Client:</span> {customers.find(c => c.id === selectedCustomerId)?.name}
              </p>
            </div>
            <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
              <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">Upload Buyer List</h2>
              <p className="text-xs text-slate-500 mb-4">
                Upload the filtered CSV/Excel file from Volza or existing Contact Log.<br />
                You can also skip and upload later from the project page.
              </p>
              <label className={`flex flex-col items-center justify-center border-2 border-dashed rounded-2xl p-10 cursor-pointer transition-all
                ${file ? "border-indigo-300 bg-indigo-50" : "border-slate-200 hover:border-indigo-300 hover:bg-slate-50"}`}>
                <Upload size={24} className={file ? "text-indigo-500" : "text-slate-300"} />
                <span className="mt-3 text-sm font-medium text-slate-600">
                  {file ? file.name : "Select CSV or Excel file"}
                </span>
                {file && <span className="text-xs text-slate-400 mt-1">{(file.size / 1024).toFixed(1)} KB</span>}
                <input type="file" accept=".csv,.xlsx,.xls" className="hidden"
                  onChange={e => setFile(e.target.files?.[0] || null)} />
              </label>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setStep("info")}
                className="flex-1 border border-slate-200 text-slate-600 py-3 rounded-xl text-sm font-medium hover:bg-slate-50">
                Back
              </button>
              <button disabled={loading} onClick={submit}
                className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 text-white py-3 rounded-xl text-sm font-semibold hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed">
                {loading
                  ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Creating...</>
                  : <><CheckCircle size={14} />{file ? "Create Project & Upload Buyers" : "Create Project"}</>}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 새 고객사 추가 모달 */}
      {showNewClient && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-slate-800">Add New Client</h3>
              <button onClick={() => setShowNewClient(false)}
                className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400">
                <X size={16} />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Company Name *</label>
                <input
                  value={newClientForm.name}
                  onChange={e => handleNewClientName(e.target.value)}
                  placeholder="e.g. Acme Corporation"
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1.5 block">
                  Slug <span className="text-slate-400 font-normal">(URL용 고유 ID)</span>
                </label>
                <input
                  value={newClientForm.slug}
                  onChange={e => setNewClientForm(p => ({ ...p, slug: e.target.value }))}
                  placeholder="e.g. acme"
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                {newClientForm.slug && (
                  <p className="text-[11px] text-slate-400 mt-1">
                    대시보드 URL: deta.ai.kr/client/<span className="text-indigo-500 font-medium">{newClientForm.slug}</span>
                  </p>
                )}
              </div>
              <button
                onClick={createNewClient}
                disabled={!newClientForm.name || !newClientForm.slug || creatingClient}
                className="w-full bg-indigo-600 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-indigo-700 disabled:opacity-40 transition-colors flex items-center justify-center gap-2">
                {creatingClient
                  ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Creating...</>
                  : <><Plus size={14} />Create Client</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  )
}
