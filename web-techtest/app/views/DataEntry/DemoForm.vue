<template>
  <div class="page">
    <header class="page__head">
      <div>
        <h1 class="page__title">Forms</h1>
        <p class="page__subtitle">The template's Ant Design form samples, each wired to a real endpoint: files go to <code>/api/uploads</code>, the big form creates <code>sites</code> records, its options come from the catalog, and the transfer list persists which <code>tags</code> are chosen.</p>
      </div>
      <a-tag class="pill" :color="error ? 'error' : 'blue'"><FormOutlined />{{ error ? 'API error' : `store counter ${storeCounter}` }}</a-tag>
    </header>

    <transition name="pop"><a-alert v-if="error" type="error" show-icon closable :message="error" class="alert" @close="error = ''" /></transition>

    <div class="form-grid">
      <div class="page__card">
        <div class="sec">
          <span class="sec__icon"><CloudUploadOutlined /></span>
          <h3 class="sec__title">Files + JSON in one request</h3>
          <span class="sec__count">{{ form1.files.length }} file{{ form1.files.length === 1 ? '' : 's' }}</span>
        </div>
        <a-form layout="vertical">
          <a-upload-dragger :file-list="form1.files" :before-upload="beforeUpload" :multiple="true" accept="image/png,image/jpeg,image/webp,application/pdf,text/plain" @remove="handleRemove">
            <p class="ant-upload-drag-icon"><inbox-outlined /></p>
            <p class="ant-upload-text">Click or drag files here</p>
            <p class="ant-upload-hint">png, jpeg, webp, pdf or txt, up to 2 MB each — the server checks the bytes, not just the extension.</p>
          </a-upload-dragger>
          <div class="two" style="margin-top: 1rem">
            <a-form-item label="Text"><a-input v-model:value="form1.text"><template #prefix><FontSizeOutlined class="in-icon" /></template></a-input></a-form-item>
            <a-form-item label="Number"><a-input-number v-model:value="form1.number" style="width: 100%" /></a-form-item>
          </div>
          <a-button type="primary" :disabled="!form1.files.length" :loading="uploading" @click="onSubmit1"><template #icon><CloudUploadOutlined /></template>Upload to /api/uploads</a-button>
        </a-form>
        <div class="sec" style="margin-top: 1rem">
          <span class="sec__icon"><FileZipOutlined /></span>
          <h3 class="sec__title">Uploaded from this form</h3>
          <span class="sec__count">{{ uploads.length }}</span>
        </div>
        <div v-if="!uploads.length" class="empty"><FileZipOutlined class="empty__icon" /><span>Nothing uploaded yet</span><span class="empty__hint">Files land in /var/lib/taskpulse/uploads; only the metadata is in PostgreSQL.</span></div>
        <ul v-else class="files">
          <li v-for="u in uploads" :key="u.id" class="file">
            <span class="file__icon"><FileImageOutlined v-if="u.contentType.startsWith('image/')" /><FilePdfOutlined v-else-if="u.contentType === 'application/pdf'" /><FileTextOutlined v-else /></span>
            <span class="file__body">
              <a :href="uploadsApi.contentUrl(u.id)" target="_blank" rel="noopener" class="file__name">{{ u.fileName }}</a>
              <span class="page__muted">{{ formatBytes(u.size) }} · {{ u.contentType }} · {{ timeAgo(u.createdAt) }}<template v-if="u.note"> · {{ u.note }}</template></span>
            </span>
            <a-popconfirm title="Delete this upload?" ok-text="Delete" ok-type="danger" @confirm="removeUpload(u)"><a-button size="small" type="text" danger><template #icon><DeleteOutlined /></template></a-button></a-popconfirm>
          </li>
        </ul>
      </div>

      <div class="page__card">
        <div class="sec">
          <span class="sec__icon"><FormOutlined /></span>
          <h3 class="sec__title">Every input type</h3>
          <span class="sec__count">{{ editing ? 'editing ' + editing : 'new site' }}</span>
        </div>
        <a-form :model="formState" layout="vertical">
          <a-form-item label="Rating">
            <a-row :gutter="8" align="middle"><a-col :span="18"><a-slider :min="1" :max="20" v-model:value="formState.rating" /></a-col><a-col :span="6"><a-input-number v-model:value="formState.rating" :min="1" :max="20" style="width: 100%" /></a-col></a-row>
          </a-form-item>
          <div class="two">
            <a-form-item label="Activity name" required><a-input v-model:value="formState.name" data-cy="site-name"><template #prefix><TagOutlined class="in-icon" /></template></a-input></a-form-item>
            <a-form-item label="Zone (catalog: regions)"><a-select v-model:value="formState.region" placeholder="please select your zone" :options="regions.map((r) => ({ value: r.code, label: r.label }))" data-cy="site-region" /></a-form-item>
            <a-form-item label="Date"><a-input v-model:value="formState.date" type="date" style="width: 100%" /></a-form-item>
            <a-form-item label="Instant delivery"><a-switch v-model:checked="formState.delivery" /></a-form-item>
            <a-form-item label="Type (catalog: types)"><a-checkbox-group v-model:value="formState.type" :options="types.map((t) => ({ label: t.label, value: t.code }))" /></a-form-item>
            <a-form-item label="Resources (catalog: resources)"><a-radio-group v-model:value="formState.resource"><a-radio v-for="r in resources" :key="r.code" :value="r.code">{{ r.label }}</a-radio></a-radio-group></a-form-item>
          </div>
          <a-form-item label="Description"><a-textarea v-model:value="formState.desc" :rows="2" /></a-form-item>
          <a-form-item label="Store counter (Pinia, client only)"><a-input-number v-model:value="storeCounter" style="width: 100%" /></a-form-item>
          <a-space>
            <a-button type="primary" :disabled="!formState.name.trim()" :loading="savingSite" @click="onSubmit" data-cy="site-submit"><template #icon><SendOutlined /></template>{{ editing ? 'Save changes' : 'Create site' }}</a-button>
            <a-button @click="reset"><template #icon><ClearOutlined /></template>{{ editing ? 'Cancel' : 'Reset' }}</a-button>
          </a-space>
        </a-form>
        <div class="sec" style="margin-top: 1rem">
          <span class="sec__icon"><DatabaseOutlined /></span>
          <h3 class="sec__title">Saved sites</h3>
          <span class="sec__count">{{ sites.length }}</span>
        </div>
        <div v-if="!sites.length" class="empty"><DatabaseOutlined class="empty__icon" /><span>No sites yet</span><span class="empty__hint">Submit the form — it becomes a catalog/sites record.</span></div>
        <ul v-else class="files">
          <li v-for="s in sites" :key="s.code" class="file" :data-cy="'site-' + s.code">
            <span class="file__icon"><TagOutlined /></span>
            <span class="file__body">
              <strong class="file__name">{{ s.label }}</strong>
              <span class="page__muted">{{ labelOf(regions, s.attributes?.region) || 'no zone' }} · {{ (s.attributes?.type || []).map((c) => labelOf(types, c)).join(', ') || 'no type' }} · {{ labelOf(resources, s.attributes?.resource) || 'no resource' }} · rating {{ s.attributes?.rating ?? '—' }}</span>
            </span>
            <span class="file__tools">
              <a-tooltip title="Edit"><a-button size="small" type="text" @click="editSite(s)"><template #icon><EditOutlined /></template></a-button></a-tooltip>
              <a-popconfirm :title="`Delete ${s.label}?`" ok-text="Delete" ok-type="danger" @confirm="removeSite(s)"><a-button size="small" type="text" danger><template #icon><DeleteOutlined /></template></a-button></a-popconfirm>
            </span>
          </li>
        </ul>
      </div>

      <div class="page__card card--wide">
        <div class="sec">
          <span class="sec__icon"><SwapOutlined /></span>
          <h3 class="sec__title">Transfer list (catalog: tags)</h3>
          <span class="sec__count">{{ targetKeys.length }} / {{ tags.length }} chosen</span>
          <form class="add-tag" @submit.prevent="addTag">
            <a-input v-model:value="newTag" placeholder="New tag" :maxlength="120" size="small" data-cy="new-tag" />
            <a-button size="small" html-type="submit" :disabled="!newTag.trim()" :loading="busy.tag"><template #icon><PlusOutlined /></template>Add</a-button>
          </form>
        </div>
        <a-transfer :data-source="tagData" show-search :list-style="{ height: '300px' }" :operations="['to right', 'to left']" :target-keys="targetKeys" :render="(item) => item.title" :titles="['available', 'chosen']" @change="onTransfer" class="transfer">
          <template #notFoundContent><div class="empty"><InboxOutlined class="empty__icon" /><span>Nothing here</span></div></template>
        </a-transfer>
        <p class="page__note">Moving an item writes <code>attributes.selected</code> on that tag with a <code>PUT</code>, so the split survives a reload and is the same for every user.</p>
      </div>

      <div class="page__card">
        <div class="sec">
          <span class="sec__icon"><ThunderboltOutlined /></span>
          <h3 class="sec__title">WebSocket round-trip</h3>
          <span class="sec__count">{{ ws.isOpen.value ? 'open · TaskPulse echo' : ws.state.value }}</span>
        </div>
        <form class="ws-send" @submit.prevent="onWsMsg">
          <a-input v-model:value="wsMsg" placeholder="Message to echo back" :disabled="!ws.isOpen.value"><template #prefix><MessageOutlined class="in-icon" /></template></a-input>
          <a-button type="primary" html-type="submit" :disabled="!ws.isOpen.value || !wsMsg"><template #icon><SendOutlined /></template>Send</a-button>
        </form>
        <ul v-if="ws.events.value.length" class="log" style="margin-top: 0.75rem"><li v-for="(e, i) in ws.events.value.slice(0, 6)" :key="i"><span class="log__t">{{ e.at.toLocaleTimeString() }}</span>{{ e.text }}</li></ul>
        <div v-else class="empty" style="margin-top: 0.75rem"><ThunderboltOutlined class="empty__icon" /><span>No messages yet</span></div>
      </div>

      <div class="page__card">
        <div class="sec">
          <span class="sec__icon"><WarningOutlined /></span>
          <h3 class="sec__title">Error routes</h3>
        </div>
        <a-space wrap>
          <a-button @click="router.push('/forbidden')"><template #icon><StopOutlined /></template>Forbidden</a-button>
          <a-button @click="router.push('/this-route-does-not-exist')"><template #icon><QuestionCircleOutlined /></template>Not Found</a-button>
        </a-space>
        <p class="page__note">Both render the template's shared error views inside the same layout.</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import { InboxOutlined, FormOutlined, CloudUploadOutlined, FontSizeOutlined, FileZipOutlined, FileImageOutlined, FilePdfOutlined, FileTextOutlined, TagOutlined, SendOutlined, ClearOutlined, SwapOutlined, ThunderboltOutlined, MessageOutlined, WarningOutlined, StopOutlined, QuestionCircleOutlined, DeleteOutlined, EditOutlined, DatabaseOutlined, PlusOutlined } from '@ant-design/icons-vue'
