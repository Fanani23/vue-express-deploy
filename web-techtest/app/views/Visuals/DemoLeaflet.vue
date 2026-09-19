<template>
  <div class="page">
    <header class="page__head">
      <div>
        <h1 class="page__title">Map</h1>
        <p class="page__subtitle">Leaflet with OpenStreetMap tiles — the template left this as a TODO. It now shows where this application runs and, if you allow it, where you are.</p>
      </div>
      <div class="page__actions">
        <a-tag class="pill" :color="located ? 'success' : geoError ? 'error' : 'default'"><EnvironmentOutlined />{{ located ? 'located' : geoError ? 'location blocked' : 'not located' }}</a-tag>
        <a-button type="primary" @click="locate" :loading="locating"><template #icon><AimOutlined /></template>Locate me</a-button>
        <a-button @click="fit"><template #icon><FullscreenOutlined /></template>Fit all</a-button>
      </div>
    </header>

    <div class="map-grid">
      <div class="page__card map-card">
        <div class="sec">
          <span class="sec__icon"><GlobalOutlined /></span>
          <h3 class="sec__title">OpenStreetMap</h3>
          <span class="sec__count">{{ places.length }} marker{{ places.length === 1 ? '' : 's' }}</span>
        </div>
        <div ref="mapEl" class="map"></div>
      </div>

      <div class="page__stack">
        <div class="page__card">
          <div class="sec">
            <span class="sec__icon"><PushpinOutlined /></span>
            <h3 class="sec__title">Places</h3>
          </div>
          <ul class="places">
            <li v-for="p in places" :key="p.name" class="place" :class="{ 'place--you': p.name === 'You' }" @click="focus(p)">
              <span class="place__icon"><UserOutlined v-if="p.name === 'You'" /><CloudServerOutlined v-else /></span>
              <span class="place__body">
                <strong>{{ p.name }}</strong>
                <span class="page__muted">{{ p.detail }}</span>
                <code class="place__coords">{{ p.lat.toFixed(4) }}, {{ p.lng.toFixed(4) }}</code>
              </span>
              <RightOutlined class="place__go" />
            </li>
            <li v-if="!located" class="empty"><UserOutlined class="empty__icon" /><span>You are not on the map yet</span><span class="empty__hint">Press Locate me — the browser will ask for permission.</span></li>
          </ul>
        </div>

        <div v-if="distance" class="page__card">
          <div class="sec">
            <span class="sec__icon"><SwapOutlined /></span>
            <h3 class="sec__title">Distance to the server</h3>
          </div>
          <div class="distance"><strong>{{ distance.toLocaleString() }}</strong> km</div>
          <p class="page__note">Great-circle distance from <code>map.distance()</code> — roughly the path every request to this app travels.</p>
        </div>
        <a-alert v-if="geoError" type="warning" show-icon :message="geoError" />
      </div>
    </div>
  </div>
</template>

<script setup>
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { AimOutlined, EnvironmentOutlined, FullscreenOutlined, GlobalOutlined, PushpinOutlined, UserOutlined, CloudServerOutlined, RightOutlined, SwapOutlined } from '@ant-design/icons-vue'

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({ iconUrl: markerIcon, iconRetinaUrl: markerIcon2x, shadowUrl: markerShadow })

const mapEl = ref(null)
const locating = ref(false)
const geoError = ref('')
const distance = ref(0)
const located = ref(false)
let map = null
const markers = new Map()

const places = ref([
  { name: 'This application', detail: 'Nevacloud VPS, Jakarta — Vue + Express and TaskPulse behind nginx', lat: -6.2088, lng: 106.8456 },
])

const addMarker = (p) => {
  if (markers.has(p.name)) markers.get(p.name).remove()
  const m = L.marker([p.lat, p.lng]).addTo(map).bindPopup(`<strong>${p.name}</strong><br>${p.detail}`)
  markers.set(p.name, m)
  return m
}
const fit = () => { if (markers.size) map.fitBounds(L.featureGroup([...markers.values()]).getBounds().pad(0.3)) }
const focus = (p) => { map.flyTo([p.lat, p.lng], 11); markers.get(p.name)?.openPopup() }

const locate = () => {
  if (!navigator.geolocation) { geoError.value = 'Geolocation is not available in this browser.'; return }
  locating.value = true
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      locating.value = false
      const p = { name: 'You', detail: `±${Math.round(pos.coords.accuracy)} m, from the browser's Geolocation API`, lat: pos.coords.latitude, lng: pos.coords.longitude }
      places.value = [...places.value.filter((x) => x.name !== 'You'), p]
      const server = places.value[0]
      distance.value = Math.round(map.distance([server.lat, server.lng], [p.lat, p.lng]) / 1000)
      located.value = true; geoError.value = ''
      addMarker(p).openPopup()
      fit()
    },
    (err) => { locating.value = false; geoError.value = `Location unavailable: ${err.message}` },
    { timeout: 10000 },
  )
}

onMounted(() => {
  map = L.map(mapEl.value, { scrollWheelZoom: false }).setView([-6.2088, 106.8456], 6)
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
  }).addTo(map)
  places.value.forEach((p) => addMarker(p).openPopup())
})
onBeforeUnmount(() => { map?.remove() })
</script>

<style scoped>
.map-grid { display: grid; gap: 1rem; grid-template-columns: minmax(0, 3fr) minmax(300px, 1.2fr); align-items: start; }
@media (max-width: 1100px) { .map-grid { grid-template-columns: 1fr; } }
.map { height: 62vh; min-height: 380px; width: 100%; border-radius: 12px; overflow: hidden; border: 1px solid var(--p-border); }
.places { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.6rem; }
.place { display: grid; grid-template-columns: auto 1fr auto; gap: 0.7rem; align-items: center; padding: 0.7rem 0.8rem; border-radius: 12px; background: var(--p-bg); border: 1px solid var(--p-border); cursor: pointer; transition: border-color 0.15s, box-shadow 0.15s; }
.place:hover { border-color: var(--p-accent); box-shadow: 0 0 0 3px color-mix(in srgb, var(--p-accent) 15%, transparent); }
.place__icon { width: 2.1rem; height: 2.1rem; border-radius: 10px; display: grid; place-items: center; background: color-mix(in srgb, var(--p-accent) 12%, transparent); color: var(--p-accent); font-size: 1rem; }
.place--you .place__icon { background: rgba(22, 163, 74, 0.12); color: #16a34a; }
.place__body { display: grid; gap: 0.15rem; min-width: 0; line-height: 1.3; }
.place__body .page__muted { font-size: 0.8rem; }
.place__coords { font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 0.75rem; color: var(--p-muted); }
.place__go { color: var(--p-muted); font-size: 0.75rem; }
.distance { font-size: 1.8rem; font-weight: 700; line-height: 1.1; }
.distance strong { font-variant-numeric: tabular-nums; }
</style>
