<template>
  <div class="page">
    <header class="page__head">
      <div>
        <h1 class="page__title">Cascading selects from an API</h1>
        <p class="page__subtitle">Each level is fetched from TaskPulse when the level above changes: status → tasks in that status → the chosen task's record. The template version called <code>/api/custom-app/cascade/*</code>, which this backend does not have.</p>
      </div>
      <a-tag :color="error ? 'error' : 'success'">{{ error ? 'API error' : api }}</a-tag>
    </header>

    <div class="page__grid page__grid--wide">
      <div class="page__card">
        <a-form layout="vertical">
          <a-form-item label="1 · Status">
            <a-select mode="multiple" placeholder="Choose one or more statuses" v-model:value="statuses" :options="statusOptions" @change="loadTasks" />
          </a-form-item>
          <a-form-item :label="`2 · Task (${taskOptions.length} loaded${loadingTasks ? ', loading…' : ''})`">
            <a-select show-search placeholder="Pick a task" v-model:value="taskId" :options="taskOptions" :disabled="!taskOptions.length" option-filter-prop="label" allow-clear @change="loadTask" />
          </a-form-item>
          <a-form-item label="3 · Record">
            <pre class="code">{{ task ? JSON.stringify(task, null, 2) : 'Select a task to fetch GET /api/tasks/{id}.' }}</pre>
          </a-form-item>
        </a-form>
      </div>
      <div class="page__card">
        <h3 class="page__h3">Requests made</h3>
        <ul class="log" data-cy="requests">
          <li v-for="(r, i) in requests" :key="i"><span class="log__t">{{ r.t }}</span>{{ r.text }}</li>
          <li v-if="!requests.length" class="page__muted">Nothing yet.</li>
        </ul>
        <p class="page__note">Selections that are no longer valid after a parent change are dropped, exactly as in the static versions — but the option lists come from the server, so they stay correct when tasks change elsewhere.</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { tasksApi, STATUSES, STATUS_LABEL } from '../../taskpulse.js'

const api = tasksApi.urls.api
const statuses = ref([])
const tasks = ref([])
const taskId = ref(undefined)
const task = ref(null)
const loadingTasks = ref(false)
const error = ref('')
const requests = ref([])
const logReq = (text) => { requests.value.unshift({ t: new Date().toLocaleTimeString(), text }); if (requests.value.length > 12) requests.value.length = 12 }

const statusOptions = STATUSES.map((s) => ({ value: s, label: STATUS_LABEL[s] }))
const taskOptions = computed(() => tasks.value.map((t) => ({ value: t.id, label: `${t.title} · ${STATUS_LABEL[t.status]}` })))

const loadTasks = async () => {
  loadingTasks.value = true
  error.value = ''
  try {
    const results = await Promise.all(statuses.value.map(async (s) => { const r = await tasksApi.list({ status: s, pageSize: 100 }); logReq(`GET /api/tasks?status=${s} → ${r.total}`); return r.items }))
    tasks.value = results.flat()
    if (!tasks.value.some((t) => t.id === taskId.value)) { taskId.value = undefined; task.value = null }
  } catch (e) { error.value = e.message; logReq('error: ' + e.message) } finally { loadingTasks.value = false }
}

const loadTask = async (id) => {
  task.value = null
  if (!id) return
  try {
    const res = await fetch(`${api}/api/tasks/${id}`, { headers: { Accept: 'application/json' } })
    logReq(`GET /api/tasks/${id.slice(0, 8)}… → ${res.status}`)
    task.value = await res.json()
  } catch (e) { error.value = e.message }
}
</script>
