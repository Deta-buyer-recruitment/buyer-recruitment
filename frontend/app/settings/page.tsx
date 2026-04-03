"use client"
import { useEffect, useState } from "react"
import AppLayout from "@/components/layout/AppLayout"
import { toast } from "sonner"
import { Shield, Eye, Edit3, Plus, Key, X, Send, Lock, ChevronDown, ChevronUp, Briefcase, Check, User } from "lucide-react"
import { cn } from "@/lib/utils"

const API = process.env.NEXT_PUBLIC_API_URL || "https://buyer-recruitment-production.up.railway.app"

const ROLE_META = {
  editor:  { label: "Editor",  desc: "Full access — create projects, run Agent, send emails", icon: Edit3,    color: "#4F46E5", bg: "#EEF2FF" },
  manager: { label: "Manager", desc: "Run Agent, send emails, update Contact Log",            icon: Briefcase, color: "#0EA5E9", bg: "#F0F9FF" },
  viewer:  { label: "Viewer",  desc: "Read-only access to all data",                         icon: Eye,       color: "#64748B", bg: "#F1F5F9" },
}

export default function SettingsPage() {
  const [profiles, setProfiles]   = useState<any[]>([])
  const [customers, setCustomers] = useState<any[]>([])
  const [loading, setLoading]     = useState(true)
  const [gmailStatus, setGmailStatus] = useState<any>(null)

  // 멤버 편집 (역할 + 이름 통합)
  const [editingId, setEditingId]     = useState<string | null>(null)
  const [editRole, setEditRole]       = useState("")
  const [editName, setEditName]       = useState("")
  const [editSaving, setEditSaving]   = useState(false)

  // 초대 폼
  const [inviteOpen, setInviteOpen]   = useState(false)
  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteName, setInviteName]   = useState("")   // ← 이름 추가
  const [inviteRole, setInviteRole]   = useState("viewer")
  const [inviting, setInviting]       = useState(false)

  // 고객사 접근 설정
  const [accessOpen, setAccessOpen]     = useState<string | null>(null)
  const [accessId, setAccessId]         = useState("")
  const [accessPw, setAccessPw]         = useState("")
  const [accessSaving, setAccessSaving] = useState(false)

  const loadData = () => {
    Promise.all([
      fetch(`${API}/api/client/profiles`).then(r => r.json()).catch(() => []),
      fetch(`${API}/api/client/customers`).then(r => r.json()).catch(() => []),
      fetch(`${API}/api/agent/gmail/status`).then(r => r.json()).catch(() => ({})),
    ]).then(([p, c, g]) => {
      setProfiles(Array.isArray(p) ? p : [])
      setCustomers(Array.isArray(c) ? c : [])
      setGmailStatus(g)
    }).finally(() => setLoading(false))
  }

  useEffect(() => { loadData() }, [])

  const startEdit = (p: any) => {
    setEditingId(p.id)
    setEditRole(p.role)
    setEditName(p.full_name || "")
  }

  const saveEdit = async (userId: string) => {
    setEditSaving(true)
    try {
      await fetch(`${API}/api/client/profiles/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: editRole, full_name: editName || null })
      })
      toast.success("Updated successfully")
      setEditingId(null)
      loadData()
    } catch { toast.error("Failed to update") }
    finally { setEditSaving(false) }
  }

  const inviteUser = async () => {
    if (!inviteEmail) { toast.error("Email is required"); return }
    setInviting(true)
    try {
      const res = await fetch(`${API}/api/client/invite`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole, full_name: inviteName || null })
      })
      const data = await res.json()
      if (data.success) {
        toast.success(`Invitation sent to ${inviteEmail}`)
        setInviteOpen(false); setInviteEmail(""); setInviteName(""); setInviteRole("viewer")
        loadData()
      } else {
        toast.error(data.error || "Failed to send invitation")
      }
    } catch { toast.error("Connection error") }
    finally { setInviting(false) }
  }

  const saveAccess = async (customerId: string) => {
    if (!accessId || !accessPw) { toast.error("ID and password are required"); return }
    setAccessSaving(true)
    try {
      await fetch(`${API}/api/client/customers/${customerId}/access`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ access_id: accessId, access_password: accessPw })
      })
      toast.success("Client access credentials updated")
      setAccessOpen(null); setAccessId(""); setAccessPw("")
      loadData()
    } catch { toast.error("Failed to update") }
    finally { setAccessSaving(false) }
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
      <div className="p-8 max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
          <p className="text-sm text-slate-500 mt-1">Manage team members, client access, and integrations</p>
        </div>

        {/* Role Overview */}
        <div className="grid grid-cols-3 gap-3 mb-8">
          {Object.entries(ROLE_META).map(([role, meta]) => {
            const Icon = meta.icon
            return (
              <div key={role} className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: meta.bg }}>
                    <Icon size={13} style={{ color: meta.color }} />
                  </div>
                  <span className="text-sm font-semibold text-slate-800">{meta.label}</span>
                </div>
                <p className="text-[11px] text-slate-500 leading-tight">{meta.desc}</p>
              </div>
            )
          })}
        </div>

        {/* Team Members */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm mb-6">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
              <Shield size={15} className="text-indigo-500" /> Team Members
            </h2>
            <button onClick={() => setInviteOpen(true)}
              className="flex items-center gap-1.5 bg-indigo-600 text-white text-xs font-semibold px-3 py-2 rounded-lg hover:bg-indigo-700 transition-colors">
              <Plus size={12} /> Invite Member
            </button>
          </div>
          <div className="divide-y divide-slate-50">
            {profiles.length === 0 && (
              <div className="py-10 text-center text-sm text-slate-400">
                No team members yet. Invite someone to get started.
              </div>
            )}
            {profiles.map(p => {
              const meta = ROLE_META[p.role as keyof typeof ROLE_META]
              const isEditing = editingId === p.id
              const initials = (p.full_name || p.email || "?")[0].toUpperCase()
              return (
                <div key={p.id} className="px-6 py-4">
                  <div className="flex items-center gap-4">
                    {/* 아바타 */}
                    <div className="w-9 h-9 rounded-full bg-indigo-50 flex items-center justify-center shrink-0">
                      <span className="text-sm font-bold text-indigo-600">{initials}</span>
                    </div>

                    {/* 이름/이메일 — 편집 모드 */}
                    <div className="flex-1 min-w-0">
                      {isEditing ? (
                        <input
                          value={editName}
                          onChange={e => setEditName(e.target.value)}
                          placeholder="이름 입력"
                          className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 w-48 focus:outline-none focus:ring-2 focus:ring-indigo-300 mb-0.5"
                        />
                      ) : (
                        <p className="text-sm font-medium text-slate-800 truncate">
                          {p.full_name || <span className="text-slate-400 italic">이름 없음</span>}
                        </p>
                      )}
                      <p className="text-xs text-slate-400 truncate">{p.email}</p>
                    </div>

                    {/* 역할 + 액션 */}
                    {isEditing ? (
                      <div className="flex items-center gap-2 shrink-0">
                        <select value={editRole} onChange={e => setEditRole(e.target.value)}
                          className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white">
                          <option value="editor">Editor</option>
                          <option value="manager">Manager</option>
                          <option value="viewer">Viewer</option>
                        </select>
                        <button onClick={() => saveEdit(p.id)} disabled={editSaving}
                          className="p-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                          <Check size={13} />
                        </button>
                        <button onClick={() => setEditingId(null)}
                          className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100">
                          <X size={13} />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3 shrink-0">
                        {meta && (
                          <span className="text-xs font-semibold px-2.5 py-1 rounded-full"
                            style={{ color: meta.color, background: meta.bg }}>
                            {meta.label}
                          </span>
                        )}
                        <button
                          onClick={() => startEdit(p)}
                          className="flex items-center gap-1 text-xs text-slate-400 hover:text-indigo-600 transition-colors border border-slate-200 rounded-lg px-2.5 py-1.5 hover:border-indigo-300">
                          <Edit3 size={11} /> Edit
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Client Dashboard Access */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm mb-6">
          <div className="px-6 py-4 border-b border-slate-100">
            <h2 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
              <Lock size={15} className="text-indigo-500" /> Client Dashboard Access
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Set login credentials for each client. Clients access their dashboard via URL.
            </p>
          </div>

          <div className="divide-y divide-slate-50">
            {customers.length === 0 && (
              <div className="py-10 text-center">
                <p className="text-sm text-slate-400">No clients yet.</p>
                <p className="text-xs text-slate-300 mt-1">Create a project first — clients are auto-generated.</p>
              </div>
            )}
            {customers.map((c: any) => {
              const isOpen = accessOpen === c.id
              return (
                <div key={c.id}>
                  <div className="px-6 py-4 flex items-center gap-4">
                    <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
                      <span className="text-sm font-bold text-slate-600">{c.name[0]}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800">{c.name}</p>
                      <p className="text-xs text-indigo-400 font-mono mt-0.5">
                        {typeof window !== "undefined" ? window.location.origin : "https://deta.ai.kr"}/client/{c.slug}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {c.access_id ? (
                        <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1">
                          <Lock size={11} /> {c.access_id}
                        </span>
                      ) : (
                        <span className="text-xs text-orange-400 font-medium">No access set</span>
                      )}
                      <button
                        onClick={() => {
                          setAccessOpen(isOpen ? null : c.id)
                          setAccessId(c.access_id || "")
                          setAccessPw("")
                        }}
                        className="flex items-center gap-1 text-xs text-slate-400 hover:text-indigo-600 transition-colors border border-slate-200 rounded-lg px-3 py-1.5 hover:border-indigo-300">
                        {isOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                        {c.access_id ? "Change" : "Set Access"}
                      </button>
                    </div>
                  </div>
                  {isOpen && (
                    <div className="px-6 pb-5 pt-1 bg-slate-50 border-t border-slate-100">
                      <p className="text-xs text-slate-500 mb-3">
                        Set the login credentials you'll share with <span className="font-semibold text-slate-700">{c.name}</span>
                      </p>
                      <div className="flex items-end gap-3">
                        <div>
                          <label className="text-[11px] font-medium text-slate-500 mb-1.5 block">Login ID</label>
                          <input value={accessId} onChange={e => setAccessId(e.target.value)}
                            placeholder="e.g. sammi2024"
                            className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 w-40 bg-white" />
                        </div>
                        <div>
                          <label className="text-[11px] font-medium text-slate-500 mb-1.5 block">Password</label>
                          <input value={accessPw} onChange={e => setAccessPw(e.target.value)}
                            type="password" placeholder="Set password"
                            className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 w-40 bg-white" />
                        </div>
                        <button onClick={() => saveAccess(c.id)} disabled={!accessId || !accessPw || accessSaving}
                          className="bg-indigo-600 text-white text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-indigo-700 disabled:opacity-40 transition-colors">
                          {accessSaving ? "Saving..." : "Save"}
                        </button>
                        <button onClick={() => setAccessOpen(null)}
                          className="text-slate-400 hover:text-slate-600 p-2 rounded-xl hover:bg-slate-200 transition-colors">
                          <X size={15} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Integrations */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm">
          <div className="px-6 py-4 border-b border-slate-100">
            <h2 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
              <Key size={15} className="text-indigo-500" /> Integrations
            </h2>
          </div>
          <div className="divide-y divide-slate-50">
            {[
              { name: "Gmail",     status: gmailStatus?.authenticated, detail: gmailStatus?.email || gmailStatus?.error, desc: "Email sending (OAuth)" },
              { name: "Hunter.io", status: true, detail: "Email extraction API",   desc: "Buyer contact extraction" },
              { name: "Anthropic", status: true, detail: "claude-sonnet-4",        desc: "Web search + ABM + Email generation" },
              { name: "Supabase",  status: true, detail: "DB + Storage + Auth",    desc: "Database and file storage" },
            ].map(({ name, status, detail, desc }) => (
              <div key={name} className="px-6 py-4 flex items-center gap-4">
                <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${status ? "bg-green-400" : "bg-red-400"}`} />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-800">{name}</span>
                    <span className="text-xs text-slate-400">{desc}</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">{detail}</p>
                </div>
                <span className={`text-xs font-semibold ${status ? "text-green-600" : "text-red-500"}`}>
                  {status ? "Connected" : "Not connected"}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Invite Modal */}
      {inviteOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-slate-800">Invite Team Member</h3>
              <button onClick={() => setInviteOpen(false)}
                className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400">
                <X size={16} />
              </button>
            </div>
            <div className="space-y-3">
              {/* 이름 입력 추가 */}
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1.5 block">
                  Name <span className="text-slate-300">(optional)</span>
                </label>
                <div className="relative">
                  <User size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input value={inviteName} onChange={e => setInviteName(e.target.value)}
                    placeholder="홍길동"
                    className="w-full border border-slate-200 rounded-xl pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1.5 block">Email *</label>
                <input value={inviteEmail} onChange={e => setInviteEmail(e.target.value)}
                  placeholder="colleague@company.com" type="email"
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1.5 block">Role *</label>
                <select value={inviteRole} onChange={e => setInviteRole(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white">
                  <option value="editor">Editor — Full access</option>
                  <option value="manager">Manager — ABM, emails, contact log</option>
                  <option value="viewer">Viewer — Read only</option>
                </select>
              </div>
              <button disabled={!inviteEmail || inviting} onClick={inviteUser}
                className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white py-3 rounded-xl text-sm font-semibold hover:bg-indigo-700 disabled:opacity-40 transition-colors">
                {inviting
                  ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Sending...</>
                  : <><Send size={14} />Send Invitation</>}
              </button>
              <p className="text-[11px] text-slate-400 text-center">
                초대받은 사람은 이메일 링크 클릭 후 비밀번호를 설정하게 됩니다
              </p>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  )
}
