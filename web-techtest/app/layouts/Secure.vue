<template>
  <a-layout class="shell">
    <bwc-loading-overlay v-if="loading"></bwc-loading-overlay>
    <a-back-top />
    <a-layout-sider v-model:collapsed="collapsed" :trigger="null" collapsible :collapsed-width="0" :width="232" class="shell__sider">
      <router-link to="/dashboard" class="brand">
        <span class="brand__logo"><BrandMark /></span>
        <span class="brand__name">{{ appTitle }}</span>
      </router-link>
      <a-menu class="shell__menu" theme="dark" mode="inline" v-model:selectedKeys="selectedKeys">
        <template v-for="route in mappedRoutes">
          <a-sub-menu v-if="route.submenu" :key="route.submenu" :title="toPascalCase(route.submenu)">
            <a-menu-item v-for="menu in subMenus[route.submenu]" :key="'sm-' + menu.path" @click="$router.push(menu)">{{ menu.name }}</a-menu-item>
          </a-sub-menu>
          <a-menu-item v-else :key="'m-' + route.path" @click="$router.push(route)">{{ route.name }}</a-menu-item>
        </template>
        <a-menu-item data-cy="logout" key="logout" @click="logout">Logout</a-menu-item>
      </a-menu>
    </a-layout-sider>

    <a-layout>
      <a-layout-header class="shell__header">
        <button type="button" class="shell__trigger" :aria-label="collapsed ? 'Show menu' : 'Hide menu'" @click="collapsed = !collapsed">
          <menu-unfold-outlined v-if="collapsed" />
          <menu-fold-outlined v-else />
        </button>
        <a-breadcrumb class="shell__crumbs">
          <a-breadcrumb-item><router-link to="/dashboard">Home</router-link></a-breadcrumb-item>
          <a-breadcrumb-item>{{ pageTitle }}</a-breadcrumb-item>
        </a-breadcrumb>
        <div class="shell__user" data-cy="user">
          <span class="shell__avatar">{{ initials }}</span>
          <span class="shell__who">
            <span class="shell__email">{{ identity }}</span>
            <span class="shell__roles">{{ roles }}</span>
          </span>
          <a-tooltip :title="`Command palette (${keyLabel(['mod+k'])})`">
            <a-button type="text" size="small" class="shell__logout" aria-label="Command palette" data-cy="palette-open" @click="paletteOpen = true"><template #icon><SearchOutlined /></template></a-button>
          </a-tooltip>
          <a-tooltip title="Sign out">
            <a-button type="text" size="small" class="shell__logout" aria-label="Sign out" @click="logout"><template #icon><LogoutOutlined /></template></a-button>
          </a-tooltip>
        </div>
      </a-layout-header>

      <a-layout-content class="shell__content">
        <router-view :key="$route.fullPath"></router-view>
      </a-layout-content>
    </a-layout>
    <CommandPalette :run="runCommand" />
  </a-layout>
</template>

