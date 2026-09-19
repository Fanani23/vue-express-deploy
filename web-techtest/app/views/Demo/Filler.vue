<template>
  <div class="page">
    <header class="page__head">
      <div>
        <h1 class="page__title">Routing</h1>
        <p class="page__subtitle">How this app reads its URL: a route param, a query string, a hash, and a prop injected by the route table. Change any of them and watch the panel update without a reload.</p>
      </div>
      <div class="page__actions">
        <a-tag class="pill" color="blue"><CompassOutlined />{{ String(route.name) }}</a-tag>
        <a-button @click="router.back()"><template #icon><ArrowLeftOutlined /></template>Back</a-button>
      </div>
    </header>

    <div class="page__card url">
      <div class="sec">
        <span class="sec__icon"><LinkOutlined /></span>
        <h3 class="sec__title">Current URL</h3>
        <span class="sec__count">{{ route.fullPath.length }} chars</span>
        <a-tooltip title="Copy full path"><a-button size="small" @click="copy"><template #icon><CopyOutlined /></template></a-button></a-tooltip>
      </div>
      <div class="url__bar">
        <span class="url__part url__part--path" title="path">{{ pathBase }}</span><span v-if="route.params.param" class="url__part url__part--param" title="route param">/{{ route.params.param }}</span><span v-if="queryString" class="url__part url__part--query" title="query string">?{{ queryString }}</span><span v-if="route.hash" class="url__part url__part--hash" title="hash">{{ route.hash }}</span>
      </div>
      <div class="url__legend">
        <span><i class="url__swatch url__swatch--path" />path</span>
        <span><i class="url__swatch url__swatch--param" />param</span>
        <span><i class="url__swatch url__swatch--query" />query</span>
        <span><i class="url__swatch url__swatch--hash" />hash</span>
      </div>
    </div>

    <div class="route-grid">
      <div class="page__card">
        <div class="sec">
          <span class="sec__icon"><InfoCircleOutlined /></span>
          <h3 class="sec__title">What the router sees</h3>
        </div>
        <ul class="facts">
          <li class="fact"><span class="fact__icon"><TagOutlined /></span><span class="fact__body"><span class="fact__label">name</span><span class="fact__value"><code>{{ String(route.name) }}</code></span></span></li>
          <li class="fact"><span class="fact__icon"><NumberOutlined /></span><span class="fact__body"><span class="fact__label">params</span><span class="fact__value"><template v-if="Object.keys(route.params).length"><a-tag v-for="(v, k) in route.params" :key="k" color="purple">{{ k }} = {{ v }}</a-tag></template><span v-else class="page__muted">none</span></span></span></li>
          <li class="fact"><span class="fact__icon"><SearchOutlined /></span><span class="fact__body"><span class="fact__label">query</span><span class="fact__value"><template v-if="Object.keys(route.query).length"><a-tag v-for="(v, k) in route.query" :key="k" color="orange">{{ k }} = {{ v }}</a-tag></template><span v-else class="page__muted">none</span></span></span></li>
          <li class="fact"><span class="fact__icon"><NumberOutlined /></span><span class="fact__body"><span class="fact__label">hash</span><span class="fact__value"><code v-if="route.hash">{{ route.hash }}</code><span v-else class="page__muted">none</span></span></span></li>
          <li class="fact"><span class="fact__icon"><ApiOutlined /></span><span class="fact__body"><span class="fact__label">prop <code>testId</code></span><span class="fact__value">{{ testId }} <span class="page__muted">— injected by the route table on <code>/test/3</code>, −1 otherwise</span></span></span></li>
          <li class="fact"><span class="fact__icon"><SafetyOutlined /></span><span class="fact__body"><span class="fact__label">meta</span><span class="fact__value"><a-tag>{{ route.meta.layout }}</a-tag><a-tag :color="route.meta.requiresAuth ? 'green' : 'default'">requiresAuth {{ route.meta.requiresAuth }}</a-tag></span></span></li>
        </ul>
      </div>

      <div class="page__card">
        <div class="sec">
          <span class="sec__icon"><ExperimentOutlined /></span>
          <h3 class="sec__title">Try it</h3>
        </div>
        <div class="try">
          <div class="try__row">
            <span class="try__label"><i class="url__swatch url__swatch--param" />Param</span>
            <a-input v-model:value="param" placeholder="e.g. 111" size="small" class="try__input" @pressEnter="pushParam" />
            <a-button size="small" @click="pushParam"><template #icon><ArrowRightOutlined /></template>push</a-button>
            <a-button size="small" :disabled="!route.params.param" @click="router.push('/template-demos/fill')"><template #icon><CloseOutlined /></template>drop</a-button>
          </div>
          <div class="try__row">
            <span class="try__label"><i class="url__swatch url__swatch--query" />Query</span>
            <a-input v-model:value="q" placeholder="value for q" size="small" class="try__input" @pressEnter="mergeQuery" />
            <a-button size="small" @click="mergeQuery"><template #icon><PlusOutlined /></template>merge</a-button>
            <a-button size="small" :disabled="!Object.keys(route.query).length" @click="router.push({ query: {} })"><template #icon><CloseOutlined /></template>clear</a-button>
          </div>
          <div class="try__row">
            <span class="try__label"><i class="url__swatch url__swatch--hash" />Hash</span>
            <a-button size="small" @click="router.push({ hash: '#section-' + Date.now().toString().slice(-3) })"><template #icon><NumberOutlined /></template>set</a-button>
            <a-button size="small" :disabled="!route.hash" @click="router.push({ hash: '' })"><template #icon><CloseOutlined /></template>clear</a-button>
          </div>
          <hr class="page__hr" />
          <div class="try__row try__row--wrap">
            <a-button size="small" @click="router.push('/test/3')"><template #icon><ApiOutlined /></template>prop route /test/3</a-button>
            <a-button size="small" @click="router.replace(route.fullPath)"><template #icon><SwapOutlined /></template>replace (no history entry)</a-button>
            <a-button size="small" @click="router.back()"><template #icon><ArrowLeftOutlined /></template>back</a-button>
            <a-button size="small" @click="router.forward()"><template #icon><ArrowRightOutlined /></template>forward</a-button>
          </div>
        </div>
        <p class="page__note">Every <code>push</code> is a history entry, <code>replace</code> is not — try the browser's own back button after a few clicks.</p>
      </div>

      <div class="page__card">
        <div class="sec">
          <span class="sec__icon"><HistoryOutlined /></span>
          <h3 class="sec__title">Navigation log</h3>
          <span class="sec__count">{{ log.length }}</span>
          <a-button size="small" type="text" :disabled="log.length <= 1" @click="log.splice(1)">clear</a-button>
        </div>
        <ul class="log">
          <li v-for="(l, i) in log" :key="i"><span class="log__t">{{ l.t }}</span>{{ l.text }}</li>
        </ul>
        <p class="page__note">The layout keys <code>&lt;router-view&gt;</code> by the full path, so every navigation remounts this component — the log lives in module scope to survive that; each line is one mount.</p>
      </div>
    </div>
  </div>
