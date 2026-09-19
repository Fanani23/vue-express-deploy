<template>
  <div class="page">
    <header class="page__head">
      <div>
        <h1 class="page__title">Cascading selects from an API</h1>
        <p class="page__subtitle">Each level is fetched from TaskPulse when the level above changes: status → tasks in that status → the chosen task's record. The template version called <code>/api/custom-app/cascade/*</code>, which this backend does not have.</p>
      </div>
      <div class="page__actions">
        <a-tag class="pill" :color="error ? 'error' : 'success'"><ApiOutlined />{{ error ? 'API error' : api.replace(/^https?:\/\//, '') }}</a-tag>
        <a-button @click="clearAll" :disabled="!statuses.length"><template #icon><ClearOutlined /></template>Clear</a-button>
      </div>
    </header>

    <div class="api-grid">
      <div class="page__card">
        <div class="sec">
          <span class="sec__icon"><FilterOutlined /></span>
          <h3 class="sec__title">1 · Status</h3>
          <span class="sec__count">{{ statuses.length }} / {{ STATUSES.length }}</span>
        </div>
        <div class="chips">
          <a-checkable-tag v-for="s in STATUSES" :key="s" :checked="statuses.includes(s)" class="chip" :data-status="s" @change="(on) => toggleStatus(s, on)">
            <CheckOutlined v-if="s === 'Done'" /><ClockCircleOutlined v-else-if="s === 'InProgress'" /><BorderOutlined v-else /> {{ STATUS_LABEL[s] }}
            <span v-if="counts[s] != null" class="chip__n">{{ counts[s] }}</span>
          </a-checkable-tag>
        </div>
        <p class="page__note">Each chip you turn on triggers <code>GET /api/tasks?status=…</code>; the level below is rebuilt from the responses.</p>
      </div>

      <div class="page__card">
        <div class="sec">
          <span class="sec__icon"><UnorderedListOutlined /></span>
          <h3 class="sec__title">2 · Task</h3>
          <span class="sec__count">{{ loadingTasks ? 'loading…' : `${tasks.length} loaded` }}</span>
        </div>
        <div v-if="!statuses.length" class="empty"><UnorderedListOutlined class="empty__icon" /><span>No tasks loaded</span><span class="empty__hint">Choose a status first.</span></div>
        <template v-else>
          <a-input v-model:value="query" placeholder="Filter loaded tasks…" allow-clear style="margin-bottom: 0.6rem"><template #prefix><SearchOutlined class="in-icon" /></template></a-input>
          <div v-if="!visibleTasks.length" class="empty"><FileSearchOutlined class="empty__icon" /><span>No task matches</span></div>
          <ul v-else class="picklist">
            <li v-for="t in visibleTasks" :key="t.id" class="pick" :class="{ 'pick--on': taskId === t.id }" @click="selectTask(t.id)">
              <span class="pick__mark" :data-status="t.status"><CheckOutlined v-if="t.status === 'Done'" /><ClockCircleOutlined v-else-if="t.status === 'InProgress'" /><BorderOutlined v-else /></span>
              <span class="pick__title">{{ t.title }}</span>
              <RightOutlined class="pick__go" />
            </li>
          </ul>
        </template>
      </div>

      <div class="page__card">
        <div class="sec">
          <span class="sec__icon"><FileTextOutlined /></span>
          <h3 class="sec__title">3 · Record</h3>
          <span v-if="task" class="sec__count">GET /api/tasks/{{ task.id.slice(0, 8) }}…</span>
          <a-segmented v-if="task" v-model:value="view" :options="['Fields', 'JSON']" size="small" />
        </div>
        <div v-if="loadingTask" class="empty"><LoadingOutlined class="empty__icon" /><span>Fetching…</span></div>
        <div v-else-if="!task" class="empty"><FileTextOutlined class="empty__icon" /><span>No record</span><span class="empty__hint">Pick a task to fetch it by id.</span></div>
        <template v-else>
          <dl v-if="view === 'Fields'" class="kv">
            <dt>Title</dt><dd><strong>{{ task.title }}</strong></dd>
            <dt>Description</dt><dd>{{ task.description || '—' }}</dd>
            <dt>Status</dt><dd><a-tag :color="STATUS_COLOR[task.status]">{{ STATUS_LABEL[task.status] }}</a-tag></dd>
            <dt>Created</dt><dd>{{ new Date(task.createdAt).toLocaleString() }}</dd>
            <dt>Updated</dt><dd>{{ new Date(task.updatedAt).toLocaleString() }} <span class="page__muted">({{ timeAgo(task.updatedAt) }})</span></dd>
            <dt>Id</dt><dd><code>{{ task.id }}</code></dd>
          </dl>
          <pre v-else class="code">{{ JSON.stringify(task, null, 2) }}</pre>
        </template>
      </div>

      <div class="page__card">
        <div class="sec">
          <span class="sec__icon"><HistoryOutlined /></span>
          <h3 class="sec__title">Requests made</h3>
          <span class="sec__count">{{ requests.length }}</span>
          <a-button size="small" type="text" :disabled="!requests.length" @click="requests = []">clear</a-button>
        </div>
        <div v-if="!requests.length" class="empty"><HistoryOutlined class="empty__icon" /><span>Nothing yet</span><span class="empty__hint">Requests appear here as you go down the levels.</span></div>
        <ul v-else class="reqs">
          <li v-for="(r, i) in requests" :key="i" class="req">
            <span class="req__code" :data-ok="r.status < 400">{{ r.status }}</span>
            <code class="req__path">{{ r.path }}</code>
            <span class="req__meta">{{ r.note }} · {{ r.ms }} ms · {{ r.t }}</span>
          </li>
        </ul>
        <p class="page__note">Selections that are no longer valid after a parent change are dropped, exactly as in the static versions — but the option lists come from the server, so they stay correct when tasks change elsewhere.</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, reactive } from 'vue'
import { ApiOutlined, ClearOutlined, FilterOutlined, CheckOutlined, ClockCircleOutlined, BorderOutlined, UnorderedListOutlined, SearchOutlined, FileSearchOutlined, RightOutlined, FileTextOutlined, LoadingOutlined, HistoryOutlined } from '@ant-design/icons-vue'
import { tasksApi, timeAgo, STATUSES, STATUS_LABEL, STATUS_COLOR } from '../../taskpulse.js'

const api = tasksApi.urls.api
const statuses = ref([])
const tasks = ref([])
const taskId = ref('')
const task = ref(null)
const query = ref('')
const view = ref('Fields')
const loadingTasks = ref(false)
const loadingTask = ref(false)
const error = ref('')
const counts = reactive({})
const requests = ref([])
const logReq = (r) => { requests.value.unshift({ t: new Date().toLocaleTimeString(), ...r }); if (requests.value.length > 20) requests.value.length = 20 }

const visibleTasks = computed(() => { const q = query.value.trim().toLowerCase(); return q ? tasks.value.filter((t) => t.title.toLowerCase().includes(q)) : tasks.value })

const loadTasks = async () => {
  loadingTasks.value = true
  error.value = ''
  try {
    const results = await Promise.all(statuses.value.map(async (s) => {
      const t0 = performance.now()
      const r = await tasksApi.list({ status: s, pageSize: 100 })
      counts[s] = r.total
      logReq({ status: 200, path: `GET /api/tasks?status=${s}`, note: `${r.total} task${r.total === 1 ? '' : 's'}`, ms: Math.round(performance.now() - t0) })
      return r.items
    }))
    tasks.value = results.flat()
    if (!tasks.value.some((t) => t.id === taskId.value)) { taskId.value = ''; task.value = null }
  } catch (e) { error.value = e.message; logReq({ status: 0, path: 'GET /api/tasks', note: e.message, ms: 0 }) } finally { loadingTasks.value = false }
}
const toggleStatus = (s, on) => { statuses.value = on ? [...statuses.value, s] : statuses.value.filter((x) => x !== s); loadTasks() }

const selectTask = async (id) => {
  taskId.value = id
  task.value = null
  loadingTask.value = true
  const t0 = performance.now()
  try {
    const res = await fetch(`${api}/api/tasks/${id}`, { headers: { Accept: 'application/json' } })
    logReq({ status: res.status, path: `GET /api/tasks/${id.slice(0, 8)}…`, note: res.ok ? 'record' : 'error', ms: Math.round(performance.now() - t0) })
    task.value = await res.json()
  } catch (e) { error.value = e.message } finally { loadingTask.value = false }
}
const clearAll = () => { statuses.value = []; tasks.value = []; taskId.value = ''; task.value = null; query.value = ''; for (const k of Object.keys(counts)) delete counts[k] }
</script>

<style scoped>
.api-grid { display: grid; gap: 1rem; grid-template-columns: repeat(2, minmax(0, 1fr)); align-items: start; }
@media (max-width: 1100px) { .api-grid { grid-template-columns: 1fr; } }
.in-icon { color: var(--p-muted); }
.chips { display: flex; flex-wrap: wrap; gap: 0.4rem; }
.chip { margin: 0; padding: 0.3rem 0.7rem; border-radius: 999px; border: 1px solid var(--p-border); background: var(--p-bg); font-size: 0.85rem; line-height: 1.3; cursor: pointer; display: inline-flex; align-items: center; gap: 0.3rem; user-select: none; }
.chip:hover { border-color: var(--p-accent); color: var(--p-accent); }
.chip.ant-tag-checkable-checked { background: var(--p-accent); border-color: var(--p-accent); color: #fff; }
.chip[data-status="Done"].ant-tag-checkable-checked { background: #16a34a; border-color: #16a34a; }
.chip[data-status="Todo"].ant-tag-checkable-checked { background: #64748b; border-color: #64748b; }
.chip__n { font-size: 0.7rem; opacity: 0.7; padding: 0 0.35rem; border-radius: 999px; background: rgba(0, 0, 0, 0.08); }
.chip.ant-tag-checkable-checked .chip__n { background: rgba(255, 255, 255, 0.25); }
.picklist { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.35rem; max-height: 22rem; overflow: auto; }
.pick { display: grid; grid-template-columns: auto 1fr auto; gap: 0.6rem; align-items: center; padding: 0.5rem 0.7rem; border-radius: 10px; background: var(--p-bg); border: 1px solid var(--p-border); cursor: pointer; transition: border-color 0.15s, background 0.15s; }
.pick:hover { border-color: var(--p-accent); }
.pick--on { border-color: var(--p-accent); background: color-mix(in srgb, var(--p-accent) 10%, transparent); }
.pick__mark { width: 1.5rem; height: 1.5rem; border-radius: 6px; display: grid; place-items: center; font-size: 0.75rem; background: rgba(148, 163, 184, 0.2); color: #64748b; }
.pick__mark[data-status="InProgress"] { background: rgba(59, 130, 246, 0.15); color: #3b82f6; }
.pick__mark[data-status="Done"] { background: rgba(22, 163, 74, 0.15); color: #16a34a; }
.pick__title { font-size: 0.9rem; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pick__go { color: var(--p-muted); font-size: 0.7rem; }
.reqs { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.35rem; max-height: 18rem; overflow: auto; }
.req { display: grid; grid-template-columns: auto 1fr; gap: 0.2rem 0.6rem; align-items: center; padding: 0.45rem 0.6rem; border-radius: 10px; background: var(--p-bg); border: 1px solid var(--p-border); font-size: 0.82rem; }
.req__code { grid-row: span 2; font-family: ui-monospace, Menlo, Consolas, monospace; font-weight: 700; font-size: 0.75rem; padding: 0.15rem 0.45rem; border-radius: 6px; background: rgba(239, 68, 68, 0.12); color: #ef4444; }
.req__code[data-ok="true"] { background: rgba(22, 163, 74, 0.12); color: #16a34a; }
.req__path { font-family: ui-monospace, Menlo, Consolas, monospace; overflow-wrap: anywhere; }
.req__meta { font-size: 0.75rem; color: var(--p-muted); }
</style>
