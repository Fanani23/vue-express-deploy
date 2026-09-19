<template>
  <div class="auth" :class="{ 'auth--signup': isSignup }">
    <aside class="auth__brand">
      <svg class="brand__edge" viewBox="0 0 100 1000" preserveAspectRatio="none" aria-hidden="true">
        <path d="M100 0 C 42 190, 96 400, 40 590 C 8 750, 52 900, 100 1000 Z" />
      </svg>
      <svg class="brand__edge brand__edge--bottom" viewBox="0 0 1000 100" preserveAspectRatio="none" aria-hidden="true">
        <path d="M0 100 L0 62 C 180 28, 380 92, 580 52 C 760 16, 900 48, 1000 70 L1000 100 Z" />
      </svg>
      <div class="brand__logo">
        <svg viewBox="0 0 261.76 226.69" aria-hidden="true">
          <path d="M161.096.001l-30.225 52.351L100.647.001H-.005l130.877 226.688L261.749.001z" fill="#41b883" />
          <path d="M161.096.001l-30.225 52.351L100.647.001H52.346l78.526 136.01L209.398.001z" fill="#34495e" />
        </svg>
      </div>
      <transition name="brand-swap" mode="out-in">
        <div v-if="!isSignup" key="in" class="brand__copy">
          <h2 class="brand__title">{{ appTitle }}</h2>
          <p class="brand__tagline">Vue 3 · Express · two-step sign-in</p>
          <ul class="brand__points">
            <li>Password checked server-side with scrypt</li>
            <li>One-time code before any token is issued</li>
            <li>Short-lived JWT + revocable refresh token</li>
          </ul>
          <button type="button" class="brand__cta" data-cy="to-signup" @click="go('signup')">
            New here? Create an account <span aria-hidden="true">→</span>
          </button>
        </div>
        <div v-else key="up" class="brand__copy">
          <h2 class="brand__title">Join {{ appTitle }}</h2>
          <p class="brand__tagline">Create your account</p>
          <ul class="brand__points">
            <li>Password stored as a salted scrypt hash</li>
            <li>Email address verified with a one-time code</li>
            <li>You are signed in as soon as it is confirmed</li>
          </ul>
          <button type="button" class="brand__cta" data-cy="to-signin" @click="go('signin')">
            <span aria-hidden="true">←</span> Already have an account? Sign in
          </button>
        </div>
      </transition>
    </aside>

    <main ref="panel" class="auth__panel">
      <transition :name="'slide-' + direction" mode="out-in" @after-enter="focusFirstField">
        <a-form v-if="view === 'login'" key="login" layout="vertical" class="auth__form" @submit="login">
          <h1 class="auth__title">Welcome back</h1>
          <p class="auth__subtitle">Sign in to continue to your dashboard.</p>

          <a-form-item label="Username or email" class="auth__required" :validate-status="fieldError.email ? 'error' : ''" :help="fieldError.email">
            <a-input data-cy="username" v-model:value="email" size="large" type="text" autocomplete="username" placeholder="username or you@example.com" @blur="touched.email = true">
              <template #prefix><UserOutlined class="auth__icon" /></template>
            </a-input>
          </a-form-item>

          <a-form-item label="Password" class="auth__required" :validate-status="fieldError.password ? 'error' : ''" :help="fieldError.password">
            <a-input-password data-cy="password" v-model:value="password" size="large" autocomplete="current-password" placeholder="••••••••" @blur="touched.password = true">
              <template #prefix><LockOutlined class="auth__icon" /></template>
            </a-input-password>
          </a-form-item>

          <div class="auth__row auth__row--end">
            <a href="/signup" @click.prevent="go('signup')">Create an account</a>
          </div>

          <a-button data-cy="login" type="primary" size="large" block html-type="submit" :loading="store.loading" :disabled="!canSubmit">
            <template #icon><MailOutlined /></template>
            Sign in with email
          </a-button>

          <template v-if="providers.google">
            <a-divider plain class="auth__divider">or</a-divider>
            <a-button size="large" block class="auth__social" @click="googleLogin">
              <template #icon><GoogleOutlined /></template>
              Continue with Google
            </a-button>
          </template>

          <p class="auth__hint" v-if="otpEmailMode">After your password, a 6-digit code is emailed to you.</p>
          <p class="auth__hint" v-else-if="otpTestMode">Test mode: the one-time code is <code>111111</code>.</p>
          <p class="auth__hint" v-else>After your password, enter the code from your authenticator app.</p>
        </a-form>

        <a-form v-else-if="view === 'otp'" key="otp" layout="vertical" class="auth__form" @submit="otpLogin">
          <a-button type="text" class="auth__back" @click="setToLogin">
            <template #icon><ArrowLeftOutlined /></template>
            Back
          </a-button>
          <h1 class="auth__title">Two-step verification</h1>
          <p class="auth__subtitle">
            <template v-if="otpFixed">This is a seeded demo account — enter its default code. Signing in as <strong>{{ email }}</strong>.</template>
            <template v-else-if="otpTestMode">Test mode is on — the code is 111111.</template>
            <template v-else-if="otpEmailMode">We emailed a 6-digit code to <strong>{{ email }}</strong>. It expires in 5 minutes.</template>
            <template v-else>Open your authenticator app and enter the current 6-digit code. Signing in as <strong>{{ email }}</strong>.</template>
          </p>

          <a-form-item label="One-time code">
            <a-input
              ref="otpInput"
              data-cy="pin"
              :value="otp"
              @update:value="otp = digitsOnly($event)"
              class="auth__otp"
              size="large"
              :maxlength="6"
              inputmode="numeric"
              pattern="[0-9]*"
              autocomplete="one-time-code"
              placeholder="000000"
            >
              <template #prefix><SafetyOutlined class="auth__icon" /></template>
            </a-input>
          </a-form-item>

          <a-button data-cy="otp" type="primary" size="large" block html-type="submit" :loading="store.loading" :disabled="otp.length !== 6">
            Verify and sign in
          </a-button>

          <p class="auth__hint">{{ otpFixed ? "The code for this account never changes." : otpEmailMode ? "Didn't get it? Go back and sign in again for a new code." : "Codes rotate every 30 seconds." }} Three wrong attempts return you to sign-in.</p>
        </a-form>

        <SignUpForm v-else key="signup" @signin="go('signin')" />
      </transition>

      <transition name="pop">
        <a-alert
          v-if="errorMessage && view !== 'signup'"
          class="auth__alert"
          type="error"
          show-icon
          closable
          :message="errorMessage"
          @close="errorMessage = ''"
        />
      </transition>
    </main>
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch, nextTick, onMounted, onBeforeUnmount, onUnmounted } from 'vue'
import { useMainStore } from '../store.js'
import { useRoute, useRouter } from 'vue-router'
import { UserOutlined, MailOutlined, LockOutlined, SafetyOutlined, GoogleOutlined, ArrowLeftOutlined } from '@ant-design/icons-vue'

