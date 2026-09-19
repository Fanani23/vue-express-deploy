<template>
  <div class="page dash">
    <header class="page__head">
      <div>
        <h1 class="page__title">Analytics</h1>
        <p class="page__subtitle">Computed live from every task in TaskPulse — nothing here is hard-coded.</p>
      </div>
      <div class="dash__pills">
        <a-tag class="pill" :color="loading ? 'processing' : error ? 'error' : 'success'"><DatabaseOutlined />{{ loading ? 'loading' : error ? 'error' : `${tasks.length} tasks` }}</a-tag>
        <a-button size="small" @click="load" :loading="loading"><template #icon><ReloadOutlined /></template>refresh</a-button>
      </div>
    </header>

    <a-row :gutter="[16, 16]">
      <a-col :xs="24" :lg="8">
        <div class="page__card">
          <div class="sec">
            <span class="sec__icon"><PieChartOutlined /></span>
            <h3 class="sec__title">By status</h3>
            <span class="sec__count">{{ tasks.length }}</span>
          </div>
          <div class="chart chart--ring"><canvas ref="statusCanvas"></canvas></div>
          <ul class="legend">
            <li v-for="s in STATUSES" :key="s" class="legend__row">
              <span class="legend__dot" :data-status="s" />
              <span class="legend__label">{{ STATUS_LABEL[s] }}</span>
              <span class="legend__count">{{ counts[s] }}</span>
              <span class="legend__pct">{{ pct(s) }}</span>
            </li>
          </ul>
        </div>
      </a-col>
      <a-col :xs="24" :lg="16">
        <div class="page__card">
          <div class="sec">
            <span class="sec__icon"><BarChartOutlined /></span>
            <h3 class="sec__title">Created and completed per day</h3>
            <span class="sec__count">last 14 days</span>
          </div>
          <div class="chart chart--bars"><canvas ref="dailyCanvas"></canvas></div>
        </div>
      </a-col>
      <a-col :xs="24" :lg="12">
        <div class="page__card">
          <div class="sec">
            <span class="sec__icon"><HourglassOutlined /></span>
            <h3 class="sec__title">Longest open</h3>
            <span class="sec__count">{{ oldestOpen.length }}</span>
          </div>
          <a-table :data-source="oldestOpen" :columns="openColumns" :pagination="false" size="small" row-key="id" class="tasks">
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'title'"><div class="task"><span class="task__mark" :data-status="record.status"><ClockCircleOutlined v-if="record.status === 'InProgress'" /><BorderOutlined v-else /></span><span class="task__title">{{ record.title }}</span></div></template>
              <template v-else-if="column.key === 'age'"><span class="task__when"><HistoryOutlined />{{ age(record.createdAt) }}</span></template>
              <template v-else-if="column.key === 'status'"><a-tag :color="STATUS_COLOR[record.status]">{{ STATUS_LABEL[record.status] }}</a-tag></template>
            </template>
            <template #emptyText><div class="empty"><CheckCircleOutlined class="empty__icon" /><span>Nothing open</span><span class="empty__hint">Every task is done.</span></div></template>
          </a-table>
        </div>
      </a-col>
      <a-col :xs="24" :lg="12">
        <div class="page__card">
          <div class="sec">
            <span class="sec__icon"><HistoryOutlined /></span>
            <h3 class="sec__title">Recently touched</h3>
            <span class="sec__count">{{ recent.length }}</span>
          </div>
          <a-table :data-source="recent" :columns="recentColumns" :pagination="false" size="small" row-key="id" class="tasks">
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'title'"><div class="task"><span class="task__mark" :data-status="record.status"><CheckOutlined v-if="record.status === 'Done'" /><ClockCircleOutlined v-else-if="record.status === 'InProgress'" /><BorderOutlined v-else /></span><span class="task__title">{{ record.title }}</span></div></template>
              <template v-else-if="column.key === 'updated'"><span class="task__when"><HistoryOutlined />{{ timeAgo(record.updatedAt) }}</span></template>
              <template v-else-if="column.key === 'status'"><a-tag :color="STATUS_COLOR[record.status]">{{ STATUS_LABEL[record.status] }}</a-tag></template>
            </template>
            <template #emptyText><div class="empty"><InboxOutlined class="empty__icon" /><span>No tasks yet</span></div></template>
          </a-table>
        </div>
      </a-col>
    </a-row>

    <transition name="pop">
      <a-alert v-if="error" class="dash__alert" type="error" show-icon closable :message="error" @close="error = ''" />
    </transition>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import Chart from 'chart.js/auto'
