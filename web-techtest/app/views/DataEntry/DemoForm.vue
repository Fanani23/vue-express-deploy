<template>
  <div class="page">
    <header class="page__head">
      <div>
        <h1 class="page__title">Forms</h1>
        <p class="page__subtitle">The template's Ant Design form samples: file drop with JSON, every input type bound to state, a transfer list, a WebSocket round-trip, and the error routes.</p>
      </div>
      <a-tag class="pill" color="blue"><FormOutlined />store counter {{ storeCounter }}</a-tag>
    </header>

    <div class="form-grid">
      <div class="page__card">
        <div class="sec">
          <span class="sec__icon"><CloudUploadOutlined /></span>
          <h3 class="sec__title">Files + JSON in one request</h3>
          <span class="sec__count">{{ form1.files.length }} file{{ form1.files.length === 1 ? '' : 's' }}</span>
        </div>
        <a-form layout="vertical">
          <a-upload-dragger :file-list="form1.files" :before-upload="beforeUpload" :multiple="true" @remove="handleRemove">
            <p class="ant-upload-drag-icon"><inbox-outlined /></p>
            <p class="ant-upload-text">Click or drag files here</p>
            <p class="ant-upload-hint">They stay in the browser — this backend has no upload route, so the request is only assembled.</p>
          </a-upload-dragger>
          <div class="two" style="margin-top: 1rem">
            <a-form-item label="Text"><a-input v-model:value="form1.text"><template #prefix><FontSizeOutlined class="in-icon" /></template></a-input></a-form-item>
            <a-form-item label="Number"><a-input-number v-model:value="form1.number" style="width: 100%" /></a-form-item>
          </div>
          <a-button type="primary" @click="onSubmit1"><template #icon><BuildOutlined /></template>Assemble request</a-button>
        </a-form>
        <pre v-if="form1Result" class="code" style="margin-top: 0.75rem">{{ form1Result }}</pre>
        <div v-else class="empty" style="margin-top: 0.75rem"><FileZipOutlined class="empty__icon" /><span>Nothing assembled yet</span><span class="empty__hint">Add files, then press Assemble request to see the multipart body.</span></div>
      </div>

      <div class="page__card">
        <div class="sec">
          <span class="sec__icon"><FormOutlined /></span>
          <h3 class="sec__title">Every input type</h3>
          <span class="sec__count">8 fields</span>
        </div>
        <a-form :model="formState" layout="vertical">
          <a-form-item label="Rating">
            <a-row :gutter="8" align="middle"><a-col :span="18"><a-slider :min="1" :max="20" v-model:value="formState.rating" /></a-col><a-col :span="6"><a-input-number v-model:value="formState.rating" :min="1" :max="20" style="width: 100%" /></a-col></a-row>
          </a-form-item>
          <div class="two">
            <a-form-item label="Activity name"><a-input v-model:value="formState.name"><template #prefix><TagOutlined class="in-icon" /></template></a-input></a-form-item>
            <a-form-item label="Zone"><a-select v-model:value="formState.region" placeholder="please select your zone" :options="[{ value: 'shanghai', label: 'Zone one' }, { value: 'beijing', label: 'Zone two' }]" /></a-form-item>
            <a-form-item label="Date"><a-input v-model:value="appStore.form.date1" type="date" style="width: 100%" /></a-form-item>
            <a-form-item label="Instant delivery"><a-switch v-model:checked="appStore.form.delivery" /></a-form-item>
            <a-form-item label="Type"><a-checkbox-group v-model:value="formState.type" :options="[{ label: 'Online', value: '1' }, { label: 'Promotion', value: '2' }, { label: 'Offline', value: '3' }]" /></a-form-item>
            <a-form-item label="Resources"><a-radio-group v-model:value="formState.resource"><a-radio value="1">Sponsor</a-radio><a-radio value="2">Venue</a-radio></a-radio-group></a-form-item>
          </div>
          <a-form-item label="Description"><a-textarea v-model:value="formState.desc" :rows="2" /></a-form-item>
          <a-form-item label="Store counter"><a-input-number v-model:value="storeCounter" style="width: 100%" /></a-form-item>
          <a-space>
            <a-button type="primary" @click="onSubmit"><template #icon><SendOutlined /></template>Submit to /api/healthcheck</a-button>
            <a-button @click="reset"><template #icon><ClearOutlined /></template>Reset</a-button>
          </a-space>
        </a-form>
        <pre class="code" style="margin-top: 0.75rem">{{ submitResult || JSON.stringify({ ...toRaw(formState), date1: appStore.form.date1, delivery: appStore.form.delivery }, null, 2) }}</pre>
      </div>

      <div class="page__card card--wide">
        <div class="sec">
          <span class="sec__icon"><SwapOutlined /></span>
          <h3 class="sec__title">Transfer list</h3>
          <span class="sec__count">{{ targetKeys.length }} / {{ mockData.length }} chosen</span>
          <a-button size="small" @click="getMock"><template #icon><ReloadOutlined /></template>reshuffle</a-button>
        </div>
        <a-transfer :data-source="mockData" show-search :list-style="{ height: '300px' }" :operations="['to right', 'to left']" :target-keys="targetKeys" :render="(item) => `${item.title} — ${item.description}`" @change="(keys) => (targetKeys = keys)" class="transfer">
          <template #notFoundContent><div class="empty"><InboxOutlined class="empty__icon" /><span>Nothing here</span></div></template>
        </a-transfer>
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
import { ref, reactive, toRaw, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { InboxOutlined, FormOutlined, CloudUploadOutlined, FontSizeOutlined, BuildOutlined, FileZipOutlined, TagOutlined, SendOutlined, ClearOutlined, SwapOutlined, ReloadOutlined, ThunderboltOutlined, MessageOutlined, WarningOutlined, StopOutlined, QuestionCircleOutlined } from '@ant-design/icons-vue'
import { useAppStore } from '../../store.js'
import { http } from '../../../common/plugins/fetch.js'
import { useTaskPulseSocket } from '../../taskpulse.js'

const appStore = useAppStore()
const router = useRouter()

const form1 = reactive({ files: [], text: 'abcd', number: 3 })
const form1Result = ref('')
const beforeUpload = (file) => {
  if (!form1.files.find((f) => f.name === file.name)) form1.files = [...form1.files, file]
  return false
}
const handleRemove = (file) => { form1.files = form1.files.filter((f) => f.uid !== file.uid) }
const onSubmit1 = () => {
  const form = new FormData()
  for (const file of form1.files) form.append('myfiles', file)
  form.append('mydata', JSON.stringify({ text: form1.text, number: form1.number }))
  const parts = [...form.entries()].map(([k, v]) => (v instanceof File ? `${k}: ${v.name} (${v.type || 'unknown'}, ${(v.size / 1024).toFixed(1)} KB)` : `${k}: ${v}`))
  form1Result.value = `multipart/form-data with ${parts.length} part(s):\n` + parts.join('\n') + '\n\nWould POST to /api/custom-app/uploads/file-and-json — not present in express-template@db883cd.'
}

const blank = () => ({ name: '', region: undefined, type: [], resource: '', desc: '', rating: 5 })
const formState = reactive(blank())
const submitResult = ref('')
const reset = () => { Object.assign(formState, blank()); submitResult.value = '' }
const onSubmit = async () => {
  try {
    const { data } = await http.post('/api/healthcheck', toRaw(formState))
    submitResult.value = 'Response: ' + JSON.stringify(data, null, 2)
  } catch (e) {
    submitResult.value = 'Error: ' + (e?.data ? JSON.stringify(e.data) : e.toString())
  }
}
const storeCounter = computed({ get: () => appStore.counter, set: (v) => (appStore.counter = v) })

const mockData = ref([])
const targetKeys = ref([])
const getMock = () => {
  const keys = [], data = []
  for (let i = 0; i < 20; i++) {
    const item = { key: String(i), title: `content ${i + 1}`, description: `description ${i + 1}`, chosen: Math.random() > 0.5 }
    if (item.chosen) keys.push(item.key)
    data.push(item)
  }
  mockData.value = data
  targetKeys.value = keys
}
onMounted(getMock)

const ws = useTaskPulseSocket()
const wsMsg = ref('')
const onWsMsg = () => { if (wsMsg.value && ws.isOpen.value) { ws.echo(wsMsg.value); wsMsg.value = '' } }
</script>

<style scoped>
.form-grid { display: grid; gap: 1rem; grid-template-columns: repeat(2, minmax(0, 1fr)); align-items: start; }
@media (max-width: 1100px) { .form-grid { grid-template-columns: 1fr; } }
.form-grid > .page__card { min-width: 0; }
.form-grid > .card--wide { grid-column: 1 / -1; }
.two { display: grid; gap: 0 1rem; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); }
.in-icon { color: var(--p-muted); }
.ws-send { display: flex; gap: 0.5rem; }
.transfer { display: flex; align-items: stretch; }
.transfer :deep(.ant-transfer-list) { flex: 1 1 0; min-width: 0; width: auto !important; }
.transfer :deep(.ant-transfer-operation) { flex: none; }
</style>
