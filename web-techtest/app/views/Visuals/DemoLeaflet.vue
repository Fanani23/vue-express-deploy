<template>
  <div class="page">
    <header class="page__head">
      <div>
        <h1 class="page__title">Map</h1>
        <p class="page__subtitle">Leaflet with OpenStreetMap tiles — the template left this as a TODO. It now shows where this application runs and, if you allow it, where you are — the distance between the two is the round-trip you feel on every click.</p>
      </div>
      <a-space>
        <a-button size="small" @click="locate" :loading="locating"><template #icon><AimOutlined /></template>locate me</a-button>
        <a-button size="small" @click="fit">fit all</a-button>
      </a-space>
    </header>

    <div class="page__card" style="padding: 0.5rem">
      <div ref="mapEl" class="map"></div>
    </div>
    <div class="page__grid" style="margin-top: 1rem">
      <div v-for="p in places" :key="p.name" class="page__card place" @click="focus(p)">
        <strong>{{ p.name }}</strong>
        <span class="page__muted">{{ p.detail }}</span>
        <span class="page__muted">{{ p.lat.toFixed(4) }}, {{ p.lng.toFixed(4) }}</span>
      </div>
    </div>
    <p v-if="distance" class="page__note">You are about <strong>{{ distance.toLocaleString() }} km</strong> from the server (great-circle, via <code>map.distance</code>).</p>
    <p v-if="geoError" class="page__note">{{ geoError }}</p>
  </div>
</template>

<script setup>
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { AimOutlined } from '@ant-design/icons-vue'

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({ iconUrl: markerIcon, iconRetinaUrl: markerIcon2x, shadowUrl: markerShadow })

const mapEl = ref(null)
const locating = ref(false)
const geoError = ref('')
const distance = ref(0)
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
.map { height: 60vh; min-height: 360px; width: 100%; }
.place { display: grid; gap: 0.2rem; cursor: pointer; }
</style>
