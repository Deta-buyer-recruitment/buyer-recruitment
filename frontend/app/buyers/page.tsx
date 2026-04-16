"use client"
import { useEffect, useState } from "react"
import AppLayout from "@/components/layout/AppLayout"
import { api } from "@/lib/api"
import { STATUS_META, cn } from "@/lib/utils"
import { toast } from "sonner"
import { Search, ExternalLink, Edit2, Check, X, Trash2, AlertTriangle, Download, ChevronDown } from "lucide-react"

const API = process.env.NEXT_PUBLIC_API_URL || "https://buyer-recruitment-production.up.railway.app"

export default function BuyerListPage() {
  const [buyers, setBuyers]     = useState<any[]>([])
  const [filtered, setFiltered] = useState<any[]>([])
  const [loading, setLoading]   = useState(true)
  const [search, setSearch]     = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [clientFilter, setClientFilter] = useState("")   // ← Client 드롭다운
  const [clients, setClients]   = useState<any[]>([])   // ← 고객사 목록
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editData, setEditData]   = useState<any>({})
  const [saving, setSaving]       = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null)
  const [deleting, setDeleting]   = useState(false)
  const [exporting, setExporting] = useState(false)

  const load = async () => {
    setLoading(true)
    const data = await api.buyers.list()
    setBuyers(data)
    // 고객사 목록 추출 (중복 제거)
    const clientMap = new Map<string, { id: string; name: string }>()
    data.forEach((b: any) => {
      if (b.customer_id && b.customers?.name) {
        clientMap.set(b.customer_id, { id: b.customer_id, name: b.customers.name })
      }
    })
    setClients(Array.from(clientMap.values()).sort((a, b) => a.name.localeCompare(b.name)))
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  useEffect(() => {
    // Client 선택 전엔 빈 화면
    if (!clientFilter) {
      setFiltered([])
      return
    }
    let result = buyers.filter(b => b.customer_id === clientFilter)
    if (search) {
      const q = search.toLowerCase()
      result = result.filter(b =>
        b.company?.toLowerCase().includes(q) ||
        b.country?.toLowerCase().includes(q) ||
        b.email?.toLowerCase().includes(q)
      )
    }
    if (statusFilter) result = result.filter(b => b.status === statusFilter)
    setFiltered(result)
  }, [search, statusFilter, clientFilter, buyers])

  const startEdit = (buyer: any) => {
    setEditingId(buyer.id)
    setEditData({ contact_name: buyer.contact_name || "", email: buyer.email || "", phone: buyer.phone || "", website: buyer.website || "", status: buyer.status })
  }

  const saveEdit = async (id: string) => {
    setSaving(true)
    try {
      await api.buyers.update(id, editData)
      toast.success("Buyer updated")
      setEditingId(null)
      load()
    } catch (e: any) { toast.error(e.message) }
    finally { setSaving(false) }
  }

  const deleteBuyer = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await fetch(`${API}/api/buyers/${deleteTarget.id}`, { method: "DELETE" })
      toast.success(`${deleteTarget.company} has been deleted.`)
      setDeleteTarget(null)
      load()
    } catch { toast.error("Failed to delete buyer.") }
    finally { setDeleting(false) }
  }

  const exportExcel = async () => {
    if (!clientFilter || filtered.length === 0) return
    setExporting(true)
    try {
      const res = await fetch(`${API}/api/buyers/export/excel?customer_id=${clientFilter}`)
      if (!res.ok) throw new Error("Export failed")
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      const clientName = clients.find(c => c.id === clientFilter)?.name || "buyers"
      a.download = `${clientName}_buyers.xlsx`
      a.click()
      URL.revokeObjectURL(url)
      toast.success("Excel file downloaded")
    } catch {
      toast.error("Export failed")
    } finally {
      setExporting(false)
    }
  }

  if (loading) return (
    <AppLayout>
      <div className="flex items-center justify-center h-screen">
        <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    </AppLayout>
  )

  const selectedClient = clients.find(c => c.id === clientFilter)

  return (
    <AppLayout>
      <div className="p-6">
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Buyer List</h1>
            <p className="text-sm text-slate-500 mt-1">
              {clientFilter
                ? `${filtered.length} buyers · ${selectedClient?.name}`
                : `Select a client to view buyers`}
            </p>
          </div>
          {/* Export 버튼 */}
          {clientFilter && filtered.length > 0 && (
            <button
              onClick={exportExcel}
              disabled={exporting}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors disabled:opacity-50 shadow-sm">
              {exporting
                ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Exporting...</>
                : <><Download size={15} />Export Buyer List</>}
            </button>
          )}
        </div>

        {/* Filters */}
        <div className="flex gap-3 mb-5 flex-wrap">
          {/* Client 드롭다운 — 필수 선택 */}
          <div className="relative">
            <select
              value={clientFilter}
              onChange={e => { setClientFilter(e.target.value); setSearch(""); setStatusFilter("") }}
              className={cn(
                "text-sm border rounded-xl px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300 pr-8 appearance-none cursor-pointer font-medium",
                clientFilter ? "border-indigo-300 text-indigo-700" : "border-slate-200 text-slate-500"
              )}>
              <option value="">— Select Client —</option>
              {clients.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>

          {/* Search & Status — Client 선택 시에만 활성화 */}
          {clientFilter && (
            <>
              <div className="relative flex-1 max-w-sm">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search company, country, email..."
                  className="w-full pl-9 pr-4 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white" />
              </div>
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="text-sm border border-slate-200 rounded-xl px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300 text-slate-700">
                <option value="">All Status</option>
                {Object.entries(STATUS_META).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
              <div className="ml-auto text-sm text-slate-500 flex items-center">{filtered.length} results</div>
            </>
          )}
        </div>

        {/* Client 미선택 시 안내 화면 */}
        {!clientFilter ? (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm py-24 text-center">
            <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Search size={24} className="text-indigo-400" />
            </div>
            <p className="text-base font-semibold text-slate-600 mb-1">Select a client to view buyers</p>
            <p className="text-sm text-slate-400">Choose a client from the dropdown above</p>
          </div>
        ) : (
          /* Table */
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{width:"40px"}}>#</th>
                  <th>Company</th>
                  <th>Country</th>
                  <th>Contact 1</th>
                  <th>Email 1</th>
                  <th>Contact 2</th>
                  <th>Email 2</th>
                  <th>Contact 3</th>
                  <th>Email 3</th>
                  <th>Website</th>
                  <th>Status</th>
                  <th style={{width:"80px"}}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(buyer => {
                  const statusM = STATUS_META[buyer.status] || STATUS_META.pending
                  const isEditing = editingId === buyer.id
                  return (
                    <tr key={buyer.id}>
                      <td className="text-slate-400 text-xs font-mono">{buyer.no || "—"}</td>
                      <td className="font-semibold text-slate-800">{buyer.company}</td>
                      <td className="text-slate-600">{buyer.country}</td>
                      <td>
                        {isEditing
                          ? <input value={editData.contact_name} onChange={e => setEditData((p: any) => ({ ...p, contact_name: e.target.value }))}
                              className="text-xs border border-slate-200 rounded px-2 py-1 w-28 focus:outline-none focus:ring-1 focus:ring-indigo-300" />
                          : <span className="text-xs text-slate-600">{buyer.contact_name || "—"}</span>}
                      </td>
                      <td>
                        {isEditing
                          ? <input value={editData.email} onChange={e => setEditData((p: any) => ({ ...p, email: e.target.value }))}
                              className="text-xs border border-slate-200 rounded px-2 py-1 w-36 focus:outline-none focus:ring-1 focus:ring-indigo-300" />
                          : <span className="text-xs text-slate-500">{buyer.email || "—"}</span>}
                      </td>
                      <td><span className="text-xs text-slate-600">{buyer.contact_name2 || "—"}</span></td>
                      <td><span className="text-xs text-slate-500">{buyer.email2 || "—"}</span></td>
                      <td><span className="text-xs text-slate-600">{buyer.contact_name3 || "—"}</span></td>
                      <td><span className="text-xs text-slate-500">{buyer.email3 || "—"}</span></td>
                      <td>
                        {buyer.website
                          ? <a href={buyer.website} target="_blank" rel="noreferrer"
                              className="text-xs text-indigo-500 hover:underline flex items-center gap-1">
                              <ExternalLink size={10} />
                              {buyer.website.replace("https://","").replace("http://","").split("/")[0]}
                            </a>
                          : <span className="text-xs text-slate-300">—</span>}
                      </td>
                      <td>
                        {isEditing
                          ? <select value={editData.status} onChange={e => setEditData((p: any) => ({ ...p, status: e.target.value }))}
                              className="text-xs border border-slate-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-300 bg-white">
                              {Object.entries(STATUS_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                            </select>
                          : <span className="badge text-[11px]" style={{ color: statusM.color, background: statusM.bg }}>{statusM.label}</span>}
                      </td>
                      <td>
                        {isEditing ? (
                          <div className="flex gap-1">
                            <button onClick={() => saveEdit(buyer.id)} disabled={saving}
                              className="p-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                              <Check size={12} />
                            </button>
                            <button onClick={() => setEditingId(null)}
                              className="p-1.5 bg-slate-100 text-slate-500 rounded-lg hover:bg-slate-200">
                              <X size={12} />
                            </button>
                          </div>
                        ) : (
                          <div className="flex gap-1">
                            <button onClick={() => startEdit(buyer)}
                              className="p-1.5 text-slate-400 hover:text-indigo-500 rounded-lg hover:bg-indigo-50 transition-colors">
                              <Edit2 size={13} />
                            </button>
                            <button onClick={() => setDeleteTarget(buyer)}
                              className="p-1.5 text-red-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors">
                              <Trash2 size={13} />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
                {filtered.length === 0 && (
                  <tr><td colSpan={12} className="text-center py-12 text-slate-400 text-sm">No buyers found</td></tr>
                )}
              </tbody>
            </table>
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
                <h3 className="font-bold text-slate-800">Delete Buyer</h3>
                <p className="text-xs text-slate-400 mt-0.5">This action cannot be undone.</p>
              </div>
            </div>
            <p className="text-sm text-slate-600 mb-1">Are you sure you want to permanently delete:</p>
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
