import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// A controllable WebSocket: the bus under test only sees `readyState`, `send`, `close` and the four handlers.
class FakeSocket {
  static instances = []
  constructor(url) { this.url = url; this.readyState = 0; this.sent = []; FakeSocket.instances.push(this) }
  send(data) { this.sent.push(JSON.parse(data)) }
  close(code, reason) { this.readyState = 3; this.onclose?.({ code: code ?? 1000, reason: reason ?? '' }) }
  open() { this.readyState = 1; this.onopen?.() }
  receive(msg) { this.onmessage?.({ data: JSON.stringify(msg) }) }
  drop(code = 1006) { this.readyState = 3; this.onclose?.({ code, reason: '' }) }
}
FakeSocket.OPEN = 1
FakeSocket.CONNECTING = 0

const jsonResponse = (status, body, headers = {}) => new Response(body == null ? null : JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } })

// Fresh module instances per test (the socket bus is module state); the mock is imported through the same
// registry so the test and the module under test share one `http`.
let mod, http
beforeEach(async () => {
  vi.resetModules()
  FakeSocket.instances = []
  vi.stubGlobal('WebSocket', FakeSocket)
  vi.stubGlobal('fetch', vi.fn())
  ;({ http } = await import('../mocks/fetch.js'))
  http._reset()
  mod = await import('../../app/taskpulse.js')
})
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers() })

describe('REST client', () => {
  it('sends the bearer token on every call and parses JSON', async () => {
    http.setTokens({ access: 'tok' })
    fetch.mockResolvedValue(jsonResponse(200, { items: [], total: 0 }))
    await expect(mod.tasksApi.list({ status: 'Done', page: 2, pageSize: 5 })).resolves.toEqual({ items: [], total: 0 })
    const [url, init] = fetch.mock.calls[0]
    expect(url).toBe('http://taskpulse.test/api/tasks?page=2&pageSize=5&status=Done')
    expect(init.headers.Authorization).toBe('Bearer tok')
  })

  it('on a 401 refreshes once and retries with the new token', async () => {
    http.setTokens({ access: 'stale' })
    fetch.mockResolvedValueOnce(jsonResponse(401, { title: 'Unauthorized' })).mockResolvedValueOnce(jsonResponse(201, { id: 'x' }))
    http.post.mockResolvedValue({ data: { access_token: 'fresh' } })

    await expect(mod.tasksApi.create({ title: 't' })).resolves.toEqual({ id: 'x' })
    expect(http.post).toHaveBeenCalledTimes(1)
    expect(fetch).toHaveBeenCalledTimes(2)
    expect(fetch.mock.calls[1][1].headers.Authorization).toBe('Bearer fresh')
  })

  it('does not retry an anonymous 401, and surfaces problem+json details', async () => {
    fetch.mockResolvedValue(jsonResponse(401, { title: 'Unauthorized' }))
    await expect(mod.tasksApi.create({ title: 't' })).rejects.toThrow('Unauthorized')
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(http.post).not.toHaveBeenCalled()

    fetch.mockResolvedValue(jsonResponse(400, { title: 'Bad', errors: { title: ['Title is required'] } }))
    await expect(mod.tasksApi.create({ title: '' })).rejects.toThrow('Title is required')
  })

  it('preferences: defaults with saved=false read as "nothing saved yet"', async () => {
    fetch.mockResolvedValueOnce(jsonResponse(200, { theme: 'system', saved: false }))
    await expect(mod.preferencesApi.get('user-4')).resolves.toBeNull()
    fetch.mockResolvedValueOnce(jsonResponse(200, { theme: 'dark', nickname: 'P', saved: true }))
    await expect(mod.preferencesApi.get('user-4')).resolves.toMatchObject({ theme: 'dark' })
  })

  it('catalog.upsert updates an existing code and creates a missing one', async () => {
    fetch.mockResolvedValueOnce(jsonResponse(200, [{ code: 'asia', label: 'Asia' }])).mockResolvedValueOnce(jsonResponse(200, { code: 'asia' }))
    await mod.catalogApi.upsert('regions', 'asia', { label: 'Asia!' })
    expect(fetch.mock.calls[1][0]).toBe('http://taskpulse.test/api/catalog/regions/asia')
    expect(fetch.mock.calls[1][1].method).toBe('PUT')

    fetch.mockResolvedValueOnce(jsonResponse(200, [])).mockResolvedValueOnce(jsonResponse(201, { code: 'oceania' }))
    await mod.catalogApi.upsert('regions', 'oceania', { label: 'Oceania' })
    expect(fetch.mock.calls[3][1].method).toBe('POST')
    expect(JSON.parse(fetch.mock.calls[3][1].body)).toEqual({ code: 'oceania', label: 'Oceania' })
  })
})