import { useAppStore } from '../../store.js'
import { useTaskPulseSocket, useChangeFeed, catalogApi, uploadsApi, formatBytes, timeAgo } from '../../taskpulse.js'

const appStore = useAppStore()
const router = useRouter()
const error = ref('')
const fail = (e) => { error.value = e?.message || String(e) }
const labelOf = (list, code) => list.find((x) => x.code === code)?.label

const form1 = reactive({ files: [], text: 'abcd', number: 3 })
const uploads = ref([])
const uploading = ref(false)
const beforeUpload = (file) => {
  if (!form1.files.find((f) => f.name === file.name)) form1.files = [...form1.files, file]
  return false
}
const handleRemove = (file) => { form1.files = form1.files.filter((f) => f.uid !== file.uid) }
const loadUploads = async () => { try { uploads.value = await uploadsApi.list('form') } catch (e) { fail(e) } }
const onSubmit1 = async () => {
  if (!form1.files.length) return
  uploading.value = true
  try {
    const items = await uploadsApi.create({ files: form1.files, source: 'form', note: JSON.stringify({ text: form1.text, number: form1.number }) })
    form1.files = []
    message.success(`${items.length} file${items.length === 1 ? '' : 's'} stored`)
    await loadUploads()
  } catch (e) { fail(e) } finally { uploading.value = false }
}
const removeUpload = async (u) => { try { await uploadsApi.remove(u.id); await loadUploads() } catch (e) { fail(e) } }

