<template>
  <div class="page">
    <header class="page__head">
      <div>
        <h1 class="page__title">Cascading selects, three levels</h1>
        <p class="page__subtitle">Continents → countries (split by hemisphere) → states, plus a pair of include/exclude lists that can never overlap. One generic <code>narrow()</code> keeps every level consistent.</p>
      </div>
      <div class="page__actions">
        <a-button @click="clear" :disabled="!touched"><template #icon><ClearOutlined /></template>Clear</a-button>
        <a-button type="primary" @click="run" :disabled="!touched"><template #icon><PlayCircleOutlined /></template>Run</a-button>
      </div>
    </header>

    <div class="c2-grid">
      <div class="page__card">
        <div class="sec">
          <span class="sec__icon"><GlobalOutlined /></span>
          <h3 class="sec__title">1 · Continents</h3>
          <span class="sec__count">{{ form.continents.length }} / {{ lists.continents.length }}</span>
          <a-button size="small" type="text" @click="toggleAll">{{ allContinents ? 'none' : 'all' }}</a-button>
        </div>
        <div class="chips">
          <a-checkable-tag v-for="c in lists.continents" :key="c" :checked="form.continents.includes(c)" class="chip" @change="(on) => pick('continents', c, on, cascade)">
            <EnvironmentOutlined /> {{ c }} <span class="chip__n">{{ (EAST[c] || WEST[c] || []).length }}</span>
          </a-checkable-tag>
        </div>
      </div>

      <div class="page__card">
        <div class="sec">
          <span class="sec__icon"><FlagOutlined /></span>
          <h3 class="sec__title">2 · Countries</h3>
          <span class="sec__count">{{ form.countriesEast.length + form.countriesWest.length }} / {{ lists.countriesEast.length + lists.countriesWest.length }}</span>
        </div>
        <div v-if="!lists.countriesEast.length && !lists.countriesWest.length" class="empty"><FlagOutlined class="empty__icon" /><span>No countries yet</span><span class="empty__hint">Choose a continent first.</span></div>
        <template v-else>
          <div class="group" v-if="lists.countriesEast.length">
            <div class="group__label"><CompassOutlined /> East hemisphere <span class="page__muted">{{ form.countriesEast.length }} / {{ lists.countriesEast.length }}</span></div>
            <div class="chips"><a-checkable-tag v-for="c in lists.countriesEast" :key="c" :checked="form.countriesEast.includes(c)" class="chip" @change="(on) => pick('countriesEast', c, on)">{{ c }}</a-checkable-tag></div>
          </div>
          <div class="group" v-if="lists.countriesWest.length">
            <div class="group__label"><CompassOutlined /> West hemisphere <span class="page__muted">{{ form.countriesWest.length }} / {{ lists.countriesWest.length }}</span></div>
            <div class="chips"><a-checkable-tag v-for="c in lists.countriesWest" :key="c" :checked="form.countriesWest.includes(c)" class="chip" @change="(on) => pick('countriesWest', c, on, cascadeStates)">{{ c }} <span class="chip__n">{{ (STATES[c] || []).length }}</span></a-checkable-tag></div>
          </div>
        </template>
      </div>

      <div class="page__card">
        <div class="sec">
          <span class="sec__icon"><PushpinOutlined /></span>
          <h3 class="sec__title">3 · States (west)</h3>
          <span class="sec__count">{{ form.states.length }} / {{ lists.states.length }}</span>
        </div>
        <div v-if="!lists.states.length" class="empty"><PushpinOutlined class="empty__icon" /><span>No states yet</span><span class="empty__hint">Pick a country in the west hemisphere.</span></div>
        <div v-else class="chips"><a-checkable-tag v-for="s in lists.states" :key="s" :checked="form.states.includes(s)" class="chip" @change="(on) => pick('states', s, on)">{{ s }}</a-checkable-tag></div>
      </div>

      <div class="page__card">
        <div class="sec">
          <span class="sec__icon"><SwapOutlined /></span>
          <h3 class="sec__title">Force include / exclude</h3>
          <span class="sec__count">{{ form.includes.length }} in · {{ form.excludes.length }} out</span>
        </div>
        <div class="group">
          <div class="group__label"><PlusCircleOutlined /> Include <a-button size="small" type="text" @click="fill('includes')">{{ form.includes.length === FORCE.length - form.excludes.length ? 'none' : 'all' }}</a-button></div>
          <div class="chips"><a-checkable-tag v-for="f in FORCE" :key="f" :checked="form.includes.includes(f)" class="chip chip--in" :class="{ 'chip--blocked': form.excludes.includes(f) }" @change="(on) => !form.excludes.includes(f) && pick('includes', f, on)">{{ f }}</a-checkable-tag></div>
        </div>
        <div class="group">
          <div class="group__label"><MinusCircleOutlined /> Exclude <a-button size="small" type="text" @click="fill('excludes')">{{ form.excludes.length === FORCE.length - form.includes.length ? 'none' : 'all' }}</a-button></div>
          <div class="chips"><a-checkable-tag v-for="f in FORCE" :key="f" :checked="form.excludes.includes(f)" class="chip chip--out" :class="{ 'chip--blocked': form.includes.includes(f) }" @change="(on) => !form.includes.includes(f) && pick('excludes', f, on)">{{ f }}</a-checkable-tag></div>
        </div>
        <p class="page__note">A value chosen on one side is greyed out on the other — the lists can never overlap.</p>
      </div>

      <div class="page__card c2-wide">
        <div class="sec">
          <span class="sec__icon"><ApartmentOutlined /></span>
          <h3 class="sec__title">Selection</h3>
          <a-segmented v-model:value="view" :options="['Tree', 'JSON']" size="small" />
          <span class="sec__count" style="margin-left: auto">{{ submittedAt ? 'last run ' + submittedAt : 'not run yet' }}</span>
        </div>
        <div v-if="!touched" class="empty"><ApartmentOutlined class="empty__icon" /><span>Nothing selected</span></div>
        <div v-else-if="view === 'Tree'" class="tree-grid">
          <div class="tree__col">
            <div v-for="c in form.continents" :key="c" class="tree__region">
              <span class="tree__label"><EnvironmentOutlined /> {{ c }}</span>
              <div class="tree__countries">
                <template v-for="k in (EAST[c] || WEST[c] || []).filter((x) => form.countriesEast.includes(x) || form.countriesWest.includes(x))" :key="k">
                  <a-tag color="blue">{{ k }}</a-tag>
                  <a-tag v-for="s in (STATES[k] || []).filter((x) => form.states.includes(x))" :key="s" color="green">{{ s }}</a-tag>
                </template>
                <span v-if="!(EAST[c] || WEST[c] || []).some((x) => form.countriesEast.includes(x) || form.countriesWest.includes(x))" class="page__muted">no country chosen</span>
              </div>
            </div>
            <div v-if="!form.continents.length" class="page__muted">no continent chosen</div>
          </div>
          <div class="tree__col">
            <div class="tree__region"><span class="tree__label"><PlusCircleOutlined /> Include</span><div class="tree__countries"><a-tag v-for="f in form.includes" :key="f" color="green">{{ f }}</a-tag><span v-if="!form.includes.length" class="page__muted">none</span></div></div>
            <div class="tree__region"><span class="tree__label"><MinusCircleOutlined /> Exclude</span><div class="tree__countries"><a-tag v-for="f in form.excludes" :key="f" color="red">{{ f }}</a-tag><span v-if="!form.excludes.length" class="page__muted">none</span></div></div>
          </div>
        </div>
        <pre v-else class="code">{{ JSON.stringify(form, null, 2) }}</pre>
        <template v-if="submitted">
          <div class="sec" style="margin-top: 1rem"><span class="sec__icon"><CheckCircleOutlined /></span><h3 class="sec__title">Last run</h3></div>
          <pre class="code">{{ submitted }}</pre>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup>
