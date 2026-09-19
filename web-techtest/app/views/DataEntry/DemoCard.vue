<template>
  <div class="page">
    <header class="page__head">
      <div>
        <h1 class="page__title">Cards</h1>
        <p class="page__subtitle">The template's card grid, with real content: every TaskPulse task as a card, and a form card that creates one.</p>
      </div>
      <a-segmented v-model:value="filter" :options="segments" size="small" />
    </header>

    <div class="cards">
      <a-card class="card card--form" :bordered="false">
        <template #title>New task</template>
        <a-form layout="vertical" @submit.prevent="create">
          <a-form-item label="Title"><a-input v-model:value="draft.title" placeholder="What needs doing?" :maxlength="200" /></a-form-item>
          <a-form-item label="Details"><a-textarea v-model:value="draft.description" :rows="3" :maxlength="2000" /></a-form-item>
          <a-button type="primary" html-type="submit" block :disabled="!draft.title.trim()" :loading="creating">Create</a-button>
        </a-form>
      </a-card>

      <a-card v-for="t in shown" :key="t.id" hoverable class="card" :bordered="false">
        <template #cover>
          <div class="card__cover" :data-status="t.status">
            <span class="card__id">#{{ t.id.slice(0, 8) }}</span>
            <a-tag :color="STATUS_COLOR[t.status]">{{ STATUS_LABEL[t.status] }}</a-tag>
          </div>
        </template>
        <template #actions>
          <a-tooltip :title="'Move to ' + STATUS_LABEL[NEXT_STATUS[t.status]]"><right-outlined @click="advance(t)" /></a-tooltip>
          <a-tooltip title="Edit title"><edit-outlined @click="rename(t)" /></a-tooltip>
          <a-popconfirm title="Delete this task?" ok-text="Delete" ok-type="danger" @confirm="remove(t)"><delete-outlined /></a-popconfirm>
        </template>
        <a-card-meta :title="t.title">
          <template #description>
            <div class="card__desc">{{ t.description || 'No details.' }}</div>
            <div class="page__muted" style="margin-top: 0.4rem">updated {{ timeAgo(t.updatedAt) }}</div>
          </template>
          <template #avatar><a-avatar :style="{ background: avatarColor(t) }">{{ t.title.slice(0, 1).toUpperCase() }}</a-avatar></template>
        </a-card-meta>
      </a-card>
    </div>
    <p v-if="!loading && !shown.length" class="page__note">No tasks in this filter.</p>
    <p class="page__note">{{ tasks.length }} tasks · <code>{{ api }}</code></p>
    <transition name="pop"><a-alert v-if="error" class="dash__alert" type="error" show-icon closable :message="error" @close="error = ''" /></transition>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { RightOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons-vue'
import { Modal, Input } from 'ant-design-vue'
import { h } from 'vue'
import { tasksApi, timeAgo, STATUSES, STATUS_LABEL, STATUS_COLOR, NEXT_STATUS } from '../../taskpulse.js'

const api = tasksApi.urls.api
const tasks = ref([])
const loading = ref(false)
const creating = ref(false)
const error = ref('')
const filter = ref('all')
const segments = [{ label: 'All', value: 'all' }, ...STATUSES.map((s) => ({ label: STATUS_LABEL[s], value: s }))]
const draft = reactive({ title: '', description: '' })

const shown = computed(() => (filter.value === 'all' ? tasks.value : tasks.value.filter((t) => t.status === filter.value)))
const avatarColor = (t) => `hsl(${[...t.id].reduce((a, c) => a + c.charCodeAt(0), 0) % 360} 60% 45%)`
const fail = (e) => { error.value = e?.message || String(e) }

const load = async () => {
  loading.value = true
  try {
    const res = await tasksApi.list({ pageSize: 100 })
    tasks.value = [...res.items].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
  } catch (e) { fail(e) } finally { loading.value = false }
}
const create = async () => {
  if (!draft.title.trim()) return
  creating.value = true
  try { await tasksApi.create({ title: draft.title, description: draft.description || null }); draft.title = ''; draft.description = ''; await load() } catch (e) { fail(e) } finally { creating.value = false }
}
const advance = async (t) => {
  try { await tasksApi.update(t.id, { title: t.title, description: t.description, status: NEXT_STATUS[t.status] }); await load() } catch (e) { fail(e) }
}
const remove = async (t) => {
  try { await tasksApi.remove(t.id); await load() } catch (e) { fail(e) }
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
</script>

<style scoped>
.cards { display: grid; gap: 1rem; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); }
.card { border-radius: 14px; overflow: hidden; }
.card--form :deep(.ant-card-body) { padding-top: 0.5rem; }
.card__cover { display: flex; justify-content: space-between; align-items: center; padding: 0.75rem 1rem; background: linear-gradient(135deg, #e0e7ff, #dbeafe); }
.card__cover[data-status="InProgress"] { background: linear-gradient(135deg, #dbeafe, #bfdbfe); }
.card__cover[data-status="Done"] { background: linear-gradient(135deg, #dcfce7, #bbf7d0); }
.card__id { font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 0.75rem; color: #475569; }
.card__desc { white-space: pre-line; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
:root[data-theme="dark"] .card__cover { background: linear-gradient(135deg, #1e293b, #1e3a5f); }
:root[data-theme="dark"] .card__cover[data-status="Done"] { background: linear-gradient(135deg, #14532d, #166534); }
:root[data-theme="dark"] .card__id { color: #cbd5e1; }
</style>
