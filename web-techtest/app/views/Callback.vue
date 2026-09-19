<template>
  <div class="cb">
    <div class="cb__card">
      <template v-if="!failed">
        <a-spin size="large" />
        <p class="cb__text">Finishing sign-in…</p>
      </template>
      <template v-else>
        <h1 class="cb__title">Sign-in could not be completed</h1>
        <p class="cb__text">{{ failed }}</p>
        <a-button type="primary" @click="$router.replace('/signin')">Back to sign in</a-button>
      </template>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import parseJwt from '@es-labs/jslib/web/parse-jwt'
import { useMainStore } from '../store.js'
import { http } from '../../common/plugins/fetch.js'

const { VITE_REFRESH_URL } = import.meta.env
const route = useRoute()
const router = useRouter()
const store = useMainStore()
const failed = ref('')

onMounted(async () => {
  const hash = route.hash.substring(1)
  if (hash === 'mocked') {
    await store.doLogin({ id: 'Aaa', groups: 'MyGroup,AnotherGroup' })
    return
  }
  const [access, refresh, metaJson] = hash.split(';')
  if (!access || !refresh) {
    failed.value = 'The identity provider did not return a session. Please try again.'
    return
  }
  try {
    const decoded = parseJwt(access)
    let meta = {}
    try { meta = metaJson ? JSON.parse(decodeURIComponent(metaJson)) : {} } catch { meta = JSON.parse(metaJson) }
    http.setTokens({ access, refresh })
    http.setOptions({ refreshUrl: VITE_REFRESH_URL })
    history.replaceState(null, '', route.path)
    await store.doLogin({ ...decoded, user_meta: meta })
  } catch (e) {
    failed.value = e?.message || String(e)
  }
})
</script>

<style scoped>
.cb { min-height: 100vh; display: grid; place-items: center; padding: 1rem; }
.cb__card { text-align: center; display: grid; gap: 1rem; justify-items: center; padding: 2rem; border-radius: 16px; background: var(--card, #fff); border: 1px solid var(--border, #e3e6eb); min-width: min(100%, 22rem); }
.cb__title { margin: 0; font-size: 1.2rem; }
.cb__text { margin: 0; color: var(--muted, #5f6672); }
</style>
