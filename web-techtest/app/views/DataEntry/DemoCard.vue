<template>
  <div class="page">
    <header class="page__head">
      <div>
        <h1 class="page__title">Cards</h1>
        <p class="page__subtitle">The template's card grid, with real content: every TaskPulse task as a card on a three-column board. Drag a card to another column, or use its buttons.</p>
      </div>
      <div class="page__actions">
        <a-input v-model:value="search" placeholder="Search cards…" allow-clear size="small" class="board-search" data-cy="search"><template #prefix><SearchOutlined class="in-icon" /></template></a-input>
        <a-tag class="pill" :color="loading ? 'processing' : 'success'"><AppstoreOutlined />{{ loading ? 'loading' : `${tasks.length} tasks` }}</a-tag>
        <a-button size="small" @click="load" :loading="loading"><template #icon><ReloadOutlined /></template></a-button>
      </div>
    </header>

    <div class="page__card">
      <div class="sec">
        <span class="sec__icon"><PlusOutlined /></span>
        <h3 class="sec__title">New task</h3>
      </div>
      <form class="new-task" @submit.prevent="create">
        <a-input v-model:value="draft.title" placeholder="What needs doing?" :maxlength="200" size="large"><template #prefix><EditOutlined class="in-icon" /></template></a-input>
        <a-input v-model:value="draft.description" placeholder="Details (optional)" :maxlength="2000" size="large"><template #prefix><AlignLeftOutlined class="in-icon" /></template></a-input>
        <a-button type="primary" size="large" html-type="submit" :disabled="!draft.title.trim()" :loading="creating"><template #icon><PlusOutlined /></template>Create</a-button>
      </form>
    </div>


    <div class="board">
      <section v-for="s in STATUSES" :key="s" class="column" :data-status="s" :class="{ 'column--over': dragOver === s }" @dragover.prevent="dragOver = s" @dragleave="dragOver = dragOver === s ? '' : dragOver" @drop.prevent="onDrop(s)">
        <div class="column__head">
          <span class="card__mark" :data-status="s"><CheckOutlined v-if="s === 'Done'" /><ClockCircleOutlined v-else-if="s === 'InProgress'" /><BorderOutlined v-else /></span>
          <h3 class="column__title">{{ STATUS_LABEL[s] }}</h3>
          <span class="sec__count">{{ byStatus[s].length }}</span>
        </div>
        <div v-if="!loading && !byStatus[s].length" class="empty column__empty"><InboxOutlined class="empty__icon" /><span>{{ appliedSearch ? 'No match' : `Nothing ${STATUS_LABEL[s].toLowerCase()}` }}</span><span class="empty__hint">{{ appliedSearch ? `for “${appliedSearch}”` : 'Drop a card here.' }}</span></div>
        <article v-for="t in byStatus[s]" :key="t.id" class="card" :data-status="t.status" draggable="true" :class="{ 'card--dragging': dragging === t.id }" @dragstart="onDragStart(t)" @dragend="dragging = ''; dragOver = ''">
          <h3 class="card__title" :class="{ 'card__title--done': t.status === 'Done' }" :title="t.title">{{ t.title }}</h3>
          <p class="card__desc" :class="{ 'card__desc--none': !t.description }">{{ t.description || 'No details' }}</p>
          <div class="card__meta">
            <span><HistoryOutlined /> {{ timeAgo(t.updatedAt) }}</span>
            <code>#{{ t.id.slice(0, 8) }}</code>
          </div>
          <div class="card__actions">
            <a-tooltip v-if="t.status !== 'Todo'" title="Move left"><a-button size="small" type="text" class="card__btn" @click="setStatus(t, PREV_STATUS[t.status])"><template #icon><ArrowLeftOutlined /></template></a-button></a-tooltip>
            <a-tooltip title="Edit title"><a-button size="small" type="text" class="card__btn" @click="rename(t)"><template #icon><EditOutlined /></template></a-button></a-tooltip>
            <a-popconfirm title="Delete this task?" ok-text="Delete" ok-type="danger" @confirm="remove(t)"><a-button size="small" type="text" danger class="card__btn"><template #icon><DeleteOutlined /></template></a-button></a-popconfirm>
            <a-tooltip v-if="t.status !== 'Done'" :title="'Move to ' + STATUS_LABEL[NEXT_STATUS[t.status]]"><a-button size="small" type="text" class="card__btn card__btn--next" @click="setStatus(t, NEXT_STATUS[t.status])">{{ STATUS_LABEL[NEXT_STATUS[t.status]] }}<template #icon><ArrowRightOutlined /></template></a-button></a-tooltip>
          </div>
        </article>
      </section>
    </div>
    <transition name="pop"><a-alert v-if="error" class="dash__alert" type="error" show-icon closable :message="error" @close="error = ''" /></transition>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { ArrowRightOutlined, ArrowLeftOutlined, EditOutlined, DeleteOutlined, AppstoreOutlined, ReloadOutlined, PlusOutlined, AlignLeftOutlined, InboxOutlined, CheckOutlined, ClockCircleOutlined, BorderOutlined, HistoryOutlined, SearchOutlined } from '@ant-design/icons-vue'
