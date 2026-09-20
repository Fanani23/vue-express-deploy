<template>
  <div class="page dash">
    <header class="page__head">
      <div>
        <h1 class="page__title">Tasks</h1>
        <p class="page__subtitle">Live view of <strong>TaskPulse</strong> — the C# REST API and WebSocket server from part B, called from this Vue app.</p>
      </div>
      <div class="dash__pills">
        <a-tag :color="apiReady === null ? 'default' : apiReady ? 'success' : 'error'" class="pill">
          <ApiOutlined />REST API {{ apiReady === null ? 'checking' : apiReady ? 'healthy' : 'unreachable' }}
        </a-tag>
        <a-tag :color="ws.isOpen.value ? 'success' : ws.state.value === 'connecting' ? 'processing' : 'error'" class="pill">
          <WifiOutlined />WebSocket {{ ws.state.value }}<template v-if="ws.isOpen.value"> · {{ ws.connections.value }} online</template>
        </a-tag>
      </div>
    </header>

    <a-row :gutter="[16, 16]" class="dash__stats">
      <a-col v-for="card in statCards" :key="card.key" :xs="12" :md="6">
        <button type="button" class="stat" :class="{ 'stat--active': filter === card.key }" :data-cy="'stat-' + card.key" @click="setFilter(card.key)">
          <span class="stat__row">
            <span class="stat__icon" :data-status="card.key"><component :is="card.icon" /></span>
            <span class="stat__body">
              <span class="stat__label">{{ card.label }}</span>
              <span class="stat__value">{{ counts ? counts[card.key === 'all' ? 'total' : card.key] : '—' }}</span>
            </span>
          </span>
          <span class="stat__bar"><i :style="{ width: barWidth(card.key) }" :data-status="card.key" /></span>
        </button>
      </a-col>
    </a-row>

    <a-row :gutter="[16, 16]">
      <a-col :xs="24" :xl="16">
        <div class="page__card">
          <div class="sec">
            <span class="sec__icon"><UnorderedListOutlined /></span>
            <h3 class="sec__title">Tasks</h3>
            <span class="sec__count">{{ total }}</span>
            <a-segmented v-model:value="filter" :options="segments" size="small" data-cy="filter" />
          </div>
          <a-input v-model:value="search" data-cy="search" placeholder="Search title or description…" allow-clear class="search" @pressEnter="applySearch">
            <template #prefix><SearchOutlined class="new-task__icon" /></template>
            <template #suffix><span v-if="search && search !== appliedSearch" class="page__muted search__hint">Enter</span></template>
          </a-input>

          <form class="new-task" @submit.prevent="createTask">
            <a-input v-model:value="draft.title" data-cy="new-title" placeholder="What needs doing?" :maxlength="200" size="large">
              <template #prefix><EditOutlined class="new-task__icon" /></template>
            </a-input>
            <a-input v-model:value="draft.description" data-cy="new-description" placeholder="Details (optional)" :maxlength="2000" size="large">
              <template #prefix><AlignLeftOutlined class="new-task__icon" /></template>
            </a-input>
            <a-button type="primary" size="large" html-type="submit" data-cy="new-submit" :loading="creating" :disabled="!draft.title.trim()">
              <template #icon><PlusOutlined /></template>
              Add
            </a-button>
            <div class="new-task__extra">
              <a-select v-model:value="draft.priority" size="small" class="new-task__priority" :options="PRIORITIES.map((p) => ({ value: p, label: p }))" data-a11y-label="Priority" data-cy="new-priority" />
              <a-date-picker v-model:value="draft.due" size="small" class="new-task__due" placeholder="Due date" :show-time="false" value-format="YYYY-MM-DD" />
              <a-select v-model:value="draft.assigneeId" size="small" class="new-task__assignee" placeholder="Assign to…" allow-clear show-search option-filter-prop="label" :options="assigneeOptions" data-a11y-label="Assignee" data-cy="new-assignee" />
              <a-select v-model:value="draft.labels" mode="tags" size="small" class="new-task__labels" placeholder="Labels" :options="labelOptions" :max-tag-count="3" data-a11y-label="Labels" data-cy="new-labels" />
            </div>
          </form>

          <div class="task-filters" data-cy="task-filters">
            <a-select v-model:value="extra.priority" size="small" placeholder="Any priority" allow-clear :options="PRIORITIES.map((p) => ({ value: p, label: p }))" data-a11y-label="Filter by priority" class="task-filters__select" />
            <a-select v-model:value="extra.assignee" size="small" placeholder="Anyone" allow-clear show-search option-filter-prop="label" :options="[{ value: 'me', label: 'Assigned to me' }, ...assigneeOptions]" data-a11y-label="Filter by assignee" class="task-filters__select" />
            <a-select v-model:value="extra.due" size="small" placeholder="Any due date" allow-clear :options="[{ value: 'overdue', label: 'Overdue' }, { value: 'today', label: 'Due today' }, { value: 'week', label: 'Due this week' }, { value: 'none', label: 'No due date' }]" data-a11y-label="Filter by due date" class="task-filters__select" />
            <a-select v-model:value="extra.label" size="small" placeholder="Any label" allow-clear show-search :options="labelOptions" data-a11y-label="Filter by label" class="task-filters__select" />
            <span v-if="overdueCount" class="task-filters__overdue" data-cy="overdue-count"><ClockCircleOutlined /> {{ overdueCount }} overdue</span>
          </div>

          <a-table
            :data-source="tasks"
            :columns="columns"
            :loading="loading"
            :pagination="false"
            row-key="id"
            size="middle"
            class="tasks"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'title'">
                <div class="task">
                  <span class="task__mark" :data-status="record.status"><CheckOutlined v-if="record.status === 'Done'" /><ClockCircleOutlined v-else-if="record.status === 'InProgress'" /><BorderOutlined v-else /></span>
                  <div class="task__text">
                    <div class="task__title" :class="{ 'task__title--done': record.status === 'Done' }">{{ record.title }}</div>
                    <div v-if="record.description" class="task__desc">{{ record.description }}</div>
                    <div v-if="record.priority !== 'Normal' || record.dueAt || record.assigneeName || record.labels?.length" class="task__meta">
                      <a-tag v-if="record.priority !== 'Normal'" :color="PRIORITY_COLOR[record.priority]" class="task__chip"><FlagOutlined /> {{ record.priority }}</a-tag>
                      <a-tag v-if="record.dueAt" :color="isOverdue(record) ? 'error' : 'default'" class="task__chip" :title="new Date(record.dueAt).toLocaleDateString()"><CalendarOutlined /> {{ dueLabel(record.dueAt) }}</a-tag>
                      <a-tag v-if="record.assigneeName" class="task__chip task__chip--who"><UserOutlined /> {{ record.assigneeName.replace(/@.*/, '') }}</a-tag>
                      <a-tag v-for="l in record.labels || []" :key="l" class="task__chip task__chip--label"><TagsOutlined /> {{ l }}</a-tag>
                    </div>
                  </div>
                </div>
              </template>
              <template v-else-if="column.key === 'status'">
                <a-select :value="record.status" size="small" class="task__status" :data-a11y-label="`Status of ${record.title}`" :options="statusOptions" :bordered="false" @change="(s) => setStatus(record, s)" />
              </template>
              <template v-else-if="column.key === 'updated'">
                <a-tooltip :title="new Date(record.updatedAt).toLocaleString()"><span class="task__when"><HistoryOutlined />{{ timeAgo(record.updatedAt) }}</span></a-tooltip>
              </template>
              <template v-else-if="column.key === 'actions'">
                <a-space :size="2">
                  <a-tooltip :title="'Move to ' + STATUS_LABEL[NEXT_STATUS[record.status]]">
                    <a-button size="small" type="text" class="task__btn" @click="setStatus(record, NEXT_STATUS[record.status])"><template #icon><ArrowRightOutlined /></template></a-button>
                  </a-tooltip>
                  <a-popconfirm title="Delete this task?" ok-text="Delete" ok-type="danger" @confirm="removeTask(record)">
                    <a-button size="small" type="text" danger class="task__btn" :data-cy="'delete-' + record.id"><template #icon><DeleteOutlined /></template></a-button>
                  </a-popconfirm>
                </a-space>
              </template>
            </template>
            <template #emptyText>
              <div class="empty"><InboxOutlined class="empty__icon" /><span>{{ appliedSearch ? `No task matches “${appliedSearch}”` : filter === 'all' ? 'No tasks yet' : `Nothing ${STATUS_LABEL[filter].toLowerCase()}` }}</span><span class="empty__hint">{{ appliedSearch ? 'The search runs on the server over title and description.' : filter === 'all' ? 'Add the first one above.' : 'Pick another filter or add a task.' }}</span></div>
            </template>
          </a-table>
          <div v-if="total > 0" class="pager">
            <span class="pager__info">Showing <strong>{{ rangeStart }}–{{ rangeEnd }}</strong> of <strong>{{ total }}</strong> · page {{ page }} of {{ pageCount }}</span>
            <div class="pager__controls">
              <a-select v-model:value="pageSize" size="small" class="pager__size" data-a11y-label="Rows per page" :options="[8, 16, 32].map((n) => ({ value: n, label: `${n} / page` }))" />
              <a-tooltip title="First page"><a-button size="small" :disabled="page <= 1" @click="goTo(1)"><template #icon><DoubleLeftOutlined /></template></a-button></a-tooltip>
              <a-tooltip title="Previous"><a-button size="small" :disabled="page <= 1" @click="goTo(page - 1)"><template #icon><LeftOutlined /></template></a-button></a-tooltip>
              <button v-for="n in pageItems" :key="n" type="button" class="pager__page" :class="{ 'pager__page--on': n === page }" @click="goTo(n)">{{ n }}</button>
              <a-tooltip title="Next"><a-button size="small" :disabled="page >= pageCount" @click="goTo(page + 1)"><template #icon><RightOutlined /></template></a-button></a-tooltip>
              <a-tooltip title="Last page"><a-button size="small" :disabled="page >= pageCount" @click="goTo(pageCount)"><template #icon><DoubleRightOutlined /></template></a-button></a-tooltip>
            </div>
          </div>
        </div>
      </a-col>

      <a-col :xs="24" :xl="8">
        <div class="page__card feedcard">
          <div class="sec">
            <span class="sec__icon"><ThunderboltOutlined /></span>
            <h3 class="sec__title">Live feed</h3>
            <span class="sec__count">{{ ws.isOpen.value ? `${ws.connections.value} online` : ws.state.value }}</span>
          </div>

          <form class="feed__send" @submit.prevent="sendBroadcast">
            <a-input v-model:value="shout" data-cy="broadcast-text" :placeholder="ws.user.value ? `Broadcast to every open tab as ${ws.user.value}…` : 'Broadcast to every open tab…'" :disabled="!ws.isOpen.value || !ws.user.value">
              <template #prefix><NotificationOutlined class="new-task__icon" /></template>
            </a-input>
            <a-button type="primary" html-type="submit" data-cy="broadcast" :disabled="!ws.isOpen.value || !ws.user.value || !shout.trim()"><template #icon><SendOutlined /></template></a-button>
          </form>
          <div class="feed__tools">
            <a-button size="small" @click="ws.ping()" :disabled="!ws.isOpen.value"><template #icon><SwapOutlined /></template>ping</a-button>
            <a-button size="small" @click="ws.reconnect()"><template #icon><ReloadOutlined /></template>reconnect</a-button>
          </div>

          <ul class="feed" data-cy="feed">
            <li v-for="(e, i) in ws.events.value" :key="i" class="feed__item" :data-kind="e.kind">
              <span class="feed__time">{{ e.at.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) }}</span>
              <span class="feed__badge">{{ e.kind === 'me' ? 'you' : e.kind === 'peer' ? e.from : e.kind }}</span>
              <span class="feed__text">{{ e.text }}</span>
            </li>
            <li v-if="!ws.events.value.length" class="empty"><ThunderboltOutlined class="empty__icon" /><span>No messages yet</span><span class="empty__hint">Waiting for the first message from the socket.</span></li>
          </ul>
        </div>
      </a-col>
    </a-row>

    <transition name="pop">
      <a-alert v-if="error" class="dash__alert" type="error" show-icon closable :message="error" @close="error = ''" />
    </transition>
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { PlusOutlined, DeleteOutlined, ArrowRightOutlined, ApiOutlined, WifiOutlined, UnorderedListOutlined, EditOutlined, AlignLeftOutlined, CheckOutlined, BorderOutlined, ClockCircleOutlined, HistoryOutlined, InboxOutlined, ThunderboltOutlined, NotificationOutlined, SendOutlined, SwapOutlined, ReloadOutlined, AppstoreOutlined, CheckCircleOutlined, LeftOutlined, RightOutlined, DoubleLeftOutlined, DoubleRightOutlined, SearchOutlined } from '@ant-design/icons-vue'
import { tasksApi, catalogApi, useTaskPulseSocket, useChangeFeed, timeAgo, STATUSES, STATUS_LABEL, NEXT_STATUS, PRIORITIES, PRIORITY_COLOR, isOverdue, dueLabel } from '../taskpulse.js'
import { usersApi } from '../users.js'
import { useMainStore } from '../store.js'
import { UserOutlined, CalendarOutlined, FlagOutlined, TagsOutlined } from '@ant-design/icons-vue'

