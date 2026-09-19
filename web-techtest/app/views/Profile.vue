<template>
  <div class="page">
    <header class="page__head">
      <div>
        <h1 class="page__title">Profile</h1>
        <p class="page__subtitle">What this session knows about you — straight from the access token the API issued.</p>
      </div>
      <a-button danger @click="logout"><template #icon><LogoutOutlined /></template>Sign out</a-button>
    </header>

    <a-row :gutter="[16, 16]">
      <a-col :xs="24" :lg="10">
        <div class="page__card profile">
          <span class="profile__avatar"><img v-if="gravatar" :src="gravatar" alt="" @error="gravatar = ''" /><template v-else>{{ initials }}</template></span>
          <h2 class="profile__name">{{ identity }}</h2>
          <p class="profile__sub">user id {{ user.sub ?? '—' }}</p>
          <div class="profile__roles">
            <a-tag v-for="r in roles" :key="r" color="blue">{{ r }}</a-tag>
            <span v-if="!roles.length" class="page__muted">no roles on this token</span>
          </div>
          <p class="page__note">Avatar from Gravatar when the address has one; otherwise your initials.</p>
        </div>
        <div class="page__card page__section">
          <h3 class="page__h3">Ways to sign in</h3>
          <dl class="kv">
            <dt>Password + code</dt><dd>scrypt-hashed password, then a 6-digit code</dd>
            <dt>Google</dt><dd>{{ providers.google ? 'available — same account when the verified email matches' : 'not configured on this server' }}</dd>
            <dt>Seeded demo account</dt><dd>{{ isSeeded ? 'yes — default code 111111' : 'no — codes arrive by email' }}</dd>
          </dl>
        </div>
      </a-col>
      <a-col :xs="24" :lg="14">
        <div class="page__card">
          <h3 class="page__h3">Session</h3>
          <dl class="kv">
            <dt>Signed in</dt><dd>{{ fmt(user.iat) }}</dd>
            <dt>Access token expires</dt><dd>{{ fmt(user.exp) }} <span class="page__muted">({{ remaining }})</span></dd>
            <dt>Scope</dt><dd>{{ user.scope || '—' }}</dd>
            <dt>Second factor</dt><dd>{{ providers.otp === 'EMAIL' ? 'one-time code by email (seeded demo accounts use their default code)' : providers.otp === 'TEST' ? 'test mode, fixed code' : providers.otp === 'GA' ? 'authenticator app' : '—' }}</dd>
            <dt>Refresh</dt><dd>short-lived access token, renewed with a revocable refresh token</dd>
          </dl>
          <p class="page__muted">Expired token → the API returns 401, the client refreshes once, and if that fails you are signed out. Sign out revokes the refresh token server-side.</p>
        </div>
      </a-col>
      <a-col :span="24">
        <div class="page__card">
          <h3 class="page__h3">Token claims</h3>
          <pre class="code" data-cy="claims">{{ claims }}</pre>
        </div>
      </a-col>
    </a-row>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { LogoutOutlined } from '@ant-design/icons-vue'
import { useMainStore } from '../store.js'
import { http } from '../../common/plugins/fetch.js'

const store = useMainStore()
const user = computed(() => store.user || {})
const roles = computed(() => (Array.isArray(user.value.roles) ? user.value.roles : []))
const identity = computed(() => user.value.user_meta?.email || user.value.email || user.value.username || `user #${user.value.sub ?? ''}`)
const initials = computed(() => identity.value.replace(/@.*/, '').slice(0, 2).toUpperCase())
const claims = computed(() => JSON.stringify(user.value, null, 2))
const providers = ref({})
const gravatar = ref('')
const isSeeded = computed(() => /^(test|ais-one|aaronjxz|admin@techtest.dev|demo@techtest.dev|viewer@techtest.dev)$/.test(identity.value))

const loadGravatar = async () => {
  const email = user.value.user_meta?.email
  if (!email || !email.includes('@') || !crypto?.subtle) return
  const bytes = new TextEncoder().encode(email.trim().toLowerCase())
  const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map((b) => b.toString(16).padStart(2, '0')).join('')
  const url = `https://www.gravatar.com/avatar/${hash}?s=160&d=404`
  try {
    const res = await fetch(url, { method: 'HEAD', mode: 'cors' })
    if (res.ok) gravatar.value = url
  } catch {
    gravatar.value = ''
  }
}
const now = ref(Date.now())
let tick

const fmt = (epoch) => (epoch ? new Date(epoch * 1000).toLocaleString() : '—')
const remaining = computed(() => {
  if (!user.value.exp) return '—'
  const s = Math.round(user.value.exp - now.value / 1000)
  if (s <= 0) return 'expired'
  return s < 60 ? `${s} s left` : `${Math.floor(s / 60)} min ${s % 60} s left`
})

onMounted(async () => {
  tick = setInterval(() => { now.value = Date.now() }, 1000)
  loadGravatar()
  try { providers.value = (await http.get('/api/auth/providers')).data } catch { providers.value = {} }
})
onBeforeUnmount(() => clearInterval(tick))

const logout = async () => {
  store.loading = true
  await store.doLogin(null)
  store.loading = false
}
</script>