import { Modal, Input } from 'ant-design-vue'
import { h } from 'vue'
import { tasksApi, timeAgo, STATUSES, STATUS_LABEL, NEXT_STATUS, useChangeFeed } from '../../taskpulse.js'

const api = tasksApi.urls.api
const tasks = ref([])
const loading = ref(false)
const creating = ref(false)
const error = ref('')
const search = ref('')
const appliedSearch = ref('')
let searchTimer = null
watch(search, () => { clearTimeout(searchTimer); searchTimer = setTimeout(() => { appliedSearch.value = search.value.trim(); load() }, 350) })
const draft = reactive({ title: '', description: '' })

const PREV_STATUS = { InProgress: 'Todo', Done: 'InProgress' }
const byStatus = computed(() => Object.fromEntries(STATUSES.map((s) => [s, tasks.value.filter((t) => t.status === s)])))
const dragging = ref('')
const dragOver = ref('')
const onDragStart = (t) => { dragging.value = t.id }
const onDrop = async (status) => {
  const t = tasks.value.find((x) => x.id === dragging.value)
  dragging.value = ''; dragOver.value = ''
  if (t && t.status !== status) await setStatus(t, status)
}

const fail = (e) => { error.value = e?.message || String(e) }

const load = async () => {
  loading.value = true
  try {
    const res = await tasksApi.list({ pageSize: 100, q: appliedSearch.value })
    tasks.value = [...res.items].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
  } catch (e) { fail(e) } finally { loading.value = false }
}
const create = async () => {
  if (!draft.title.trim()) return
  creating.value = true
  try { await tasksApi.create({ title: draft.title, description: draft.description || null }); draft.title = ''; draft.description = ''; await load() } catch (e) { fail(e) } finally { creating.value = false }
}
// Optimistic: the card moves (or disappears) immediately; the server response is merged in, a failure rolls back.
const setStatus = async (t, status) => {
  if (status === t.status) return
  const previous = t.status
  t.status = status; t.updatedAt = new Date().toISOString()
  try { Object.assign(t, await tasksApi.update(t.id, { title: t.title, description: t.description, status })) } catch (e) { t.status = previous; fail(e); await load() }
}
const remove = async (t) => {
  const snapshot = tasks.value.slice()
  tasks.value = tasks.value.filter((x) => x.id !== t.id)
  try { await tasksApi.remove(t.id) } catch (e) { tasks.value = snapshot; fail(e); await load() }
}
const rename = (t) => {
  let value = t.title
  Modal.confirm({
    title: 'Edit title',
    content: () => h(Input, { defaultValue: value, maxlength: 200, onChange: (e) => { value = e.target.value } }),
    okText: 'Save',
    onOk: async () => {
      if (!value.trim() || value === t.title) return
      try { await tasksApi.update(t.id, { title: value.trim(), description: t.description, status: t.status }); await load() } catch (e) { fail(e) }
    },
  })
}

