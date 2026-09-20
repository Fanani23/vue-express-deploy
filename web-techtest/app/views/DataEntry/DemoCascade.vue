<template>
  <div class="page">
    <header class="page__head">
      <div>
        <h1 class="page__title">Cascading selects</h1>
        <p class="page__subtitle">Two dependent selections whose options are <strong>records, not literals</strong>: regions and countries live in TaskPulse's catalog, so you can add or remove them here and the cascade follows. A country that is no longer reachable is dropped from the selection.</p>
      </div>
      <div class="page__actions">
        <a-tag class="pill" :color="error ? 'error' : 'blue'"><DatabaseOutlined />{{ error ? 'API error' : `${regions.length} regions · ${countries.length} countries` }}</a-tag>
        <a-button @click="clear" :disabled="!form.regions.length && !saved"><template #icon><ClearOutlined /></template>Clear</a-button>
        <a-button type="primary" @click="submit" :disabled="!form.countries.length" :loading="saving"><template #icon><SendOutlined /></template>Save selection</a-button>
      </div>
    </header>

    <transition name="pop"><a-alert v-if="error" type="error" show-icon closable :message="error" class="alert" @close="error = ''" /></transition>

    <div class="cascade-grid">
      <div class="page__card">
        <div class="sec">
          <span class="sec__icon"><GlobalOutlined /></span>
          <h3 class="sec__title">1 · Regions</h3>
          <span class="sec__count">{{ form.regions.length }} / {{ regions.length }}</span>
          <a-button size="small" type="text" :disabled="!regions.length" @click="toggleAllRegions">{{ regions.length && form.regions.length === regions.length ? 'none' : 'all' }}</a-button>
        </div>
        <div v-if="!regions.length && !loading" class="empty"><GlobalOutlined class="empty__icon" /><span>No regions</span><span class="empty__hint">Add the first one below.</span></div>
        <div v-else class="chips">
          <span v-for="r in regions" :key="r.code" class="chipwrap">
            <a-checkable-tag :checked="form.regions.includes(r.code)" class="chip" @change="(on) => toggleRegion(r.code, on)">
              <EnvironmentOutlined /> {{ r.label }} <span class="chip__n">{{ countriesOf(r.code).length }}</span>
            </a-checkable-tag>
            <a-popconfirm :title="`Delete region ${r.label}? Its countries stay, minus this parent.`" ok-text="Delete" ok-type="danger" @confirm="removeRegion(r)"><button type="button" class="chip__x" :aria-label="'delete ' + r.label"><CloseOutlined /></button></a-popconfirm>
          </span>
        </div>
        <form class="add" @submit.prevent="addRegion">
          <a-input v-model:value="newRegion" placeholder="New region, e.g. Oceania" :maxlength="120" size="small" data-cy="new-region" />
          <a-button size="small" html-type="submit" :disabled="!newRegion.trim()" :loading="busy.region"><template #icon><PlusOutlined /></template>Add region</a-button>
        </form>
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
          <span v-for="c in countryList" :key="c.code" class="chipwrap">
            <a-checkable-tag :checked="form.countries.includes(c.code)" class="chip" @change="(on) => toggleCountry(c.code, on)">
              {{ c.label }} <span v-if="regionsOf(c).length > 1" class="chip__n" :title="regionsOf(c).map(labelOf).join(', ')">{{ regionsOf(c).length }}×</span>
            </a-checkable-tag>
            <a-popconfirm :title="`Delete country ${c.label}?`" ok-text="Delete" ok-type="danger" @confirm="removeCountry(c)"><button type="button" class="chip__x" :aria-label="'delete ' + c.label"><CloseOutlined /></button></a-popconfirm>
          </span>
        </div>
        <form class="add add--country" @submit.prevent="addCountry">
          <a-input v-model:value="newCountry.label" placeholder="New country" :maxlength="120" size="small" data-cy="new-country" />
          <a-select v-model:value="newCountry.parents" mode="multiple" placeholder="in region(s)" size="small" :options="regions.map((r) => ({ value: r.code, label: r.label }))" :max-tag-count="2" data-cy="new-country-regions" />
          <a-button size="small" html-type="submit" :disabled="!newCountry.label.trim() || !newCountry.parents.length" :loading="busy.country"><template #icon><PlusOutlined /></template>Add</a-button>
        </form>
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
            <span class="tree__label"><EnvironmentOutlined /> {{ labelOf(r) }}</span>
            <div class="tree__countries">
              <a-tag v-for="c in countriesOf(r).filter((x) => form.countries.includes(x.code))" :key="c.code" color="blue">{{ c.label }}</a-tag>
              <span v-if="!countriesOf(r).some((x) => form.countries.includes(x.code))" class="page__muted">no country chosen</span>
            </div>
          </li>
        </ul>
        <pre v-else class="code">{{ JSON.stringify(form, null, 2) }}</pre>

        <div class="sec" style="margin-top: 1rem">
          <span class="sec__icon"><CheckCircleOutlined /></span>
          <h3 class="sec__title">Saved selection</h3>
          <span v-if="saved" class="sec__count">{{ timeAgo(saved.updatedAt) }}</span>
          <a-button v-if="saved" size="small" type="text" @click="restore">restore</a-button>
        </div>
        <div v-if="!saved" class="empty"><SendOutlined class="empty__icon" /><span>Nothing saved yet</span><span class="empty__hint">Save writes <code>catalog/selections/{{ key }}</code>; it survives a reload.</span></div>
        <pre v-else class="code">{{ JSON.stringify(saved.attributes, null, 2) }}</pre>
      </div>
    </div>
  </div>
