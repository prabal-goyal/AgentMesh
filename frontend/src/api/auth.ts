const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3001'

export interface AuthUser {
  id:    string
  email: string
}

export interface AuthResponse {
  token: string
  user:  AuthUser
}

async function postAuth(path: 'signup' | 'login', email: string, password: string): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE}/api/auth/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(err.error ?? `Server error ${res.status}`)
  }

  return res.json()
}

export const signup = (email: string, password: string) => postAuth('signup', email, password)
export const login  = (email: string, password: string) => postAuth('login',  email, password)

export async function getMe(token: string): Promise<{ user: AuthUser }> {
  const res = await fetch(`${API_BASE}/api/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(err.error ?? `Server error ${res.status}`)
  }

  return res.json()
}
