<template>
  <div class="page dash">
    <header class="page__head">
      <div>
        <h1 class="page__title">Chart.js</h1>
        <p class="page__subtitle">The template's Chart.js sample, now fed by TaskPulse instead of three hard-coded numbers. Switch the chart type and see the same data re-drawn.</p>
      </div>
      <div class="chart-tools">
        <a-tag class="pill" :color="loading ? 'processing' : tasks.length ? 'success' : 'default'"><DatabaseOutlined />{{ loading ? 'loading' : `${tasks.length} tasks` }}</a-tag>
        <div class="chart-types">
          <a-tooltip v-for="t in types" :key="t.value" :title="t.label">
            <button type="button" class="chart-type" :class="{ 'chart-type--on': type === t.value }" :aria-pressed="type === t.value" @click="type = t.value"><component :is="t.icon" /><span>{{ t.label }}</span></button>
          </a-tooltip>
        </div>
        <a-button size="small" @click="load" :loading="loading"><template #icon><ReloadOutlined /></template>refresh</a-button>
      </div>
    </header>

    <div v-if="!loading && !tasks.length" class="page__card"><div class="empty"><BarChartOutlined class="empty__icon" /><span>No tasks to chart</span><span class="empty__hint">Add a few on the Tasks page, then refresh.</span></div></div>
    <div v-else class="chart-grid">
      <div class="page__card">
        <div class="sec"><span class="sec__icon"><PieChartOutlined /></span><h3 class="sec__title">Tasks by status</h3><span class="sec__count">{{ type }}</span></div>
        <div class="chart chart--bars"><canvas ref="c1"></canvas></div>
      </div>
      <div class="page__card">
        <div class="sec"><span class="sec__icon"><FontSizeOutlined /></span><h3 class="sec__title">Title length distribution</h3><span class="sec__count">characters</span></div>
        <div class="chart chart--bars"><canvas ref="c2"></canvas></div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import Chart from 'chart.js/auto'
import { tasksApi, STATUSES, STATUS_LABEL } from '../../taskpulse.js'
import { DatabaseOutlined, ReloadOutlined, BarChartOutlined, LineChartOutlined, PieChartOutlined, RadarChartOutlined, FontSizeOutlined } from '@ant-design/icons-vue'
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
const tasks = ref([])
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
    const all = []
    for (let page = 1; page <= 20; page++) {
      const res = await tasksApi.list({ page, pageSize: 100 })
      all.push(...res.items)
      if (all.length >= res.total || !res.items.length) break
    }
    tasks.value = all
  } catch {
    tasks.value = []
  } finally {
    loading.value = false
  }
}

const dataset1 = () => ({
  labels: STATUSES.map((s) => STATUS_LABEL[s]),
  datasets: [{ label: 'Tasks', data: STATUSES.map((s) => tasks.value.filter((t) => t.status === s).length), backgroundColor: colors.slice(0, 3), borderRadius: 6 }],
})
const buckets = ['≤10', '11–20', '21–30', '31–40', '41+']
const dataset2 = () => {
  const counts = [0, 0, 0, 0, 0]
  for (const t of tasks.value) counts[Math.min(4, Math.floor(Math.max(0, t.title.length - 1) / 10))]++
  return { labels: buckets, datasets: [{ label: 'Tasks', data: counts, backgroundColor: colors, borderRadius: 6 }] }
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

watch([tasks, type, isDark], () => nextTick(draw))
onMounted(load)
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
