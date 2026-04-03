"use client"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  LayoutDashboard, Users,
  BookOpen, Settings, Zap, ChevronRight, Mail, LogOut
} from "lucide-react"
import { cn } from "@/lib/utils"
import { createBrowserClient } from "@supabase/ssr"
import { useEffect, useState } from "react"

const NAV = [
  { href: "/dashboard",  icon: LayoutDashboard, label: "Dashboard" },
  { href: "/campaigns",  icon: Zap,              label: "Projects" },
  { href: "/buyers",     icon: Users,            label: "Buyer List" },
  { href: "/contacts",   icon: BookOpen,         label: "Contact Log" },
  { href: "/settings",   icon: Settings,         label: "Settings",  editorOnly: true },
]

const API = process.env.NEXT_PUBLIC_API_URL || "https://buyer-recruitment-production.up.railway.app"

export default function Sidebar() {
  const path = usePathname()
  const router = useRouter()
  const [role, setRole] = useState<string | null>(null)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      const userId = data.session?.user?.id
      if (!userId) return
      try {
        const res = await fetch(`${API}/api/client/profiles`)
        const profiles = await res.json()
        const me = profiles.find((p: any) => p.id === userId)
        if (me) setRole(me.role)
      } catch {}
    })
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push("/login")
  }

  return (
    <aside style={{ width: "var(--sidebar-w)" }}
      className="fixed inset-y-0 left-0 bg-white border-r border-slate-100 flex flex-col z-30 shadow-sm">

      {/* Logo */}
      <div className="px-5 py-5 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
            <Zap size={16} className="text-white" />
          </div>
          <div>
            <div className="font-bold text-[15px] text-slate-900 leading-none">BuyerOS</div>
            <div className="text-[10px] text-slate-400 mt-0.5">Overseas Buyer Platform</div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {NAV.map(({ href, icon: Icon, label, editorOnly }) => {
          // editor 전용 탭은 role이 editor일 때만 표시
          if (editorOnly && role !== "editor") return null
          const active = path.startsWith(href)
          return (
            <Link key={href} href={href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13.5px] font-medium transition-all",
                active
                  ? "bg-indigo-50 text-indigo-700"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              )}>
              <Icon size={16} className={active ? "text-indigo-600" : "text-slate-400"} />
              <span className="flex-1">{label}</span>
              {active && <ChevronRight size={14} className="text-indigo-400" />}
            </Link>
          )
        })}
      </nav>

      {/* Bottom */}
      <div className="px-4 py-4 border-t border-slate-100 space-y-2">
        <GmailStatus />
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2 px-2 py-2 rounded-lg text-[12px] text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all">
          <LogOut size={13} />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  )
}

function GmailStatus() {
  return (
    <div className="flex items-center gap-2 px-2 py-2 bg-slate-50 rounded-lg">
      <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
      <Mail size={11} className="text-slate-400" />
      <span className="text-[11px] text-slate-500 truncate">Gmail Connected</span>
    </div>
  )
}
