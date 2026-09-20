<template>
  <div class="page">
    <header class="page__head">
      <div>
        <h1 class="page__title">Map</h1>
        <p class="page__subtitle">Leaflet with OpenStreetMap tiles — the template left this as a TODO. The markers are <code>places</code> records in TaskPulse's catalog: click anywhere on the map to add one, rename or delete it from the list, and it is there for everyone after a reload.</p>
      </div>
      <div class="page__actions">
        <a-tag class="pill" :color="located ? 'success' : geoError ? 'error' : 'default'"><EnvironmentOutlined />{{ located ? 'located' : geoError ? 'location blocked' : 'not located' }}</a-tag>
        <a-button type="primary" @click="locate" :loading="locating"><template #icon><AimOutlined /></template>Locate me</a-button>
        <a-button @click="fit"><template #icon><FullscreenOutlined /></template>Fit all</a-button>
      </div>
    </header>

    <transition name="pop"><a-alert v-if="error" type="error" show-icon closable :message="error" class="alert" @close="error = ''" /></transition>

    <div class="map-grid">
      <div class="page__card map-card">
        <div class="sec">
          <span class="sec__icon"><GlobalOutlined /></span>
          <h3 class="sec__title">OpenStreetMap</h3>
          <span class="sec__count">{{ places.length + (you ? 1 : 0) }} marker{{ places.length + (you ? 1 : 0) === 1 ? '' : 's' }}</span>
          <span class="page__muted hint"><PlusCircleOutlined /> click the map to add a place</span>
        </div>
        <div ref="mapEl" class="map" data-cy="map"></div>
      </div>

      <div class="page__stack">
        <div class="page__card">
          <div class="sec">
            <span class="sec__icon"><PushpinOutlined /></span>
            <h3 class="sec__title">Places</h3>
            <span class="sec__count">{{ places.length }}</span>
            <a-button size="small" @click="load" :loading="loading"><template #icon><ReloadOutlined /></template></a-button>
          </div>
          <div v-if="!places.length && !loading" class="empty"><PushpinOutlined class="empty__icon" /><span>No places yet</span><span class="empty__hint">Click on the map to add the first one.</span></div>
          <ul v-else class="places">
            <li v-for="p in places" :key="p.code" class="place" :data-cy="'place-' + p.code" @click="focus(p)">
              <span class="place__icon"><CloudServerOutlined v-if="p.code === 'this-application'" /><EnvironmentOutlined v-else /></span>
              <span class="place__body">
                <strong>{{ p.label }}</strong>
                <span class="page__muted">{{ p.attributes?.detail || 'no description' }}</span>
                <code class="place__coords">{{ Number(p.attributes?.lat).toFixed(4) }}, {{ Number(p.attributes?.lng).toFixed(4) }}</code>
              </span>
              <span class="place__tools" @click.stop>
                <a-tooltip title="Edit"><a-button size="small" type="text" @click="edit(p)"><template #icon><EditOutlined /></template></a-button></a-tooltip>
                <a-popconfirm :title="`Delete ${p.label}?`" ok-text="Delete" ok-type="danger" @confirm="remove(p)"><a-button size="small" type="text" danger><template #icon><DeleteOutlined /></template></a-button></a-popconfirm>
              </span>
            </li>
          </ul>
          <ul v-if="you" class="places" style="margin-top: 0.6rem">
            <li class="place place--you" @click="map.flyTo([you.lat, you.lng], 11)">
              <span class="place__icon"><UserOutlined /></span>
              <span class="place__body"><strong>You</strong><span class="page__muted">{{ you.detail }} — not stored</span><code class="place__coords">{{ you.lat.toFixed(4) }}, {{ you.lng.toFixed(4) }}</code></span>
              <a-tooltip title="Save my location as a place"><a-button size="small" type="text" @click.stop="savePlace({ lat: you.lat, lng: you.lng }, 'My location')"><template #icon><SaveOutlined /></template></a-button></a-tooltip>
            </li>
          </ul>
          <div v-else class="empty" style="margin-top: 0.6rem"><UserOutlined class="empty__icon" /><span>You are not on the map yet</span><span class="empty__hint">Press Locate me — the browser will ask for permission.</span></div>
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

    <a-modal v-model:open="dialog.open" :title="dialog.code ? 'Edit place' : 'New place'" :ok-text="dialog.code ? 'Save' : 'Add'" :confirm-loading="dialog.busy" :ok-button-props="{ disabled: !dialog.label.trim() }" @ok="saveDialog">
      <div class="dialog">
        <a-input v-model:value="dialog.label" placeholder="Name" :maxlength="120" data-cy="place-name" @pressEnter="saveDialog" />
        <a-input v-model:value="dialog.detail" placeholder="What is here? (optional)" :maxlength="300" data-cy="place-detail" />
        <code class="page__muted">{{ Number(dialog.lat).toFixed(5) }}, {{ Number(dialog.lng).toFixed(5) }}</code>
      </div>
    </a-modal>
  </div>