const api = tasksApi.urls.api
const apiReady = ref(null)
const counts = ref(null)
const tasks = ref([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(8)
const filter = ref('all')
const route = useRoute()
const search = ref(typeof route.query.q === 'string' ? route.query.q : '')
const appliedSearch = ref(search.value)
let searchTimer = null
const applySearch = () => { clearTimeout(searchTimer); appliedSearch.value = search.value.trim() }
watch(search, () => { clearTimeout(searchTimer); searchTimer = setTimeout(applySearch, 350) })
watch(appliedSearch, () => { page.value = 1; refresh() })
const loading = ref(false)
const creating = ref(false)
const error = ref('')
const draft = reactive({ title: '', description: '', priority: 'Normal', due: null, assigneeId: null, labels: [] })
const extra = reactive({ priority: null, assignee: null, due: null, label: null })
const store = useMainStore()
const users = ref([])
const tags = ref([])
const overdueCount = ref(0)
const assigneeOptions = computed(() => users.value.map((u) => ({ value: String(u.id), label: u.username + (u.email ? ` · ${u.email}` : '') })))
const labelOptions = computed(() => tags.value.map((t) => ({ value: t.code, label: t.label })))
const assigneeName = (id) => { const u = users.value.find((x) => String(x.id) === String(id)); return u ? u.email || u.username : null }
const loadOptions = async () => {
  try { users.value = await usersApi.list() } catch { users.value = [] }
  try { tags.value = await catalogApi.list('tags') } catch { tags.value = [] }
}
const loadOverdue = async () => { try { overdueCount.value = (await tasksApi.list({ due: 'overdue', pageSize: 1 })).total } catch { } }
watch(extra, () => { page.value = 1; refresh() })
const shout = ref('')

const statCards = [
  { key: 'all', label: 'All tasks', icon: AppstoreOutlined },
  { key: 'Todo', label: 'To do', icon: BorderOutlined },
  { key: 'InProgress', label: 'In progress', icon: ClockCircleOutlined },
  { key: 'Done', label: 'Done', icon: CheckCircleOutlined },
]
const segments = [{ label: 'All', value: 'all' }, ...STATUSES.map((s) => ({ label: STATUS_LABEL[s], value: s }))]
const statusOptions = STATUSES.map((s) => ({ label: STATUS_LABEL[s], value: s }))
const columns = [
  { title: 'Task', key: 'title', dataIndex: 'title' },
  { title: 'Status', key: 'status', dataIndex: 'status', width: 150 },
  { title: 'Updated', key: 'updated', dataIndex: 'updatedAt', width: 120 },
  { title: '', key: 'actions', width: 90, align: 'right' },
]

const barWidth = (key) => {
  if (!counts.value || !counts.value.total) return '0%'
  const n = key === 'all' ? counts.value.total : counts.value[key]
  return Math.round((n / counts.value.total) * 100) + '%'
}

const fail = (e) => { error.value = e?.message || String(e) }

const loadCounts = async () => {
  try { counts.value = await tasksApi.counts({ q: appliedSearch.value }) } catch (e) { fail(e) }
}

const loadTasks = async () => {
  loading.value = true
  try {
    const res = await tasksApi.list({ status: filter.value === 'all' ? undefined : filter.value, q: appliedSearch.value, page: page.value, pageSize: pageSize.value, ...extra })
    tasks.value = res.items
    total.value = res.total
    if (res.items.length === 0 && page.value > 1) { page.value = 1; await loadTasks() }
  } catch (e) { fail(e) } finally { loading.value = false }
}

const refresh = () => Promise.all([loadCounts(), loadTasks(), loadOverdue()])

const setFilter = (key) => { filter.value = key }
const pageCount = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)))
const rangeStart = computed(() => (total.value ? (page.value - 1) * pageSize.value + 1 : 0))
const rangeEnd = computed(() => Math.min(total.value, page.value * pageSize.value))
const pageItems = computed(() => {
  const n = pageCount.value
  const start = Math.min(Math.max(1, page.value - 1), Math.max(1, n - 2))
  return Array.from({ length: Math.min(3, n) }, (_, i) => start + i)
})
const goTo = (p) => { page.value = Math.min(Math.max(1, p), pageCount.value); loadTasks() }
watch(pageSize, () => { page.value = 1; loadTasks() })