import { reactive, ref, computed } from 'vue'
import { message } from 'ant-design-vue'
import { ClearOutlined, PlayCircleOutlined, GlobalOutlined, EnvironmentOutlined, FlagOutlined, CompassOutlined, PushpinOutlined, SwapOutlined, PlusCircleOutlined, MinusCircleOutlined, ApartmentOutlined, CheckCircleOutlined } from '@ant-design/icons-vue'

const EAST = { Asia: ['Russia', 'Japan', 'Burma', 'Indonesia', 'Afghanistan'], Europe: ['Russia', 'Germany', 'France', 'Poland', 'Sweden', 'Italy'], Africa: ['Egypt', 'Nigeria', 'Kenya', 'Liberia'], ME: ['Egypt', 'Saudi Arabia', 'Afghanistan'] }
const WEST = { NA: ['United States', 'Canada'], SA: ['Brazil', 'Argentina', 'Ecuador'] }
const STATES = { 'United States': ['California', 'New York', 'Ohio', 'Utah', 'Texas'], Canada: ['Ontario', 'Quebec', 'BC', 'Alberta'], Brazil: ['B1', 'B2'], Argentina: ['A1', 'A2', 'A3'], Ecuador: ['EC1', 'EC2'] }
const FORCE = ['aa1', 'aa22', 'aa23', 'aa4', 'aa5', 'bb1', 'bb22', 'bb23', 'bb4', 'bb5']