</template>

<script setup>
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'
import { ref, reactive, onMounted, onBeforeUnmount } from 'vue'
import { message } from 'ant-design-vue'
import { AimOutlined, EnvironmentOutlined, FullscreenOutlined, GlobalOutlined, PushpinOutlined, UserOutlined, CloudServerOutlined, SwapOutlined, PlusCircleOutlined, ReloadOutlined, EditOutlined, DeleteOutlined, SaveOutlined } from '@ant-design/icons-vue'
import { catalogApi, useChangeFeed } from '../../taskpulse.js'

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({ iconUrl: markerIcon, iconRetinaUrl: markerIcon2x, shadowUrl: markerShadow })

const mapEl = ref(null)
const places = ref([])
const loading = ref(false)
const error = ref('')
const locating = ref(false)
const geoError = ref('')
const distance = ref(0)
const located = ref(false)
const you = ref(null)
const dialog = reactive({ open: false, busy: false, code: '', label: '', detail: '', lat: 0, lng: 0, sort: 0 })
let map = null
let youMarker = null
const markers = new Map()

const fail = (e) => { error.value = e?.message || String(e) }
const coords = (p) => [Number(p.attributes?.lat), Number(p.attributes?.lng)]
const drawMarkers = () => {
  for (const m of markers.values()) m.remove()
  markers.clear()
  for (const p of places.value) {
    if (!Number.isFinite(coords(p)[0]) || !Number.isFinite(coords(p)[1])) continue
    const m = L.marker(coords(p)).addTo(map).bindPopup(`<strong>${escapeHtml(p.label)}</strong><br>${escapeHtml(p.attributes?.detail || '')}`)
    markers.set(p.code, m)
  }
}
const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
const load = async () => {
  loading.value = true
  try { places.value = await catalogApi.list('places'); if (map) drawMarkers() } catch (e) { fail(e) } finally { loading.value = false }
}
const fit = () => { const all = [...markers.values(), ...(youMarker ? [youMarker] : [])]; if (all.length) map.fitBounds(L.featureGroup(all).getBounds().pad(0.3)) }
const focus = (p) => { map.flyTo(coords(p), 11); markers.get(p.code)?.openPopup() }

