<template>
  <div class="page">
    <header class="page__head">
      <div>
        <h1 class="page__title">Vue playground</h1>
        <p class="page__subtitle">The template's Vue 3 test bed, kept as a working reference: reactivity, the store, routing, API calls and an rxjs pipeline — results shown on the page instead of the console.</p>
      </div>
    </header>

    <div class="pg-grid">
      <div class="page__card">
        <div class="sec"><span class="sec__icon"><ThunderboltOutlined /></span><h3 class="sec__title">Reactivity</h3><span class="sec__count">{{ updatesShown }} re-renders</span></div>
        <dl class="kv">
          <dt><code>ref</code> counter</dt>
          <dd class="page__actions"><strong>{{ count }}</strong> <a-button size="small" @click="count++"><template #icon><PlusOutlined /></template>increment</a-button></dd>
          <dt>Plain variable</dt>
          <dd>{{ nonReactiveData }} <span class="page__muted">— bumped every 5 s too, but the view never updates: it is not reactive</span></dd>
          <dt><code>ref</code> number</dt>
          <dd>{{ reactiveData }} <span class="page__muted">— bumped every 5 s, updates</span></dd>
          <dt><code>ref</code> object</dt>
          <dd><a-button size="small" @click="testObjectRef.a++">a = {{ testObjectRef.a }}</a-button></dd>
          <dt><code>reactive</code> nested</dt>
          <dd><a-button size="small" @click="testObjectReactive.a.xx++">a.xx = {{ testObjectReactive.a.xx }}</a-button></dd>
        </dl>
        <ul class="log" data-cy="lifecycle">
          <li v-for="(l, i) in lifecycle" :key="i"><span class="log__t">{{ l.t }}</span>{{ l.text }}</li>
        </ul>
        <p class="page__note"><code>onUpdated</code> count is copied into a ref every 5 s — writing reactive state from the hook itself would loop.</p>
      </div>

      <div class="page__card">
        <div class="sec"><span class="sec__icon"><DatabaseOutlined /></span><h3 class="sec__title">Store (Pinia)</h3><span class="sec__count">user</span></div>
        <pre class="code">{{ storeUser }}</pre>
        <div class="page__actions" style="margin-top: 0.75rem">
          <a-button size="small" @click="store.updateUser({ nickname: 'Renamed ' + new Date().toLocaleTimeString() })"><template #icon><EditOutlined /></template>updateUser(nickname)</a-button>
          <a-button size="small" @click="store.updateUser({ nickname: undefined })"><template #icon><ClearOutlined /></template>clear</a-button>
        </div>
        <p class="page__note"><code>updateUser</code> merges fields; the header and Profile react.</p>
      </div>

      <div class="page__card">
        <div class="sec"><span class="sec__icon"><CompassOutlined /></span><h3 class="sec__title">Router</h3></div>
        <div class="page__actions">
          <a-button size="small" @click="router.push('/dun-no-what-is-this')"><template #icon><QuestionCircleOutlined /></template>unknown route → Not Found</a-button>
          <a-button size="small" @click="router.push('/forbidden')"><template #icon><StopOutlined /></template>/forbidden</a-button>
          <a-button size="small" @click="router.push('/template-demos/fill/42')"><template #icon><LinkOutlined /></template>route with a param</a-button>
        </div>
        <p class="page__note">Catch-all → shared <code>NotFound</code>; guards send signed-out users to <code>/signin</code>.</p>
      </div>

      <div class="page__card">
        <div class="sec"><span class="sec__icon"><ApiOutlined /></span><h3 class="sec__title">API calls</h3></div>
        <div class="page__actions">
          <a-button size="small" @click="testApi('healthcheck')"><template #icon><HeartOutlined /></template>/api/healthcheck</a-button>
          <a-button size="small" @click="testApi('check-db')"><template #icon><DatabaseOutlined /></template>/api/check-db</a-button>
          <a-button size="small" @click="testApi('tests/error')"><template #icon><WarningOutlined /></template>/api/tests/error</a-button>
          <a-button size="small" @click="testApi('msw/test')"><template #icon><ExperimentOutlined /></template>/api/msw/test</a-button>
        </div>
        <pre v-if="apiResult" class="code" style="margin-top: 0.75rem" data-cy="api-result">{{ apiResult }}</pre>
        <div v-else class="empty" style="margin-top: 0.75rem" data-cy="api-result"><SendOutlined class="empty__icon" /><span>No request yet</span><span class="empty__hint">Press a button — the response or error appears here.</span></div>
      </div>

      <div class="page__card">
        <div class="sec"><span class="sec__icon"><SearchOutlined /></span><h3 class="sec__title">rxjs search</h3><span v-if="searched" class="sec__count">{{ searchResult.length }} hits</span></div>
        <a-input ref="searchRef" placeholder="Type to search TaskPulse tasks…" allow-clear><template #prefix><SearchOutlined style="color: var(--p-muted)" /></template></a-input>
        <p class="page__note"><code>fromEvent → debounceTime(400) → distinctUntilChanged → switchMap</code> — the last keystroke wins.</p>
        <a-list v-if="searchResult.length" size="small" :data-source="searchResult" style="margin-top: 0.5rem">
          <template #renderItem="{ item }">
            <a-list-item>
              <span>{{ item.title }}</span>
              <a-tag :color="STATUS_COLOR[item.status]">{{ STATUS_LABEL[item.status] }}</a-tag>
            </a-list-item>
          </template>
        </a-list>
        <div v-else class="empty" style="margin-top: 0.5rem"><FileSearchOutlined v-if="searched" class="empty__icon" /><SearchOutlined v-else class="empty__icon" /><span>{{ searched ? 'No task matches' : 'Results appear here' }}</span></div>
      </div>

      <div class="page__card">
        <div class="sec"><span class="sec__icon"><AppstoreOutlined /></span><h3 class="sec__title">Template refs in <code>v-for</code></h3><span class="sec__count">{{ boxes.length }}</span></div>
        <div class="boxes">
          <div v-for="(item, i) in boxes" :key="i" :ref="(el) => (divs[i] = el)" class="box" :style="{ background: item.color }" @click="flash(i)">{{ item.label }}</div>
        </div>
        <p class="page__note">Click a box — the handler reaches the DOM node through the collected refs.</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted, onUpdated, onBeforeUnmount, onBeforeUpdate, ref, computed, reactive } from 'vue'
