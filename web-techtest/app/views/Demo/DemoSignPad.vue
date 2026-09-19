<template>
  <div class="page">
    <header class="page__head">
      <div>
        <h1 class="page__title">Signature</h1>
        <p class="page__subtitle">The template's <code>&lt;vcxwc-sign-pad&gt;</code> custom element bound with <code>v-model</code>: draw, and the PNG data URL is available to the app immediately.</p>
      </div>
    </header>

    <div class="page__grid page__grid--wide">
      <div class="page__card">
        <h3 class="page__h3">Draw</h3>
        <div class="pad">
          <vcxwc-sign-pad :key="padKey" width="420" height="200" v-model="imageDataUrl" :context2d="ctx"></vcxwc-sign-pad>
        </div>
        <div class="page__actions" style="margin-top: 0.75rem">
          <a-button size="small" @click="clear">clear</a-button>
          <a-radio-group v-model:value="color" size="small" button-style="solid">
            <a-radio-button value="#1a1d21">black</a-radio-button>
            <a-radio-button value="#2563eb">blue</a-radio-button>
            <a-radio-button value="#dc2626">red</a-radio-button>
          </a-radio-group>
        </div>
      </div>

      <div class="page__card">
        <h3 class="page__h3">Result</h3>
        <div v-if="!imageDataUrl" class="page__muted">Nothing drawn yet.</div>
        <template v-else>
          <img :src="imageDataUrl" alt="signature" class="sig" />
          <div class="page__actions" style="margin-top: 0.75rem">
            <a :href="imageDataUrl" download="signature.png"><a-button size="small" type="primary">download PNG</a-button></a>
            <span class="page__muted">{{ Math.round((imageDataUrl.length * 3) / 4 / 1024) }} KB · {{ imageDataUrl.slice(0, 22) }}…</span>
          </div>
        </template>
        <p class="page__note">In a real form this data URL would be posted with the other fields, or converted to a Blob and uploaded.</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import '@es-labs/jslib/web/sign-pad'
import { ref, computed, watch } from 'vue'

const imageDataUrl = ref('')
const color = ref('#1a1d21')
const padKey = ref(0)
const ctx = computed(() => JSON.stringify({ lineWidth: 2, strokeStyle: color.value }))

const clear = () => { imageDataUrl.value = ''; padKey.value++ }
watch(color, () => { padKey.value++ })
</script>

<style scoped>
.pad { display: inline-block; border: 1px dashed #c7cdd6; border-radius: 12px; overflow: hidden; background: #fff; max-width: 100%; }
.pad vcxwc-sign-pad { --vcxwc-sign-pad-background-color: #fff; display: block; }
.sig { max-width: 100%; border: 1px solid #e3e6eb; border-radius: 10px; background: #fff; }
</style>
