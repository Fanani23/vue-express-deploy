<template>
  <div class="page">
    <section class="hero page__card">
      <div class="hero__band" />
      <div class="hero__body">
        <span class="hero__avatar"><img v-if="gravatar" :src="gravatar" alt="" /><template v-else>{{ initials }}</template></span>
        <div class="hero__who">
          <h1 class="hero__name">{{ identity }}</h1>
          <div class="hero__chips">
            <a-tag v-for="r in roles" :key="r" color="blue">{{ r }}</a-tag>
            <a-tag v-if="!roles.length">no role</a-tag>
            <a-tag :color="isSeeded ? 'gold' : 'green'">{{ isSeeded ? 'seeded demo account' : 'real account' }}</a-tag>
            <a-tag :color="tokenColor"><span class="pill__dot" />{{ tokenState }}</a-tag>
          </div>
          <p class="page__muted">user id {{ user.sub ?? '—' }} · signed in {{ fmt(user.iat) }}</p>
        </div>
        <div class="hero__actions">
          <a-button @click="renew" :loading="renewing"><template #icon><ReloadOutlined /></template>Renew session</a-button>
          <a-button @click="copy(http.getTokens().access, 'Access token')"><template #icon><CopyOutlined /></template>Copy token</a-button>
          <a-button danger @click="logout"><template #icon><LogoutOutlined /></template>Sign out</a-button>
        </div>
      </div>
    </section>

    <a-row :gutter="[16, 16]">
      <a-col :xs="24" :lg="8">
        <div class="page__card session">
          <div class="sec"><span class="sec__icon"><ClockCircleOutlined /></span><h3 class="sec__title">Session</h3><span class="sec__count">{{ lifetimeMin }} min token</span></div>
          <div class="session__ring">
            <a-progress type="dashboard" :percent="percentLeft" :stroke-color="ringColor" :size="150" :format="() => remainingShort" />
            <div class="session__caption">{{ remainingLong }}</div>
          </div>
          <a-alert v-if="secondsLeft > 0 && secondsLeft < 300" type="warning" show-icon message="Less than five minutes left — renew, or the next API call will refresh it for you." class="session__warn" />
          <a-alert v-else-if="secondsLeft <= 0" type="error" show-icon message="Access token expired — the next call refreshes it, or renew now." class="session__warn" />
          <ul class="facts">
            <li class="fact"><span class="fact__icon"><LoginOutlined /></span><span class="fact__body"><span class="fact__label">Issued</span><span class="fact__value">{{ fmt(user.iat) }}</span></span></li>
            <li class="fact"><span class="fact__icon"><FieldTimeOutlined /></span><span class="fact__body"><span class="fact__label">Expires</span><span class="fact__value">{{ fmt(user.exp) }}</span></span></li>
            <li class="fact"><span class="fact__icon"><ReloadOutlined /></span><span class="fact__body"><span class="fact__label">Renewed this visit</span><span class="fact__value">{{ renewedTimes }}×</span></span></li>
          </ul>
        </div>
      </a-col>

      <a-col :xs="24" :lg="8">
        <div class="page__card">
          <div class="sec"><span class="sec__icon"><SafetyCertificateOutlined /></span><h3 class="sec__title">Security</h3><span class="sec__count">{{ providers.google ? '3 methods' : '2 methods' }}</span></div>
          <ul class="methods">
            <li class="method">
              <span class="method__icon"><LockOutlined /></span>
              <span class="method__text"><strong>Password + one-time code</strong><span class="page__muted">scrypt-hashed password, then a 6-digit code</span></span>
              <a-tag color="success">on</a-tag>
            </li>
            <li class="method">
              <span class="method__icon"><MailOutlined /></span>
              <span class="method__text"><strong>Second factor</strong><span class="page__muted">{{ secondFactor }}</span></span>
              <a-tag :color="isSeeded ? 'gold' : 'success'">{{ isSeeded ? 'default code' : providers.otp || '—' }}</a-tag>
            </li>
            <li class="method">
              <span class="method__icon"><GoogleOutlined /></span>
              <span class="method__text"><strong>Google</strong><span class="page__muted">{{ providers.google ? 'account chooser; same account when the verified email matches' : 'not configured on this server' }}</span></span>
              <a-tag :color="providers.google ? 'success' : 'default'">{{ providers.google ? 'available' : 'off' }}</a-tag>
            </li>
            <li class="method">
              <span class="method__icon"><SafetyCertificateOutlined /></span>
              <span class="method__text"><strong>Sign out everywhere</strong><span class="page__muted">revokes the refresh token server-side; open tabs lose their session at the next call</span></span>
              <a-button size="small" danger @click="logout">revoke</a-button>
            </li>
          </ul>
        </div>
      </a-col>

      <a-col :xs="24" :lg="8">
        <div class="page__card">
          <div class="sec"><span class="sec__icon"><SettingOutlined /></span><h3 class="sec__title">Preferences</h3></div>
          <div class="pref">
            <div class="pref__label"><BgColorsOutlined /> Appearance</div>
            <a-segmented v-model:value="themeChoice" :options="themeOptions" block @change="(v) => theme.set(v === 'system' ? null : v)" />
            <div class="page__muted" style="margin-top: 0.4rem">This browser only · System follows the OS.</div>
          </div>
          <div class="pref">
            <div class="pref__label"><IdcardOutlined /> Display name <span class="page__muted">(this session)</span></div>
            <a-input-search v-model:value="nickname" placeholder="How the header should call you" enter-button="Apply" :maxlength="40" @search="applyNickname" />
            <div class="page__muted" style="margin-top: 0.4rem">Updates the header instantly · not saved on the server (the template has no profile API).</div>
          </div>
        </div>
      </a-col>

      <a-col :span="24">
        <div class="page__card">
          <div class="sec">
            <span class="sec__icon"><KeyOutlined /></span>
            <h3 class="sec__title">Token</h3>
            <span class="sec__count">{{ explained.length }} claims</span>
            <a-segmented v-model:value="claimView" :options="['Explained', 'Raw JSON']" size="small" />
            <a-tooltip title="Copy claims"><a-button size="small" @click="copy(claims, 'Claims')"><template #icon><CopyOutlined /></template></a-button></a-tooltip>
          </div>
          <div class="token">
            <code class="token__value">{{ maskedToken }}</code>
            <a-tooltip :title="showToken ? 'Hide token' : 'Show token'"><a-button size="small" @click="showToken = !showToken"><template #icon><EyeInvisibleOutlined v-if="showToken" /><EyeOutlined v-else /></template></a-button></a-tooltip>
          </div>
          <a-table v-if="claimView === 'Explained'" :data-source="explained" :columns="claimColumns" :pagination="false" size="small" row-key="claim" class="claims" />
          <pre v-else class="code" data-cy="claims">{{ claims }}</pre>
        </div>
      </a-col>
    </a-row>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { message } from 'ant-design-vue'
