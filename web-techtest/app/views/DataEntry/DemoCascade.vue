<template>
  <div class="page">
    <header class="page__head">
      <div>
        <h1 class="page__title">Cascading selects</h1>
        <p class="page__subtitle">Two dependent multi-selects: the countries offered follow the regions chosen, and a country that is no longer reachable is dropped from the selection.</p>
      </div>
      <a-tag>store counter: {{ storeCounter }}</a-tag>
    </header>

    <div class="page__grid page__grid--wide">
      <div class="page__card">
        <a-form layout="vertical">
          <a-form-item label="Regions">
            <a-select mode="multiple" placeholder="Please select" v-model:value="form.regions" :options="regionOptions" @change="syncCountries" />
          </a-form-item>
          <a-form-item :label="`Countries (${countryOptions.length} available)`">
            <a-select mode="multiple" placeholder="Please select" v-model:value="form.countries" :options="countryOptions" :disabled="!countryOptions.length" />
          </a-form-item>
          <a-space>
            <a-button type="primary" @click="submitted = JSON.stringify(form, null, 2)">Submit</a-button>
            <a-button @click="clear">Clear</a-button>
          </a-space>
        </a-form>
      </div>
      <div class="page__card">
        <h3 class="page__h3">State</h3>
        <pre class="code">{{ JSON.stringify(form, null, 2) }}</pre>
        <h3 class="page__h3" style="margin-top: 1rem">Last submit</h3>
        <pre class="code">{{ submitted || '—' }}</pre>
        <p class="page__note">A country in two regions (Russia, Egypt, Afghanistan) appears once; deselecting its last region removes it from the selection too.</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { reactive, ref, computed } from 'vue'
import { useAppStore } from '../../store.js'

const appStore = useAppStore()
const storeCounter = computed(() => appStore.counter)

const master = {
  Asia: ['Russia', 'Japan', 'Burma', 'Indonesia', 'Afghanistan'],
  Europe: ['Russia', 'Germany', 'France', 'Poland', 'Sweden', 'Italy'],
  NA: ['United States', 'Canada'],
  SA: ['Brazil', 'Argentina', 'Ecuador'],
  Africa: ['Egypt', 'Nigeria', 'Kenya', 'Liberia'],
  ME: ['Egypt', 'Saudi Arabia', 'Afghanistan'],
}
const regionOptions = Object.keys(master).map((r) => ({ value: r, label: r }))
const form = reactive({ regions: [], countries: [] })
const submitted = ref('')

const countryOptions = computed(() => [...new Set(form.regions.flatMap((r) => master[r]))].map((c) => ({ value: c, label: c })))
const syncCountries = () => {
  const allowed = new Set(countryOptions.value.map((o) => o.value))
  form.countries = form.countries.filter((c) => allowed.has(c))
}
const clear = () => { form.regions = []; form.countries = []; submitted.value = '' }
</script>