onMounted(load)
useChangeFeed(() => load(), { resources: ['task'] })
</script>

<style scoped>
.new-task { display: grid; grid-template-columns: 1.2fr 1.6fr auto; gap: 0.5rem; }
@media (max-width: 720px) { .new-task { grid-template-columns: 1fr; } }
.in-icon { color: var(--p-muted); }
.board-search { width: 14rem; }
.cards { display: grid; gap: 1rem; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); margin-top: 1rem; }
.card { display: flex; flex-direction: column; gap: 0.5rem; padding: 0.9rem 1rem 0.6rem; border-radius: 14px; background: var(--p-card); border: 1px solid var(--p-border); border-top: 4px solid #94a3b8; box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04); transition: transform 0.2s, box-shadow 0.2s; }
.card:hover { transform: translateY(-2px); box-shadow: 0 10px 30px rgba(15, 23, 42, 0.08); }
.card[data-status="InProgress"] { border-top-color: #3b82f6; }
.card[data-status="Done"] { border-top-color: #16a34a; }
.card__top { display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; }
.card__mark { width: 1.7rem; height: 1.7rem; border-radius: 8px; display: grid; place-items: center; font-size: 0.85rem; background: rgba(148, 163, 184, 0.2); color: #64748b; }
.card__mark[data-status="InProgress"] { background: rgba(59, 130, 246, 0.15); color: #3b82f6; }
.card__mark[data-status="Done"] { background: rgba(22, 163, 74, 0.15); color: #16a34a; }
.card__status { width: 8.5rem; background: var(--p-bg); border-radius: 8px; }
.card__title { margin: 0; font-size: 1rem; font-weight: 600; line-height: 1.3; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.card__title--done { text-decoration: line-through; color: var(--p-muted); font-weight: 500; }
.card__desc { margin: 0; font-size: 0.85rem; color: var(--p-muted); white-space: pre-line; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; flex: 1; }
.card__desc--none { font-style: italic; opacity: 0.7; }
.card__meta { display: flex; justify-content: space-between; align-items: center; font-size: 0.78rem; color: var(--p-muted); }
.card__meta code { font-family: ui-monospace, Menlo, Consolas, monospace; }
.card__actions { display: flex; align-items: center; gap: 0.15rem; border-top: 1px solid var(--p-border); margin: 0.2rem -1rem 0; padding: 0.35rem 0.6rem 0; }
.card__actions .card__btn:first-child { margin-right: auto; }
.card__btn { color: var(--p-muted); }
.card__btn:hover { color: var(--p-accent); }
</style>
<style scoped>
.board { display: grid; gap: 1rem; grid-template-columns: repeat(3, minmax(0, 1fr)); margin-top: 1rem; align-items: start; }
@media (max-width: 1000px) { .board { grid-template-columns: 1fr; } }
.column { display: grid; gap: 0.75rem; padding: 0.75rem; border-radius: 16px; background: color-mix(in srgb, var(--p-border) 35%, transparent); border: 2px solid transparent; min-height: 12rem; transition: border-color 0.15s, background 0.15s; }
.column--over { border-color: var(--p-accent); background: color-mix(in srgb, var(--p-accent) 8%, transparent); }
.column__head { display: flex; align-items: center; gap: 0.6rem; padding: 0.25rem 0.25rem 0; }
.column__title { margin: 0; font-size: 0.95rem; font-weight: 600; flex: 1; }
.column__empty { background: var(--p-card); }
.card { cursor: grab; }
.card--dragging { opacity: 0.4; }
.card__btn--next { margin-left: auto; }
.card__actions .card__btn:first-child { margin-right: 0; }
</style>
