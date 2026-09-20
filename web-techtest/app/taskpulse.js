import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { http } from '../common/plugins/fetch.js'
import { refreshTokens } from './session.js'

const API = (import.meta.env.VITE_TASKPULSE_URL || 'http://127.0.0.1:8088').replace(/\/$/, '')
const WS = import.meta.env.VITE_TASKPULSE_WS_URL || API.replace(/^http/, 'ws') + '/ws'

export const STATUSES = ['Todo', 'InProgress', 'Done']
export const PRIORITIES = ['Low', 'Normal', 'High']
export const PRIORITY_COLOR = { Low: 'default', Normal: 'blue', High: 'volcano' }
export const isOverdue = (t) => t && t.status !== 'Done' && t.dueAt && new Date(t.dueAt) < new Date()
export const dueLabel = (iso) => {
  if (!iso) return ''
  const d = new Date(iso); const today = new Date(); today.setHours(0, 0, 0, 0)
  const days = Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()) - today) / 86_400_000)
  if (days === 0) return 'today'
  if (days === 1) return 'tomorrow'
  if (days === -1) return 'yesterday'
  if (days < 0) return `${-days} d overdue`
  if (days < 7) return `in ${days} d`
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}
// The body PUT /api/tasks/{id} expects: the whole task (the server replaces, it does not merge) with the change on top.
export const taskBody = (task, changes = {}) => ({
  title: task.title, description: task.description ?? null, status: task.status,
  priority: task.priority ?? 'Normal', dueAt: task.dueAt ?? null, assigneeId: task.assigneeId ?? null, assigneeName: task.assigneeName ?? null,
  labels: task.labels ?? [],
  ...changes,
})
export const STATUS_LABEL = { Todo: 'To do', InProgress: 'In progress', Done: 'Done' }
export const STATUS_COLOR = { Todo: 'default', InProgress: 'processing', Done: 'success' }
export const NEXT_STATUS = { Todo: 'InProgress', InProgress: 'Done', Done: 'Todo' }

const bearer = () => { const t = http.getTokens?.().access; return t ? { Authorization: `Bearer ${t}` } : {} }

// Every call carries the part-A access token; a 401 triggers one refresh (through the express refresh endpoint)
// and one retry, so an expired token never surfaces as an error while the refresh token is still good.
const send = (path, options, headers) => fetch(API + path, { ...options, headers: { ...headers, ...bearer(), ...(options.headers || {}) } })

const request = async (path, options = {}) => {
  const headers = { Accept: 'application/json', ...(options.body && !(options.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}) }
  let res = await send(path, options, headers)
  if (res.status === 401 && http.getTokens?.().access) {
    try { await refreshTokens(); res = await send(path, options, headers) } catch { }
  }
  if (res.status === 204) return null
  const body = await res.json().catch(() => null)
  if (!res.ok) {
    const detail = body?.errors ? Object.values(body.errors).flat().join(' ') : body?.detail || body?.title
    throw new Error(detail || `${res.status} ${res.statusText}`)
  }
  return body
}