</template>

<script>
import { ref } from 'vue'

const navLog = ref([])
</script>

<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import { CompassOutlined, ArrowLeftOutlined, ArrowRightOutlined, LinkOutlined, CopyOutlined, InfoCircleOutlined, TagOutlined, NumberOutlined, SearchOutlined, ApiOutlined, SafetyOutlined, ExperimentOutlined, CloseOutlined, PlusOutlined, SwapOutlined, HistoryOutlined } from '@ant-design/icons-vue'

const props = defineProps({ testId: { type: Number, default: -1 } })
const route = useRoute()
const router = useRouter()
const param = ref('')
const q = ref('')
const log = navLog

const pathBase = computed(() => (route.params.param ? route.path.slice(0, route.path.lastIndexOf('/')) : route.path))
const queryString = computed(() => new URLSearchParams(route.query).toString())

const pushParam = () => router.push('/template-demos/fill/' + encodeURIComponent(param.value || '111'))
const mergeQuery = () => router.push({ query: { ...route.query, q: q.value || 'hello', n: Number(route.query.n || 0) + 1 } })
const copy = async () => { try { await navigator.clipboard.writeText(route.fullPath); message.success('Path copied') } catch { message.error('Clipboard not available') } }

log.value.unshift({ t: new Date().toLocaleTimeString(), text: 'mounted at ' + route.fullPath })
if (log.value.length > 10) log.value.length = 10
</script>

<style scoped>
.url { margin-bottom: 1rem; }
.url__bar { font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 0.95rem; padding: 0.6rem 0.8rem; border-radius: 10px; background: var(--p-bg); border: 1px solid var(--p-border); overflow-wrap: anywhere; }
.url__part--path { color: var(--p-text); }
.url__part--param { color: #7c3aed; font-weight: 600; }
.url__part--query { color: #d97706; }
.url__part--hash { color: #2563eb; }
.url__legend { display: flex; gap: 1rem; margin-top: 0.5rem; font-size: 0.78rem; color: var(--p-muted); }
.url__legend span { display: inline-flex; align-items: center; gap: 0.35rem; }
.url__swatch { width: 0.65rem; height: 0.65rem; border-radius: 3px; display: inline-block; background: var(--p-text); }
.url__swatch--param { background: #7c3aed; }
.url__swatch--query { background: #d97706; }
.url__swatch--hash { background: #2563eb; }
.route-grid { display: grid; gap: 1rem; grid-template-columns: repeat(3, minmax(0, 1fr)); align-items: start; }
@media (max-width: 1250px) { .route-grid { grid-template-columns: 1fr; } }
.facts { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.5rem; }
.fact { display: flex; align-items: center; gap: 0.7rem; padding: 0.5rem 0.7rem; border-radius: 10px; background: var(--p-bg); border: 1px solid var(--p-border); }
.fact__icon { width: 1.9rem; height: 1.9rem; border-radius: 8px; display: grid; place-items: center; background: color-mix(in srgb, var(--p-accent) 12%, transparent); color: var(--p-accent); flex: none; }
.fact__body { display: grid; gap: 0.15rem; line-height: 1.25; min-width: 0; }
.fact__label { font-size: 0.75rem; color: var(--p-muted); }
.fact__value { font-size: 0.9rem; display: flex; flex-wrap: wrap; gap: 0.25rem; align-items: center; }
.fact__value .ant-tag { margin: 0; }
.try { display: grid; gap: 0.6rem; }
.try__row { display: flex; align-items: center; gap: 0.4rem; }
.try__row--wrap { flex-wrap: wrap; }
.try__label { display: inline-flex; align-items: center; gap: 0.35rem; font-size: 0.8rem; font-weight: 600; width: 4.5rem; flex: none; }
.try__input { flex: 1; min-width: 0; }
</style>