const lists = reactive({ continents: ['Asia', 'Europe', 'NA', 'SA', 'Africa', 'ME'], countriesEast: [], countriesWest: [], states: [] })
const form = reactive({ continents: [], countriesEast: [], countriesWest: [], states: [], includes: [], excludes: [] })
const submitted = ref('')
const submittedAt = ref('')
const view = ref('Tree')

const touched = computed(() => Object.values(form).some((v) => v.length))
const allContinents = computed(() => form.continents.length === lists.continents.length)

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

const pick = (key, value, on, after) => {
  form[key] = on ? [...form[key], value] : form[key].filter((x) => x !== value)
  after?.()
}
const toggleAll = () => { form.continents = allContinents.value ? [] : [...lists.continents]; cascade() }
const fill = (key) => {
  const other = key === 'includes' ? 'excludes' : 'includes'
  const free = FORCE.filter((x) => !form[other].includes(x))
  form[key] = form[key].length === free.length ? [] : free
}
const run = () => { submitted.value = JSON.stringify(form, null, 2); submittedAt.value = new Date().toLocaleTimeString(); message.success('Run recorded — see Last run') }
const clear = () => { Object.assign(form, { continents: [], countriesEast: [], countriesWest: [], states: [], includes: [], excludes: [] }); cascade(); submitted.value = ''; submittedAt.value = '' }
</script>

<style scoped>
.c2-grid { display: grid; gap: 1rem; grid-template-columns: repeat(2, minmax(0, 1fr)); align-items: start; }
@media (max-width: 1100px) { .c2-grid { grid-template-columns: 1fr; } }
.c2-wide { grid-column: 1 / -1; }
.chips { display: flex; flex-wrap: wrap; gap: 0.4rem; }
.chip { margin: 0; padding: 0.3rem 0.7rem; border-radius: 999px; border: 1px solid var(--p-border); background: var(--p-bg); font-size: 0.85rem; line-height: 1.3; cursor: pointer; display: inline-flex; align-items: center; gap: 0.3rem; user-select: none; }
.chip:hover { border-color: var(--p-accent); color: var(--p-accent); }
.chip.ant-tag-checkable-checked { background: var(--p-accent); border-color: var(--p-accent); color: #fff; }
.chip--in.ant-tag-checkable-checked { background: #16a34a; border-color: #16a34a; }
.chip--out.ant-tag-checkable-checked { background: #dc2626; border-color: #dc2626; }
.chip--blocked { opacity: 0.35; cursor: not-allowed; text-decoration: line-through; }
.chip--blocked:hover { border-color: var(--p-border); color: inherit; }
.chip__n { font-size: 0.7rem; opacity: 0.7; padding: 0 0.35rem; border-radius: 999px; background: rgba(0, 0, 0, 0.08); }
.chip.ant-tag-checkable-checked .chip__n { background: rgba(255, 255, 255, 0.25); }
.group + .group { margin-top: 0.9rem; }
.group__label { display: flex; align-items: center; gap: 0.4rem; font-size: 0.85rem; font-weight: 600; margin-bottom: 0.45rem; }
.tree-grid { display: grid; gap: 0.75rem; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); }
.tree__col { display: grid; gap: 0.5rem; align-content: start; }
.tree__region { padding: 0.55rem 0.7rem; border-radius: 10px; background: var(--p-bg); border: 1px solid var(--p-border); display: grid; gap: 0.35rem; }
.tree__label { font-weight: 600; display: inline-flex; gap: 0.35rem; align-items: center; }
.tree__countries { display: flex; flex-wrap: wrap; gap: 0.25rem; padding-left: 1.3rem; }
.tree__countries .ant-tag { margin: 0; }
</style>
