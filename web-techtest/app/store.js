import { defineStore } from 'pinia'
import { ref } from 'vue'
import router from './router.js'
import { http } from '../common/plugins/fetch.js'
import { session } from './session.js'

const { VITE_INITIAL_SECURE_PATH, VITE_INITIAL_PUBLIC_PATH } = import.meta.env

export const useMainStore = defineStore('main', () => {
  const user = ref(null)
  const loading = ref(false)

  async function doLogin(payload) {
    if (payload) {
      if (payload.forced) {
        session.clear(payload.reason || 'expired')
        user.value = null
        await router.push(VITE_INITIAL_PUBLIC_PATH)
      } else {
        user.value = { ...payload }
        session.save(user.value)
        await router.push(VITE_INITIAL_SECURE_PATH)
      }
    } else {
      const { VITE_LOGOUT_URL } = import.meta.env
      try {
        if (VITE_LOGOUT_URL) await http.get(VITE_LOGOUT_URL)
        session.clear()
        user.value = null
        await router.push(VITE_INITIAL_PUBLIC_PATH)
      } catch (e) {
        if (e.toString() === 'TypeError: Failed to fetch' || (e.data && e.data.message !== 'Token Expired Error')) {
          session.clear()
          user.value = null
          await router.push(VITE_INITIAL_PUBLIC_PATH)
        }
      }
    }
  }

  function updateUser(payload) {
    user.value = { ...user.value, ...payload }
    session.save(user.value)
  }

  function restoreSession() {
    if (user.value) return true
    const restored = session.restore()
    if (!restored) return false
    user.value = restored
    return true
  }

  return { user, loading, doLogin, updateUser, restoreSession }
})

export const useAppStore = defineStore('app', {
  state: () => ({
    counter: 5,
    form: {
      delivery: true,
      date1: '2021-04-01'
    },
    message: 'No Message From WS'
  }),
  getters: {
    doubleCount() {
      return this.counter * 2
    },
    doubleCountPlusOne() {
      return this.doubleCount * 2 + 1
    }
  },
  actions: {
    reset() {
      this.counter = 0
    }
  }
})
