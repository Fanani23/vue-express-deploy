import { http } from '../common/plugins/fetch.js'
import { refreshTokens } from './session.js'

// The accounts behind "Team members": /api/users on the express API (patch 0016). Plain fetch rather than the
// template's http plugin, because that plugin signs the user out on any 401/403 - and a Viewer pressing an
// Admin-only button deserves a message, not a sign-out. Cookie mode carries the session by itself; the bearer
// header covers the non-cookie configuration.
const API = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')

const bearer = () => { const t = http.getTokens?.().access; return t ? { Authorization: `Bearer ${t}` } : {} }
const send = (path, options) => fetch(API + path, {
  credentials: 'include',
  ...options,
  headers: { Accept: 'application/json', ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...bearer(), ...(options.headers || {}) },
})

const request = async (path, options = {}) => {
  let res = await send(path, options)
  if (res.status === 401 && http.getTokens?.().access) {
    try { await refreshTokens(); res = await send(path, options) } catch { }
  }
  if (res.status === 204) return null
  const body = await res.json().catch(() => null)
  if (!res.ok) throw new Error(body?.message || `${res.status} ${res.statusText}`)
  return body
}

export const ROLES = ['Admin', 'TestGroup', 'Viewer']

export const usersApi = {
  list: () => request('/api/users'),
  me: () => request('/api/users/me'),
  create: (user) => request('/api/users', { method: 'POST', body: JSON.stringify(user) }),
  update: (id, patch) => request(`/api/users/${id}`, { method: 'PUT', body: JSON.stringify(patch) }),
  remove: (id) => request(`/api/users/${id}`, { method: 'DELETE' }),
}

export const isAdmin = (user) => (Array.isArray(user?.roles) ? user.roles : String(user?.roles || '').split(',')).includes('Admin')