import { LogoutOutlined, ReloadOutlined, CopyOutlined, LockOutlined, MailOutlined, GoogleOutlined, SafetyCertificateOutlined, ClockCircleOutlined, LoginOutlined, FieldTimeOutlined, SettingOutlined, BgColorsOutlined, IdcardOutlined, KeyOutlined, EyeOutlined, EyeInvisibleOutlined } from '@ant-design/icons-vue'
import parseJwt from '@es-labs/jslib/web/parse-jwt'
import { useMainStore } from '../store.js'
import { http } from '../../common/plugins/fetch.js'
import { useTheme } from '../theme.js'

const store = useMainStore()
const theme = useTheme()
const user = computed(() => store.user || {})
const roles = computed(() => (Array.isArray(user.value.roles) ? user.value.roles : []))
const identity = computed(() => user.value.nickname || user.value.user_meta?.email || user.value.email || user.value.username || `user #${user.value.sub ?? ''}`)
const initials = computed(() => identity.value.replace(/@.*/, '').slice(0, 2).toUpperCase())
const isSeeded = computed(() => /^(test|ais-one|aaronjxz|admin@techtest\.dev|demo@techtest\.dev|viewer@techtest\.dev)$/.test(user.value.user_meta?.email || ''))
const providers = ref({})
const gravatar = ref('')
const renewing = ref(false)
const renewedTimes = ref(0)
const nickname = ref('')
const claimView = ref('Explained')
const showToken = ref(false)
const now = ref(Date.now())
let tick

