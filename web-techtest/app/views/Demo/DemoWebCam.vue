<template>
  <div class="page">
    <header class="page__head">
      <div>
        <h1 class="page__title">Camera</h1>
        <p class="page__subtitle">The template's <code>&lt;vcxwc-web-cam&gt;</code> custom element. Start the camera, take a photo, keep it — everything stays in your browser.</p>
      </div>
    </header>

    <div class="page__grid page__grid--wide">
      <div class="page__card">
        <h3 class="page__h3">Live</h3>
        <vcxwc-web-cam class="cam" @snap="onSnap" width="480" height="360">
          <button slot="button-unsnap" class="cam__btn">Start camera</button>
          <button slot="button-snap" class="cam__btn cam__btn--primary">Take photo</button>
        </vcxwc-web-cam>
        <p class="page__note">The browser asks for permission the first time. Nothing is uploaded.</p>
      </div>

      <div class="page__card">
        <h3 class="page__h3">Photos <span class="page__muted">({{ shots.length }})</span></h3>
        <div v-if="!shots.length" class="page__muted">No photo yet.</div>
        <div class="shots">
          <figure v-for="(s, i) in shots" :key="s.at" class="shot">
            <img :src="s.src" alt="" />
            <figcaption class="page__actions">
              <span class="page__muted">{{ new Date(s.at).toLocaleTimeString() }} · {{ s.kb }} KB</span>
              <a :href="s.src" :download="`photo-${i + 1}.png`"><a-button size="small">download</a-button></a>
              <a-button size="small" danger @click="shots.splice(i, 1)">remove</a-button>
            </figcaption>
          </figure>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import '@es-labs/jslib/web/web-cam'
import { ref } from 'vue'

const shots = ref([])

const onSnap = (e) => {
  const src = typeof e.detail === 'string' ? e.detail : e.detail?.dataUrl || e.detail?.src || ''
  if (!src) return
  shots.value.unshift({ src, at: Date.now(), kb: Math.round((src.length * 3) / 4 / 1024) })
}
</script>

<style scoped>
.cam { display: block; --vcxwc-web-cam-top: 4%; --vcxwc-web-cam-right: 4%; max-width: 100%; }
.cam__btn { appearance: none; border: 1px solid #e3e6eb; background: #fff; color: #1a1d21; border-radius: 8px; padding: 0.35rem 0.8rem; font: inherit; cursor: pointer; margin: 0.25rem; }
.cam__btn--primary { background: #2563eb; border-color: #2563eb; color: #fff; }
.shots { display: grid; gap: 0.75rem; }
.shot { margin: 0; }
.shot img { width: 100%; border-radius: 10px; display: block; }
.shot figcaption { margin-top: 0.4rem; }
</style>
