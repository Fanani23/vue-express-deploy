import { useMainStore } from '../store'

const { VITE_INITIAL_SECURE_PATH, VITE_INITIAL_PUBLIC_PATH } = import.meta.env

export const authGuard = async (to, from, next) => {
  const store = useMainStore()

  const loggedIn = !!store.user || (await store.restoreSession())
  const requiresAuth = to.matched.some((record) => record.meta.requiresAuth)

  if (loggedIn === requiresAuth) {
    next()
  } else if (!loggedIn && requiresAuth) {
    next(VITE_INITIAL_PUBLIC_PATH)
  } else {
    next(VITE_INITIAL_SECURE_PATH)
  }
}
