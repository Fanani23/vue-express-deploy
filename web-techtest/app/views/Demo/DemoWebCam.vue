<template>
  <div class="page">
    <header class="page__head">
      <div>
        <h1 class="page__title">Camera</h1>
        <p class="page__subtitle">The template's <code>&lt;vcxwc-web-cam&gt;</code> custom element. Start the camera, take a photo, keep it — everything stays in your browser.</p>
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
        <div class="cam__frame" ref="frame">
          <vcxwc-web-cam v-if="ready" :key="size.w" class="cam" @snap="onSnap" :width="size.w" :height="size.h">
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
                <a :href="s.src" :download="`photo-${i + 1}.png`"><a-button size="small"><template #icon><DownloadOutlined /></template></a-button></a>
                <a-button size="small" danger @click="shots.splice(i, 1)"><template #icon><DeleteOutlined /></template></a-button>
              </span>
            </figcaption>
          </figure>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import '@es-labs/jslib/web/web-cam'
import { ref, reactive, onMounted, onBeforeUnmount } from 'vue'
import { VideoCameraOutlined, PictureOutlined, CameraOutlined, DeleteOutlined, DownloadOutlined, ClockCircleOutlined } from '@ant-design/icons-vue'

const shots = ref([])
const frame = ref(null)
const size = reactive({ w: 480, h: 360 })
const supported = !!navigator.mediaDevices?.getUserMedia
const permission = ref('unknown')
const ready = ref(false)
let ro

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
  fit()
  ro = new ResizeObserver(fit)
  if (frame.value) ro.observe(frame.value)
  try {
    const status = await navigator.permissions.query({ name: 'camera' })
    permission.value = status.state
    status.onchange = () => { permission.value = status.state }
  } catch {
    permission.value = supported ? 'prompt' : 'unavailable'
  }
})
onBeforeUnmount(() => ro?.disconnect())
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
</style>
