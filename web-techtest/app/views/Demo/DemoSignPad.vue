<template>
  <div class="page">
    <header class="page__head">
      <div>
        <h1 class="page__title">Signature</h1>
        <p class="page__subtitle">The template's <code>&lt;vcxwc-sign-pad&gt;</code> custom element bound with <code>v-model</code>: draw, and the PNG data URL is available to the app immediately.</p>
      </div>
    </header>

    <div class="sig-grid">
      <div class="page__card">
        <div class="sec">
          <span class="sec__icon"><EditOutlined /></span>
          <h3 class="sec__title">Draw</h3>
          <span class="sec__count">{{ size.w }}×{{ size.h }}</span>
        </div>
        <div class="pad" ref="frame">
          <vcxwc-sign-pad v-if="ready" :key="padKey" :width="size.w" :height="size.h" v-model="imageDataUrl" :context2d="ctx"></vcxwc-sign-pad>
          <span v-if="!imageDataUrl" class="pad__hint"><HighlightOutlined /> Sign here with the mouse or a finger</span>
        </div>
        <div class="toolbar">
          <div class="toolbar__group">
            <span class="toolbar__label">Pen</span>
            <button v-for="c in colors" :key="c.value" type="button" class="swatch" :class="{ 'swatch--on': color === c.value }" :style="{ '--swatch': c.value }" :title="c.label" :aria-label="c.label" :aria-pressed="color === c.value" @click="color = c.value" />
          </div>
          <div class="toolbar__group">
            <span class="toolbar__label">Width</span>
            <a-segmented v-model:value="lineWidth" :options="[{ label: 'thin', value: 1 }, { label: 'normal', value: 2 }, { label: 'thick', value: 4 }]" size="small" />
          </div>
          <a-button class="toolbar__clear" @click="clear" :disabled="!imageDataUrl"><template #icon><ClearOutlined /></template>Clear</a-button>
        </div>
      </div>

      <div class="page__card">
        <div class="sec">
          <span class="sec__icon"><FileImageOutlined /></span>
          <h3 class="sec__title">Result</h3>
          <span v-if="imageDataUrl" class="sec__count">{{ kb }} KB</span>
        </div>
        <div v-if="!imageDataUrl" class="empty"><HighlightOutlined class="empty__icon" /><span>Nothing drawn yet</span><span class="empty__hint">The PNG appears here as soon as you lift the pen.</span></div>
        <template v-else>
          <div class="sig"><img :src="imageDataUrl" alt="signature" /></div>
          <div class="page__actions" style="margin-top: 0.75rem">
            <a :href="imageDataUrl" download="signature.png"><a-button type="primary"><template #icon><DownloadOutlined /></template>Download PNG</a-button></a>
            <a-button @click="copyUrl"><template #icon><CopyOutlined /></template>Copy data URL</a-button>
            <span class="page__muted"><code>{{ imageDataUrl.slice(0, 22) }}…</code></span>
          </div>
        </template>
        <p class="page__note">In a real form this data URL is posted with the other fields, or converted to a Blob and uploaded.</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import '@es-labs/jslib/web/sign-pad'
import { ref, reactive, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { message } from 'ant-design-vue'
import { EditOutlined, HighlightOutlined, ClearOutlined, FileImageOutlined, DownloadOutlined, CopyOutlined } from '@ant-design/icons-vue'

const imageDataUrl = ref('')
const color = ref('#1a1d21')
const lineWidth = ref(2)
const padKey = ref(0)
const ready = ref(false)
const frame = ref(null)
const size = reactive({ w: 420, h: 200 })
let ro

const colors = [
  { value: '#1a1d21', label: 'Black' },
  { value: '#2563eb', label: 'Blue' },
  { value: '#dc2626', label: 'Red' },
  { value: '#16a34a', label: 'Green' },
]
const ctx = computed(() => JSON.stringify({ lineWidth: lineWidth.value, strokeStyle: color.value, lineCap: 'round', lineJoin: 'round' }))
const kb = computed(() => Math.round((imageDataUrl.value.length * 3) / 4 / 1024))

const fit = () => {
  const w = Math.max(240, Math.min(900, Math.floor((frame.value?.clientWidth || 420) - 2)))
  size.w = w
  size.h = Math.round(w * 0.45)
  ready.value = true
}
const clear = () => { imageDataUrl.value = ''; padKey.value++ }
const copyUrl = async () => {
  try { await navigator.clipboard.writeText(imageDataUrl.value); message.success('Data URL copied') } catch { message.error('Clipboard not available') }
}
watch([color, lineWidth], () => { padKey.value++ })

onMounted(() => { fit(); ro = new ResizeObserver(fit); if (frame.value) ro.observe(frame.value) })
onBeforeUnmount(() => ro?.disconnect())
</script>

<style scoped>
.sig-grid { display: grid; gap: 1rem; grid-template-columns: minmax(0, 3fr) minmax(0, 2fr); }
@media (max-width: 1100px) { .sig-grid { grid-template-columns: 1fr; } }
.pad { position: relative; width: 100%; border: 1px dashed #c7cdd6; border-radius: 12px; overflow: hidden; background: #fff; line-height: 0; }
.pad vcxwc-sign-pad { --vcxwc-sign-pad-background-color: #fff; display: block; }
.pad__hint { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); pointer-events: none; color: #94a3b8; font-size: 0.9rem; line-height: 1.2; display: inline-flex; gap: 0.4rem; align-items: center; }
.toolbar { display: flex; flex-wrap: wrap; align-items: center; gap: 0.75rem 1.25rem; margin-top: 0.85rem; }
.toolbar__group { display: inline-flex; align-items: center; gap: 0.4rem; }
.toolbar__label { font-size: 0.78rem; color: var(--p-muted); text-transform: uppercase; letter-spacing: 0.06em; margin-right: 0.2rem; }
.toolbar__clear { margin-left: auto; }
.swatch { width: 1.6rem; height: 1.6rem; border-radius: 50%; border: 2px solid transparent; background: var(--swatch); cursor: pointer; padding: 0; box-shadow: inset 0 0 0 2px #fff; transition: transform 0.15s, border-color 0.15s; }
.swatch:hover { transform: scale(1.1); }
.swatch--on { border-color: var(--p-accent); transform: scale(1.1); }
.sig { border: 1px solid var(--p-border); border-radius: 12px; background: #fff; padding: 0.5rem; }
.sig img { max-width: 100%; display: block; }
</style>