import parseJwt from '@es-labs/jslib/web/parse-jwt'

import { http } from '../../common/plugins/fetch.js'
import SignUpForm from '../components/SignUpForm.vue'

const { VITE_REFRESH_URL, VITE_APP_TITLE, VITE_OTP_MODE } = import.meta.env
const appTitle = VITE_APP_TITLE || 'My App'
const providers = ref({ google: false, otp: VITE_OTP_MODE || '' })

const googleLogin = () => {
  window.location.assign(`${import.meta.env.VITE_API_URL || ''}/api/google/login`)
}
const otpTestMode = computed(() => providers.value.otp === 'TEST')
const otpEmailMode = computed(() => providers.value.otp === 'EMAIL')
const store = useMainStore()
const route = useRoute()
const email = ref('')
const password = ref('')
const errorMessage = ref('')
const mode = ref('login')
const otpFixed = ref(false)
const otp = ref('')
const otpInput = ref(null)

const touched = reactive({ email: false, password: false })
const digitsOnly = (v) => String(v ?? '').replace(/\D/g, '').slice(0, 6)

const emailError = computed(() => (email.value.trim() ? '' : 'Username or email is required'))
const passwordError = computed(() => (password.value ? '' : 'Password is required'))
const fieldError = computed(() => ({
  email: touched.email ? emailError.value : '',
  password: touched.password ? passwordError.value : '',
}))
const canSubmit = computed(() => !emailError.value && !passwordError.value && !store.loading)

