import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  pending:   { label: "Not Contacted", color: "#64748B", bg: "#F1F5F9" },
  contacted: { label: "Contacted",     color: "#2563EB", bg: "#EFF6FF" },
  replied:   { label: "Replied",       color: "#059669", bg: "#ECFDF5" },
  meeting:   { label: "In Meeting",    color: "#7C3AED", bg: "#F5F3FF" },
  closed:    { label: "Closed",        color: "#047857", bg: "#D1FAE5" },
  rejected:  { label: "Rejected",      color: "#DC2626", bg: "#FEF2F2" },
}

export const CAMPAIGN_STATUS_META: Record<string, { label: string; color: string }> = {
  draft:           { label: "Draft",             color: "#64748B" },
  running:         { label: "Agent Running",     color: "#F59E0B" },
  abm_done:        { label: "ABM Complete",      color: "#3B82F6" },
  templates_done:  { label: "Templates Ready",   color: "#8B5CF6" },
  review_pending:  { label: "Pending Review",    color: "#F97316" },
  r1_sent:         { label: "1st Email Sent",    color: "#10B981" },
  r2_sent:         { label: "2nd Email Sent",    color: "#10B981" },
  r3_sent:         { label: "3rd Email Sent",    color: "#047857" },
  error:           { label: "Error",             color: "#EF4444" },
}

// 팀원 역할 (editor / manager / viewer)
// 고객사 접근은 별도 ID/비번 방식으로 분리
export const ROLE_META: Record<string, { label: string; color: string; bg: string; permissions: string[] }> = {
  editor: {
    label: "Editor",
    color: "#4F46E5",
    bg: "#EEF2FF",
    permissions: ["create_project", "run_agent", "send_email", "contact_log", "upload_file", "manage_users"],
  },
  manager: {
    label: "Manager",
    color: "#0EA5E9",
    bg: "#F0F9FF",
    permissions: ["run_agent", "send_email", "contact_log", "upload_file"],
  },
  viewer: {
    label: "Viewer",
    color: "#64748B",
    bg: "#F1F5F9",
    permissions: [],
  },
}

export function hasPermission(role: string, permission: string): boolean {
  return ROLE_META[role]?.permissions.includes(permission) ?? false
}

export const CONTACT_METHODS = ["Email", "Call", "Email & Call", "WhatsApp", "LinkedIn"]

export function formatDate(d: string | null | undefined): string {
  if (!d) return "—"
  return d
}
