<template>
  <div class="page">
    <header class="page__head">
      <div>
        <h1 class="page__title">Forms</h1>
        <p class="page__subtitle">The template's Ant Design form samples: file drop with JSON, every input type bound to state, a transfer list, a WebSocket round-trip, and the error routes.</p>
      </div>
    </header>

    <div class="page__card">
      <a-collapse v-model:activeKey="activeKey" ghost>
        <a-collapse-panel key="1" header="Files + JSON in one multipart request">
          <a-form :label-col="labelCol" :wrapper-col="wrapperCol">
            <a-upload-dragger :file-list="form1.files" :before-upload="beforeUpload" :multiple="true" @remove="handleRemove">
              <p class="ant-upload-drag-icon"><inbox-outlined /></p>
              <p class="ant-upload-text">Click or drag files here</p>
              <p class="ant-upload-hint">They stay in the browser — this backend has no upload route, so the request is only assembled.</p>
            </a-upload-dragger>
            <a-form-item label="Text" style="margin-top: 1rem"><a-input v-model:value="form1.text" /></a-form-item>
            <a-form-item label="Number"><a-input-number v-model:value="form1.number" style="width: 100%" /></a-form-item>
            <a-form-item :wrapper-col="{ span: 14, offset: 4 }">
              <a-button type="primary" @click="onSubmit1">Assemble request</a-button>
            </a-form-item>
          </a-form>
          <pre class="code" v-if="form1Result">{{ form1Result }}</pre>
        </a-collapse-panel>

        <a-collapse-panel key="2" :header="`Every input type (store counter: ${storeCounter})`">
          <a-form :model="formState" :label-col="labelCol" :wrapper-col="wrapperCol">
            <a-form-item label="Rating">
              <a-row :gutter="8"><a-col :span="18"><a-slider :min="1" :max="20" v-model:value="formState.rating" /></a-col><a-col :span="6"><a-input-number v-model:value="formState.rating" :min="1" :max="20" style="width: 100%" /></a-col></a-row>
            </a-form-item>
            <a-form-item label="Activity name"><a-input v-model:value="formState.name" /></a-form-item>
            <a-form-item label="Zone">
              <a-select v-model:value="formState.region" placeholder="please select your zone" :options="[{ value: 'shanghai', label: 'Zone one' }, { value: 'beijing', label: 'Zone two' }]" />
            </a-form-item>
            <a-form-item label="Date"><a-input v-model:value="appStore.form.date1" type="date" style="width: 100%" /></a-form-item>
            <a-form-item label="Instant delivery"><a-switch v-model:checked="appStore.form.delivery" /></a-form-item>
            <a-form-item label="Type">
              <a-checkbox-group v-model:value="formState.type" :options="[{ label: 'Online', value: '1' }, { label: 'Promotion', value: '2' }, { label: 'Offline', value: '3' }]" />
            </a-form-item>
            <a-form-item label="Resources">
              <a-radio-group v-model:value="formState.resource"><a-radio value="1">Sponsor</a-radio><a-radio value="2">Venue</a-radio></a-radio-group>
            </a-form-item>
            <a-form-item label="Description"><a-textarea v-model:value="formState.desc" :rows="2" /></a-form-item>
            <a-form-item label="Store counter"><a-input-number v-model:value="storeCounter" style="width: 100%" /></a-form-item>
            <a-form-item :wrapper-col="{ span: 14, offset: 4 }">
              <a-space>
                <a-button type="primary" @click="onSubmit">Submit to /api/healthcheck</a-button>
                <a-button @click="reset">Reset</a-button>
              </a-space>
            </a-form-item>
          </a-form>
          <pre class="code">{{ submitResult || JSON.stringify({ ...toRaw(formState), date1: appStore.form.date1, delivery: appStore.form.delivery }, null, 2) }}</pre>
        </a-collapse-panel>

        <a-collapse-panel key="3" header="Transfer list">
          <a-transfer :data-source="mockData" show-search :list-style="{ width: '260px', height: '300px' }" :operations="['to right', 'to left']" :target-keys="targetKeys" :render="(item) => `${item.title} — ${item.description}`" @change="(keys) => (targetKeys = keys)">
            <template #footer><a-button size="small" style="float: right; margin: 5px" @click="getMock">reshuffle</a-button></template>
            <template #notFoundContent><span>nothing here</span></template>
          </a-transfer>
        </a-collapse-panel>

        <a-collapse-panel key="4" header="WebSocket round-trip (TaskPulse echo)">
          <a-form :label-col="labelCol" :wrapper-col="wrapperCol">
            <a-form-item label="Message"><a-input v-model:value="wsMsg" @pressEnter="onWsMsg" /></a-form-item>
            <a-form-item :wrapper-col="{ span: 14, offset: 4 }">
              <a-space>
                <a-button type="primary" @click="onWsMsg" :disabled="!ws.isOpen.value || !wsMsg">Send</a-button>
                <a-tag :color="ws.isOpen.value ? 'success' : 'error'">{{ ws.state.value }}</a-tag>
              </a-space>
            </a-form-item>
          </a-form>
          <ul class="log"><li v-for="(e, i) in ws.events.value.slice(0, 6)" :key="i"><span class="log__t">{{ e.at.toLocaleTimeString() }}</span>{{ e.text }}</li></ul>
        </a-collapse-panel>

        <a-collapse-panel key="5" header="Error routes">
          <a-space>
            <a-button @click="router.push('/forbidden')">Forbidden</a-button>
            <a-button @click="router.push('/this-route-does-not-exist')">Not Found</a-button>
          </a-space>
        </a-collapse-panel>
      </a-collapse>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, toRaw, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { InboxOutlined } from '@ant-design/icons-vue'
import { useAppStore } from '../../store.js'
import { http } from '../../../common/plugins/fetch.js'
import { useTaskPulseSocket } from '../../taskpulse.js'

const appStore = useAppStore()
const router = useRouter()
const activeKey = ref(['1'])
const labelCol = { span: 4 }
const wrapperCol = { span: 14 }

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
