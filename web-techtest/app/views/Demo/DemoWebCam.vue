<template>
  <div class="page">
    <header class="page__head">
      <div>
        <h1 class="page__title">Camera</h1>
        <p class="page__subtitle">The template's <code>&lt;vcxwc-web-cam&gt;</code> custom element. Start the camera, take a photo, and either keep it in the browser or save it to TaskPulse (<code>/api/uploads</code>, source <code>webcam</code>).</p>
      </div>
      <a-tag class="pill" :color="permission === 'granted' ? 'success' : permission === 'denied' ? 'error' : 'default'"><VideoCameraOutlined />camera {{ permission }}</a-tag>
    </header>

    <div class="cam-grid">
      <div class="page__card">
        <div class="sec">
          <span class="sec__icon"><VideoCameraOutlined /></span>
          <h3 class="sec__title">Live</h3>
          <span class="sec__count">{{ size.w }}×{{ size.h }}</span>
        </div>
        <a-alert v-if="permission === 'denied'" type="warning" show-icon class="cam__alert" message="Camera access is blocked for this site" description="Click the camera icon in the address bar, allow access, then reload this page." />
        <a-alert v-else-if="!supported" type="error" show-icon class="cam__alert" message="This browser has no camera API (getUserMedia)." />
        <a-alert v-else-if="hasCamera === false" type="info" show-icon class="cam__alert" message="No camera on this device" description="The camera element is not started; photos saved earlier are still listed on the right." />
        <div class="cam__frame" ref="frame">
          <vcxwc-web-cam v-if="ready && supported && hasCamera !== false && permission !== 'denied'" :key="size.w" class="cam" @snap="onSnap" :width="size.w" :height="size.h">
            <button slot="button-unsnap" class="cam__btn"><span class="cam__btn-icon">▶</span> Start camera</button>
            <button slot="button-snap" class="cam__btn cam__btn--primary"><span class="cam__btn-icon">●</span> Take photo</button>
          </vcxwc-web-cam>
        </div>
        <p class="page__note">The browser asks for permission the first time. Nothing is uploaded.</p>
      </div>

      <div class="page__card">
        <div class="sec">
          <span class="sec__icon"><PictureOutlined /></span>
          <h3 class="sec__title">Photos</h3>
          <span class="sec__count">{{ shots.length }}</span>
          <a-button v-if="shots.length" size="small" danger @click="shots = []"><template #icon><DeleteOutlined /></template>clear all</a-button>
        </div>
        <div v-if="!shots.length" class="empty"><CameraOutlined class="empty__icon" /><span>No photo yet</span><span class="empty__hint">Start the camera and press Take photo.</span></div>
        <div class="shots">
          <figure v-for="(s, i) in shots" :key="s.at" class="shot">
            <img :src="s.src" alt="" />
            <figcaption class="shot__bar">
              <span class="page__muted"><ClockCircleOutlined /> {{ new Date(s.at).toLocaleTimeString() }} · {{ s.kb }} KB</span>
              <span class="page__actions">
                <a-tooltip title="Save to server"><a-button size="small" type="primary" :loading="s.saving" @click="save(s, i)"><template #icon><CloudUploadOutlined /></template></a-button></a-tooltip>
                <a :href="s.src" :download="`photo-${i + 1}.png`"><a-button size="small"><template #icon><DownloadOutlined /></template></a-button></a>
                <a-button size="small" danger @click="shots.splice(i, 1)"><template #icon><DeleteOutlined /></template></a-button>
              </span>
            </figcaption>
          </figure>
        </div>
        <div class="sec" style="margin-top: 1rem">
          <span class="sec__icon"><CloudServerOutlined /></span>
          <h3 class="sec__title">Saved on the server</h3>
          <span class="sec__count">{{ saved.length }}</span>
        </div>
        <div v-if="!saved.length" class="empty"><CloudServerOutlined class="empty__icon" /><span>No saved photos</span><span class="empty__hint">Press the cloud button on a photo to store it.</span></div>
        <div v-else class="saved">
          <figure v-for="u in saved" :key="u.id" class="saved__item">
            <a :href="uploadsApi.contentUrl(u.id)" target="_blank" rel="noopener"><img :src="uploadsApi.contentUrl(u.id)" alt="" /></a>
            <figcaption><span class="page__muted">{{ formatBytes(u.size) }} · {{ timeAgo(u.createdAt) }}</span><a-popconfirm title="Delete from the server?" ok-text="Delete" ok-type="danger" @confirm="removeSaved(u)"><a-button size="small" type="text" danger><template #icon><DeleteOutlined /></template></a-button></a-popconfirm></figcaption>
          </figure>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import '@es-labs/jslib/web/web-cam'
import { ref, reactive, onMounted, onBeforeUnmount } from 'vue'
import { VideoCameraOutlined, PictureOutlined, CameraOutlined, DeleteOutlined, DownloadOutlined, ClockCircleOutlined, CloudUploadOutlined, CloudServerOutlined } from '@ant-design/icons-vue'
import { message } from 'ant-design-vue'
import { uploadsApi, dataUrlToFile, formatBytes, timeAgo, useChangeFeed } from '../../taskpulse.js'

