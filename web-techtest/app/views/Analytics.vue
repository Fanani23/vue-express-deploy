<template>
  <div class="page dash">
    <header class="page__head">
      <div>
        <h1 class="page__title">Analytics</h1>
        <p class="page__subtitle">One request to <code>/api/tasks/stats</code> — the grouping happens in PostgreSQL, so this page costs the same with 40 tasks or 40,000.</p>
      </div>
      <div class="dash__pills">
        <a-tag class="pill" :color="loading ? 'processing' : error ? 'error' : 'success'"><DatabaseOutlined />{{ loading ? 'loading' : error ? 'error' : `${total} tasks` }}</a-tag>
        <a-button size="small" @click="load" :loading="loading"><template #icon><ReloadOutlined /></template>refresh</a-button>
      </div>
    </header>

    <a-row :gutter="[16, 16]">
      <a-col :xs="24" :lg="8">
        <div class="page__card">
          <div class="sec">
            <span class="sec__icon"><PieChartOutlined /></span>
            <h3 class="sec__title">By status</h3>
            <span class="sec__count">{{ total }}</span>
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
            <a-segmented v-model:value="days" :options="[{ label: '7 days', value: 7 }, { label: '14 days', value: 14 }, { label: '30 days', value: 30 }]" size="small" />
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
import { tasksApi, timeAgo, STATUSES, STATUS_LABEL, STATUS_COLOR, useChangeFeed } from '../taskpulse.js'
import { DatabaseOutlined, ReloadOutlined, PieChartOutlined, BarChartOutlined, HourglassOutlined, HistoryOutlined, ClockCircleOutlined, BorderOutlined, CheckOutlined, CheckCircleOutlined, InboxOutlined } from '@ant-design/icons-vue'
import { useTheme } from '../theme.js'

const { isDark } = useTheme()
const stats = ref(null)
const open = ref([])
const days = ref(14)
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
    const [s, todo, inProgress] = await Promise.all([
      tasksApi.stats(days.value),
      tasksApi.list({ status: 'Todo', pageSize: 6 }),
      tasksApi.list({ status: 'InProgress', pageSize: 6 }),
    ])
    stats.value = s
    open.value = [...todo.items, ...inProgress.items].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)).slice(0, 6)
  } catch (e) {
    error.value = e?.message || String(e)
  } finally {
    loading.value = false
  }
}

const total = computed(() => stats.value?.total || 0)
const counts = computed(() => Object.fromEntries(STATUSES.map((s) => [s, stats.value?.byStatus?.[s] || 0])))
const pct = (s) => (total.value ? Math.round((counts.value[s] / total.value) * 100) + '%' : '0%')

const daily = computed(() => {
  const rows = stats.value?.daily || []
  return {
    labels: rows.map((r) => new Date(r.date + 'T00:00:00').toLocaleDateString([], { month: 'short', day: 'numeric' })),
    created: rows.map((r) => r.created),
    done: rows.map((r) => r.done),
  }
})

const age = (iso) => {
  const h = Math.round((Date.now() - new Date(iso).getTime()) / 36e5)
  return h < 24 ? `${h} h` : `${Math.round(h / 24)} d`
}
const oldestOpen = computed(() => open.value)
const recent = computed(() => stats.value?.recentlyUpdated || [])
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

watch([stats, isDark], () => nextTick(draw))
watch(days, load)
onMounted(load)
useChangeFeed(() => load(), { resources: ['task'] })
onBeforeUnmount(() => { statusChart?.destroy(); dailyChart?.destroy() })
</script>

<style src="../style/dashboard.css"></style>