<script setup>
import { onMounted, onUnmounted, onBeforeUnmount, ref, reactive, computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import { MenuUnfoldOutlined, MenuFoldOutlined, LogoutOutlined, SearchOutlined, AppstoreOutlined, CheckSquareOutlined, LineChartOutlined, UserOutlined, BulbOutlined, ExperimentOutlined } from '@ant-design/icons-vue'
import { useRouter } from 'vue-router'
import BrandMark from '../components/BrandMark.vue'
import CommandPalette from '../components/CommandPalette.vue'
import { paletteOpen, registerCommands, installShortcuts, keyLabel } from '../shortcuts.js'
import { useMainStore } from '../store.js'
import { SECURE_ROUTES } from '../setups/routes.js'
import { onLogin, onLogout } from '../setups/events.js'
import { useTheme } from '../theme.js'
import { preferencesApi, userKey } from '../taskpulse.js'
import { session, IDLE_LIMIT_SECONDS } from '../session.js'
import { watchA11y } from '../a11y.js'

if (!idleTimer._touchWrapped) {
  const originalReset = idleTimer.reset.bind(idleTimer)
  idleTimer.reset = () => { originalReset(); session.touch() }
  idleTimer._touchWrapped = true
}

import idleTimer from '@es-labs/jslib/web/idle'

const appTitle = import.meta.env.VITE_APP_TITLE || 'My App'
const store = useMainStore()
const route = useRoute()
const mappedRoutes = reactive([])
const subMenus = reactive({})
const loading = computed(() => store.loading)
const selectedKeys = ref(['1'])
const collapsed = ref(false)

const pageTitle = computed(() => (typeof route.name === 'string' ? route.name.replace(/([a-z])([A-Z])/g, '$1 $2') : 'Dashboard'))
const identity = computed(() => {
  const u = store.user || {}
  return u.nickname || u.user_meta?.email || u.email || u.username || `user #${u.sub ?? ''}`
})
const roles = computed(() => {
  const r = store.user?.roles
  return Array.isArray(r) && r.length ? r.join(' · ') : 'signed in'
})
const initials = computed(() => identity.value.replace(/@.*/, '').slice(0, 2).toUpperCase())

const syncSelection = () => {
  const parts = route.path.split('/')
  selectedKeys.value = [(parts.length === 3 ? 'sm-' : 'm-') + route.path]
}
watch(() => route.path, syncSelection)

const toPascalCase = (str) => {
  str = str.replace(/-\w/g, (x) => ` ${x[1].toUpperCase()}`)
  return str[0].toUpperCase() + str.substring(1, str.length)
}

const theme = useTheme()
const applyServerPreferences = async () => {
  if (!store.user || store.user.prefs_loaded) return
  try {
    const prefs = await preferencesApi.get(userKey(store.user))
    if (prefs) {
      theme.set(prefs.theme === 'system' ? null : prefs.theme)
      store.updateUser({ nickname: prefs.nickname || undefined, prefs_loaded: true })
    } else {
      store.updateUser({ prefs_loaded: true })
    }
  } catch { }
}

// Keyboard: Ctrl/⌘ K opens the palette; `g` + a letter jumps to a page, `t` flips the theme, `?` lists everything.
// Pages add their own commands (the Tasks page: new task, search, export) while they are mounted.
const router = useRouter()
const runCommand = (c) => { if (c.to) router.push(c.to); else c.run?.() }
let stopShortcuts = null
let unregister = null
const PAGE_ICON = { '/dashboard': AppstoreOutlined, '/tasks': CheckSquareOutlined, '/analytics': LineChartOutlined, '/profile': UserOutlined }
const PAGE_KEYS = { '/dashboard': ['g', 'd'], '/tasks': ['g', 't'], '/analytics': ['g', 'a'], '/profile': ['g', 'p'] }

let stopA11y = null
onMounted(async () => {
  applyServerPreferences()
  stopA11y = watchA11y()
  unregister = registerCommands([
    ...SECURE_ROUTES.filter((r) => r.meta?.layout === 'layout-secure' && !r.hidden && r.path.split('/').length <= 3).map((r) => ({
      id: 'go' + r.path.replace(/\W+/g, '-'), title: (r.path.startsWith('/template-demos') ? 'Demo: ' : 'Go to ') + r.name, to: r.path, keys: PAGE_KEYS[r.path], icon: PAGE_ICON[r.path] || ExperimentOutlined, keywords: ['page', 'open', r.path],
    })),
    { id: 'theme', title: 'Toggle dark / light theme', keys: ['t'], icon: BulbOutlined, keywords: ['dark', 'light', 'appearance'], run: () => theme.toggle() },
    { id: 'logout', title: 'Sign out', icon: LogoutOutlined, keywords: ['logout', 'exit'], run: () => logout() },
  ])
  stopShortcuts = installShortcuts(runCommand)
  idleTimer.timeouts.length = 0
  idleTimer.timeouts.push({ time: IDLE_LIMIT_SECONDS, fn: () => store.doLogin({ forced: true, reason: 'idle' }), stop: true })
  idleTimer.reset()
  idleTimer.start()
  session.touch()

  SECURE_ROUTES.filter((r) => r.meta.layout === 'layout-secure').forEach((r) => {
    if (!r.hidden) {
      const pathLen = r.path.split('/').length
      if (pathLen === 2 || pathLen === 3) {
        const submenu = pathLen === 3 ? r.path.split('/', 2)[1] : ''
        if (submenu) {
          if (!subMenus[submenu]) {
            subMenus[submenu] = []
            mappedRoutes.push({ ...r, submenu })
          }
          subMenus[submenu].push({ ...r })
        } else {
          mappedRoutes.push({ ...r, submenu: '' })
        }
      }
    }
  })
  syncSelection()
  onLogin && onLogin()
})
onUnmounted(() => {})
onBeforeUnmount(() => {
  stopA11y?.()
  stopShortcuts?.()
  unregister?.()
  idleTimer.stop()
  onLogout && onLogout()
})

const logout = async () => {
  store.loading = true
  await store.doLogin(null)
  store.loading = false
}
</script>

<style>
@import 'Secure.css';
</style>
