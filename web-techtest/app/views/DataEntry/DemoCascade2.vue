<template>
  <div class="page">
    <header class="page__head">
      <div>
        <h1 class="page__title">Cascading selects, three levels</h1>
        <p class="page__subtitle">Continents → countries (split by hemisphere) → states, plus a pair of include/exclude lists that can never overlap. One generic <code>narrow()</code> keeps every level consistent.</p>
      </div>
    </header>

    <div class="page__grid page__grid--wide">
      <div class="page__card">
        <a-form layout="vertical">
          <a-form-item>
            <template #label>Continents <a-checkbox class="all" :checked="allContinents" @change="toggleAll">select all</a-checkbox></template>
            <a-select mode="multiple" placeholder="Please select" v-model:value="form.continents" :options="opts(lists.continents)" @change="cascade" />
          </a-form-item>
          <a-form-item :label="`Countries, east (${lists.countriesEast.length})`">
            <a-select mode="multiple" placeholder="Please select" v-model:value="form.countriesEast" :options="opts(lists.countriesEast)" allow-clear :disabled="!lists.countriesEast.length" />
          </a-form-item>
          <a-form-item :label="`Countries, west (${lists.countriesWest.length})`">
            <a-select mode="multiple" placeholder="Please select" v-model:value="form.countriesWest" :options="opts(lists.countriesWest)" allow-clear :disabled="!lists.countriesWest.length" @change="cascadeStates" />
          </a-form-item>
          <a-form-item :label="`States, west (${lists.states.length})`">
            <a-select mode="multiple" placeholder="Please select" v-model:value="form.states" :options="opts(lists.states)" :disabled="!lists.states.length" />
          </a-form-item>
          <hr class="page__hr" />
          <a-form-item>
            <template #label>Force include <a-checkbox class="all" :checked="form.includes.length === FORCE.length - form.excludes.length && FORCE.length - form.excludes.length > 0" @change="(e) => fill('includes', e.target.checked)">select all</a-checkbox></template>
            <a-select mode="multiple" placeholder="Please select" v-model:value="form.includes" :options="opts(FORCE.filter((x) => !form.excludes.includes(x)))" />
          </a-form-item>
          <a-form-item>
            <template #label>Force exclude <a-checkbox class="all" :checked="form.excludes.length === FORCE.length - form.includes.length && FORCE.length - form.includes.length > 0" @change="(e) => fill('excludes', e.target.checked)">select all</a-checkbox></template>
            <a-select mode="multiple" placeholder="Please select" v-model:value="form.excludes" :options="opts(FORCE.filter((x) => !form.includes.includes(x)))" />
          </a-form-item>
          <a-space>
            <a-button type="primary" @click="submitted = JSON.stringify(form, null, 2)">Run</a-button>
            <a-button @click="clear">Clear</a-button>
          </a-space>
        </a-form>
      </div>
      <div class="page__card">
        <h3 class="page__h3">State</h3>
        <pre class="code">{{ JSON.stringify(form, null, 2) }}</pre>
        <h3 class="page__h3" style="margin-top: 1rem">Last run</h3>
        <pre class="code">{{ submitted || '—' }}</pre>
      </div>
    </div>
  </div>
</template>

<script setup>
import { reactive, ref, computed } from 'vue'

const EAST = { Asia: ['Russia', 'Japan', 'Burma', 'Indonesia', 'Afghanistan'], Europe: ['Russia', 'Germany', 'France', 'Poland', 'Sweden', 'Italy'], Africa: ['Egypt', 'Nigeria', 'Kenya', 'Liberia'], ME: ['Egypt', 'Saudi Arabia', 'Afghanistan'] }
const WEST = { NA: ['United States', 'Canada'], SA: ['Brazil', 'Argentina', 'Ecuador'] }
const STATES = { 'United States': ['California', 'New York', 'Ohio', 'Utah', 'Texas'], Canada: ['Ontario', 'Quebec', 'BC', 'Alberta'], Brazil: ['B1', 'B2'], Argentina: ['A1', 'A2', 'A3'], Ecuador: ['EC1', 'EC2'] }
const FORCE = ['aa1', 'aa22', 'aa23', 'aa4', 'aa5', 'bb1', 'bb22', 'bb23', 'bb4', 'bb5']

const lists = reactive({ continents: ['Asia', 'Europe', 'NA', 'SA', 'Africa', 'ME'], countriesEast: [], countriesWest: [], states: [] })
const form = reactive({ continents: [], countriesEast: [], countriesWest: [], states: [], includes: [], excludes: [] })
const submitted = ref('')
const opts = (arr) => arr.map((v) => ({ value: v, label: v }))

const narrow = (selectedParents, masterMap, listKey, formKey) => {
  lists[listKey] = [...new Set(selectedParents.flatMap((p) => masterMap[p] || []))]
  form[formKey] = form[formKey].filter((x) => lists[listKey].includes(x))
}
const cascadeStates = () => narrow(form.countriesWest, STATES, 'states', 'states')
const cascade = () => {
  narrow(form.continents, EAST, 'countriesEast', 'countriesEast')
  narrow(form.continents, WEST, 'countriesWest', 'countriesWest')
  cascadeStates()
}

const allContinents = computed(() => form.continents.length === lists.continents.length)
const toggleAll = (e) => { form.continents = e.target.checked ? [...lists.continents] : []; cascade() }
const fill = (key, on) => {
  const other = key === 'includes' ? 'excludes' : 'includes'
  form[key] = on ? FORCE.filter((x) => !form[other].includes(x)) : []
}
const clear = () => { Object.assign(form, { continents: [], countriesEast: [], countriesWest: [], states: [], includes: [], excludes: [] }); cascade(); submitted.value = '' }
</script>

<style scoped>
.all { margin-left: 0.75rem; font-weight: 400; }
</style>
