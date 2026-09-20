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

describe('more of the REST surface', () => {
  it('counts fan out to one request per status and read the totals', async () => {
    fetch.mockImplementation(async (url) => jsonResponse(200, { total: url.includes('status=Done') ? 3 : url.includes('status=') ? 1 : 5 }))
    await expect(mod.tasksApi.counts({ q: ' postgres ' })).resolves.toEqual({ total: 5, Todo: 1, InProgress: 1, Done: 3 })
    expect(fetch.mock.calls[0][0]).toContain('q=postgres')
  })
  it('ready() is false when the API is unreachable', async () => {
    fetch.mockRejectedValue(new Error('ECONNREFUSED'))
    await expect(mod.tasksApi.ready()).resolves.toBe(false)
    fetch.mockResolvedValue(new Response('Healthy', { status: 200 }))
    await expect(mod.tasksApi.ready()).resolves.toBe(true)
  })
  it('uploads post multipart with the source and note, and build content URLs', async () => {
    fetch.mockResolvedValue(jsonResponse(201, [{ id: 'u1' }]))
    const file = new File(['x'], 'x.txt', { type: 'text/plain' })
    await mod.uploadsApi.create({ files: [file], source: 'signpad', note: 'n' })
    const [, init] = fetch.mock.calls[0]
    expect(init.body).toBeInstanceOf(FormData)
    expect(init.body.get('source')).toBe('signpad')
    expect(init.headers['Content-Type']).toBeUndefined() // the browser sets the multipart boundary
    expect(mod.uploadsApi.contentUrl('u1')).toBe('http://taskpulse.test/api/uploads/u1/content')
  })
  it('catalog list builds the query string', async () => {
    fetch.mockResolvedValue(jsonResponse(200, []))
    await mod.catalogApi.list('countries', { parent: 'asia', q: ' ru ' })
    expect(fetch.mock.calls[0][0]).toBe('http://taskpulse.test/api/catalog/countries?parent=asia&q=ru')
    await mod.catalogApi.kinds()
    expect(fetch.mock.calls[1][0]).toBe('http://taskpulse.test/api/catalog')
  })
})