</template>

<script setup>
import { reactive, ref, computed, onMounted } from 'vue'
import { message } from 'ant-design-vue'
import { DatabaseOutlined, ClearOutlined, SendOutlined, GlobalOutlined, EnvironmentOutlined, FlagOutlined, ApartmentOutlined, CheckCircleOutlined, PlusOutlined, CloseOutlined } from '@ant-design/icons-vue'
import { useMainStore } from '../../store.js'
import { catalogApi, timeAgo, userKey } from '../../taskpulse.js'

const store = useMainStore()
const key = computed(() => userKey(store.user))

const regions = ref([])
const countries = ref([])
const loading = ref(false)
const error = ref('')
const saving = ref(false)
const saved = ref(null)
const busy = reactive({ region: false, country: false })
const newRegion = ref('')
const newCountry = reactive({ label: '', parents: [] })
const form = reactive({ regions: [], countries: [] })
const view = ref('Tree')

const fail = (e) => { error.value = e?.message || String(e) }
const load = async () => {
  loading.value = true
  try {
    const [r, c] = await Promise.all([catalogApi.list('regions'), catalogApi.list('countries')])
    regions.value = r
    countries.value = c
    syncCountries()
  } catch (e) { fail(e) } finally { loading.value = false }
}
const loadSaved = async () => {
  try { saved.value = await catalogApi.find('selections', key.value) } catch { saved.value = null }
}

const labelOf = (code) => regions.value.find((r) => r.code === code)?.label || code
const countriesOf = (regionCode) => countries.value.filter((c) => c.parents.includes(regionCode))
const countryList = computed(() => { const seen = new Set(); return form.regions.flatMap(countriesOf).filter((c) => !seen.has(c.code) && seen.add(c.code)) })
const regionsOf = (c) => form.regions.filter((r) => c.parents.includes(r))
const syncCountries = () => { form.countries = form.countries.filter((code) => countryList.value.some((c) => c.code === code)) }

const toggleRegion = (code, on) => { form.regions = on ? [...form.regions, code] : form.regions.filter((x) => x !== code); syncCountries() }
const toggleAllRegions = () => { form.regions = form.regions.length === regions.value.length ? [] : regions.value.map((r) => r.code); syncCountries() }
const toggleCountry = (code, on) => { form.countries = on ? [...form.countries, code] : form.countries.filter((x) => x !== code) }
const toggleAllCountries = () => { form.countries = form.countries.length === countryList.value.length ? [] : countryList.value.map((c) => c.code) }

