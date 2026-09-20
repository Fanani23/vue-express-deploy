import { http } from '../common/plugins/fetch.js'

const KEY = 'vt.session'
const REASON_KEY = 'vt.signout-reason'
export const IDLE_LIMIT_SECONDS = Number(import.meta.env.VITE_IDLE_LIMIT_SECONDS) > 0 ? Number(import.meta.env.VITE_IDLE_LIMIT_SECONDS) : 30 * 60
const TOUCH_EVERY_MS = 10 * 1000

let lastTouch = 0

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

export const session = {
  save(user) {
    const tokens = http.getTokens?.() || {}
    if (!user || !tokens.access) return
    write({ user, tokens: { access: tokens.access, refresh: tokens.refresh }, lastActive: Date.now() })
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

  restore() {
    const s = read()
    if (!s?.tokens?.access || !s.user) return null
    if (this.idleSeconds() >= IDLE_LIMIT_SECONDS) {
      this.clear('idle')
      return null
    }
    http.setTokens({ access: s.tokens.access, refresh: s.tokens.refresh })
    http.setOptions({ refreshUrl: import.meta.env.VITE_REFRESH_URL })
    lastTouch = 0
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