describe('task fields, CSV, audit and webhooks', () => {
  it('list and exportUrl carry the same filters', async () => {
    fetch.mockResolvedValue(jsonResponse(200, { items: [], total: 0 }))
    await mod.tasksApi.list({ status: 'Todo', q: ' x ', priority: 'High', assignee: 'me', label: 'ops', due: 'overdue', page: 2 })
    expect(fetch.mock.calls[0][0]).toBe('http://taskpulse.test/api/tasks?page=2&pageSize=10&status=Todo&q=x&priority=High&assignee=me&label=ops&due=overdue')
    expect(mod.tasksApi.exportUrl({ status: 'Todo', label: 'ops', due: 'week' })).toBe('http://taskpulse.test/api/tasks/export.csv?status=Todo&label=ops&due=week')
    expect(mod.tasksApi.exportUrl()).toBe('http://taskpulse.test/api/tasks/export.csv')
    expect(mod.catalogApi.exportUrl('places')).toBe('http://taskpulse.test/api/catalog/places/export.csv')
  })
  it('patch sends the whole task with the change on top (PUT replaces)', async () => {
    fetch.mockResolvedValue(jsonResponse(200, {}))
    const task = { id: 't1', title: 'a', status: 'Todo', labels: ['x'], assigneeId: '4', assigneeName: 'Ann' }
    await mod.tasksApi.patch(task, { status: 'Done' })
    const [url, init] = fetch.mock.calls[0]
    expect(url).toBe('http://taskpulse.test/api/tasks/t1')
    expect(init.method).toBe('PUT')
    expect(JSON.parse(init.body)).toEqual({ title: 'a', description: null, status: 'Done', priority: 'Normal', dueAt: null, assigneeId: '4', assigneeName: 'Ann', labels: ['x'] })
    await mod.tasksApi.get('t1'); await mod.tasksApi.stats(7); await mod.tasksApi.create({ title: 'n' }); await mod.tasksApi.update('t1', {}); await mod.tasksApi.remove('t1')
    expect(fetch.mock.calls.map(([u, i]) => `${i?.method || 'GET'} ${u.replace('http://taskpulse.test', '')}`).slice(1))
      .toEqual(['GET /api/tasks/t1', 'GET /api/tasks/stats?days=7', 'POST /api/tasks', 'PUT /api/tasks/t1', 'DELETE /api/tasks/t1'])
  })
  it('isOverdue and dueLabel', () => {
    const day = 86_400_000
    expect(mod.isOverdue({ status: 'Todo', dueAt: new Date(Date.now() - day).toISOString() })).toBeTruthy()
    expect(mod.isOverdue({ status: 'Done', dueAt: new Date(Date.now() - day).toISOString() })).toBeFalsy()
    expect(mod.isOverdue({ status: 'Todo' })).toBeFalsy()
    expect(mod.dueLabel('')).toBe('')
    expect(mod.dueLabel(new Date().toISOString())).toBe('today')
    expect(mod.dueLabel(new Date(Date.now() + day).toISOString())).toBe('tomorrow')
    expect(mod.dueLabel(new Date(Date.now() - day).toISOString())).toBe('yesterday')
    expect(mod.dueLabel(new Date(Date.now() - 3 * day).toISOString())).toBe('3 d overdue')
    expect(mod.dueLabel(new Date(Date.now() + 3 * day).toISOString())).toBe('in 3 d')
    expect(mod.dueLabel(new Date(Date.now() + 40 * day).toISOString())).toMatch(/\d/)
  })
  it('CSV import posts the file as multipart and returns the per-row report', async () => {
    fetch.mockResolvedValue(jsonResponse(200, { created: 1, updated: 0, skipped: [{ row: 3, error: 'title is required' }] }))
    const file = new File(['title\nx\n'], 't.csv', { type: 'text/csv' })
    await expect(mod.tasksApi.importCsv(file)).resolves.toMatchObject({ created: 1 })
    expect(fetch.mock.calls[0][0]).toBe('http://taskpulse.test/api/tasks/import')
    expect(fetch.mock.calls[0][1].body.get('file').name).toBe('t.csv')
    await mod.catalogApi.importCsv('places', file)
    expect(fetch.mock.calls[1][0]).toBe('http://taskpulse.test/api/catalog/places/import')
  })
  it('audit list and the webhooks client hit the right routes', async () => {
    fetch.mockResolvedValue(jsonResponse(200, []))
    await mod.auditApi.list({ resource: 'auth', limit: 5 })
    await mod.auditApi.list()
    await mod.webhooksApi.list()
    await mod.webhooksApi.create({ url: 'https://h', secret: 's' })
    await mod.webhooksApi.update('w1', { active: false })
    await mod.webhooksApi.deliveries('w1')
    await mod.webhooksApi.remove('w1')
    await mod.catalogApi.get('places', 'p1'); await mod.catalogApi.create('places', {}); await mod.catalogApi.update('places', 'p1', {}); await mod.catalogApi.remove('places', 'p1')
    expect(fetch.mock.calls.map(([u, i]) => `${i?.method || 'GET'} ${u.replace('http://taskpulse.test', '')}`)).toEqual([
      'GET /api/audit?limit=5&resource=auth', 'GET /api/audit?limit=20',
      'GET /api/webhooks', 'POST /api/webhooks', 'PUT /api/webhooks/w1', 'GET /api/webhooks/w1/deliveries', 'DELETE /api/webhooks/w1',
      'GET /api/catalog/places/p1', 'POST /api/catalog/places', 'PUT /api/catalog/places/p1', 'DELETE /api/catalog/places/p1',
    ])
    expect(JSON.parse(fetch.mock.calls[4][1].body)).toEqual({ active: false })
  })
})

describe('history', () => {
  it('task, catalog item and kind history hit the audit-backed routes', async () => {
    fetch.mockResolvedValue(jsonResponse(200, []))
    await mod.tasksApi.history('t1')
    await mod.catalogApi.history('places', 'p1')
    await mod.auditApi.list({ resource: 'catalog', kind: 'places', target: 'p1', limit: 100 })
    expect(fetch.mock.calls.map(([u]) => u.replace('http://taskpulse.test', ''))).toEqual([
      '/api/tasks/t1/history', '/api/catalog/places/p1/history', '/api/audit?limit=100&resource=catalog&kind=places&target=p1',
    ])
  })
})

describe('idempotent creates', () => {
  it('sends an Idempotency-Key and retries a dropped connection once with the same key', async () => {
    fetch.mockRejectedValueOnce(new TypeError('Failed to fetch')).mockResolvedValueOnce(jsonResponse(201, { id: 't1' }))
    await expect(mod.tasksApi.create({ title: 'once' })).resolves.toEqual({ id: 't1' })
    expect(fetch).toHaveBeenCalledTimes(2)
    const keys = fetch.mock.calls.map(([, init]) => init.headers['Idempotency-Key'])
    expect(keys[0]).toMatch(/^[0-9a-f-]{36}$|^\d+-/)
    expect(keys[1]).toBe(keys[0])
  })
  it('does not retry an HTTP error, and a caller-supplied key is used as given', async () => {
    fetch.mockResolvedValue(jsonResponse(422, { title: 'used for a different request' }))
    await expect(mod.catalogApi.create('places', { label: 'x' }, 'my-key')).rejects.toThrow(/different request/)
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(fetch.mock.calls[0][1].headers['Idempotency-Key']).toBe('my-key')
  })
})