const addRegion = async () => {
  if (!newRegion.value.trim()) return
  busy.region = true
  try { const r = await catalogApi.create('regions', { label: newRegion.value.trim(), sort: regions.value.length + 1 }); newRegion.value = ''; await load(); message.success(`Region ${r.label} added`) } catch (e) { fail(e) } finally { busy.region = false }
}
const removeRegion = async (r) => {
  try { await catalogApi.remove('regions', r.code); form.regions = form.regions.filter((x) => x !== r.code); await load() } catch (e) { fail(e) }
}
const addCountry = async () => {
  if (!newCountry.label.trim() || !newCountry.parents.length) return
  busy.country = true
  try { const c = await catalogApi.create('countries', { label: newCountry.label.trim(), parents: newCountry.parents }); newCountry.label = ''; newCountry.parents = []; await load(); message.success(`Country ${c.label} added`) } catch (e) { fail(e) } finally { busy.country = false }
}
const removeCountry = async (c) => {
  try { await catalogApi.remove('countries', c.code); form.countries = form.countries.filter((x) => x !== c.code); await load() } catch (e) { fail(e) }
}

const submit = async () => {
  saving.value = true
  try {
    saved.value = await catalogApi.upsert('selections', key.value, { label: `Cascade selection of ${key.value}`, attributes: { regions: [...form.regions], countries: [...form.countries] } })
    message.success(`Saved ${form.countries.length} countr${form.countries.length === 1 ? 'y' : 'ies'} in ${form.regions.length} region${form.regions.length === 1 ? '' : 's'}`)
  } catch (e) { fail(e) } finally { saving.value = false }
}
const restore = () => { if (!saved.value) return; form.regions = [...(saved.value.attributes?.regions || [])]; form.countries = [...(saved.value.attributes?.countries || [])]; syncCountries() }
const clear = async () => {
  form.regions = []; form.countries = []
  if (saved.value) { try { await catalogApi.remove('selections', key.value); saved.value = null } catch (e) { fail(e) } }
}

onMounted(() => Promise.all([load(), loadSaved()]))
</script>

<style scoped>
.alert { margin-bottom: 1rem; }
.cascade-grid { display: grid; gap: 1rem; grid-template-columns: repeat(3, minmax(0, 1fr)); align-items: start; }
@media (max-width: 1200px) { .cascade-grid { grid-template-columns: 1fr; } }
.chips { display: flex; flex-wrap: wrap; gap: 0.4rem; }
.chipwrap { position: relative; display: inline-flex; }
.chip { margin: 0; padding: 0.3rem 0.7rem; border-radius: 999px; border: 1px solid var(--p-border); background: var(--p-bg); font-size: 0.85rem; line-height: 1.3; cursor: pointer; display: inline-flex; align-items: center; gap: 0.3rem; user-select: none; }
.chip:hover { border-color: var(--p-accent); color: var(--p-accent); }
.chip.ant-tag-checkable-checked { background: var(--p-accent); border-color: var(--p-accent); color: #fff; }
.chip__n { font-size: 0.7rem; opacity: 0.7; padding: 0 0.35rem; border-radius: 999px; background: rgba(0, 0, 0, 0.08); }
.chip.ant-tag-checkable-checked .chip__n { background: rgba(255, 255, 255, 0.25); }
.chip__x { position: absolute; top: -0.35rem; right: -0.35rem; width: 1.1rem; height: 1.1rem; border-radius: 50%; border: 1px solid var(--p-border); background: var(--p-card); color: var(--p-muted); font-size: 0.55rem; display: grid; place-items: center; cursor: pointer; opacity: 0; transition: opacity 0.15s; padding: 0; }
.chipwrap:hover .chip__x, .chip__x:focus-visible { opacity: 1; }
.chip__x:hover { color: #ef4444; border-color: #ef4444; }
.add { display: grid; grid-template-columns: 1fr auto; gap: 0.4rem; margin-top: 0.75rem; }
.add--country { grid-template-columns: 1fr 1fr auto; }
.tree { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.5rem; }
.tree__region { padding: 0.55rem 0.7rem; border-radius: 10px; background: var(--p-bg); border: 1px solid var(--p-border); display: grid; gap: 0.35rem; }
.tree__label { font-weight: 600; display: inline-flex; gap: 0.35rem; align-items: center; }
.tree__countries { display: flex; flex-wrap: wrap; gap: 0.25rem; padding-left: 1.3rem; }
.tree__countries .ant-tag { margin: 0; }
</style>
