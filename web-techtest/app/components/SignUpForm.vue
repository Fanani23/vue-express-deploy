<template>
  <div class="auth__stack">
    <transition :name="'slide-' + direction" mode="out-in">
      <a-form v-if="mode === 'form'" key="form" layout="vertical" class="auth__form" @finish="signup">
        <h1 class="auth__title">Create an account</h1>
        <p class="auth__subtitle">We will email you a code to confirm the address.</p>

        <a-form-item label="Email" required :validate-status="fieldError.email ? 'error' : ''" :help="fieldError.email">
          <a-input data-cy="signup-email" v-model:value="email" size="large" type="email" autocomplete="email" placeholder="you@example.com" @blur="touched.email = true">
            <template #prefix><MailOutlined class="auth__icon" /></template>
          </a-input>
        </a-form-item>

        <a-form-item label="Password" required :validate-status="fieldError.password ? 'error' : ''" :help="fieldError.password">
          <a-input-password data-cy="signup-password" v-model:value="password" size="large" autocomplete="new-password" placeholder="at least 8 characters" @blur="touched.password = true">
            <template #prefix><LockOutlined class="auth__icon" /></template>
          </a-input-password>
          <div class="strength" :data-level="strength.level" aria-live="polite">
            <span class="strength__bar"><i v-for="n in 4" :key="n" /></span>
            <span class="strength__label">{{ strength.label }}</span>
          </div>
        </a-form-item>

        <a-form-item label="Confirm password" required :validate-status="fieldError.confirm ? 'error' : ''" :help="fieldError.confirm">
          <a-input-password data-cy="signup-confirm" v-model:value="confirm" size="large" autocomplete="new-password" placeholder="repeat your password" @blur="touched.confirm = true">
            <template #prefix><LockOutlined class="auth__icon" /></template>
          </a-input-password>
        </a-form-item>

        <a-button data-cy="signup" type="primary" size="large" block html-type="submit" :loading="store.loading" :disabled="!canSubmit">
          <template #icon><MailOutlined /></template>
          Sign up with email
        </a-button>

        <p class="auth__hint">Already have an account? <a href="/signin" @click.prevent="$emit('signin')">Sign in</a></p>
      </a-form>

      <a-form v-else key="otp" layout="vertical" class="auth__form" @finish="verifyOtp">
        <a-button type="text" class="auth__back" @click="mode = 'form'">
          <template #icon><ArrowLeftOutlined /></template>
          Back
        </a-button>
        <h1 class="auth__title">Check your email</h1>
        <p class="auth__subtitle">
          We sent a 6-digit code to <strong>{{ email }}</strong>. Enter it to confirm your address and sign in.
        </p>

        <a-form-item label="Verification code" required>
          <a-input ref="otpInput" data-cy="pin" :value="otp" @update:value="otp = digitsOnly($event)" class="auth__otp" size="large" :maxlength="6" inputmode="numeric" pattern="[0-9]*" autocomplete="one-time-code" placeholder="000000">
            <template #prefix><SafetyOutlined class="auth__icon" /></template>
          </a-input>
        </a-form-item>

        <a-button data-cy="otp" type="primary" size="large" block html-type="submit" :loading="store.loading" :disabled="otp.length !== 6 || store.loading">
          Confirm and sign in
        </a-button>

        <p class="auth__hint">The code expires in 5 minutes. Didn't get it? Check spam, or go back and try again.</p>
      </a-form>
    </transition>

    <transition name="pop">
      <a-alert v-if="errorMessage" class="auth__alert" type="error" show-icon closable :message="errorMessage" @close="errorMessage = ''" />
    </transition>
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch, nextTick } from 'vue'
import { useMainStore } from '../store.js'
import { MailOutlined, LockOutlined, SafetyOutlined, ArrowLeftOutlined } from '@ant-design/icons-vue'
import parseJwt from '@es-labs/jslib/web/parse-jwt'
import { http } from '../../common/plugins/fetch.js'

defineEmits(['signin'])

const { VITE_REFRESH_URL } = import.meta.env
const store = useMainStore()

const PASSWORD_MIN = 8
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const digitsOnly = (v) => String(v ?? '').replace(/\D/g, '').slice(0, 6)

const mode = ref('form')
const email = ref('')
const password = ref('')
const confirm = ref('')
const otp = ref('')
const otpInput = ref(null)
const errorMessage = ref('')
const touched = reactive({ email: false, password: false, confirm: false })
let otpId = ''

const direction = ref('left')
watch(mode, (m) => {
  direction.value = m === 'otp' ? 'left' : 'right'
  errorMessage.value = ''
  if (m === 'otp') nextTick(() => otpInput.value?.focus?.())
})

const emailError = computed(() => {
  const v = email.value.trim()
  if (!v) return 'Email is required'
  if (!EMAIL_RE.test(v)) return 'Enter a valid email address'
  return ''
})
const passwordError = computed(() => {
  if (!password.value) return 'Password is required'
  if (password.value.length < PASSWORD_MIN) return `At least ${PASSWORD_MIN} characters`
  return ''
})
const confirmError = computed(() => {
  if (!confirm.value) return 'Please repeat your password'
  if (confirm.value !== password.value) return 'Passwords do not match'
  return ''
})
const fieldError = computed(() => ({
  email: touched.email ? emailError.value : '',
  password: touched.password ? passwordError.value : '',
  confirm: touched.confirm ? confirmError.value : '',
}))
const canSubmit = computed(() => !emailError.value && !passwordError.value && !confirmError.value && !store.loading)

const strength = computed(() => {
  const p = password.value
  if (!p) return { level: 0, label: '' }
  const score = [p.length >= PASSWORD_MIN, /[a-z]/.test(p) && /[A-Z]/.test(p), /\d/.test(p), /[^\w\s]/.test(p)].filter(Boolean).length
  return { level: score, label: ['Too short', 'Weak', 'Fair', 'Good', 'Strong'][score] }
})

const finishLogin = async (data) => {
  const decoded = parseJwt(data.access_token)
  http.setTokens({ access: data.access_token, refresh: data.refresh_token })
  http.setOptions({ refreshUrl: VITE_REFRESH_URL })
  await store.doLogin(decoded)
}

const signup = async () => {
  touched.email = touched.password = touched.confirm = true
  if (!canSubmit.value) return
  store.loading = true
  errorMessage.value = ''
  try {
    const { data } = await http.post('/api/auth/signup', { email: email.value.trim(), password: password.value })
    if (data.otp) {
      otpId = data.otp
      otp.value = ''
      mode.value = 'otp'
    } else if (data.access_token) {
      await finishLogin(data)
    }
  } catch (e) {
    errorMessage.value = e?.data?.message || e.toString()
  }
  store.loading = false
}

const verifyOtp = async () => {
  if (store.loading || otp.value.length !== 6) return
  store.loading = true
  errorMessage.value = ''
  try {
    http.setOptions({ refreshUrl: VITE_REFRESH_URL })
    const { data } = await http.post('/api/auth/otp', { id: otpId, pin: otp.value })
    await finishLogin(data)
  } catch (e) {
    errorMessage.value = e?.data?.message === 'Token Expired Error' ? 'Code expired — go back and try again' : 'That code is not right'
  }
  store.loading = false
}
</script>
