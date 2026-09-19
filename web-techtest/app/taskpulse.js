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
  list: ({ status, page = 1, pageSize = 10 } = {}) => {
    const q = new URLSearchParams({ page, pageSize })
    if (status) q.set('status', status)
    return request(`/api/tasks?${q}`)
  },
  counts: async () => {
    const [all, ...per] = await Promise.all([
      request('/api/tasks?pageSize=1'),
      ...STATUSES.map((s) => request(`/api/tasks?pageSize=1&status=${s}`)),
    ])
    return { total: all.total, Todo: per[0].total, InProgress: per[1].total, Done: per[2].total }
  },
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
  stats: () => request('/stats'),
  urls: { api: API, ws: WS },
}

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
    ping: () => send('ping'),
    reconnect: () => { close(); connect() },
    url: WS,
  }
}