const openDialog = (fields) => { Object.assign(dialog, { open: true, busy: false, code: '', label: '', detail: '', sort: places.value.length + 1, ...fields }) }
const edit = (p) => openDialog({ code: p.code, label: p.label, detail: p.attributes?.detail || '', lat: p.attributes?.lat, lng: p.attributes?.lng, sort: p.sort })
const savePlace = ({ lat, lng }, label = '') => openDialog({ lat, lng, label })
const saveDialog = async () => {
  if (!dialog.label.trim()) return
  dialog.busy = true
  const body = { label: dialog.label.trim(), attributes: { lat: Number(dialog.lat), lng: Number(dialog.lng), detail: dialog.detail.trim() }, sort: dialog.sort }
  try {
    const saved = dialog.code ? await catalogApi.update('places', dialog.code, body) : await catalogApi.create('places', body)
    dialog.open = false
    await load()
    focus(saved)
    message.success(`${saved.label} ${dialog.code ? 'updated' : 'added'}`)
  } catch (e) { fail(e) } finally { dialog.busy = false }
}
const remove = async (p) => { try { await catalogApi.remove('places', p.code); await load() } catch (e) { fail(e) } }

const locate = () => {
  if (!navigator.geolocation) { geoError.value = 'Geolocation is not available in this browser.'; return }
  locating.value = true
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      locating.value = false
      you.value = { detail: `±${Math.round(pos.coords.accuracy)} m, from the browser's Geolocation API`, lat: pos.coords.latitude, lng: pos.coords.longitude }
      youMarker?.remove()
      youMarker = L.marker([you.value.lat, you.value.lng]).addTo(map).bindPopup('<strong>You</strong>').openPopup()
      const server = places.value.find((p) => p.code === 'this-application') || places.value[0]
      distance.value = server ? Math.round(map.distance(coords(server), [you.value.lat, you.value.lng]) / 1000) : 0
      located.value = true; geoError.value = ''
      fit()
    },
    (err) => { locating.value = false; geoError.value = `Location unavailable: ${err.message}` },
    { timeout: 10000 },
  )
}

onMounted(async () => {
  map = L.map(mapEl.value, { scrollWheelZoom: false }).setView([-6.2088, 106.8456], 6)
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
  }).addTo(map)
  map.on('click', (e) => savePlace({ lat: e.latlng.lat, lng: e.latlng.lng }))
  await load()
  drawMarkers()
  fit()
})
onBeforeUnmount(() => { map?.remove() })
useChangeFeed(() => load(), { resources: ['catalog'] })
</script>

<style scoped>
.alert { margin-bottom: 1rem; }
.hint { font-size: 0.78rem; display: inline-flex; gap: 0.3rem; align-items: center; }
.map-grid { display: grid; gap: 1rem; grid-template-columns: minmax(0, 3fr) minmax(300px, 1.2fr); align-items: start; }
@media (max-width: 1100px) { .map-grid { grid-template-columns: 1fr; } }
.map { height: 62vh; min-height: 380px; width: 100%; border-radius: 12px; overflow: hidden; border: 1px solid var(--p-border); cursor: crosshair; }
.places { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.6rem; }
.place { display: grid; grid-template-columns: auto 1fr auto; gap: 0.7rem; align-items: center; padding: 0.7rem 0.8rem; border-radius: 12px; background: var(--p-bg); border: 1px solid var(--p-border); cursor: pointer; transition: border-color 0.15s, box-shadow 0.15s; }
.place:hover { border-color: var(--p-accent); box-shadow: 0 0 0 3px color-mix(in srgb, var(--p-accent) 15%, transparent); }
.place__icon { width: 2.1rem; height: 2.1rem; border-radius: 10px; display: grid; place-items: center; background: color-mix(in srgb, var(--p-accent) 12%, transparent); color: var(--p-accent); font-size: 1rem; }
.place--you .place__icon { background: rgba(22, 163, 74, 0.12); color: #16a34a; }
.place__body { display: grid; gap: 0.15rem; min-width: 0; line-height: 1.3; }
.place__body .page__muted { font-size: 0.8rem; }
.place__coords { font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 0.75rem; color: var(--p-muted); }
.place__tools { display: flex; }
.distance { font-size: 1.8rem; font-weight: 700; line-height: 1.1; }
.distance strong { font-variant-numeric: tabular-nums; }
.dialog { display: grid; gap: 0.6rem; margin-top: 0.5rem; }
</style>