const regions = ref([])
const types = ref([])
const resources = ref([])
const sites = ref([])
const editing = ref('')
const savingSite = ref(false)
const blank = () => ({ name: '', region: undefined, type: [], resource: '', desc: '', rating: 5, date: '', delivery: false })
const formState = reactive(blank())
const reset = () => { Object.assign(formState, blank()); editing.value = '' }
const loadOptions = async () => {
  try {
    const [r, t, res, s] = await Promise.all([catalogApi.list('regions'), catalogApi.list('types'), catalogApi.list('resources'), catalogApi.list('sites')])
    regions.value = r; types.value = t; resources.value = res; sites.value = s
  } catch (e) { fail(e) }
}
const loadSites = async () => { try { sites.value = await catalogApi.list('sites') } catch (e) { fail(e) } }
const onSubmit = async () => {
  if (!formState.name.trim()) return
  savingSite.value = true
  const body = { label: formState.name.trim(), attributes: { region: formState.region || null, type: [...formState.type], resource: formState.resource || null, desc: formState.desc, rating: formState.rating, date: formState.date || null, delivery: formState.delivery } }
  try {
    const saved = editing.value ? await catalogApi.update('sites', editing.value, body) : await catalogApi.create('sites', body)
    message.success(`${saved.label} ${editing.value ? 'updated' : 'created'}`)
    reset()
    await loadSites()
  } catch (e) { fail(e) } finally { savingSite.value = false }
}
const editSite = (s) => {
  const a = s.attributes || {}
  Object.assign(formState, { name: s.label, region: a.region || undefined, type: [...(a.type || [])], resource: a.resource || '', desc: a.desc || '', rating: a.rating ?? 5, date: a.date || '', delivery: !!a.delivery })
  editing.value = s.code
}
const removeSite = async (s) => { try { await catalogApi.remove('sites', s.code); if (editing.value === s.code) reset(); await loadSites() } catch (e) { fail(e) } }
const storeCounter = computed({ get: () => appStore.counter, set: (v) => (appStore.counter = v) })