const forced = ref(false)
let otpCount = 0
let otpId = ''

const setToLogin = () => {
  mode.value = 'login'
  otp.value = ''
  otpCount = 0
  touched.email = touched.password = false
  otpFixed.value = false
}

watch(mode, (m) => {
  if (m === 'otp') nextTick(() => otpInput.value?.focus?.())
})

onUnmounted(() => console.log('signIn unmounted'))

onMounted(async () => {
  console.log('signIn mounted!', route.hash)
  setToLogin()
  errorMessage.value = ''
  store.loading = false
  try {
    const { data } = await http.get('/api/auth/providers')
    providers.value = { ...providers.value, ...data }
  } catch (e) {
    console.log('providers unavailable, using env defaults', e?.toString())
  }
  if (otpTestMode.value) otp.value = '111111'
})

onBeforeUnmount(() => {
})

const _setUser = async (data, decoded) => {
  await store.doLogin(decoded)
}

const login = async () => {
  console.log('login clicked', forced.value)
  if (forced.value) {
    _setUser(null, {
      id: 1,
      access_token: '',
      refresh_token: ''
    })
    return
  }
  if (store.value) return
  touched.email = touched.password = true
  if (!canSubmit.value) return
  store.loading = true
  errorMessage.value = ''
  try {
    const { data } = await http.post('/api/auth/login', {
      email: email.value,
      password: password.value
    })
    if (data.otp) {
      mode.value = 'otp'
      otpId = data.otp
      otpFixed.value = data.fixed === true
      otpCount = 0
    } else {
      const decoded = parseJwt(data.access_token)
      http.setTokens({ access: data.access_token, refresh: data.refresh_token })
      http.setOptions({ refreshUrl: VITE_REFRESH_URL })
      _setUser(data, decoded)
    }
  } catch (e) {
    console.log('login error', e.toString(), e)
    errorMessage.value = e?.data?.message || e.toString()
  }
  store.loading = false
}

const otpLogin = async () => {
  if (store.loading) return
  store.loading = true
  errorMessage.value = ''
  try {
    http.setOptions({ refreshUrl: VITE_REFRESH_URL })
    const { data } = await http.post('/api/auth/otp', { id: otpId, pin: otp.value })
    const decoded = parseJwt(data.access_token)
    http.setTokens({ access: data.access_token, refresh: data.refresh_token })
    http.setOptions({ refreshUrl: VITE_REFRESH_URL })
    _setUser(data, decoded)
  } catch (e) {
    if (e?.data?.message === 'Token Expired Error') {
      errorMessage.value = 'OTP Expired'
      setToLogin()
    } else if (otpCount < 3) {
      otpCount++
      errorMessage.value = 'OTP Error'
    } else {
      errorMessage.value = 'OTP Tries Exceeded'
      setToLogin()
    }
  }
  store.loading = false
}

const router = useRouter()
const isSignup = computed(() => route.name === 'SignUp')
const view = computed(() => (isSignup.value ? 'signup' : mode.value))

const DEPTH = { login: 0, otp: 1, signup: 1 }
const direction = ref('left')
watch(view, (to, from) => {
  direction.value = DEPTH[to] >= DEPTH[from] ? 'left' : 'right'
  errorMessage.value = ''
})

const go = (target) => {
  if (target === 'signin') setToLogin()
  router.push(target === 'signup' ? '/signup' : '/signin')
}

const panel = ref(null)
const focusFirstField = () => {
  if (view.value === 'otp') return
  panel.value?.querySelector('.auth__form input')?.focus()
}
</script>

<style src="../style/auth.css"></style>
