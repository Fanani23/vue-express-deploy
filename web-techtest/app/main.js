import { createApp } from 'vue'
import { createPinia } from 'pinia'
import Antd from 'ant-design-vue'
import router from './router.js'
import App from './App.vue'

import './style/main.css'
import createSentry from '../common/sentry.js'

import '@es-labs/jslib/web/bwc-loading-overlay'

import { version } from '../package.json'
console.log(`V${version}`)

// The template registers a service worker (common/pwa.js) that only caches index.html on install and has no fetch
// handler. It buys nothing here and is one more place stale HTML can hide after a redeploy, so this app does not
// register it and unregisters one left behind by an earlier visit.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations()
    .then((registrations) => Promise.all(registrations.map((r) => r.unregister())))
    .then((results) => { if (results.some(Boolean)) console.log('service worker from an earlier build unregistered') })
    .catch(() => { })
}

const app = createApp(App)
createSentry(app, router)
app.use(createPinia())
app.use(router)
app.use(Antd)

app.mount('#app')
