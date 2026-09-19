<template>
  <div>
    <bwc-loading-overlay v-if="loading"></bwc-loading-overlay>
    <router-view v-slot="{ Component }">
      <component :is="Component" :key="AUTH_ROUTES.has($route.name) ? 'auth' : $route.fullPath" />
    </router-view>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted } from 'vue'
import { useMainStore } from '../store'

const AUTH_ROUTES = new Set(['Home', 'SignIn', 'SignUp'])
const store = useMainStore()
onMounted(() => console.log('PUBLIC mounted!'))
onUnmounted(() => console.log('PUBLIC unmounted'))
const loading = computed(() => store.loading)
</script>
