import { createRouter, createWebHistory } from 'vue-router'
import { ROUTES, SECURE_ROUTES, PUBLIC_ROUTES } from './setups/routes.js'
import { authGuard } from './setups/authGuard'

const { BASE_URL } = import.meta.env
for (const route of SECURE_ROUTES) {
  route.beforeEnter = authGuard
  route.meta = { requiresAuth: true, layout: 'layout-secure' }
}

for (const route of PUBLIC_ROUTES) {
  route.beforeEnter = authGuard
  route.meta = { requiresAuth: false, layout: 'layout-public' }
}

const routerHistory = createWebHistory(BASE_URL)
const router = createRouter({
  history: routerHistory,
  routes: [
    ...PUBLIC_ROUTES,
    ...SECURE_ROUTES,
    ...ROUTES
  ]
})

const RELOAD_KEY = 'vt.chunk-reload'
const isStaleChunkError = (e) => /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Expected a JavaScript/i.test(String(e?.message || e))

const reloadOnce = (path) => {
  let last = ''
  try { last = sessionStorage.getItem(RELOAD_KEY) || '' } catch { }
  const stamp = `${path}@${Math.floor(Date.now() / 60000)}`
  if (last === stamp) return false
  try { sessionStorage.setItem(RELOAD_KEY, stamp) } catch { }
  window.location.assign(path)
  return true
}

router.onError((error, to) => {
  if (isStaleChunkError(error)) reloadOnce(to?.fullPath || window.location.pathname)
})

window.addEventListener('vite:preloadError', (event) => {
  event.preventDefault()
  reloadOnce(window.location.pathname + window.location.search)
})

export default router