import { ThunderboltOutlined, PlusOutlined, DatabaseOutlined, EditOutlined, ClearOutlined, CompassOutlined, QuestionCircleOutlined, StopOutlined, LinkOutlined, ApiOutlined, HeartOutlined, WarningOutlined, ExperimentOutlined, SendOutlined, SearchOutlined, FileSearchOutlined, AppstoreOutlined } from '@ant-design/icons-vue'
import { useRouter } from 'vue-router'
import { fromEvent } from 'rxjs'
import { switchMap, debounceTime, distinctUntilChanged, map } from 'rxjs/operators'
import { useMainStore } from '../../store.js'
import { http } from '../../../common/plugins/fetch.js'
import { tasksApi, STATUS_LABEL, STATUS_COLOR } from '../../taskpulse.js'

const router = useRouter()
const store = useMainStore()
const storeUser = computed(() => JSON.stringify(store.user, null, 2))

const count = ref(0)
let nonReactiveData = 10
const reactiveData = ref(20)
const testObjectRef = ref({ a: 10, b: 20, c: 30 })
const testObjectReactive = reactive({ a: { xx: 40 }, b: 50, c: 60 })

const lifecycle = ref([])
let updates = 0
const updatesShown = ref(0)
const note = (text) => {
  lifecycle.value.unshift({ t: new Date().toLocaleTimeString(), text })
  if (lifecycle.value.length > 8) lifecycle.value.length = 8
}

const boxes = [
  { label: 'A', color: '#ef4444' }, { label: 'B', color: '#60a5fa' }, { label: 'C', color: '#facc15' },
  { label: 'D', color: '#a16207' }, { label: 'E', color: '#4ade80' }, { label: 'F', color: '#c084fc' },
]
const divs = ref([])
onBeforeUpdate(() => { divs.value = [] })
const flash = (i) => {
  const el = divs.value[i]
  if (!el?.animate) return
  el.animate([{ transform: 'scale(1)' }, { transform: 'scale(0.9) rotate(-4deg)' }, { transform: 'scale(1)' }], { duration: 350 })
}

const apiResult = ref('')
const testApi = async (path) => {
  apiResult.value = `GET /api/${path} …`
  try {
    const { data } = await http.get('/api/' + path)
    apiResult.value = `GET /api/${path}\n${JSON.stringify(data, null, 2)}`
  } catch (e) {
    apiResult.value = `GET /api/${path}\n${e?.status ? e.status + ' ' : ''}${e?.data ? JSON.stringify(e.data) : e.toString()}`
  }
}

const searchRef = ref(null)
const searchResult = ref([])
const searched = ref(false)
let subscription
let timer

onMounted(() => {
  note('mounted')
  timer = setInterval(() => { nonReactiveData += 1; reactiveData.value += 1; updatesShown.value = updates }, 5000)
  subscription = fromEvent(searchRef.value.$el.querySelector('input') || searchRef.value.$el, 'input')
    .pipe(
      map((e) => e.target.value.trim().toLowerCase()),
      debounceTime(400),
      distinctUntilChanged(),
      switchMap(async (q) => {
        if (!q) return { q, items: [] }
        const res = await tasksApi.list({ pageSize: 100 })
        return { q, items: res.items.filter((t) => t.title.toLowerCase().includes(q) || (t.description || '').toLowerCase().includes(q)).slice(0, 8) }
      }),
    )
    .subscribe(({ q, items }) => { searched.value = !!q; searchResult.value = items })
})
onUpdated(() => { updates += 1 })
onBeforeUnmount(() => { clearInterval(timer); subscription?.unsubscribe() })
</script>

<style scoped>
.pg-grid { display: grid; gap: 1rem; grid-template-columns: repeat(auto-fit, minmax(340px, 1fr)); }
.boxes { display: flex; flex-wrap: wrap; gap: 0.5rem; }
.box { width: 64px; height: 48px; border-radius: 10px; display: grid; place-items: center; color: #111; font-weight: 700; cursor: pointer; user-select: none; }
</style>
