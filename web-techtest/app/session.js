import { http } from '../common/plugins/fetch.js'

const KEY = 'vt.session'
const REASON_KEY = 'vt.signout-reason'
export const IDLE_LIMIT_SECONDS = Number(import.meta.env.VITE_IDLE_LIMIT_SECONDS) > 0 ? Number(import.meta.env.VITE_IDLE_LIMIT_SECONDS) : 30 * 60
const TOUCH_EVERY_MS = 10 * 1000

let lastTouch = 0
let refreshing = null

const read = () => {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

const write = (value) => {
  try {
    if (value) localStorage.setItem(KEY, JSON.stringify(value))
    else localStorage.removeItem(KEY)
  } catch { }
}

const expiresAt = (access) => {
  try { return JSON.parse(atob(access.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).exp * 1000 } catch { return 0 }
}

// One refresh at a time: concurrent 401s share the same in-flight call. In HttpOnly-cookie mode (the deployed
// configuration) the browser attaches the refresh cookie itself; the body only carries the access token so the
// server can read `sub`. A refresh token kept in memory (non-cookie mode) is sent too.
export const refreshTokens = () => {
  if (refreshing) return refreshing
  const tokens = http.getTokens?.() || {}
  refreshing = http.post(import.meta.env.VITE_REFRESH_URL || '/api/auth/refresh', { refresh_token: tokens.refresh, access_token: tokens.access })
    .then(({ data }) => {
      http.setTokens({ access: data.access_token, refresh: data.refresh_token || tokens.refresh })
      const s = read()
      if (s) { s.tokens = { access: data.access_token }; s.lastActive = Date.now(); write(s) }
      return data
    })
    .finally(() => { refreshing = null })
  return refreshing
}

// What survives a page reload: the user's claims and the short-lived access token. The refresh token is an
// HttpOnly cookie the page cannot read, so a reload after the access token expired goes through /api/auth/refresh.
export const session = {
  save(user) {
    const tokens = http.getTokens?.() || {}
    if (!user || !tokens.access) return
    write({ user, tokens: { access: tokens.access }, lastActive: Date.now() })
    lastTouch = Date.now()
  },

  touch() {
    const now = Date.now()
    if (now - lastTouch < TOUCH_EVERY_MS) return
    const s = read()
    if (!s) return
    s.lastActive = now
    write(s)
    lastTouch = now
  },

  idleSeconds() {
    const s = read()
    return s ? Math.round((Date.now() - (s.lastActive || 0)) / 1000) : Infinity
  },

  async restore() {
    const s = read()
    if (!s?.tokens?.access || !s.user) return null
    if (this.idleSeconds() >= IDLE_LIMIT_SECONDS) {
      this.clear('idle')
      return null
    }
    http.setTokens({ access: s.tokens.access })
    http.setOptions({ refreshUrl: import.meta.env.VITE_REFRESH_URL })
    lastTouch = 0
    if (expiresAt(s.tokens.access) - Date.now() < 60 * 1000) {
      try {
        await refreshTokens()
      } catch {
        this.clear('expired')
        http.setTokens({ access: undefined, refresh: undefined })
        return null
      }
    }
    return s.user
  },

  clear(reason) {
    write(null)
    lastTouch = 0
    try {
      if (reason) sessionStorage.setItem(REASON_KEY, reason)
    } catch { }
  },

  takeSignOutReason() {
    try {
      const r = sessionStorage.getItem(REASON_KEY)
      sessionStorage.removeItem(REASON_KEY)
      return r
    } catch {
      return null
    }
  },
}
