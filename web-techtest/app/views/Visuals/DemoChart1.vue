<template>
  <div class="page dash">
    <header class="page__head">
      <div>
        <h1 class="page__title">Chart.js</h1>
        <p class="page__subtitle">The template's Chart.js sample, fed by <code>/api/tasks/stats</code> instead of three hard-coded numbers. Switch the chart type and see the same data re-drawn.</p>
      </div>
      <div class="chart-tools">
        <a-tag class="pill" :color="loading ? 'processing' : total ? 'success' : 'default'"><DatabaseOutlined />{{ loading ? 'loading' : `${total} tasks` }}</a-tag>
        <div class="chart-types">
          <a-tooltip v-for="t in types" :key="t.value" :title="t.label">
            <button type="button" class="chart-type" :class="{ 'chart-type--on': type === t.value }" :aria-pressed="type === t.value" @click="type = t.value"><component :is="t.icon" /><span>{{ t.label }}</span></button>
          </a-tooltip>
        </div>
        <a-button size="small" @click="load" :loading="loading"><template #icon><ReloadOutlined /></template>refresh</a-button>
      </div>
    </header>

    <div v-if="!loading && !total" class="page__card"><div class="empty"><BarChartOutlined class="empty__icon" /><span>No tasks to chart</span><span class="empty__hint">Add a few on the Tasks page, then refresh.</span></div></div>
    <div v-else class="chart-grid">
      <div class="page__card">
        <div class="sec"><span class="sec__icon"><PieChartOutlined /></span><h3 class="sec__title">Tasks by status</h3><span class="sec__count">{{ type }}</span></div>
        <div class="chart chart--bars"><canvas ref="c1"></canvas></div>
      </div>
      <div class="page__card">
        <div class="sec"><span class="sec__icon"><CalendarOutlined /></span><h3 class="sec__title">Created per day</h3><span class="sec__count">last 14 days</span></div>
        <div class="chart chart--bars"><canvas ref="c2"></canvas></div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import Chart from 'chart.js/auto'
import { tasksApi, STATUSES, STATUS_LABEL, useChangeFeed } from '../../taskpulse.js'
import { DatabaseOutlined, ReloadOutlined, BarChartOutlined, LineChartOutlined, PieChartOutlined, RadarChartOutlined, CalendarOutlined } from '@ant-design/icons-vue'
import { useTheme } from '../../theme.js'

const { isDark } = useTheme()
const api = tasksApi.urls.api
const type = ref('bar')
const types = [
  { value: 'bar', label: 'Bar', icon: BarChartOutlined },
  { value: 'line', label: 'Line', icon: LineChartOutlined },
  { value: 'doughnut', label: 'Doughnut', icon: PieChartOutlined },
  { value: 'polarArea', label: 'Polar', icon: RadarChartOutlined },
]
const stats = ref(null)
const total = computed(() => stats.value?.total || 0)
const loading = ref(false)
const c1 = ref(null)
const c2 = ref(null)
let chart1 = null
let chart2 = null

const colors = ['#94a3b8', '#3b82f6', '#16a34a', '#f59e0b', '#a855f7', '#ef4444']
const textColor = () => (isDark.value ? '#9aa3b0' : '#5f6672')

const load = async () => {
  loading.value = true
  try {
    stats.value = await tasksApi.stats(14)
  } catch {
    stats.value = null
  } finally {
    loading.value = false
  }
}

const dataset1 = () => ({
  labels: STATUSES.map((s) => STATUS_LABEL[s]),
  datasets: [{ label: 'Tasks', data: STATUSES.map((s) => stats.value?.byStatus?.[s] || 0), backgroundColor: colors.slice(0, 3), borderRadius: 6 }],
})
const dataset2 = () => {
  const rows = stats.value?.daily || []
  return {
    labels: rows.map((r) => new Date(r.date + 'T00:00:00').toLocaleDateString([], { month: 'short', day: 'numeric' })),
    datasets: [{ label: 'Created', data: rows.map((r) => r.created), backgroundColor: rows.map((_, i) => colors[i % colors.length]), borderColor: colors[1], borderRadius: 6 }],
  }
}

const options = () => {
  const cartesian = ['bar', 'line'].includes(type.value)
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: !cartesian, position: 'bottom', labels: { color: textColor(), boxWidth: 12 } } },
    scales: cartesian ? { x: { ticks: { color: textColor() }, grid: { display: false } }, y: { beginAtZero: true, ticks: { color: textColor(), precision: 0 } } } : {},
  }
}

const draw = () => {
  if (!c1.value || !c2.value) return
  chart1?.destroy(); chart2?.destroy()
  chart1 = new Chart(c1.value, { type: type.value, data: dataset1(), options: options() })
  chart2 = new Chart(c2.value, { type: type.value, data: dataset2(), options: options() })
}

watch([stats, type, isDark], () => nextTick(draw))
onMounted(load)
useChangeFeed(() => load(), { resources: ['task'] })
onBeforeUnmount(() => { chart1?.destroy(); chart2?.destroy() })
</script>

<style src="../../style/dashboard.css"></style>
<style scoped>
.chart-tools { display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap; }
.chart-types { display: inline-flex; background: var(--p-card); border: 1px solid var(--p-border); border-radius: 10px; padding: 0.2rem; gap: 0.15rem; }
.chart-type { appearance: none; border: 0; background: transparent; color: var(--p-muted); border-radius: 8px; padding: 0.3rem 0.65rem; font: inherit; font-size: 0.82rem; cursor: pointer; display: inline-flex; align-items: center; gap: 0.35rem; transition: background 0.15s, color 0.15s; }
.chart-type:hover { color: var(--p-text); background: var(--p-bg); }
.chart-type--on { background: var(--p-accent); color: #fff; }
.chart-grid { display: grid; gap: 1rem; grid-template-columns: repeat(auto-fit, minmax(380px, 1fr)); }
</style>