// A create carries an Idempotency-Key, so a retry after a dropped connection (the request may have reached the
// server) gets the first result back instead of making a second row. Network errors are retried once with the same key.
export const newIdempotencyKey = () => (globalThis.crypto?.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`)
const createOnce = async (path, body, key = newIdempotencyKey()) => {
  const options = { method: 'POST', body, headers: { 'Idempotency-Key': key } }
  try {
    return await request(path, options)
  } catch (e) {
    if (!(e instanceof TypeError)) throw e // an HTTP answer: not a transport failure
    return request(path, options)
  }
}

export const tasksApi = {
  list: ({ status, q: search, page = 1, pageSize = 10, priority, assignee, label, due } = {}) => {
    const q = new URLSearchParams({ page, pageSize })
    if (status) q.set('status', status)
    if (search && search.trim()) q.set('q', search.trim())
    if (priority) q.set('priority', priority)
    if (assignee) q.set('assignee', assignee)
    if (label) q.set('label', label)
    if (due) q.set('due', due)
    return request(`/api/tasks?${q}`)
  },
  get: (id) => request(`/api/tasks/${id}`),
  counts: async ({ q: search } = {}) => {
    const s = search && search.trim() ? `&q=${encodeURIComponent(search.trim())}` : ''
    const [all, ...per] = await Promise.all([
      request(`/api/tasks?pageSize=1${s}`),
      ...STATUSES.map((st) => request(`/api/tasks?pageSize=1&status=${st}${s}`)),
    ])
    return { total: all.total, Todo: per[0].total, InProgress: per[1].total, Done: per[2].total }
  },
  stats: (days = 14) => request(`/api/tasks/stats?days=${days}`),
  create: (task, key) => createOnce('/api/tasks', JSON.stringify(task), key),
  update: (id, task) => request(`/api/tasks/${id}`, { method: 'PUT', body: JSON.stringify(task) }),
  // change one or more fields of a task the caller already holds
  patch: (task, changes) => request(`/api/tasks/${task.id}`, { method: 'PUT', body: JSON.stringify(taskBody(task, changes)) }),
  remove: (id) => request(`/api/tasks/${id}`, { method: 'DELETE' }),
  history: (id) => request(`/api/tasks/${id}/history`),
  // CSV: export honours the same filters as list(); import takes a File (multipart) and reports per-row outcomes
  exportUrl: ({ status, q: search, priority, assignee, label, due } = {}) => {
    const p = new URLSearchParams()
    if (status) p.set('status', status)
    if (search && search.trim()) p.set('q', search.trim())
    if (priority) p.set('priority', priority)
    if (assignee) p.set('assignee', assignee)
    if (label) p.set('label', label)
    if (due) p.set('due', due)
    const s = p.toString()
    return `${API}/api/tasks/export.csv${s ? '?' + s : ''}`
  },
  importCsv: (file) => { const form = new FormData(); form.append('file', file, file.name); return request('/api/tasks/import', { method: 'POST', body: form }) },
  ready: async () => {
    try {
      const res = await fetch(API + '/health/ready')
      return res.ok
    } catch {
      return false
    }
  },
  urls: { api: API, ws: WS },
}

export const catalogApi = {
  kinds: () => request('/api/catalog'),
  list: (kind, { parent, q } = {}) => {
    const params = new URLSearchParams()
    if (parent) params.set('parent', parent)
    if (q && q.trim()) params.set('q', q.trim())
    const s = params.toString()
    return request(`/api/catalog/${kind}${s ? '?' + s : ''}`)
  },
  get: (kind, code) => request(`/api/catalog/${kind}/${code}`),
  find: async (kind, code) => (await request(`/api/catalog/${kind}?q=${encodeURIComponent(code)}`)).find((item) => item.code === code) || null,
  create: (kind, item, key) => createOnce(`/api/catalog/${kind}`, JSON.stringify(item), key),
  update: (kind, code, item) => request(`/api/catalog/${kind}/${code}`, { method: 'PUT', body: JSON.stringify(item) }),
  remove: (kind, code) => request(`/api/catalog/${kind}/${code}`, { method: 'DELETE' }),
  history: (kind, code) => request(`/api/catalog/${kind}/${code}/history`),
  exportUrl: (kind) => `${API}/api/catalog/${kind}/export.csv`,
  importCsv: (kind, file) => { const form = new FormData(); form.append('file', file, file.name); return request(`/api/catalog/${kind}/import`, { method: 'POST', body: form }) },
  upsert: async (kind, code, item) => {
    const existing = await catalogApi.find(kind, code)
    return existing
      ? request(`/api/catalog/${kind}/${code}`, { method: 'PUT', body: JSON.stringify(item) })
      : request(`/api/catalog/${kind}`, { method: 'POST', body: JSON.stringify({ code, ...item }) })
  },
}

export const webhooksApi = {
  list: () => request('/api/webhooks'),
  create: (hook) => request('/api/webhooks', { method: 'POST', body: JSON.stringify(hook) }),
  update: (id, patch) => request(`/api/webhooks/${id}`, { method: 'PUT', body: JSON.stringify(patch) }),
  remove: (id) => request(`/api/webhooks/${id}`, { method: 'DELETE' }),
  deliveries: (id) => request(`/api/webhooks/${id}/deliveries`),
}

export const auditApi = {
  list: ({ resource, kind, target, limit = 20 } = {}) => request(`/api/audit?limit=${limit}${resource ? '&resource=' + resource : ''}${kind ? '&kind=' + encodeURIComponent(kind) : ''}${target ? '&target=' + encodeURIComponent(target) : ''}`),
}

export const preferencesApi = {
  get: async (userId) => {
    const prefs = await request(`/api/preferences/${encodeURIComponent(userId)}`)
    return prefs?.saved ? prefs : null
  },
  save: (userId, prefs) => request(`/api/preferences/${encodeURIComponent(userId)}`, { method: 'PUT', body: JSON.stringify(prefs) }),
  remove: (userId) => request(`/api/preferences/${encodeURIComponent(userId)}`, { method: 'DELETE' }),
}

export const uploadsApi = {
  list: (source) => request(`/api/uploads${source ? '?source=' + encodeURIComponent(source) : ''}`),
  create: async ({ files, source, note }) => {
    const form = new FormData()
    for (const f of files) form.append('files', f, f.name)
    if (source) form.append('source', source)
    if (note) form.append('note', note)
    return createOnce('/api/uploads', form)
  },
  remove: (id) => request(`/api/uploads/${id}`, { method: 'DELETE' }),
  contentUrl: (id) => `${API}/api/uploads/${id}/content`,
}

export const userKey = (user) => 'user-' + String(user?.sub ?? user?.id ?? 'anon').replace(/[^A-Za-z0-9._@+-]/g, '-').toLowerCase()

export const dataUrlToFile = (dataUrl, name) => {
  const [meta, b64] = dataUrl.split(',')
  const type = (meta.match(/^data:([^;]+)/) || [])[1] || 'application/octet-stream'
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new File([bytes], name, { type })
}

export const formatBytes = (n) => (n < 1024 ? `${n} B` : n < 1024 * 1024 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1024 / 1024).toFixed(2)} MB`)