const fmt = (epoch) => (epoch ? new Date(epoch * 1000).toLocaleString() : '—')
const secondsLeft = computed(() => (user.value.exp ? Math.round(user.value.exp - now.value / 1000) : 0))
const lifetime = computed(() => Math.max(1, (user.value.exp || 0) - (user.value.iat || 0)))
const lifetimeMin = computed(() => Math.round(lifetime.value / 60))
const percentLeft = computed(() => Math.max(0, Math.min(100, Math.round((secondsLeft.value / lifetime.value) * 100))))
const remainingShort = computed(() => (secondsLeft.value <= 0 ? 'expired' : secondsLeft.value < 60 ? `${secondsLeft.value}s` : `${Math.floor(secondsLeft.value / 60)}m ${String(secondsLeft.value % 60).padStart(2, '0')}s`))
const remainingLong = computed(() => (secondsLeft.value <= 0 ? 'access token expired' : `of ${lifetimeMin.value} minutes left on the access token`))
const ringColor = computed(() => (percentLeft.value > 50 ? '#16a34a' : percentLeft.value > 20 ? '#f59e0b' : '#ef4444'))
const tokenState = computed(() => (secondsLeft.value <= 0 ? 'token expired' : secondsLeft.value < 300 ? 'token expiring' : 'token valid'))
const tokenColor = computed(() => (secondsLeft.value <= 0 ? 'error' : secondsLeft.value < 300 ? 'warning' : 'success'))
const secondFactor = computed(() => (isSeeded.value ? 'this account uses its default code 111111' : providers.value.otp === 'EMAIL' ? 'a 6-digit code is emailed at every sign-in' : providers.value.otp === 'TEST' ? 'test mode, fixed code' : providers.value.otp === 'GA' ? 'authenticator app (TOTP)' : '—'))

const themeOptions = [{ label: 'System', value: 'system' }, { label: 'Light', value: 'light' }, { label: 'Dark', value: 'dark' }]
const themeChoice = ref(theme.preference.value || 'system')

const claims = computed(() => JSON.stringify(user.value, null, 2))
const meaning = {
  iss: 'issuer — who minted the token (empty in the template config)',
  sub: 'subject — your user id in the users table',
  aud: 'audience — intended recipient (empty in the template config)',
  scope: 'OpenID scopes the token was issued with',
  roles: 'coarse-grained roles: RBAC tenant roles, else FGA, else the legacy roles column',
  iat: 'issued at (unix seconds)',
  exp: 'expires at (unix seconds) — the API rejects the token after this',
  user_meta: 'selected user fields copied into the token (AUTH_USER_FIELDS_JWT_PAYLOAD)',
  nickname: 'set on this page; lives in the store only',
}
const explained = computed(() => Object.entries(user.value).map(([claim, value]) => ({ claim, value: typeof value === 'object' ? JSON.stringify(value) : /^(iat|exp)$/.test(claim) ? `${value} → ${fmt(value)}` : String(value ?? ''), meaning: meaning[claim] || '' })))
const claimColumns = [
  { title: 'Claim', dataIndex: 'claim', key: 'claim', width: 120 },
  { title: 'Value', dataIndex: 'value', key: 'value', ellipsis: true },
  { title: 'Meaning', dataIndex: 'meaning', key: 'meaning' },
]
const maskedToken = computed(() => {
  const t = http.getTokens().access || ''
  if (!t) return 'no access token in memory'
  return showToken.value ? t : `${t.slice(0, 12)}…${t.slice(-10)}  (${t.length} chars, HS256 JWT)`
})

const copy = async (text, what) => {
  try { await navigator.clipboard.writeText(text); message.success(`${what} copied`) } catch { message.error('Clipboard not available') }
}
const renew = async () => {
  renewing.value = true
  try {
    const { data } = await http.post('/api/auth/refresh', { refresh_token: http.getTokens().refresh, access_token: http.getTokens().access })
    http.setTokens({ access: data.access_token, refresh: data.refresh_token })
    store.updateUser({ ...parseJwt(data.access_token), user_meta: data.user_meta || user.value.user_meta })
    renewedTimes.value++
    message.success('Session renewed — new access and refresh tokens')
  } catch (e) {
    message.error('Refresh failed: ' + (e?.data?.message || e.toString()))
  } finally {
    renewing.value = false
  }
}
const applyNickname = () => { store.updateUser({ nickname: nickname.value.trim() || undefined }); message.success(nickname.value.trim() ? 'Display name applied' : 'Display name cleared') }
const logout = async () => { store.loading = true; await store.doLogin(null); store.loading = false }

