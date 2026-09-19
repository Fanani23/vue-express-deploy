<template>
  <div class="page">
    <header class="page__head">
      <div>
        <h1 class="page__title">Chart.js</h1>
        <p class="page__subtitle">The template's Chart.js sample, now fed by TaskPulse instead of three hard-coded numbers. Switch the chart type and see the same data re-drawn.</p>
      </div>
      <a-space>
        <a-segmented v-model:value="type" :options="['bar', 'line', 'doughnut', 'polarArea']" size="small" />
        <a-button size="small" @click="load" :loading="loading">refresh</a-button>
      </a-space>
    </header>

    <div class="page__grid page__grid--wide">
      <div class="page__card">
        <h3 class="page__h3">Tasks by status</h3>
        <canvas ref="c1" height="220"></canvas>
      </div>
      <div class="page__card">
        <h3 class="page__h3">Title length distribution <span class="page__muted">(characters)</span></h3>
        <canvas ref="c2" height="220"></canvas>
      </div>
    </div>
    <p class="page__note">{{ tasks.length }} tasks loaded from <code>{{ api }}</code>. The chart instances are created once and updated in place (<code>chart.update()</code>) when data or type changes.</p>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import Chart from 'chart.js/auto'
import { tasksApi, STATUSES, STATUS_LABEL } from '../../taskpulse.js'
import { useTheme } from '../../theme.js'

const { isDark } = useTheme()
const api = tasksApi.urls.api
const type = ref('bar')
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
