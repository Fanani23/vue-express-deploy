<template>
  <a-drawer :open="open" :title="title" placement="right" :width="420" @close="$emit('close')">
    <div data-cy="history">
      <a-alert v-if="error" type="error" show-icon :message="error" class="history__alert" />
      <a-skeleton v-else-if="loading" active :paragraph="{ rows: 4 }" />
      <p v-else-if="!rows.length" class="page__muted">No changes recorded yet.</p>
      <a-timeline v-else class="history">
        <a-timeline-item v-for="r in rows" :key="r.id" :color="COLOR[r.action] || 'gray'">
          <div class="history__head">
            <strong class="history__action">{{ WORD[r.action] || r.action }}</strong>
            <span v-if="showTarget" class="history__target">{{ r.targetId }}</span>
            <span class="page__muted history__who">{{ r.actor || 'someone' }} · <time :datetime="r.at" :title="new Date(r.at).toLocaleString()">{{ timeAgo(r.at) }}</time></span>
          </div>
          <div v-if="!r.changes" class="page__muted history__summary">{{ r.summary }}</div>
          <ul v-else class="history__changes">
            <li v-for="(c, field) in r.changes" :key="field">
              <span class="history__field">{{ field }}</span>
              <span class="history__from">{{ show(c.from) }}</span>
              <span class="history__arrow" aria-hidden="true">→</span>
              <span class="history__to">{{ show(c.to) }}</span>
            </li>
          </ul>
        </a-timeline-item>
    </a-timeline>
    </div>
  </a-drawer>
</template>

<script setup>
// Who changed what on one record (or one catalog kind): the audit rows behind it, with the per-field diff every
// update carries. `loader` returns the rows; it runs each time the drawer opens.
import { ref, watch } from 'vue'
import { timeAgo } from '../taskpulse.js'

const props = defineProps({ open: Boolean, title: String, loader: Function, showTarget: Boolean })
defineEmits(['close'])

const WORD = { create: 'Created', update: 'Updated', move: 'Moved', delete: 'Deleted', restore: 'Restored', purge: 'Purged', import: 'Imported', schema: 'Schema' }
const COLOR = { create: 'green', update: 'blue', move: 'blue', delete: 'red', purge: 'red', restore: 'green', import: 'purple' }
const rows = ref([])
const loading = ref(false)
const error = ref('')
const show = (v) => (v == null || v === '' ? '—' : Array.isArray(v) ? (v.length ? v.join(', ') : '—') : typeof v === 'object' ? JSON.stringify(v) : String(v))

watch(() => props.open, async (open) => {
  if (!open) return
  loading.value = true; error.value = ''
  try { rows.value = await props.loader() } catch (e) { error.value = e?.message || String(e); rows.value = [] } finally { loading.value = false }
}, { immediate: true })
</script>

<style scoped>
.history { margin-top: 0.4rem; }
.history__head { display: flex; flex-wrap: wrap; gap: 0.4rem 0.5rem; align-items: baseline; }
.history__target { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 0.78rem; opacity: 0.8; }
.history__who { font-size: 0.78rem; }
.history__summary { font-size: 0.82rem; margin-top: 0.15rem; }
.history__changes { list-style: none; margin: 0.25rem 0 0; padding: 0; display: grid; gap: 0.15rem; font-size: 0.8rem; }
.history__changes li { display: grid; grid-template-columns: auto minmax(0, 1fr) auto minmax(0, 1fr); gap: 0.35rem; align-items: baseline; }
.history__field { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; opacity: 0.75; }
.history__from { text-decoration: line-through; opacity: 0.65; overflow-wrap: anywhere; }
.history__to { font-weight: 600; overflow-wrap: anywhere; }
.history__arrow { opacity: 0.5; }
.history__alert { margin-bottom: 0.6rem; }
</style>
