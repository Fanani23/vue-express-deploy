import { ref, computed, onMounted, onBeforeUnmount } from 'vue'

const API = (import.meta.env.VITE_TASKPULSE_URL || 'http://127.0.0.1:8088').replace(/\/$/, '')
const WS = import.meta.env.VITE_TASKPULSE_WS_URL || API.replace(/^http/, 'ws') + '/ws'

export const STATUSES = ['Todo', 'InProgress', 'Done']
export const STATUS_LABEL = { Todo: 'To do', InProgress: 'In progress', Done: 'Done' }
export const STATUS_COLOR = { Todo: 'default', InProgress: 'processing', Done: 'success' }
export const NEXT_STATUS = { Todo: 'InProgress', InProgress: 'Done', Done: 'Todo' }

const request = async (path, options = {}) => {
  const res = await fetch(API + path, {
    ...options,
    headers: { Accept: 'application/json', ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(options.headers || {}) },
  })
  if (res.status === 204) return null
  const body = await res.json().catch(() => null)
  if (!res.ok) {
    const detail = body?.errors ? Object.values(body.errors).flat().join(' ') : body?.detail || body?.title
    throw new Error(detail || `${res.status} ${res.statusText}`)
  }
  return body
}

export const tasksApi = {
  list: ({ status, q: search, page = 1, pageSize = 10 } = {}) => {
    const q = new URLSearchParams({ page, pageSize })
    if (status) q.set('status', status)
    if (search && search.trim()) q.set('q', search.trim())
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
  create: (task) => request('/api/tasks', { method: 'POST', body: JSON.stringify(task) }),
  update: (id, task) => request(`/api/tasks/${id}`, { method: 'PUT', body: JSON.stringify(task) }),
  remove: (id) => request(`/api/tasks/${id}`, { method: 'DELETE' }),
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
  create: (kind, item) => request(`/api/catalog/${kind}`, { method: 'POST', body: JSON.stringify(item) }),
  update: (kind, code, item) => request(`/api/catalog/${kind}/${code}`, { method: 'PUT', body: JSON.stringify(item) }),
  remove: (kind, code) => request(`/api/catalog/${kind}/${code}`, { method: 'DELETE' }),
  upsert: async (kind, code, item) => {
    const res = await fetch(`${API}/api/catalog/${kind}/${code}`, { method: 'PUT', body: JSON.stringify(item), headers: { Accept: 'application/json', 'Content-Type': 'application/json' } })
    if (res.status === 404) return request(`/api/catalog/${kind}`, { method: 'POST', body: JSON.stringify({ code, ...item }) })
    const body = await res.json().catch(() => null)
    if (!res.ok) throw new Error(body?.detail || body?.title || `${res.status} ${res.statusText}`)
    return body
  },
}

export const preferencesApi = {
  get: async (userId) => {
    const res = await fetch(`${API}/api/preferences/${encodeURIComponent(userId)}`, { headers: { Accept: 'application/json' } })
    if (res.status === 404) return null
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
    return res.json()
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
    const res = await fetch(`${API}/api/uploads`, { method: 'POST', body: form, headers: { Accept: 'application/json' } })
    const body = await res.json().catch(() => null)
    if (!res.ok) throw new Error(body?.detail ? `${body.title} (${body.detail})` : body?.title || `${res.status} ${res.statusText}`)
    return body
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

export const useTaskPulseSocket = ({ onMessage } = {}) => {
  const state = ref('connecting')
  const connectionId = ref('')
  const connections = ref(0)
  const events = ref([])
  let socket = null
  let retry = null
  let closedByUs = false

  const push = (e) => {
    events.value.unshift({ at: new Date(), ...e })
    if (events.value.length > 60) events.value.length = 60
  }

  const connect = () => {
    closedByUs = false
    state.value = 'connecting'
    socket = new WebSocket(WS)
    socket.onopen = () => { state.value = 'open' }
    socket.onclose = (ev) => {
      state.value = 'closed'
      connections.value = 0
      push({ kind: 'system', text: `Disconnected (${ev.code}${ev.reason ? ' ' + ev.reason : ''})` })
      if (!closedByUs) retry = setTimeout(connect, 3000)
    }
    socket.onerror = () => { state.value = 'error' }
    socket.onmessage = (ev) => {
      let msg
      try { msg = JSON.parse(ev.data) } catch { return push({ kind: 'raw', text: ev.data }) }
      if (msg.connections != null) connections.value = msg.connections
      switch (msg.type) {
        case 'welcome':
          connectionId.value = msg.connectionId
          push({ kind: 'system', text: `Connected as ${msg.connectionId} · ${msg.connections} online` })
          break
        case 'system':
          push({ kind: 'system', text: `${msg.connectionId} ${msg.event} · ${msg.connections} online` })
          break
        case 'broadcast':
          push({ kind: msg.from === connectionId.value ? 'me' : 'peer', from: msg.from, text: msg.data })
          break
        case 'echo':
          push({ kind: 'me', text: `echo: ${msg.data}` })
          break
        case 'pong':
          push({ kind: 'system', text: 'pong' })
          break
        case 'error':
          push({ kind: 'error', text: msg.error })
          break
        default:
          push({ kind: 'raw', text: ev.data })
      }
      onMessage?.(msg)
    }
  }

  const send = (type, data) => {
    if (socket?.readyState !== WebSocket.OPEN) return false
    socket.send(JSON.stringify({ type, data }))
    return true
  }

  const close = () => {
    closedByUs = true
    clearTimeout(retry)
    socket?.close(1000, 'page closed')
  }

  onMounted(connect)
  onBeforeUnmount(close)

  return {
    state,
    connectionId,
    connections,
    events,
    isOpen: computed(() => state.value === 'open'),
    broadcast: (text) => send('broadcast', text),
    echo: (text) => send('echo', text),
    ping: () => send('ping'),
    reconnect: () => { close(); connect() },
    url: WS,
  }
}
