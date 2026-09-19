<template>
  <div class="page">
    <header class="page__head">
      <div>
        <h1 class="page__title">Cascading selects</h1>
        <p class="page__subtitle">Two dependent selections: the countries offered follow the regions chosen, and a country that is no longer reachable is dropped from the selection.</p>
      </div>
      <div class="page__actions">
        <a-tag class="pill" color="blue"><DatabaseOutlined />store counter {{ storeCounter }}</a-tag>
        <a-button @click="clear" :disabled="!form.regions.length && !submitted"><template #icon><ClearOutlined /></template>Clear</a-button>
        <a-button type="primary" @click="submit" :disabled="!form.countries.length"><template #icon><SendOutlined /></template>Submit</a-button>
      </div>
    </header>

    <div class="cascade-grid">
      <div class="page__card">
        <div class="sec">
          <span class="sec__icon"><GlobalOutlined /></span>
          <h3 class="sec__title">1 · Regions</h3>
          <span class="sec__count">{{ form.regions.length }} / {{ regionList.length }}</span>
          <a-button size="small" type="text" @click="toggleAllRegions">{{ form.regions.length === regionList.length ? 'none' : 'all' }}</a-button>
        </div>
        <div class="chips">
          <a-checkable-tag v-for="r in regionList" :key="r" :checked="form.regions.includes(r)" class="chip" @change="(on) => toggleRegion(r, on)">
            <EnvironmentOutlined /> {{ r }} <span class="chip__n">{{ master[r].length }}</span>
          </a-checkable-tag>
        </div>
        <p class="page__note">Pick one or more regions — the country list below is built from them.</p>
      </div>

      <div class="page__card">
        <div class="sec">
          <span class="sec__icon"><FlagOutlined /></span>
          <h3 class="sec__title">2 · Countries</h3>
          <span class="sec__count">{{ form.countries.length }} / {{ countryList.length }}</span>
          <a-button size="small" type="text" :disabled="!countryList.length" @click="toggleAllCountries">{{ countryList.length && form.countries.length === countryList.length ? 'none' : 'all' }}</a-button>
        </div>
        <div v-if="!countryList.length" class="empty"><FlagOutlined class="empty__icon" /><span>No countries yet</span><span class="empty__hint">Choose a region first.</span></div>
        <div v-else class="chips">
          <a-checkable-tag v-for="c in countryList" :key="c" :checked="form.countries.includes(c)" class="chip" @change="(on) => toggleCountry(c, on)">
            {{ c }} <span v-if="regionsOf(c).length > 1" class="chip__n" :title="regionsOf(c).join(', ')">{{ regionsOf(c).length }}×</span>
          </a-checkable-tag>
        </div>
        <p class="page__note">A country in two regions (Russia, Egypt, Afghanistan) appears once; deselecting its last region removes it from the selection too.</p>
      </div>

      <div class="page__card">
        <div class="sec">
          <span class="sec__icon"><ApartmentOutlined /></span>
          <h3 class="sec__title">Selection</h3>
          <span class="sec__count">{{ form.countries.length }} chosen</span>
          <a-segmented v-model:value="view" :options="['Tree', 'JSON']" size="small" />
        </div>
        <div v-if="!form.regions.length" class="empty"><ApartmentOutlined class="empty__icon" /><span>Nothing selected</span></div>
        <ul v-else-if="view === 'Tree'" class="tree">
          <li v-for="r in form.regions" :key="r" class="tree__region">
            <span class="tree__label"><EnvironmentOutlined /> {{ r }}</span>
            <div class="tree__countries">
              <a-tag v-for="c in master[r].filter((x) => form.countries.includes(x))" :key="c" color="blue">{{ c }}</a-tag>
              <span v-if="!master[r].some((x) => form.countries.includes(x))" class="page__muted">no country chosen</span>
            </div>
          </li>
        </ul>
        <pre v-else class="code">{{ JSON.stringify(form, null, 2) }}</pre>

        <div class="sec" style="margin-top: 1rem">
          <span class="sec__icon"><CheckCircleOutlined /></span>
          <h3 class="sec__title">Last submit</h3>
          <span v-if="submitted" class="sec__count">{{ submittedAt }}</span>
        </div>
        <pre v-if="submitted" class="code">{{ submitted }}</pre>
        <div v-else class="empty"><SendOutlined class="empty__icon" /><span>Not submitted yet</span></div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { reactive, ref, computed } from 'vue'
import { message } from 'ant-design-vue'
import { DatabaseOutlined, ClearOutlined, SendOutlined, GlobalOutlined, EnvironmentOutlined, FlagOutlined, ApartmentOutlined, CheckCircleOutlined } from '@ant-design/icons-vue'
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
const regionList = Object.keys(master)
const form = reactive({ regions: [], countries: [] })
const submitted = ref('')
const submittedAt = ref('')
const view = ref('Tree')

const countryList = computed(() => [...new Set(form.regions.flatMap((r) => master[r]))])
const regionsOf = (c) => form.regions.filter((r) => master[r].includes(c))
const syncCountries = () => { form.countries = form.countries.filter((c) => countryList.value.includes(c)) }

const toggleRegion = (r, on) => { form.regions = on ? [...form.regions, r] : form.regions.filter((x) => x !== r); syncCountries() }
const toggleAllRegions = () => { form.regions = form.regions.length === regionList.length ? [] : [...regionList]; syncCountries() }
const toggleCountry = (c, on) => { form.countries = on ? [...form.countries, c] : form.countries.filter((x) => x !== c) }
const toggleAllCountries = () => { form.countries = form.countries.length === countryList.value.length ? [] : [...countryList.value] }
const submit = () => { submitted.value = JSON.stringify(form, null, 2); submittedAt.value = new Date().toLocaleTimeString(); message.success(`Submitted ${form.countries.length} countr${form.countries.length === 1 ? 'y' : 'ies'} in ${form.regions.length} region${form.regions.length === 1 ? '' : 's'}`) }
const clear = () => { form.regions = []; form.countries = []; submitted.value = ''; submittedAt.value = '' }
</script>

<style scoped>
.cascade-grid { display: grid; gap: 1rem; grid-template-columns: repeat(3, minmax(0, 1fr)); align-items: start; }
@media (max-width: 1200px) { .cascade-grid { grid-template-columns: 1fr; } }
.chips { display: flex; flex-wrap: wrap; gap: 0.4rem; }
.chip { margin: 0; padding: 0.3rem 0.7rem; border-radius: 999px; border: 1px solid var(--p-border); background: var(--p-bg); font-size: 0.85rem; line-height: 1.3; cursor: pointer; display: inline-flex; align-items: center; gap: 0.3rem; user-select: none; }
.chip:hover { border-color: var(--p-accent); color: var(--p-accent); }
.chip.ant-tag-checkable-checked { background: var(--p-accent); border-color: var(--p-accent); color: #fff; }
.chip__n { font-size: 0.7rem; opacity: 0.7; padding: 0 0.35rem; border-radius: 999px; background: rgba(0, 0, 0, 0.08); }
.chip.ant-tag-checkable-checked .chip__n { background: rgba(255, 255, 255, 0.25); }
.tree { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.5rem; }
.tree__region { padding: 0.55rem 0.7rem; border-radius: 10px; background: var(--p-bg); border: 1px solid var(--p-border); display: grid; gap: 0.35rem; }
.tree__label { font-weight: 600; display: inline-flex; gap: 0.35rem; align-items: center; }
.tree__countries { display: flex; flex-wrap: wrap; gap: 0.25rem; padding-left: 1.3rem; }
.tree__countries .ant-tag { margin: 0; }
</style>
