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
          <div class="jwt">
            <div class="jwt__parts">
              <span class="jwt__part jwt__part--h" title="header">{{ parts.header }}</span><span class="jwt__dot">.</span><span class="jwt__part jwt__part--p" title="payload">{{ parts.payload }}</span><span class="jwt__dot">.</span><span class="jwt__part jwt__part--s" title="signature">{{ parts.signature }}</span>
            </div>
            <a-tooltip :title="showToken ? 'Hide token' : 'Show token'"><a-button size="small" @click="showToken = !showToken"><template #icon><EyeInvisibleOutlined v-if="showToken" /><EyeOutlined v-else /></template></a-button></a-tooltip>
          </div>
          <div class="jwt__legend">
            <span><i class="jwt__swatch jwt__swatch--h" />header · {{ header.alg || '—' }} {{ header.typ || '' }}</span>
            <span><i class="jwt__swatch jwt__swatch--p" />payload · {{ explained.length }} claims</span>
            <span><i class="jwt__swatch jwt__swatch--s" />signature · HMAC, checked by the API only</span>
            <span class="page__muted">{{ tokenLength }} chars</span>
          </div>
          <div v-if="claimView === 'Explained'" class="claims">
            <div v-for="c in explained" :key="c.claim" class="claim" :class="{ 'claim--empty': c.empty }">
              <span class="claim__icon"><component :is="c.icon" /></span>
              <div class="claim__body">
                <div class="claim__head"><code class="claim__name">{{ c.claim }}</code><span v-if="c.badge" class="claim__badge" :data-tone="c.tone">{{ c.badge }}</span></div>
                <div class="claim__value">
                  <template v-if="c.empty"><MinusOutlined /> not set</template>
                  <template v-else-if="c.tags"><a-tag v-for="t in c.tags" :key="t" color="blue" class="claim__tag">{{ t }}</a-tag></template>
                  <template v-else-if="c.pairs"><span v-for="p in c.pairs" :key="p.k" class="claim__pair"><span class="page__muted">{{ p.k }}</span> {{ p.v }}</span></template>
                  <template v-else>{{ c.value }}</template>
                </div>
                <div class="claim__meaning">{{ c.meaning }}</div>
              </div>
            </div>
          </div>
          <pre v-else class="code" data-cy="claims">{{ claims }}</pre>
        </div>
      </a-col>
    </a-row>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { message } from 'ant-design-vue'