export const timeAgo = (iso) => {
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000))
  if (s < 45) return 'just now'
  const m = Math.round(s / 60)
  if (m < 60) return `${m} min ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h} h ago`
  return `${Math.round(h / 24)} d ago`
}

// One WebSocket per browser tab, shared by every page that wants the feed or change notifications.
// Reconnects with exponential backoff and jitter (1 s → 30 s) and resets the delay after a successful open.
const bus = {
  socket: null,
  state: ref('idle'),
  connectionId: ref(''),
  connections: ref(0),
  user: ref(''),
  attempt: 0,
  timer: null,
  listeners: new Set(),
}
const BACKOFF_BASE_MS = 1000
const BACKOFF_MAX_MS = 30000

const nextDelay = () => {
  const exp = Math.min(BACKOFF_MAX_MS, BACKOFF_BASE_MS * 2 ** bus.attempt)
  bus.attempt = Math.min(bus.attempt + 1, 10)
  return Math.round(exp / 2 + Math.random() * exp / 2)
}

const emit = (msg) => { for (const fn of bus.listeners) { try { fn(msg) } catch { } } }

const connectBus = () => {
  if (bus.socket && (bus.socket.readyState === WebSocket.OPEN || bus.socket.readyState === WebSocket.CONNECTING)) return
  clearTimeout(bus.timer)
  bus.state.value = 'connecting'
  const socket = new WebSocket(WS)
  bus.socket = socket
  // Attach the signed-in identity right after the handshake: only an authenticated connection may broadcast,
  // and peers then see who said it. Reads (feed, change events) never need it.
  socket.onopen = () => { bus.state.value = 'open'; bus.attempt = 0; bus.user.value = ''; authRetried = false; authenticateBus() }
  socket.onerror = () => { bus.state.value = 'error' }
  socket.onclose = (ev) => {
    bus.state.value = 'closed'
    bus.connections.value = 0
    emit({ type: '_closed', code: ev.code, reason: ev.reason })
    if (bus.listeners.size) {
      const delay = nextDelay()
      emit({ type: '_retry', delayMs: delay })
      bus.timer = setTimeout(connectBus, delay)
    }
  }
  socket.onmessage = (ev) => {
    let msg
    try { msg = JSON.parse(ev.data) } catch { return emit({ type: '_raw', data: ev.data }) }
    if (msg.connections != null) bus.connections.value = msg.connections
    if (msg.type === 'welcome') bus.connectionId.value = msg.connectionId
    if (msg.type === 'authed') bus.user.value = msg.user || ''
    // An expired access token at handshake time: refresh once through express, then authenticate again.
    if (msg.type === 'error' && /expired token/i.test(msg.error || '') && !authRetried) refreshTokens().then(() => authenticateBus(true)).catch(() => {})
    emit(msg)
  }
}

