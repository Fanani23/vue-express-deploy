<template>
  <div class="dash">
    <header class="dash__head">
      <div>
        <h1 class="dash__title">Dashboard</h1>
        <p class="dash__subtitle">Live view of <strong>TaskPulse</strong> — the C# REST API and WebSocket server from part B, called from this Vue app.</p>
      </div>
      <div class="dash__pills">
        <a-tag :color="apiReady === null ? 'default' : apiReady ? 'success' : 'error'" class="pill">
          <span class="pill__dot" />REST API {{ apiReady === null ? 'checking' : apiReady ? 'healthy' : 'unreachable' }}
        </a-tag>
        <a-tag :color="ws.isOpen.value ? 'success' : ws.state.value === 'connecting' ? 'processing' : 'error'" class="pill">
          <span class="pill__dot" />WebSocket {{ ws.state.value }}<template v-if="ws.isOpen.value"> · {{ ws.connections.value }} online</template>
        </a-tag>
      </div>
    </header>

    <a-row :gutter="[16, 16]" class="dash__stats">
      <a-col v-for="card in statCards" :key="card.key" :xs="12" :md="6">
        <button type="button" class="stat" :class="{ 'stat--active': filter === card.key }" :data-cy="'stat-' + card.key" @click="setFilter(card.key)">
          <span class="stat__label">{{ card.label }}</span>
          <span class="stat__value">{{ counts ? counts[card.key === 'all' ? 'total' : card.key] : '—' }}</span>
          <span class="stat__bar"><i :style="{ width: barWidth(card.key) }" :data-status="card.key" /></span>
        </button>
      </a-col>
    </a-row>

    <a-row :gutter="[16, 16]">
      <a-col :xs="24" :xl="16">
        <a-card class="panel" :bordered="false">
          <template #title>
            <div class="panel__head">
              <span>Tasks</span>
              <a-segmented v-model:value="filter" :options="segments" size="small" data-cy="filter" />
            </div>
          </template>

          <form class="new-task" @submit.prevent="createTask">
            <a-input v-model:value="draft.title" data-cy="new-title" placeholder="What needs doing?" :maxlength="200" size="large" />
            <a-input v-model:value="draft.description" data-cy="new-description" placeholder="Details (optional)" :maxlength="2000" size="large" />
            <a-button type="primary" size="large" html-type="submit" data-cy="new-submit" :loading="creating" :disabled="!draft.title.trim()">
              <template #icon><PlusOutlined /></template>
              Add
            </a-button>
          </form>

          <a-table
            :data-source="tasks"
            :columns="columns"
            :loading="loading"
            :pagination="{ current: page, pageSize, total, showSizeChanger: false, size: 'small', showTotal: (t) => `${t} task${t === 1 ? '' : 's'}` }"
            row-key="id"
            size="middle"
            class="tasks"
            @change="onTableChange"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'title'">
                <div class="task__title" :class="{ 'task__title--done': record.status === 'Done' }">{{ record.title }}</div>
                <div v-if="record.description" class="task__desc">{{ record.description }}</div>
              </template>
              <template v-else-if="column.key === 'status'">
                <a-select :value="record.status" size="small" class="task__status" :options="statusOptions" @change="(s) => setStatus(record, s)" />
              </template>
              <template v-else-if="column.key === 'updated'">
                <a-tooltip :title="new Date(record.updatedAt).toLocaleString()">{{ timeAgo(record.updatedAt) }}</a-tooltip>
              </template>
              <template v-else-if="column.key === 'actions'">
                <a-space>
                  <a-tooltip :title="'Move to ' + STATUS_LABEL[NEXT_STATUS[record.status]]">
                    <a-button size="small" type="text" @click="setStatus(record, NEXT_STATUS[record.status])"><template #icon><RightOutlined /></template></a-button>
                  </a-tooltip>
                  <a-popconfirm title="Delete this task?" ok-text="Delete" ok-type="danger" @confirm="removeTask(record)">
                    <a-button size="small" type="text" danger :data-cy="'delete-' + record.id"><template #icon><DeleteOutlined /></template></a-button>
                  </a-popconfirm>
                </a-space>
              </template>
            </template>
            <template #emptyText>
              <a-empty :description="filter === 'all' ? 'No tasks yet — add the first one above.' : `Nothing ${STATUS_LABEL[filter].toLowerCase()}.`" />
            </template>
          </a-table>

          <p class="panel__foot">
            <code>{{ api }}</code> · problem+json on errors · optimistic concurrency (xmin) · every change is announced to the other open tabs over the socket.
          </p>
        </a-card>
      </a-col>

      <a-col :xs="24" :xl="8">
        <a-card class="panel panel--feed" :bordered="false">
          <template #title>
            <div class="panel__head">
              <span>Live feed</span>
              <a-space>
                <a-button size="small" @click="ws.ping()" :disabled="!ws.isOpen.value">ping</a-button>
                <a-button size="small" @click="ws.reconnect()">reconnect</a-button>
              </a-space>
            </div>
          </template>

          <form class="feed__send" @submit.prevent="sendBroadcast">
            <a-input v-model:value="shout" data-cy="broadcast-text" placeholder="Broadcast to every open tab…" :disabled="!ws.isOpen.value" />
            <a-button type="primary" html-type="submit" data-cy="broadcast" :disabled="!ws.isOpen.value || !shout.trim()">Send</a-button>
          </form>

          <ul class="feed" data-cy="feed">
            <li v-for="(e, i) in ws.events.value" :key="i" class="feed__item" :data-kind="e.kind">
              <span class="feed__time">{{ e.at.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) }}</span>
              <span class="feed__badge">{{ e.kind === 'me' ? 'you' : e.kind === 'peer' ? e.from : e.kind }}</span>
              <span class="feed__text">{{ e.text }}</span>
            </li>
            <li v-if="!ws.events.value.length" class="feed__empty">Waiting for the first message…</li>
          </ul>

          <p class="panel__foot">
            <code>{{ ws.url }}</code> · open this page in a second tab and send something — or change a task there.
          </p>
        </a-card>
      </a-col>
    </a-row>

    <transition name="pop">
      <a-alert v-if="error" class="dash__alert" type="error" show-icon closable :message="error" @close="error = ''" />
    </transition>
  </div>
