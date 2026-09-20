import { beforeEach, describe, expect, it, vi } from 'vitest'
import { http } from '../mocks/fetch.js'
import { session, refreshTokens, IDLE_LIMIT_SECONDS } from '../../app/session.js'

const jwt = (claims) => `h.${btoa(JSON.stringify(claims)).replace(/=+$/, '')}.s`
const inSeconds = (s) => Math.floor(Date.now() / 1000) + s
const stored = () => JSON.parse(localStorage.getItem('vt.session'))
const user = { sub: 4, email: 'admin@techtest.dev', roles: ['Admin'] }

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  http._reset()
  vi.useRealTimers()
})

describe('session.save / restore', () => {
  it('keeps the user and the access token only — never the refresh token', async () => {
    http.setTokens({ access: jwt({ exp: inSeconds(900) }), refresh: 'refresh-secret' })
    session.save(user)
    expect(stored().tokens).toEqual({ access: http.getTokens().access })
    expect(JSON.stringify(stored())).not.toContain('refresh-secret')
    expect(stored().user.email).toBe('admin@techtest.dev')

    http._reset()
    await expect(session.restore()).resolves.toEqual(user)
    expect(http.getTokens().access).toBe(stored().tokens.access)
    expect(http.post).not.toHaveBeenCalled()
  })

  it('does nothing without a token or a user', () => {
    session.save(user)
    expect(localStorage.getItem('vt.session')).toBeNull()
    http.setTokens({ access: 'x' })
    session.save(null)
    expect(localStorage.getItem('vt.session')).toBeNull()
  })

  it('returns null when nothing is stored', async () => {
    await expect(session.restore()).resolves.toBeNull()
  })
})

describe('idle sign-out', () => {
  it('signs out with the reason "idle" past the limit, and keeps a session under it', async () => {
    http.setTokens({ access: jwt({ exp: inSeconds(900) }) })
    session.save(user)
    const s = stored()
    s.lastActive = Date.now() - (IDLE_LIMIT_SECONDS - 5) * 1000
    localStorage.setItem('vt.session', JSON.stringify(s))
    await expect(session.restore()).resolves.toEqual(user)

    s.lastActive = Date.now() - (IDLE_LIMIT_SECONDS + 1) * 1000
    localStorage.setItem('vt.session', JSON.stringify(s))
    await expect(session.restore()).resolves.toBeNull()
    expect(localStorage.getItem('vt.session')).toBeNull()
    expect(session.takeSignOutReason()).toBe('idle')
    expect(session.takeSignOutReason()).toBeNull()
  })

  it('touch() writes lastActive at most every 10 s', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-20T10:00:00Z'))
    http.setTokens({ access: jwt({ exp: inSeconds(900) }) })
    session.save(user)
    const first = stored().lastActive
    vi.setSystemTime(new Date('2026-09-20T10:00:05Z'))
    session.touch()
    expect(stored().lastActive).toBe(first)
    vi.setSystemTime(new Date('2026-09-20T10:00:11Z'))
    session.touch()
    expect(stored().lastActive).toBe(first + 11_000)
    expect(session.idleSeconds()).toBe(0)
  })
})

describe('refresh', () => {
  it('restore() refreshes through the cookie when the access token is about to expire and stores the new one', async () => {
    http.setTokens({ access: jwt({ exp: inSeconds(30) }) })
    session.save(user)
    const fresh = jwt({ exp: inSeconds(900) })
    http.post.mockResolvedValue({ data: { access_token: fresh } })

    await expect(session.restore()).resolves.toEqual(user)
    expect(http.post).toHaveBeenCalledTimes(1)
    expect(http.post.mock.calls[0][0]).toBe('/api/auth/refresh')
    expect(http.post.mock.calls[0][1].refresh_token).toBeUndefined()
    expect(http.getTokens().access).toBe(fresh)
    expect(stored().tokens.access).toBe(fresh)
  })

  it('restore() signs out with the reason "expired" when the refresh fails', async () => {
    http.setTokens({ access: jwt({ exp: inSeconds(10) }) })
    session.save(user)
    http.post.mockRejectedValue(new Error('401'))

    await expect(session.restore()).resolves.toBeNull()
    expect(localStorage.getItem('vt.session')).toBeNull()
    expect(http.getTokens().access).toBeUndefined()
    expect(session.takeSignOutReason()).toBe('expired')
  })

  it('refreshTokens() is single-flight: concurrent callers share one request', async () => {
    http.setTokens({ access: jwt({ exp: inSeconds(10) }) })
    let resolve
    http.post.mockReturnValue(new Promise((r) => { resolve = r }))
    const a = refreshTokens()
    const b = refreshTokens()
    expect(a).toBe(b)
    expect(http.post).toHaveBeenCalledTimes(1)
    resolve({ data: { access_token: 'new' } })
    await a
    expect(http.getTokens().access).toBe('new')
    // Once settled, the next call is a new request.
    http.post.mockResolvedValue({ data: { access_token: 'newer' } })
    await refreshTokens()
    expect(http.post).toHaveBeenCalledTimes(2)
  })
})