let authRetried = false
const authenticateBus = async (afterRefresh = false) => {
  const token = http.getTokens?.().access
  if (!token || bus.socket?.readyState !== WebSocket.OPEN) return
  bus.socket.send(JSON.stringify({ type: 'auth', token }))
  authRetried = afterRefresh
}

export const subscribeSocket = (fn) => {
  bus.listeners.add(fn)
  connectBus()
  return () => {
    bus.listeners.delete(fn)
    if (!bus.listeners.size) { clearTimeout(bus.timer); bus.socket?.close(1000, 'no subscribers'); bus.socket = null; bus.state.value = 'idle' }
  }
}

export const socketSend = (type, data) => {
  if (bus.socket?.readyState !== WebSocket.OPEN) return false
  bus.socket.send(JSON.stringify({ type, data }))
  return true
}

export const useTaskPulseSocket = ({ onMessage } = {}) => {
  const events = ref([])
  let unsubscribe = null

  const push = (e) => {
    events.value.unshift({ at: new Date(), ...e })
    if (events.value.length > 60) events.value.length = 60
  }

  const handle = (msg) => {
    switch (msg.type) {
      case 'welcome':
        push({ kind: 'system', text: `Connected as ${msg.connectionId} · ${msg.connections} online` })
        break
      case 'system':
        push({ kind: 'system', text: `${msg.connectionId} ${msg.event} · ${msg.connections} online` })
        break
      case 'broadcast':
        push({ kind: msg.from === bus.connectionId.value ? 'me' : 'peer', from: msg.actor || msg.from, text: msg.data })
        break
      case 'authed':
        push({ kind: 'system', text: `Signed in on the socket as ${msg.user}` })
        break
      case 'echo':
        push({ kind: 'me', text: `echo: ${msg.data}` })
        break
      case 'pong':
        push({ kind: 'system', text: 'pong' })
        break
      case 'changed':
        push({ kind: 'peer', text: `${msg.actor || 'someone'} · ${msg.action} ${msg.resource}${msg.kind ? '/' + msg.kind : ''} ${String(msg.id).slice(0, 8)}` })
        break
      case 'error':
        push({ kind: 'error', text: msg.error })
        break
      case '_closed':
        push({ kind: 'system', text: `Disconnected (${msg.code}${msg.reason ? ' ' + msg.reason : ''})` })
        break
      case '_retry':
        push({ kind: 'system', text: `Reconnecting in ${(msg.delayMs / 1000).toFixed(1)} s` })
        break
      case '_raw':
        push({ kind: 'raw', text: msg.data })
        break
      default:
        push({ kind: 'raw', text: JSON.stringify(msg) })
    }
    if (!msg.type.startsWith('_')) onMessage?.(msg)
  }

  onMounted(() => { unsubscribe = subscribeSocket(handle) })
  onBeforeUnmount(() => { unsubscribe?.() })

  return {
    state: bus.state,
    connectionId: bus.connectionId,
    connections: bus.connections,
    user: bus.user,
    events,
    isOpen: computed(() => bus.state.value === 'open'),
    broadcast: (text) => socketSend('broadcast', text),
    echo: (text) => socketSend('echo', text),
    ping: () => socketSend('ping'),
    reconnect: () => { bus.socket?.close(1000, 'reconnect'); bus.attempt = 0; setTimeout(connectBus, 50) },
    url: WS,
  }
}

// Re-run `handler` (debounced) whenever the API reports that a matching resource changed in any tab or process.
export const useChangeFeed = (handler, { resources = null, debounceMs = 300 } = {}) => {
  let timer = null
  let unsubscribe = null
  const last = ref(null)
  const onMsg = (msg) => {
    if (msg.type !== 'changed') return
    if (resources && !resources.includes(msg.resource)) return
    last.value = { ...msg, at: new Date() }
    clearTimeout(timer)
    timer = setTimeout(() => handler(msg), debounceMs)
  }
  onMounted(() => { unsubscribe = subscribeSocket(onMsg) })
  onBeforeUnmount(() => { clearTimeout(timer); unsubscribe?.() })
  return { last, state: bus.state }
}