const tags = ref([])
const newTag = ref('')
const busy = reactive({ tag: false })
const tagData = computed(() => tags.value.map((t) => ({ key: t.code, title: t.label })))
const targetKeys = computed(() => tags.value.filter((t) => t.attributes?.selected).map((t) => t.code))
const loadTags = async () => { try { tags.value = await catalogApi.list('tags') } catch (e) { fail(e) } }
const onTransfer = async (keys, direction, moved) => {
  const selected = direction === 'right'
  try {
    await Promise.all(moved.map((code) => { const t = tags.value.find((x) => x.code === code); return catalogApi.update('tags', code, { label: t.label, attributes: { ...(t.attributes || {}), selected }, sort: t.sort }) }))
    await loadTags()
  } catch (e) { fail(e) }
}
const addTag = async () => {
  if (!newTag.value.trim()) return
  busy.tag = true
  try { await catalogApi.create('tags', { label: newTag.value.trim(), attributes: { selected: false }, sort: tags.value.length + 1 }); newTag.value = ''; await loadTags() } catch (e) { fail(e) } finally { busy.tag = false }
}

const ws = useTaskPulseSocket()
const wsMsg = ref('')
const onWsMsg = () => { if (wsMsg.value && ws.isOpen.value) { ws.echo(wsMsg.value); wsMsg.value = '' } }

onMounted(() => Promise.all([loadOptions(), loadUploads(), loadTags()]))
useChangeFeed((msg) => (msg.resource === 'upload' ? loadUploads() : Promise.all([loadOptions(), loadTags()])), { resources: ['catalog', 'upload'] })
</script>

<style scoped>
.alert { margin-bottom: 1rem; }
.form-grid { display: grid; gap: 1rem; grid-template-columns: repeat(2, minmax(0, 1fr)); align-items: start; }
@media (max-width: 1100px) { .form-grid { grid-template-columns: 1fr; } }
.form-grid > .page__card { min-width: 0; }
.form-grid > .card--wide { grid-column: 1 / -1; }
.two { display: grid; gap: 0 1rem; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); }
.in-icon { color: var(--p-muted); }
.ws-send { display: flex; gap: 0.5rem; }
.add-tag { display: flex; gap: 0.4rem; }
.transfer { display: flex; align-items: stretch; }
.transfer :deep(.ant-transfer-list) { flex: 1 1 0; min-width: 0; width: auto !important; }
.transfer :deep(.ant-transfer-operation) { flex: none; }
.files { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.4rem; }
.file { display: grid; grid-template-columns: auto 1fr auto; gap: 0.6rem; align-items: center; padding: 0.5rem 0.7rem; border-radius: 10px; background: var(--p-bg); border: 1px solid var(--p-border); }
.file__icon { width: 1.9rem; height: 1.9rem; border-radius: 8px; display: grid; place-items: center; background: color-mix(in srgb, var(--p-accent) 12%, transparent); color: var(--p-accent); }
.file__body { display: grid; gap: 0.1rem; min-width: 0; line-height: 1.3; }
.file__body .page__muted { font-size: 0.78rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.file__name { font-weight: 600; color: var(--p-text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.file__tools { display: flex; }
</style>
