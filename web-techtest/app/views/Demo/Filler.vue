<template>
  <div class="page">
    <header class="page__head">
      <div>
        <h1 class="page__title">Routing</h1>
        <p class="page__subtitle">How this app reads its URL: a route param, a query string, a hash, and a prop injected by the route table. Change any of them and watch the panel update without a reload.</p>
      </div>
    </header>

    <div class="page__grid page__grid--wide">
      <div class="page__card">
        <h3 class="page__h3">Current route</h3>
        <dl class="kv">
          <dt>name</dt><dd><code>{{ route.name }}</code></dd>
          <dt>path</dt><dd><code>{{ route.path }}</code></dd>
          <dt>params</dt><dd><code>{{ JSON.stringify(route.params) }}</code></dd>
          <dt>query</dt><dd><code>{{ JSON.stringify(route.query) }}</code></dd>
          <dt>hash</dt><dd><code>{{ route.hash || '""' }}</code></dd>
          <dt>prop <code>testId</code></dt><dd><code>{{ testId }}</code> <span class="page__muted">(−1 unless the route table passes one, e.g. <code>/test/3</code>)</span></dd>
          <dt>layout</dt><dd><code>{{ route.meta.layout }}</code> · requiresAuth={{ route.meta.requiresAuth }}</dd>
        </dl>
      </div>

      <div class="page__card">
        <h3 class="page__h3">Try it</h3>
        <div class="page__stack">
          <div class="page__actions">
            <a-input v-model:value="param" placeholder="param" style="width: 9rem" />
            <a-button size="small" @click="router.push('/template-demos/fill/' + encodeURIComponent(param || '111'))">push param</a-button>
            <a-button size="small" v-if="route.params.param" @click="router.push('/template-demos/fill')">drop param</a-button>
          </div>
          <div class="page__actions">
            <a-input v-model:value="q" placeholder="query value" style="width: 9rem" />
            <a-button size="small" @click="router.push({ query: { ...route.query, q: q || 'hello', n: Number(route.query.n || 0) + 1 } })">merge query</a-button>
            <a-button size="small" @click="router.push({ query: {} })">clear query</a-button>
          </div>
          <div class="page__actions">
            <a-button size="small" @click="router.push({ hash: '#section-' + Date.now().toString().slice(-3) })">set hash</a-button>
            <a-button size="small" @click="router.push('/test/3')">prop route /test/3</a-button>
            <a-button size="small" @click="router.back()">back</a-button>
            <a-button size="small" @click="router.replace(route.fullPath)">replace (no history entry)</a-button>
          </div>
        </div>
        <p class="page__note">Use the browser's back and forward buttons after a few clicks — every <code>push</code> is a history entry, <code>replace</code> is not.</p>
      </div>

      <div class="page__card">
        <h3 class="page__h3">Navigation log</h3>
        <ul class="log">
          <li v-for="(l, i) in log" :key="i"><span class="log__t">{{ l.t }}</span>{{ l.text }}</li>
        </ul>
        <p class="page__note">The layout keys <code>&lt;router-view&gt;</code> by the full path, so every navigation remounts this component — the log lives in module scope to survive that, and each line is one mount.</p>
      </div>
    </div>
  </div>
</template>

<script>
import { ref } from 'vue'

const navLog = ref([])
</script>

<script setup>
import { useRoute, useRouter } from 'vue-router'

const props = defineProps({ testId: { type: Number, default: -1 } })
const route = useRoute()
const router = useRouter()
const param = ref('')
const q = ref('')
const log = navLog
log.value.unshift({ t: new Date().toLocaleTimeString(), text: 'mounted at ' + route.fullPath })
if (log.value.length > 10) log.value.length = 10
</script>
