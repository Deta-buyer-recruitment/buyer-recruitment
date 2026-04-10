"use client"
import { useEffect, useState } from "react"
import AppLayout from "@/components/layout/AppLayout"
import { api } from "@/lib/api"
import { STATUS_META, CONTACT_METHODS, cn } from "@/lib/utils"
import { toast } from "sonner"
import { Search, Download, ChevronDown, ChevronUp, Save, Ban } from "lucide-react"

const API = process.env.NEXT_PUBLIC_API_URL || "https://buyer-recruitment-production.up.railway.app"

export default function ContactLogPage() {
  const [buyers, setBuyers]     = useState<any[]>([])
  const [filtered, setFiltered] = useState<any[]>([])
  const [loading, setLoading]   = useState(true)
  const [search, setSearch]     = useState("")
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [editLogs, setEditLogs]     = useState<Record<string, any>>({})
  const [saving, setSaving]         = useState<string | null>(null)
  const [customerFilter, setCustomerFilter] = useState("")
  const [customers, setCustomers]   = useState<string[]>([])
  const [stopTarget, setStopTarget] = useState<any | null>(null)
  const [stopping, setStopping]     = useState(false)

  const load = async () => {
    setLoading(true)
    const data = await api.buyers.list()
    setBuyers(data)
    setFiltered(data)
    const names = Array.from(new Set(data.map((b: any) => b.customers?.name).filter(Boolean))) as string[]
    setCustomers(names)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  useEffect(() => {
    let result = buyers
    if (search) {
      const q = search.toLowerCase()
      result = result.filter(b =>
        b.company?.toLowerCase().includes(q) ||
        b.email?.toLowerCase().includes(q) ||
        b.country?.toLowerCase().includes(q) ||
        b.contact_name?.toLowerCase().includes(q)
      )
    }
    if (customerFilter) result = result.filter(b => b.customers?.name === customerFilter)
    setFiltered(result)
  }, [search, customerFilter, buyers])

  const setLog = (buyerId: string, attemptNo: number, field: string, value: any) => {
    setEditLogs(prev => ({
      ...prev,
      [buyerId]: { ...prev[buyerId], [attemptNo]: { ...(prev[buyerId]?.[attemptNo] || {}), [field]: value } }
    }))
  }

  const saveLog = async (buyer: any, attemptNo: number) => {
    const key = `${buyer.id}-${attemptNo}`
    setSaving(key)
    const existing = buyer.contact_logs?.find((l: any) => l.attempt_no === attemptNo) || {}
    const edits = editLogs[buyer.id]?.[attemptNo] || {}
    try {
      await api.contacts.upsert({ buyer_id: buyer.id, attempt_no: attemptNo, ...existing, ...edits })
      toast.success(`Contact #${attemptNo} saved`)
      await load()
    } catch (e: any) { toast.error(e.message) }
    finally { setSaving(null) }
  }

  const stopContact = async () => {
    if (!stopTarget) return
    setStopping(true)
    try {
      await api.buyers.update(stopTarget.id, { status: "rejected" })
      toast.success(`${stopTarget.company} marked as Stop Contact`)
      setStopTarget(null)
      load()
    } catch { toast.error("Failed to update status.") }
    finally { setStopping(false) }
  }

  const exportExcel = async () => {
    if (!customerFilter) { toast.error("Please select a client first"); return }
    const customerId = buyers.find(b => b.customers?.name === customerFilter)?.customer_id
    if (!customerId) return
    const res = await api.buyers.exportExcel(customerId)
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `Contact_Log_${customerFilter}_${new Date().toISOString().slice(0, 10)}.xlsx`
    a.click()
    URL.revokeObjectURL(url)
    toast.success("Excel downloaded")
  }

  if (loading) return (
    <AppLayout>
      <div className="flex items-center justify-center h-screen">
        <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    </AppLayout>
  )

  // STATUS_META에 rejected 추가 (없는 경우)
  const STATUS_WITH_STOP = {
    ...STATUS_META,
    rejected: { label: "Stop Contact", color: "#DC2626", bg: "#FEF2F2" }
  }

  return (
    <AppLayout>
      <div className="p-8 max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Contact Log</h1>
            <p className="text-sm text-slate-500 mt-1">Track all buyer outreach history and reply status</p>
          </div>
          <button onClick={exportExcel}
            className="flex items-center gap-2 border border-slate-200 bg-white text-slate-700 px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors shadow-sm">
            <Download size={14} /> Export Excel
          </button>
        </div>

        {/* Filters */}
        <div className="flex gap-3 mb-5">
          <div className="relative flex-1 max-w-sm">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search company, email, country..."
              className="w-full pl-9 pr-4 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white" />
          </div>
          <select value={customerFilter} onChange={e => setCustomerFilter(e.target.value)}
            className="text-sm border border-slate-200 rounded-xl px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300 text-slate-700">
            <option value="">All Clients</option>
            {customers.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <div className="ml-auto text-sm text-slate-500 flex items-center">{filtered.length} buyers</div>
        </div>

        {/* Buyer List */}
        <div className="space-y-2">
          {filtered.flatMap(buyer => {
            const statusM = STATUS_WITH_STOP[buyer.status as keyof typeof STATUS_WITH_STOP] || STATUS_META.pending
            const isOpen = expandedId === buyer.id
            const logs: any[] = buyer.contact_logs || []
            const logsMap = Object.fromEntries(logs.map((l: any) => [l.attempt_no, l]))
            const lastContact = [...logs].sort((a: any, b: any) => b.attempt_no - a.attempt_no)[0]
            const isStopped = buyer.status === "rejected"

            // 컨택 목록 (최대 3개)
            const contacts = [
              { name: buyer.contact_name, email: buyer.email, idx: 1 },
              { name: buyer.contact_name2, email: buyer.email2, idx: 2 },
              { name: buyer.contact_name3, email: buyer.email3, idx: 3 },
            ].filter(c => c.email || c.name)

            // 컨택이 없으면 기본 1개 row
            const rows = contacts.length > 0 ? contacts : [{ name: null, email: null, idx: 1 }]

            return rows.map((contact, ci) => (
              <div key={`${buyer.id}-${contact.idx}`} className={cn("bg-white rounded-2xl border shadow-sm overflow-hidden",
                isStopped ? "border-red-100 bg-red-50/30" : "border-slate-100")}>
                <div className="w-full flex items-center gap-4 px-5 py-4">
                  <button onClick={() => setExpandedId(isOpen ? null : buyer.id)}
                    className="flex items-center gap-4 flex-1 min-w-0 text-left">
                    <span className="text-xs text-slate-400 font-mono w-8 shrink-0">
                      {ci === 0 ? (buyer.no || "—") : ""}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={cn("font-semibold text-sm truncate", isStopped ? "text-red-400 line-through" : "text-slate-800")}>
                          {buyer.company}
                        </span>
                        <span className="text-xs text-slate-400">({buyer.country})</span>
                        {contacts.length > 1 && (
                          <span className="text-[10px] bg-indigo-50 text-indigo-500 px-1.5 py-0.5 rounded-full font-medium">
                            Contact {contact.idx}
                          </span>
                        )}
                        {ci === 0 && buyer.customers?.name && (
                          <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">{buyer.customers.name}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5">
                        {contact.name && <span className="text-xs text-slate-500">{contact.name}</span>}
                        {contact.email && <span className="text-xs text-slate-400">{contact.email}</span>}
                      </div>
                    </div>
                    {ci === 0 && (
                      <div className="text-right shrink-0">
                        {lastContact ? (
                          <div className="text-xs text-slate-500">
                            <div>#{lastContact.attempt_no} · {lastContact.contact_date || "No date"}</div>
                            <div className="mt-0.5">
                              {lastContact.replied === true && <span className="text-emerald-600 font-semibold">Replied ✓</span>}
                              {lastContact.replied === false && <span className="text-red-400">No reply</span>}
                              {lastContact.replied === null && <span className="text-slate-300">—</span>}
                            </div>
                          </div>
                        ) : <span className="text-xs text-slate-300">No contact yet</span>}
                      </div>
                    )}
                    {ci === 0 && (
                      <span className="badge text-[11px] shrink-0" style={{ color: statusM.color, background: statusM.bg }}>
                        {statusM.label}
                      </span>
                    )}
                    <div className="shrink-0 text-slate-300">{isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</div>
                  </button>

                  {/* Stop Contact 버튼 - 첫 번째 row에만 */}
                  {ci === 0 && !isStopped && (
                    <button onClick={() => setStopTarget(buyer)}
                      title="Mark as Stop Contact"
                      className="shrink-0 flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-red-500 hover:bg-red-50 px-2.5 py-1.5 rounded-lg border border-transparent hover:border-red-200 transition-all">
                      <Ban size={13} />
                      Stop
                    </button>
                  )}
                  {ci === 0 && isStopped && (
                    <span className="shrink-0 text-xs text-red-400 flex items-center gap-1 px-2.5 py-1.5">
                      <Ban size={12} /> Stopped
                    </span>
                  )}
                </div>
                </div>

                {isOpen && (
                  <div className="border-t border-slate-100 px-5 py-4 bg-slate-50">
                    {isStopped && (
                      <div className="mb-3 flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5">
                        <Ban size={14} className="text-red-400" />
                        <p className="text-xs text-red-600 font-medium">This buyer has requested to stop contact. They will be excluded from future email campaigns.</p>
                      </div>
                    )}
                    <div className="grid grid-cols-1 gap-3">
                      {Array.from({ length: 10 }, (_, i) => i + 1).map(attempt => {
                        const log = logsMap[attempt] || {}
                        const edit = editLogs[buyer.id]?.[attempt] || {}
                        const merged = { ...log, ...edit }
                        const hasData = log.contact_date || log.contact_method || log.replied !== undefined
                        const isSavingLog = saving === `${buyer.id}-${attempt}`

                        return (
                          <div key={attempt} className={cn("rounded-xl p-4 border transition-all",
                            hasData || Object.keys(edit).length > 0 ? "bg-white border-indigo-100" : "bg-white border-slate-100 opacity-60")}>
                            <div className="flex items-center gap-4">
                              <div className={cn("w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0",
                                hasData ? "bg-indigo-100 text-indigo-700" : "bg-slate-100 text-slate-400")}>{attempt}</div>
                              <input value={merged.contact_date || ""} onChange={e => setLog(buyer.id, attempt, "contact_date", e.target.value)}
                                placeholder="YYYY-MM-DD"
                                className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 w-28 focus:outline-none focus:ring-2 focus:ring-indigo-200 bg-white" />
                              <select value={merged.contact_method || ""} onChange={e => setLog(buyer.id, attempt, "contact_method", e.target.value)}
                                className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-200 bg-white">
                                <option value="">Method</option>
                                {CONTACT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                              </select>
                              <div className="flex gap-2">
                                {[{ val: true, label: "Y", cls: "bg-emerald-500 text-white" }, { val: false, label: "N", cls: "bg-red-400 text-white" }].map(({ val, label, cls }) => (
                                  <button key={label}
                                    onClick={() => setLog(buyer.id, attempt, "replied", merged.replied === val ? null : val)}
                                    className={cn("text-xs font-bold w-7 h-7 rounded-lg border transition-all",
                                      merged.replied === val ? cls + " border-transparent" : "border-slate-200 text-slate-400 hover:border-slate-300 bg-white")}>
                                    {label}
                                  </button>
                                ))}
                              </div>
                              <input value={merged.result || ""} onChange={e => setLog(buyer.id, attempt, "result", e.target.value)}
                                placeholder="Result notes..."
                                className="flex-1 text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-200 bg-white" />
                              <button onClick={() => saveLog(buyer, attempt)} disabled={isSavingLog}
                                className={cn("flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all shrink-0",
                                  Object.keys(edit).length > 0 ? "bg-indigo-600 text-white hover:bg-indigo-700" : "bg-slate-100 text-slate-400 hover:bg-slate-200")}>
                                {isSavingLog ? <div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" /> : <Save size={11} />}
                                Save
                              </button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            ))
          })}
          {filtered.length === 0 && (
            <div className="text-center py-16 text-slate-400 bg-white rounded-2xl border border-slate-100">
              <div className="text-4xl mb-3">📭</div>
              <p className="text-sm">No results found</p>
            </div>
          )}
        </div>
      </div>

      {/* Stop Contact 확인 모달 */}
      {stopTarget && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center shrink-0">
                <Ban size={18} className="text-orange-500" />
              </div>
              <div>
                <h3 className="font-bold text-slate-800">Stop Contact</h3>
                <p className="text-xs text-slate-400 mt-0.5">This buyer will be excluded from future emails.</p>
              </div>
            </div>
            <p className="text-sm text-slate-600 mb-1">
              Are you sure you want to stop contacting:
            </p>
            <div className="bg-orange-50 rounded-xl px-4 py-3 mb-5">
              <p className="font-semibold text-slate-800 text-sm">{stopTarget.company}</p>
              <p className="text-xs text-slate-500 mt-0.5">{stopTarget.country} · {stopTarget.email || "No email"}</p>
            </div>
            <p className="text-xs text-slate-400 mb-4">
              The buyer's status will be changed to <span className="font-semibold text-red-500">Stop Contact</span> and they will be skipped in all future email campaigns.
            </p>
            <div className="flex gap-2">
              <button onClick={() => setStopTarget(null)}
                className="flex-1 border border-slate-200 text-slate-600 py-2.5 rounded-xl text-sm font-medium hover:bg-slate-50">
                Cancel
              </button>
              <button onClick={stopContact} disabled={stopping}
                className="flex-1 bg-orange-500 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-orange-600 disabled:opacity-50 flex items-center justify-center gap-2">
                {stopping
                  ? <><div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />Updating...</>
                  : <><Ban size={13} />Stop Contact</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  )
}