describe('helpers', () => {
  it('userKey normalises the subject', () => {
    expect(mod.userKey({ sub: 4 })).toBe('user-4')
    expect(mod.userKey({ id: 'A B/C' })).toBe('user-a-b-c')
    expect(mod.userKey(null)).toBe('user-anon')
  })
  it('formatBytes and timeAgo', () => {
    expect(mod.formatBytes(512)).toBe('512 B')
    expect(mod.formatBytes(2048)).toBe('2.0 KB')
    expect(mod.formatBytes(3 * 1024 * 1024)).toBe('3.00 MB')
    expect(mod.timeAgo(new Date(Date.now() - 10_000).toISOString())).toBe('just now')
    expect(mod.timeAgo(new Date(Date.now() - 5 * 60_000).toISOString())).toBe('5 min ago')
    expect(mod.timeAgo(new Date(Date.now() - 3 * 3600_000).toISOString())).toBe('3 h ago')
  })
  it('dataUrlToFile keeps the declared type and the bytes', async () => {
    const f = mod.dataUrlToFile('data:text/plain;base64,' + btoa('hello'), 'h.txt')
    expect(f.type).toBe('text/plain')
    expect(f.name).toBe('h.txt')
    const text = await new Promise((resolve) => { const r = new FileReader(); r.onload = () => resolve(r.result); r.readAsText(f) })
    expect(text).toBe('hello')
  })
})

describe('socket bus', () => {
  it('signs in with the access token after the handshake, and re-authenticates after a refresh', async () => {
    http.setTokens({ access: 'tok' })
    const seen = []
    const unsubscribe = mod.subscribeSocket((m) => seen.push(m))
    const sock = FakeSocket.instances[0]
    expect(sock.url).toBe('ws://taskpulse.test/ws')
    sock.open()
    expect(sock.sent).toEqual([{ type: 'auth', token: 'tok' }])

    sock.receive({ type: 'welcome', connectionId: 'abc', connections: 1 })
    sock.receive({ type: 'authed', connectionId: 'abc', user: 'admin@techtest.dev' })
    expect(seen.map((m) => m.type)).toEqual(['welcome', 'authed'])

    // Expired at handshake: refresh once, send auth again with the new token — and never loop on a second failure.
    http.post.mockResolvedValue({ data: { access_token: 'fresh' } })
    sock.receive({ type: 'error', error: 'Invalid or expired token.' })
    await new Promise((r) => setTimeout(r, 0))
    expect(sock.sent.at(-1)).toEqual({ type: 'auth', token: 'fresh' })
    sock.receive({ type: 'error', error: 'Invalid or expired token.' })
    await new Promise((r) => setTimeout(r, 0))
    expect(http.post).toHaveBeenCalledTimes(1)
    unsubscribe()
  })

  it('does not send auth without a session, and reconnects with growing, jittered delays', () => {
    vi.useFakeTimers()
    const seen = []
    const unsubscribe = mod.subscribeSocket((m) => seen.push(m))
    const first = FakeSocket.instances[0]
    first.open()
    expect(first.sent).toEqual([])

    const delays = []
    for (let i = 0; i < 4; i++) {
      FakeSocket.instances.at(-1).drop()
      const retry = seen.filter((m) => m.type === '_retry').at(-1)
      delays.push(retry.delayMs)
      vi.advanceTimersByTime(retry.delayMs + 1)
    }
    expect(FakeSocket.instances).toHaveLength(5)
    // 1 s, 2 s, 4 s, 8 s bases, each jittered within [base/2, base]
    ;[1000, 2000, 4000, 8000].forEach((base, i) => { expect(delays[i]).toBeGreaterThanOrEqual(base / 2); expect(delays[i]).toBeLessThanOrEqual(base) })

    // A successful open resets the backoff.
    FakeSocket.instances.at(-1).open()
    FakeSocket.instances.at(-1).drop()
    expect(seen.filter((m) => m.type === '_retry').at(-1).delayMs).toBeLessThanOrEqual(1000)

    // Last subscriber gone: the socket is closed and no retry is scheduled.
    unsubscribe()
    const count = FakeSocket.instances.length
    vi.advanceTimersByTime(60_000)
    expect(FakeSocket.instances).toHaveLength(count)
  })

  it('socketSend only works on an open socket', () => {
    expect(mod.socketSend('ping')).toBe(false)
    const unsubscribe = mod.subscribeSocket(() => {})
    FakeSocket.instances[0].open()
    expect(mod.socketSend('broadcast', 'hi')).toBe(true)
    expect(FakeSocket.instances[0].sent.at(-1)).toEqual({ type: 'broadcast', data: 'hi' })
    unsubscribe()
  })
})
