"use client"
import { useEffect, useState } from "react"
import AppLayout from "@/components/layout/AppLayout"
import { api } from "@/lib/api"
import { STATUS_META, cn } from "@/lib/utils"
import { toast } from "sonner"
import { Search, ExternalLink, Edit2, Check, X } from "lucide-react"

export default function BuyerListPage() {
  const [buyers, setBuyers]   = useState<any[]>([])
  const [filtered, setFiltered] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch]   = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editData, setEditData]   = useState<any>({})
  const [saving, setSaving]       = useState(false)

  const load = async () => {
    setLoading(true)
    const data = await api.buyers.list()
    setBuyers(data)
    setFiltered(data)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  useEffect(() => {
    let result = buyers
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
  }, [search, statusFilter, buyers])

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

  if (loading) return (
    <AppLayout>
      <div className="flex items-center justify-center h-screen">
        <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    </AppLayout>
  )

  return (
    <AppLayout>
      <div className="p-8 max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Buyer List</h1>
          <p className="text-sm text-slate-500 mt-1">{buyers.length} total buyers across all projects</p>
        </div>

        {/* Filters */}
        <div className="flex gap-3 mb-5">
          <div className="relative flex-1 max-w-sm">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search company, country, email..."
              className="w-full pl-9 pr-4 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white" />
          </div>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="text-sm border border-slate-200 rounded-xl px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300 text-slate-700">
            <option value="">All Status</option>
            {Object.entries(STATUS_META).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
          <div className="ml-auto text-sm text-slate-500 flex items-center">{filtered.length} results</div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Company</th>
                <th>Country</th>
                <th>Contact</th>
                <th>Email</th>
                <th>Website</th>
                <th>Status</th>
                <th>Client</th>
                <th></th>
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
                            className="text-xs border border-slate-200 rounded px-2 py-1 w-32 focus:outline-none focus:ring-1 focus:ring-indigo-300" />
                        : <span className="text-xs text-slate-600">{buyer.contact_name || "—"}</span>}
                    </td>
                    <td>
                      {isEditing
                        ? <input value={editData.email} onChange={e => setEditData((p: any) => ({ ...p, email: e.target.value }))}
                            className="text-xs border border-slate-200 rounded px-2 py-1 w-40 focus:outline-none focus:ring-1 focus:ring-indigo-300" />
                        : <span className="text-xs text-slate-500">{buyer.email || "—"}</span>}
                    </td>
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
                      <span className="text-xs text-slate-400">{buyer.customers?.name || "—"}</span>
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
                        <button onClick={() => startEdit(buyer)}
                          className="p-1.5 text-slate-300 hover:text-indigo-500 rounded-lg hover:bg-indigo-50 transition-colors">
                          <Edit2 size={13} />
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={9} className="text-center py-12 text-slate-400 text-sm">No buyers found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AppLayout>
  )
}
