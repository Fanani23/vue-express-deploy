<template>
  <a-layout class="shell">
    <bwc-loading-overlay v-if="loading"></bwc-loading-overlay>
    <a-back-top />
    <a-layout-sider v-model:collapsed="collapsed" :trigger="null" collapsible :collapsed-width="0" :width="232" class="shell__sider">
      <router-link to="/dashboard" class="brand">
        <span class="brand__logo">V</span>
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
          <a-tooltip title="Sign out">
            <a-button type="text" size="small" class="shell__logout" aria-label="Sign out" @click="logout"><template #icon><LogoutOutlined /></template></a-button>
          </a-tooltip>
        </div>
      </a-layout-header>

      <a-layout-content class="shell__content">
        <router-view :key="$route.fullPath"></router-view>
      </a-layout-content>
    </a-layout>
  </a-layout>
</template>

<script setup>
import { onMounted, onUnmounted, onBeforeUnmount, ref, reactive, computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import { MenuUnfoldOutlined, MenuFoldOutlined, LogoutOutlined } from '@ant-design/icons-vue'
import { useMainStore } from '../store.js'
import { SECURE_ROUTES } from '../setups/routes.js'
import { onLogin, onLogout } from '../setups/events.js'

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
  return u.user_meta?.email || u.email || u.username || `user #${u.sub ?? ''}`
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

onMounted(async () => {
  idleTimer.timeouts.push({ time: 300, fn: () => alert('Idle Timeout Test'), stop: true })
  idleTimer.start()

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