</template>

<script setup>
import { ref, reactive, watch, onMounted } from 'vue'
import { PlusOutlined, RightOutlined, DeleteOutlined } from '@ant-design/icons-vue'
import { tasksApi, useTaskPulseSocket, timeAgo, STATUSES, STATUS_LABEL, NEXT_STATUS } from '../taskpulse.js'

const api = tasksApi.urls.api
const apiReady = ref(null)
const counts = ref(null)
const tasks = ref([])
const total = ref(0)
const page = ref(1)
const pageSize = 8
const filter = ref('all')
const loading = ref(false)
const creating = ref(false)
const error = ref('')
const draft = reactive({ title: '', description: '' })
const shout = ref('')

const statCards = [
  { key: 'all', label: 'All tasks' },
  { key: 'Todo', label: 'To do' },
  { key: 'InProgress', label: 'In progress' },
  { key: 'Done', label: 'Done' },
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
  try { counts.value = await tasksApi.counts() } catch (e) { fail(e) }
}

const loadTasks = async () => {
  loading.value = true
  try {
    const res = await tasksApi.list({ status: filter.value === 'all' ? undefined : filter.value, page: page.value, pageSize })
    tasks.value = res.items
    total.value = res.total
    if (res.items.length === 0 && page.value > 1) { page.value = 1; await loadTasks() }
  } catch (e) { fail(e) } finally { loading.value = false }
}

const refresh = () => Promise.all([loadCounts(), loadTasks()])

const setFilter = (key) => { filter.value = key }
const onTableChange = (p) => { page.value = p.current; loadTasks() }

const announce = (what, task) => ws.broadcast(`task:${what} "${task.title}"`)

const createTask = async () => {
  if (!draft.title.trim() || creating.value) return
  creating.value = true
  try {
    const task = await tasksApi.create({ title: draft.title, description: draft.description || null })
    draft.title = ''; draft.description = ''
    filter.value = 'all'; page.value = 1
    await refresh()
    announce('created', task)
  } catch (e) { fail(e) } finally { creating.value = false }
}

const setStatus = async (record, status) => {
  if (status === record.status) return
  try {
    const task = await tasksApi.update(record.id, { title: record.title, description: record.description, status })
    await refresh()
    announce(status === 'Done' ? 'done' : 'moved', task)
  } catch (e) { fail(e); await refresh() }
}

const removeTask = async (record) => {
  try {
    await tasksApi.remove(record.id)
    await refresh()
    announce('deleted', record)
  } catch (e) { fail(e) }
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
  apiReady.value = await tasksApi.ready()
  await refresh()
})
</script>

<style src="../style/dashboard.css"></style>