const loadGravatar = async () => {
  const email = user.value.user_meta?.email
  if (!email || !email.includes('@') || !crypto?.subtle) return
  const bytes = new TextEncoder().encode(email.trim().toLowerCase())
  const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map((b) => b.toString(16).padStart(2, '0')).join('')
  const url = `https://www.gravatar.com/avatar/${hash}?s=160&d=404`
  try { const res = await fetch(url, { method: 'HEAD', mode: 'cors' }); if (res.ok) gravatar.value = url } catch { gravatar.value = '' }
}

onMounted(async () => {
  tick = setInterval(() => { now.value = Date.now() }, 1000)
  nickname.value = user.value.nickname || ''
  loadGravatar()
  try { providers.value = (await http.get('/api/auth/providers')).data } catch { providers.value = {} }
})
onBeforeUnmount(() => clearInterval(tick))
</script>

<style scoped>
.hero { padding: 0; overflow: hidden; margin-bottom: 1rem; }
.hero__band { height: 96px; background: linear-gradient(120deg, #2563eb, #7c3aed 60%, #db2777); }
.hero__body { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 1rem 1.5rem; padding: 0 1.5rem 1.25rem; margin-top: -44px; }
.hero__avatar { width: 88px; height: 88px; border-radius: 50%; display: grid; place-items: center; background: var(--p-card); color: var(--p-accent); font-weight: 800; font-size: 1.7rem; border: 4px solid var(--p-card); box-shadow: 0 6px 20px rgba(15, 23, 42, 0.15); overflow: hidden; flex: none; }
.hero__avatar img { width: 100%; height: 100%; object-fit: cover; }
.hero__who { flex: 1; min-width: 240px; display: grid; gap: 0.35rem; padding-top: 48px; }
.hero__name { margin: 0; font-size: 1.35rem; font-weight: 700; letter-spacing: -0.01em; word-break: break-all; }
.hero__chips { display: flex; flex-wrap: wrap; gap: 0.3rem; }
.hero__chips .ant-tag { margin: 0; display: inline-flex; align-items: center; gap: 0.35rem; }
.hero__actions { display: flex; flex-wrap: wrap; gap: 0.5rem; padding-top: 48px; }
.session__ring { display: grid; justify-items: center; gap: 0.25rem; margin: 0.25rem 0 0.75rem; }
.session__caption { font-size: 0.85rem; color: var(--p-muted); }
.session__warn { margin-bottom: 0.75rem; }
.facts { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.5rem; }
.fact { display: flex; align-items: center; gap: 0.7rem; padding: 0.5rem 0.7rem; border-radius: 10px; background: var(--p-bg); border: 1px solid var(--p-border); }
.fact__icon { width: 1.9rem; height: 1.9rem; border-radius: 8px; display: grid; place-items: center; background: color-mix(in srgb, var(--p-accent) 12%, transparent); color: var(--p-accent); flex: none; }
.fact__body { display: grid; line-height: 1.25; }
.fact__label { font-size: 0.75rem; color: var(--p-muted); }
.fact__value { font-weight: 600; font-size: 0.9rem; }
.pref__label .anticon { color: var(--p-accent); margin-right: 0.25rem; }
.methods { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.6rem; }
.method { display: grid; grid-template-columns: auto 1fr auto; gap: 0.75rem; align-items: center; padding: 0.6rem 0.75rem; border: 1px solid var(--p-border); border-radius: 10px; background: var(--p-bg); }
.method__icon { width: 2rem; height: 2rem; border-radius: 8px; display: grid; place-items: center; background: color-mix(in srgb, var(--p-accent) 12%, transparent); color: var(--p-accent); }
.method__text { display: grid; line-height: 1.3; }
.method__text .page__muted { font-size: 0.78rem; }
.pref + .pref { margin-top: 1rem; }
.pref__label { font-weight: 600; margin-bottom: 0.4rem; }
.token { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.75rem; }
.token__value { flex: 1; font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 0.78rem; padding: 0.5rem 0.7rem; background: var(--p-bg); border: 1px solid var(--p-border); border-radius: 8px; overflow-wrap: anywhere; }
.claims :deep(td) { font-size: 0.85rem; }
.pill__dot { width: 0.5rem; height: 0.5rem; border-radius: 50%; background: currentColor; display: inline-block; }
@media (prefers-reduced-motion: reduce) { .hero__band { background: #2563eb; } }
</style>