const announce = (what, task) => ws.broadcast(`task:${what} "${task.title}"`)

const createTask = async () => {
  if (!draft.title.trim() || creating.value) return
  creating.value = true
  try {
    const task = await tasksApi.create({
      title: draft.title, description: draft.description || null, priority: draft.priority,
      dueAt: draft.due ? new Date(draft.due + 'T17:00:00').toISOString() : null,
      assigneeId: draft.assigneeId || null, assigneeName: draft.assigneeId ? assigneeName(draft.assigneeId) : null,
      labels: draft.labels,
    })
    draft.title = ''; draft.description = ''; draft.priority = 'Normal'; draft.due = null; draft.assigneeId = null; draft.labels = []
    filter.value = 'all'; page.value = 1
    await refresh()
    announce('created', task)
  } catch (e) { fail(e) } finally { creating.value = false }
}

// Optimistic: the row changes on screen at once and the counts follow; the server answer is applied on top,
// and a failure puts the previous state back with the error shown.
const bump = (from, to) => { if (!counts.value) return; if (from) counts.value[from] = Math.max(0, counts.value[from] - 1); if (to) counts.value[to] = (counts.value[to] || 0) + 1 }
const setStatus = async (record, status) => {
  if (status === record.status) return
  const previous = record.status
  const row = tasks.value.find((t) => t.id === record.id)
  if (row) { row.status = status; row.updatedAt = new Date().toISOString() }
  bump(previous, status)
  if (filter.value !== 'all' && filter.value !== status) tasks.value = tasks.value.filter((t) => t.id !== record.id)
  try {
    const task = await tasksApi.patch({ ...record, status: previous }, { status })
    if (row) Object.assign(row, task)
    announce(status === 'Done' ? 'done' : 'moved', task)
    loadCounts()
  } catch (e) { fail(e); await refresh() }
}