const shots = ref([])
const saved = ref([])
const loadSaved = async () => { try { saved.value = await uploadsApi.list('webcam') } catch { saved.value = [] } }
const save = async (s, i) => {
  s.saving = true
  try { await uploadsApi.create({ files: [dataUrlToFile(s.src, `photo-${new Date(s.at).toISOString().replace(/[:.]/g, '-')}.png`)], source: 'webcam' }); message.success('Photo saved on the server'); shots.value.splice(i, 1); await loadSaved() } catch (e) { message.error(e.message) } finally { s.saving = false }
}
const removeSaved = async (u) => { try { await uploadsApi.remove(u.id); await loadSaved() } catch (e) { message.error(e.message) } }
useChangeFeed(() => loadSaved(), { resources: ['upload'] })
const frame = ref(null)
const size = reactive({ w: 480, h: 360 })
const supported = !!navigator.mediaDevices?.getUserMedia
const permission = ref('unknown')
const hasCamera = ref(null) // null = not checked yet
const ready = ref(false)
let ro

// The template's element calls getUserMedia without a catch, so a missing or blocked camera surfaces as an unhandled
// rejection. Turn that into the alert above instead of a console error (and never mount the element when there is
// no camera to begin with).
const onCameraRejection = (e) => {
  const name = e.reason?.name
  if (name === 'NotAllowedError' || name === 'SecurityError') { permission.value = 'denied'; e.preventDefault() }
  else if (name === 'NotFoundError' || name === 'OverconstrainedError' || name === 'NotReadableError') { hasCamera.value = false; e.preventDefault() }
}

const fit = () => {
  const w = Math.max(240, Math.min(960, Math.floor((frame.value?.clientWidth || 480) - 2)))
  size.w = w
  size.h = Math.round((w * 3) / 4)
  ready.value = true
}

const onSnap = (e) => {
  const src = typeof e.detail === 'string' ? e.detail : e.detail?.dataUrl || e.detail?.src || ''
  if (!src) return
  shots.value.unshift({ src, at: Date.now(), kb: Math.round((src.length * 3) / 4 / 1024) })
}

onMounted(async () => {
  window.addEventListener('unhandledrejection', onCameraRejection)
  loadSaved()
  ro = new ResizeObserver(fit)
  if (frame.value) ro.observe(frame.value)
  try {
    const devices = supported ? await navigator.mediaDevices.enumerateDevices() : []
    hasCamera.value = devices.some((d) => d.kind === 'videoinput')
  } catch {
    hasCamera.value = null
  }
  fit()
  try {
    const status = await navigator.permissions.query({ name: 'camera' })
    permission.value = status.state
    status.onchange = () => { permission.value = status.state }
  } catch {
    permission.value = supported ? 'prompt' : 'unavailable'
  }
})
onBeforeUnmount(() => { ro?.disconnect(); window.removeEventListener('unhandledrejection', onCameraRejection) })
</script>

<style scoped>
.cam-grid { display: grid; gap: 1rem; grid-template-columns: minmax(0, 3fr) minmax(0, 2fr); }
@media (max-width: 1100px) { .cam-grid { grid-template-columns: 1fr; } }
.cam__alert { margin-bottom: 0.75rem; }
.cam__frame { width: 100%; border-radius: 12px; overflow: hidden; background: #0b0e13; border: 1px solid var(--p-border); line-height: 0; }
.cam { display: block; max-width: 100%; --vcxwc-web-cam-top: 4%; --vcxwc-web-cam-right: 4%; }
.cam__btn { appearance: none; border: 1px solid rgba(255, 255, 255, 0.35); background: rgba(15, 23, 42, 0.7); color: #fff; border-radius: 999px; padding: 0.4rem 0.9rem; font: inherit; font-size: 0.85rem; cursor: pointer; margin: 0.25rem; backdrop-filter: blur(4px); display: inline-flex; align-items: center; gap: 0.4rem; line-height: 1.2; }
.cam__btn--primary { background: #2563eb; border-color: #2563eb; }
.cam__btn-icon { font-size: 0.7rem; }
.shots { display: grid; gap: 0.75rem; }
.shot { margin: 0; border-radius: 12px; overflow: hidden; border: 1px solid var(--p-border); background: var(--p-bg); }
.shot img { width: 100%; display: block; }
.shot__bar { display: flex; justify-content: space-between; align-items: center; gap: 0.5rem; padding: 0.5rem 0.7rem; font-size: 0.82rem; }
.saved { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 0.6rem; }
.saved__item { margin: 0; border-radius: 10px; overflow: hidden; border: 1px solid var(--p-border); background: var(--p-bg); }
.saved__item img { width: 100%; aspect-ratio: 4 / 3; object-fit: cover; display: block; }
.saved__item figcaption { display: flex; justify-content: space-between; align-items: center; padding: 0.25rem 0.4rem 0.25rem 0.55rem; font-size: 0.72rem; }
</style>
