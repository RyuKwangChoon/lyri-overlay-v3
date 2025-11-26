const API_BASE = import.meta.env.VITE_API_BASE

export async function apiGet(path: string) {
  const res = await fetch(`${API_BASE}${path}`)
  return res.json()
}

export async function apiPost(path: string, body: any) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
  return res.json()
}
