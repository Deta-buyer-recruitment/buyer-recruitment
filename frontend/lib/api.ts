const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

async function apiFetch(path: string, options?: RequestInit) {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { "Content-Type": "application/json", ...options?.headers },
    ...options,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || "API 오류")
  }
  return res.json()
}

// ── Customers ────────────────────────────────────────────
export const api = {
  customers: {
    list: () => apiFetch("/api/campaigns"),
  },

  // ── Campaigns ──────────────────────────────────────────
  campaigns: {
    list: (customerId?: string) =>
      apiFetch(`/api/campaigns${customerId ? `?customer_id=${customerId}` : ""}`),
    get: (id: string) => apiFetch(`/api/campaigns/${id}`),
    create: (data: Record<string, unknown>) =>
      apiFetch("/api/campaigns/", { method: "POST", body: JSON.stringify(data) }),
    uploadBuyers: (campaignId: string, customerId: string, file: File) => {
      const form = new FormData()
      form.append("file", file)
      form.append("customer_id", customerId)
      return fetch(`${API_URL}/api/campaigns/${campaignId}/upload-buyers`, {
        method: "POST",
        body: form,
      }).then(r => r.json())
    },
  },

  // ── Buyers ─────────────────────────────────────────────
  buyers: {
    list: (customerId?: string, status?: string) => {
      const params = new URLSearchParams()
      if (customerId) params.set("customer_id", customerId)
      if (status) params.set("status", status)
      return apiFetch(`/api/buyers/?${params}`)
    },
    get: (id: string) => apiFetch(`/api/buyers/${id}`),
    update: (id: string, data: Record<string, unknown>) =>
      apiFetch(`/api/buyers/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    exportExcel: (customerId: string) =>
      fetch(`${API_URL}/api/buyers/export/excel?customer_id=${customerId}`),
  },

  // ── Contact Logs ───────────────────────────────────────
  contacts: {
    upsert: (data: Record<string, unknown>) =>
      apiFetch("/api/contacts/", { method: "POST", body: JSON.stringify(data) }),
    listByBuyer: (buyerId: string) => apiFetch(`/api/contacts/buyer/${buyerId}`),
    classify: (campaignId: string, roundNum: number) =>
      apiFetch(`/api/contacts/classify/${campaignId}?round_num=${roundNum}`),
  },

  // ── Agent ──────────────────────────────────────────────
  agent: {
    // SSE 스트리밍 — EventSource로 직접 사용
    runUrl: (campaignId: string) => `${API_URL}/api/agent/run/${campaignId}`,
    status: (campaignId: string) => apiFetch(`/api/agent/status/${campaignId}`),
    send: (data: { campaign_id: string; round_key: string; buyer_ids?: string[] }) =>
      apiFetch("/api/agent/send", { method: "POST", body: JSON.stringify(data) }),
    updateCTA: (data: Record<string, unknown>) =>
      apiFetch("/api/agent/update-cta", { method: "POST", body: JSON.stringify(data) }),
    gmailStatus: () => apiFetch("/api/agent/gmail/status"),
  },
}
