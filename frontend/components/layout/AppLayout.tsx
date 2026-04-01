import Sidebar from "@/components/layout/Sidebar"

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main
        style={{ marginLeft: "var(--sidebar-w)" }}
        className="flex-1 min-h-screen bg-slate-50"
      >
        {children}
      </main>
    </div>
  )
}