const removeTask = async (record) => {
  const index = tasks.value.findIndex((t) => t.id === record.id)
  const snapshot = tasks.value.slice()
  if (index >= 0) tasks.value.splice(index, 1)
  total.value = Math.max(0, total.value - 1)
  bump(record.status, null)
  if (counts.value) counts.value.total = Math.max(0, counts.value.total - 1)
  try {
    await tasksApi.remove(record.id)
    announce('deleted', record)
    if (!tasks.value.length && page.value > 1) { page.value--; await loadTasks() }
  } catch (e) { tasks.value = snapshot; fail(e); await refresh() }
}

const ws = useTaskPulseSocket({
  onMessage: (msg) => {
    if (msg.type === 'broadcast' && msg.from !== ws.connectionId.value && /^task:/.test(msg.data || '')) refresh()
  },
})

const sendBroadcast = () => {
  if (ws.broadcast(shout.value.trim())) shout.value = ''
}

watch(filter, () => { page.value = 1; loadTasks() })

onMounted(async () => {
  loadOptions()
  apiReady.value = await tasksApi.ready()
  await refresh()
})
useChangeFeed(() => refresh(), { resources: ['task'] })
</script>

<style src="../style/dashboard.css">.new-task__extra { grid-column: 1 / -1; display: flex; flex-wrap: wrap; gap: 0.4rem; align-items: center; }
.new-task__priority { width: 7rem; }
.new-task__assignee { min-width: 12rem; flex: 1; }
.new-task__labels { min-width: 12rem; flex: 1; }
.task-filters { display: flex; flex-wrap: wrap; gap: 0.4rem; align-items: center; margin: 0.6rem 0 0.4rem; }
.task-filters__select { min-width: 9.5rem; }
.task-filters__overdue { margin-left: auto; font-size: 0.8rem; color: var(--ant-color-error, #cf1322); font-weight: 600; }
.task__meta { display: flex; flex-wrap: wrap; gap: 0.25rem; margin-top: 0.3rem; }
.task__chip { margin: 0; font-size: 0.72rem; line-height: 1.4; }
.task__chip--label { background: var(--p-bg, #f5f5f5); }
</style>
<style scoped>
.search { margin-bottom: 0.75rem; }
.search__hint { font-size: 0.7rem; border: 1px solid var(--p-border); border-radius: 4px; padding: 0 0.3rem; }
</style>
