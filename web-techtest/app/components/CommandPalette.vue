<template>
  <a-modal :open="paletteOpen" :footer="null" :closable="false" :width="560" wrap-class-name="palette__wrap" :body-style="{ padding: 0 }" destroy-on-close @cancel="paletteOpen = false">
    <div class="palette" data-cy="palette" role="dialog" aria-label="Command palette">
      <input ref="box" v-model="query" class="palette__input" type="text" placeholder="Type a page or an action…" aria-label="Search commands" data-cy="palette-input" autocomplete="off" spellcheck="false" @keydown="onKey" />
      <ul class="palette__list" role="listbox" aria-label="Commands">
        <li v-for="(c, i) in results" :key="c._id" class="palette__item" :class="{ 'palette__item--on': i === index }" role="option" :aria-selected="i === index" :data-cy="'cmd-' + c.id" @mousemove="index = i" @click="run(c)">
          <span class="palette__icon" aria-hidden="true"><component :is="c.icon || RightOutlined" /></span>
          <span class="palette__title">{{ c.title }}</span>
          <span v-if="c.hint" class="palette__hint">{{ c.hint }}</span>
          <kbd v-if="c.keys" class="palette__keys">{{ keyLabel(c.keys) }}</kbd>
        </li>
        <li v-if="!results.length" class="palette__empty">Nothing matches “{{ query }}”</li>
      </ul>
      <div class="palette__foot"><kbd>↑</kbd><kbd>↓</kbd> move · <kbd>Enter</kbd> run · <kbd>Esc</kbd> close · <kbd>?</kbd> all shortcuts</div>
    </div>
  </a-modal>

  <a-modal :open="helpOpen" :footer="null" title="Keyboard shortcuts" :width="460" @cancel="helpOpen = false">
    <ul class="help" data-cy="shortcut-help">
      <li><kbd>{{ keyLabel(['mod+k']) }}</kbd><span>Command palette</span></li>
      <li v-for="c in withKeys" :key="c._id"><kbd>{{ keyLabel(c.keys) }}</kbd><span>{{ c.title }}</span></li>
      <li><kbd>?</kbd><span>This list</span></li>
    </ul>
  </a-modal>
</template>

<script setup>
// The command palette and the shortcut help sheet. Commands come from the registry in shortcuts.js; running one
// closes the palette first, so a command that focuses a field is not fighting the modal for focus.
import { ref, computed, watch, nextTick } from 'vue'
import { RightOutlined } from '@ant-design/icons-vue'
import { paletteOpen, helpOpen, allCommands, matchCommands, keyLabel } from '../shortcuts.js'

const props = defineProps({ run: { type: Function, required: true } })
const query = ref('')
const index = ref(0)
const box = ref(null)
const results = computed(() => matchCommands(query.value, allCommands()).slice(0, 12))
const withKeys = computed(() => allCommands().filter((c) => c.keys))
watch(query, () => { index.value = 0 })
watch(paletteOpen, async (open) => { if (open) { query.value = ''; index.value = 0; await nextTick(); setTimeout(() => box.value?.focus(), 50) } })

const run = async (c) => { paletteOpen.value = false; await nextTick(); props.run(c) }
const onKey = (e) => {
  if (e.key === 'ArrowDown') { e.preventDefault(); index.value = Math.min(results.value.length - 1, index.value + 1) }
  else if (e.key === 'ArrowUp') { e.preventDefault(); index.value = Math.max(0, index.value - 1) }
  else if (e.key === 'Enter') { e.preventDefault(); const c = results.value[index.value]; if (c) run(c) }
  else if (e.key === 'Escape') { paletteOpen.value = false }
}
</script>

<style scoped>
.palette { display: grid; }
.palette__input { width: 100%; border: 0; border-bottom: 1px solid var(--p-border, rgba(128, 128, 128, 0.25)); background: transparent; color: inherit; font: inherit; font-size: 1.05rem; padding: 0.9rem 1rem; outline: none; }
.palette__list { list-style: none; margin: 0; padding: 0.35rem; max-height: 50vh; overflow: auto; }
.palette__item { display: grid; grid-template-columns: auto minmax(0, 1fr) auto auto; gap: 0.6rem; align-items: center; padding: 0.5rem 0.7rem; border-radius: 8px; cursor: pointer; }
.palette__item--on { background: rgba(22, 119, 255, 0.12); }
.palette__icon { opacity: 0.7; display: inline-flex; }
.palette__title { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.palette__hint { font-size: 0.78rem; opacity: 0.6; }
.palette__keys, .palette__foot kbd, .help kbd { font: 0.72rem ui-monospace, SFMono-Regular, Menlo, monospace; border: 1px solid rgba(128, 128, 128, 0.4); border-bottom-width: 2px; border-radius: 5px; padding: 0.05rem 0.4rem; opacity: 0.85; }
.palette__empty { padding: 0.8rem; opacity: 0.6; }
.palette__foot { font-size: 0.75rem; opacity: 0.65; padding: 0.5rem 0.9rem; border-top: 1px solid rgba(128, 128, 128, 0.2); display: flex; gap: 0.3rem; align-items: center; flex-wrap: wrap; }
.help { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.45rem; }
.help li { display: grid; grid-template-columns: 6rem 1fr; gap: 0.6rem; align-items: center; }
</style>
