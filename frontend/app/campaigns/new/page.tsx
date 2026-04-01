"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import AppLayout from "@/components/layout/AppLayout"
import { api } from "@/lib/api"
import { toast } from "sonner"
import { ArrowLeft, Upload, CheckCircle } from "lucide-react"
import Link from "next/link"

const FIELD_GROUPS = [
  {
    title: "Client Information",
    fields: [
      { key: "company_name",        label: "Client Company Name", placeholder: "e.g. ABC Corp",                    required: true },
      { key: "target_country",      label: "Target Country",      placeholder: "e.g. Germany, Pakistan",           required: true },
      { key: "product_description", label: "Product Description", placeholder: "e.g. Industrial plastic packaging", required: true },
      { key: "hs_code",             label: "HS Code",             placeholder: "e.g. 3923.10",                     required: true },
      { key: "company_website",     label: "Client Website",      placeholder: "https://...",                      required: true },
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

  const set = (key: string, val: string) => setForm(p => ({ ...p, [key]: val }))

  const isInfoComplete = ["company_name","target_country","product_description",
    "hs_code","company_website","usp","signature_name",
    "signature_title","signature_phone"].every(k => form[k])

  const submit = async () => {
    setLoading(true)
    try {
      // 1. 프로젝트 생성
      const camp = await api.campaigns.create({
        ...form,
        customer_id: "",
        followup_interval_days: Number(form.followup_interval_days) || 7
      })

      // 2. 바이어 리스트 업로드 (있는 경우만)
      if (file) {
        const uploadResult = await api.campaigns.uploadBuyers(camp.id, camp.customer_id, file)
        toast.success(`Project created! ${uploadResult.inserted} buyers uploaded`)
      } else {
        toast.success("Project created! You can upload buyers from the project page.")
      }

      // 3. 바이어 업로드까지만 하고 Agent는 실행하지 않음 → 상세 페이지로 이동
      router.push(`/campaigns/${camp.id}`)
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
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
              <div className="mt-4 text-xs text-slate-400 space-y-1">
                <p>✓ Supported columns: company / country / website / email / contact_name / phone</p>
                <p>✓ Korean column names also supported automatically</p>
              </div>
            </div>

            {/* 다음 단계 안내 */}
            <div className="bg-indigo-50 rounded-2xl p-4 border border-indigo-100">
              <p className="text-xs font-semibold text-indigo-700 mb-2">After creating the project, you can:</p>
              <div className="space-y-1.5">
                {[
                  "Run website search for buyers",
                  "Extract contacts via Hunter.io",
                  "Run ABM analysis",
                  "Generate & send email templates",
                ].map((step, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-indigo-600">
                    <div className="w-4 h-4 rounded-full bg-indigo-200 text-indigo-700 flex items-center justify-center font-bold text-[10px]">{i + 1}</div>
                    {step}
                  </div>
                ))}
              </div>
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
    </AppLayout>
  )
}