import { LogoutOutlined, ReloadOutlined, CopyOutlined, LockOutlined, MailOutlined, GoogleOutlined, SafetyCertificateOutlined, ClockCircleOutlined, LoginOutlined, FieldTimeOutlined, SettingOutlined, BgColorsOutlined, IdcardOutlined, KeyOutlined, EyeOutlined, EyeInvisibleOutlined, BankOutlined, UserOutlined, TeamOutlined, SafetyOutlined, CrownOutlined, TagOutlined, FileTextOutlined, MinusOutlined } from '@ant-design/icons-vue'
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
const CLAIM_ICON = { iss: BankOutlined, sub: UserOutlined, aud: TeamOutlined, scope: SafetyOutlined, roles: CrownOutlined, iat: LoginOutlined, exp: FieldTimeOutlined, user_meta: IdcardOutlined, nickname: TagOutlined }
const explained = computed(() => Object.entries(user.value).map(([claim, value]) => {
  const c = { claim, meaning: meaning[claim] || '', icon: CLAIM_ICON[claim] || FileTextOutlined, empty: value === '' || value == null || (Array.isArray(value) && !value.length) }
  if (Array.isArray(value)) c.tags = value.map(String)
  else if (value && typeof value === 'object') c.pairs = Object.entries(value).map(([k, v]) => ({ k, v: String(v) }))
  else if (claim === 'iat' || claim === 'exp') { c.value = fmt(value); c.badge = claim === 'exp' ? remainingShort.value : String(value); c.tone = claim === 'exp' ? (secondsLeft.value <= 0 ? 'bad' : secondsLeft.value < 300 ? 'warn' : 'ok') : 'muted' }
  else c.value = String(value)
  return c
}))
const rawToken = computed(() => http.getTokens().access || '')
const tokenLength = computed(() => rawToken.value.length)
const parts = computed(() => {
  const [h = '', p = '', s = ''] = rawToken.value.split('.')
  const cut = (x) => (showToken.value || x.length <= 14 ? x : `${x.slice(0, 8)}…${x.slice(-4)}`)
  return { header: cut(h), payload: cut(p), signature: cut(s) }
})
const header = computed(() => { try { return JSON.parse(atob(rawToken.value.split('.')[0].replace(/-/g, '+').replace(/_/g, '/'))) } catch { return {} } })

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
.jwt { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem; }
.jwt__parts { flex: 1; font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 0.78rem; padding: 0.55rem 0.7rem; background: var(--p-bg); border: 1px solid var(--p-border); border-radius: 8px; overflow-wrap: anywhere; line-height: 1.5; }
.jwt__part--h { color: #dc2626; }
.jwt__part--p { color: #7c3aed; }
.jwt__part--s { color: #2563eb; }
.jwt__dot { color: var(--p-muted); margin: 0 0.1rem; }
.jwt__legend { display: flex; flex-wrap: wrap; gap: 0.4rem 1.1rem; font-size: 0.78rem; color: var(--p-muted); margin-bottom: 1rem; align-items: center; }
.jwt__legend span { display: inline-flex; align-items: center; gap: 0.35rem; }
.jwt__swatch { width: 0.65rem; height: 0.65rem; border-radius: 3px; display: inline-block; }
.jwt__swatch--h { background: #dc2626; }
.jwt__swatch--p { background: #7c3aed; }
.jwt__swatch--s { background: #2563eb; }
.claims { display: grid; gap: 0.75rem; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); }
.claim { display: flex; gap: 0.7rem; padding: 0.75rem 0.85rem; border-radius: 12px; background: var(--p-bg); border: 1px solid var(--p-border); }
.claim--empty { border-style: dashed; }
.claim__icon { flex: none; width: 2rem; height: 2rem; border-radius: 8px; display: grid; place-items: center; background: color-mix(in srgb, #7c3aed 12%, transparent); color: #7c3aed; }
.claim--empty .claim__icon { background: var(--p-card); color: var(--p-muted); }
.claim__body { min-width: 0; display: grid; gap: 0.2rem; }
.claim__head { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
.claim__name { font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 0.82rem; font-weight: 700; color: var(--p-text); }
.claim__badge { font-size: 0.7rem; font-weight: 600; padding: 0.05rem 0.45rem; border-radius: 999px; background: var(--p-card); border: 1px solid var(--p-border); color: var(--p-muted); font-variant-numeric: tabular-nums; }
.claim__badge[data-tone="ok"] { color: #16a34a; border-color: #16a34a55; }
.claim__badge[data-tone="warn"] { color: #f59e0b; border-color: #f59e0b55; }
.claim__badge[data-tone="bad"] { color: #ef4444; border-color: #ef444455; }
.claim__value { font-size: 0.92rem; font-weight: 500; overflow-wrap: anywhere; display: flex; flex-wrap: wrap; gap: 0.25rem 0.5rem; align-items: center; }
.claim--empty .claim__value { color: var(--p-muted); font-weight: 400; }
.claim__tag { margin: 0; }
.claim__pair { display: inline-flex; gap: 0.35rem; }
.claim__meaning { font-size: 0.78rem; color: var(--p-muted); }
.pill__dot { width: 0.5rem; height: 0.5rem; border-radius: 50%; background: currentColor; display: inline-block; }
@media (prefers-reduced-motion: reduce) { .hero__band { background: #2563eb; } }
</style>
