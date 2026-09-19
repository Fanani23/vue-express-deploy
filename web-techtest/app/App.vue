<template>
  <a-config-provider :theme="antdTheme">
    <component :is="layouts[$route.meta.layout || (storeUser ? 'layout-secure' : 'layout-public')]"></component>
    <ThemeToggle class="app__theme-toggle" />
  </a-config-provider>
</template>

<script setup>
import LayoutPublic from './layouts/Public.vue'
import LayoutSecure from './layouts/Secure.vue'
import ThemeToggle from './components/ThemeToggle.vue'

import { shallowRef, computed } from 'vue'
import { theme as antTheme } from 'ant-design-vue'
import { useMainStore } from './store.js'
import { useTheme } from './theme.js'

import { http } from '../common/plugins/fetch.js'
import { provideI18n } from '../common/plugins/i18n.js'

const layouts = shallowRef({
  'layout-secure': LayoutSecure,
  'layout-public': LayoutPublic,
})
const store = useMainStore()
const storeUser = store.user
const logout = async () => {
  await store.doLogin({ forced: true })
}
http.setOptions({ forceLogoutFn: logout })

const { isDark } = useTheme()
const antdTheme = computed(() => ({
  algorithm: isDark.value ? antTheme.darkAlgorithm : antTheme.defaultAlgorithm
}))

provideI18n({
  locale: 'en',
  messages: {
    en: { sign_in: 'Sign In (en)' },
    id: { sign_in: 'Masuk (id)' }
  }
})
</script>

<style>
.app__theme-toggle { position: fixed; top: 0.75rem; right: 1rem; z-index: 1000; }
</style>