import { tasksApi, timeAgo, STATUSES, STATUS_LABEL, STATUS_COLOR } from '../taskpulse.js'
import { DatabaseOutlined, ReloadOutlined, PieChartOutlined, BarChartOutlined, HourglassOutlined, HistoryOutlined, ClockCircleOutlined, BorderOutlined, CheckOutlined, CheckCircleOutlined, InboxOutlined } from '@ant-design/icons-vue'
import { useTheme } from '../theme.js'

const { isDark } = useTheme()
const tasks = ref([])
const loading = ref(false)
const error = ref('')
const statusCanvas = ref(null)
const dailyCanvas = ref(null)
let statusChart = null
let dailyChart = null

const palette = { Todo: '#94a3b8', InProgress: '#3b82f6', Done: '#16a34a' }
const textColor = () => (isDark.value ? '#9aa3b0' : '#5f6672')
const gridColor = () => (isDark.value ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)')

const load = async () => {
  loading.value = true
  error.value = ''
  try {
    const all = []
    for (let page = 1; page <= 20; page++) {
      const res = await tasksApi.list({ page, pageSize: 100 })
      all.push(...res.items)
      if (all.length >= res.total || res.items.length === 0) break
    }
    tasks.value = all
  } catch (e) {
    error.value = e?.message || String(e)
  } finally {
    loading.value = false
  }
}

const counts = computed(() => Object.fromEntries(STATUSES.map((s) => [s, tasks.value.filter((t) => t.status === s).length])))
const pct = (s) => (tasks.value.length ? Math.round((counts.value[s] / tasks.value.length) * 100) + '%' : '0%')

const days = computed(() => {
  const out = []
  const d = new Date(); d.setHours(0, 0, 0, 0)
  for (let i = 13; i >= 0; i--) {
    const day = new Date(d); day.setDate(d.getDate() - i)
    out.push(day)
  }
  return out
})
const dayKey = (x) => new Date(x).toDateString()
const daily = computed(() => {
  const created = {}, done = {}
  for (const t of tasks.value) {
    created[dayKey(t.createdAt)] = (created[dayKey(t.createdAt)] || 0) + 1
    if (t.status === 'Done') done[dayKey(t.updatedAt)] = (done[dayKey(t.updatedAt)] || 0) + 1
  }
  return {
    labels: days.value.map((d) => d.toLocaleDateString([], { month: 'short', day: 'numeric' })),
    created: days.value.map((d) => created[d.toDateString()] || 0),
    done: days.value.map((d) => done[d.toDateString()] || 0),
  }
})

const age = (iso) => {
  const h = Math.round((Date.now() - new Date(iso).getTime()) / 36e5)
  return h < 24 ? `${h} h` : `${Math.round(h / 24)} d`
}
const oldestOpen = computed(() => tasks.value.filter((t) => t.status !== 'Done').sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)).slice(0, 6))
const recent = computed(() => [...tasks.value].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)).slice(0, 6))
const openColumns = [
  { title: 'Task', dataIndex: 'title', key: 'title', ellipsis: true },
  { title: 'Status', key: 'status', width: 120 },
  { title: 'Open for', key: 'age', width: 90, align: 'right' },
]
const recentColumns = [
  { title: 'Task', dataIndex: 'title', key: 'title', ellipsis: true },
  { title: 'Status', key: 'status', width: 120 },
  { title: 'Updated', key: 'updated', width: 110, align: 'right' },
]

const draw = () => {
  if (!statusCanvas.value || !dailyCanvas.value) return
  statusChart?.destroy(); dailyChart?.destroy()
  const common = { responsive: true, maintainAspectRatio: false, animation: { duration: 400 }, plugins: { legend: { labels: { color: textColor() } } } }
  statusChart = new Chart(statusCanvas.value, {
    type: 'doughnut',
    data: {
      labels: STATUSES.map((s) => STATUS_LABEL[s]),
      datasets: [{ data: STATUSES.map((s) => counts.value[s]), backgroundColor: STATUSES.map((s) => palette[s]), borderWidth: 0 }],
    },
    options: { ...common, cutout: '70%', plugins: { legend: { display: false } } },
  })
  dailyChart = new Chart(dailyCanvas.value, {
    type: 'bar',
    data: {
      labels: daily.value.labels,
      datasets: [
        { label: 'Created', data: daily.value.created, backgroundColor: palette.InProgress, borderRadius: 4 },
        { label: 'Completed', data: daily.value.done, backgroundColor: palette.Done, borderRadius: 4 },
      ],
    },
    options: {
      ...common,
      scales: {
        x: { ticks: { color: textColor() }, grid: { display: false } },
        y: { beginAtZero: true, ticks: { color: textColor(), precision: 0 }, grid: { color: gridColor() } },
      },
    },
  })
}

watch([tasks, isDark], () => nextTick(draw))
onMounted(load)
onBeforeUnmount(() => { statusChart?.destroy(); dailyChart?.destroy() })
</script>

<style src="../style/dashboard.css"></style>
