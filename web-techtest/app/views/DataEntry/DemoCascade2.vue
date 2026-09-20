<template>
  <div class="page">
    <header class="page__head">
      <div>
        <h1 class="page__title">Cascading selects, three levels</h1>
        <p class="page__subtitle">Continents → countries (split by hemisphere) → states, plus a pair of include/exclude lists that can never overlap. Every level is a catalog kind in TaskPulse — the same <code>regions</code> and <code>countries</code> the Cascade page edits, plus <code>states</code> and <code>force</code> which you can edit here.</p>
      </div>
      <div class="page__actions">
        <a-tag class="pill" :color="error ? 'error' : 'blue'"><DatabaseOutlined />{{ error ? 'API error' : `${lists.continents.length} · ${countries.length} · ${states.length} · ${force.length}` }}</a-tag>
        <a-button @click="clear" :disabled="!touched && !saved"><template #icon><ClearOutlined /></template>Clear</a-button>
        <a-button type="primary" @click="run" :disabled="!touched" :loading="saving"><template #icon><PlayCircleOutlined /></template>Run</a-button>
      </div>
    </header>

    <transition name="pop"><a-alert v-if="error" type="error" show-icon closable :message="error" class="alert" @close="error = ''" /></transition>

    <div class="c2-grid">
      <div class="page__card">
        <div class="sec">
          <span class="sec__icon"><GlobalOutlined /></span>
          <h3 class="sec__title">1 · Continents</h3>
          <span class="sec__count">{{ form.continents.length }} / {{ lists.continents.length }}</span>
          <a-button size="small" type="text" :disabled="!lists.continents.length" @click="toggleAll">{{ allContinents ? 'none' : 'all' }}</a-button>
        </div>
        <div v-if="!lists.continents.length && !loading" class="empty"><GlobalOutlined class="empty__icon" /><span>No continents</span><span class="empty__hint">Add regions on the <router-link to="/template-demos/cascade">Cascade</router-link> page.</span></div>
        <div v-else class="chips">
          <a-checkable-tag v-for="c in lists.continents" :key="c.code" :checked="form.continents.includes(c.code)" class="chip" @change="(on) => pick('continents', c.code, on, cascade)">
            <EnvironmentOutlined /> {{ c.label }} <span class="chip__n">{{ countriesOf(c.code).length }}</span><span class="chip__side">{{ c.attributes?.side === 'west' ? 'W' : 'E' }}</span>
          </a-checkable-tag>
        </div>
        <p class="page__note">The hemisphere comes from each region's <code>attributes.side</code>. Regions and countries are edited on the <router-link to="/template-demos/cascade">Cascade</router-link> page.</p>
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
            <div class="chips"><a-checkable-tag v-for="c in lists.countriesEast" :key="c.code" :checked="form.countriesEast.includes(c.code)" class="chip" @change="(on) => pick('countriesEast', c.code, on)">{{ c.label }}</a-checkable-tag></div>
          </div>
          <div class="group" v-if="lists.countriesWest.length">
            <div class="group__label"><CompassOutlined /> West hemisphere <span class="page__muted">{{ form.countriesWest.length }} / {{ lists.countriesWest.length }}</span></div>
            <div class="chips"><a-checkable-tag v-for="c in lists.countriesWest" :key="c.code" :checked="form.countriesWest.includes(c.code)" class="chip" @change="(on) => pick('countriesWest', c.code, on, cascadeStates)">{{ c.label }} <span class="chip__n">{{ statesOf(c.code).length }}</span></a-checkable-tag></div>
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
        <div v-else class="chips">
          <span v-for="s in lists.states" :key="s.code" class="chipwrap">
            <a-checkable-tag :checked="form.states.includes(s.code)" class="chip" @change="(on) => pick('states', s.code, on)">{{ s.label }}</a-checkable-tag>
            <a-popconfirm :title="`Delete state ${s.label}?`" ok-text="Delete" ok-type="danger" @confirm="removeItem('states', s)"><button type="button" class="chip__x" :aria-label="'delete ' + s.label"><CloseOutlined /></button></a-popconfirm>
          </span>
        </div>
        <form class="add add--state" @submit.prevent="addState">
          <a-input v-model:value="newState.label" placeholder="New state" :maxlength="120" size="small" data-cy="new-state" />
          <a-select v-model:value="newState.parent" placeholder="in country" size="small" :options="westCountries.map((c) => ({ value: c.code, label: c.label }))" data-cy="new-state-country" />
          <a-button size="small" html-type="submit" :disabled="!newState.label.trim() || !newState.parent" :loading="busy.state"><template #icon><PlusOutlined /></template>Add</a-button>
        </form>
      </div>

      <div class="page__card">
        <div class="sec">
          <span class="sec__icon"><SwapOutlined /></span>
          <h3 class="sec__title">Force include / exclude</h3>
          <span class="sec__count">{{ form.includes.length }} in · {{ form.excludes.length }} out</span>
        </div>
        <div class="group">
          <div class="group__label"><PlusCircleOutlined /> Include <a-button size="small" type="text" :disabled="!force.length" @click="fill('includes')">{{ force.length && form.includes.length === force.length - form.excludes.length ? 'none' : 'all' }}</a-button></div>
          <div v-if="!force.length" class="empty"><SwapOutlined class="empty__icon" /><span>No values</span></div>
          <div v-else class="chips"><a-checkable-tag v-for="f in force" :key="f.code" :checked="form.includes.includes(f.code)" class="chip chip--in" :class="{ 'chip--blocked': form.excludes.includes(f.code) }" @change="(on) => !form.excludes.includes(f.code) && pick('includes', f.code, on)">{{ f.label }}</a-checkable-tag></div>
        </div>
        <div class="group">
          <div class="group__label"><MinusCircleOutlined /> Exclude <a-button size="small" type="text" :disabled="!force.length" @click="fill('excludes')">{{ force.length && form.excludes.length === force.length - form.includes.length ? 'none' : 'all' }}</a-button></div>
          <div v-if="force.length" class="chips">
            <span v-for="f in force" :key="f.code" class="chipwrap">
              <a-checkable-tag :checked="form.excludes.includes(f.code)" class="chip chip--out" :class="{ 'chip--blocked': form.includes.includes(f.code) }" @change="(on) => !form.includes.includes(f.code) && pick('excludes', f.code, on)">{{ f.label }}</a-checkable-tag>
              <a-popconfirm :title="`Delete ${f.label} from the force list?`" ok-text="Delete" ok-type="danger" @confirm="removeItem('force', f)"><button type="button" class="chip__x" :aria-label="'delete ' + f.label"><CloseOutlined /></button></a-popconfirm>
            </span>
          </div>
        </div>
        <form class="add" @submit.prevent="addForce">
          <a-input v-model:value="newForce" placeholder="New value, e.g. cc1" :maxlength="120" size="small" data-cy="new-force" />
          <a-button size="small" html-type="submit" :disabled="!newForce.trim()" :loading="busy.force"><template #icon><PlusOutlined /></template>Add</a-button>
        </form>
        <p class="page__note">A value chosen on one side is greyed out on the other — the lists can never overlap. Hover a value in the exclude row to delete it.</p>
      </div>

      <div class="page__card c2-wide">
        <div class="sec">
          <span class="sec__icon"><ApartmentOutlined /></span>
          <h3 class="sec__title">Selection</h3>
          <a-segmented v-model:value="view" :options="['Tree', 'JSON']" size="small" />
          <span class="sec__count" style="margin-left: auto">{{ saved ? 'last run ' + timeAgo(saved.updatedAt) : 'not run yet' }}</span>
          <a-button v-if="saved" size="small" type="text" @click="restore">restore last run</a-button>
        </div>
        <div v-if="!touched" class="empty"><ApartmentOutlined class="empty__icon" /><span>Nothing selected</span></div>
        <div v-else-if="view === 'Tree'" class="tree-grid">
          <div class="tree__col">
            <div v-for="c in form.continents" :key="c" class="tree__region">
              <span class="tree__label"><EnvironmentOutlined /> {{ labelOf(lists.continents, c) }}</span>
              <div class="tree__countries">
                <template v-for="k in countriesOf(c).filter((x) => form.countriesEast.includes(x.code) || form.countriesWest.includes(x.code))" :key="k.code">
                  <a-tag color="blue">{{ k.label }}</a-tag>
                  <a-tag v-for="s in statesOf(k.code).filter((x) => form.states.includes(x.code))" :key="s.code" color="green">{{ s.label }}</a-tag>
                </template>
                <span v-if="!countriesOf(c).some((x) => form.countriesEast.includes(x.code) || form.countriesWest.includes(x.code))" class="page__muted">no country chosen</span>
              </div>
            </div>
            <div v-if="!form.continents.length" class="page__muted">no continent chosen</div>
          </div>
          <div class="tree__col">
            <div class="tree__region"><span class="tree__label"><PlusCircleOutlined /> Include</span><div class="tree__countries"><a-tag v-for="f in form.includes" :key="f" color="green">{{ labelOf(force, f) }}</a-tag><span v-if="!form.includes.length" class="page__muted">none</span></div></div>
            <div class="tree__region"><span class="tree__label"><MinusCircleOutlined /> Exclude</span><div class="tree__countries"><a-tag v-for="f in form.excludes" :key="f" color="red">{{ labelOf(force, f) }}</a-tag><span v-if="!form.excludes.length" class="page__muted">none</span></div></div>
          </div>
        </div>
        <pre v-else class="code">{{ JSON.stringify(form, null, 2) }}</pre>
        <template v-if="saved">
          <div class="sec" style="margin-top: 1rem"><span class="sec__icon"><CheckCircleOutlined /></span><h3 class="sec__title">Last run</h3><span class="sec__count">catalog/selections-2/{{ key }}</span></div>
          <pre class="code">{{ JSON.stringify(saved.attributes, null, 2) }}</pre>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup>
import { reactive, ref, computed, onMounted } from 'vue'
import { message } from 'ant-design-vue'
import { DatabaseOutlined, ClearOutlined, PlayCircleOutlined, GlobalOutlined, EnvironmentOutlined, FlagOutlined, CompassOutlined, PushpinOutlined, SwapOutlined, PlusCircleOutlined, MinusCircleOutlined, ApartmentOutlined, CheckCircleOutlined, PlusOutlined, CloseOutlined } from '@ant-design/icons-vue'
import { useMainStore } from '../../store.js'
import { catalogApi, timeAgo, userKey, useChangeFeed } from '../../taskpulse.js'

const store = useMainStore()
const key = computed(() => userKey(store.user))

const regions = ref([])
const countries = ref([])
const states = ref([])
const force = ref([])
const loading = ref(false)
const saving = ref(false)
const saved = ref(null)
const error = ref('')
const busy = reactive({ state: false, force: false })
const newState = reactive({ label: '', parent: undefined })
const newForce = ref('')

const lists = reactive({ continents: [], countriesEast: [], countriesWest: [], states: [] })
const form = reactive({ continents: [], countriesEast: [], countriesWest: [], states: [], includes: [], excludes: [] })
const view = ref('Tree')

const touched = computed(() => Object.values(form).some((v) => v.length))
const allContinents = computed(() => lists.continents.length > 0 && form.continents.length === lists.continents.length)
const labelOf = (list, code) => list.find((x) => x.code === code)?.label || code
const isWest = (regionCode) => regions.value.find((r) => r.code === regionCode)?.attributes?.side === 'west'
const countriesOf = (regionCode) => countries.value.filter((c) => c.parents.includes(regionCode))
const statesOf = (countryCode) => states.value.filter((s) => s.parents.includes(countryCode))
const westCountries = computed(() => { const seen = new Set(); return regions.value.filter((r) => isWest(r.code)).flatMap((r) => countriesOf(r.code)).filter((c) => !seen.has(c.code) && seen.add(c.code)) })

const fail = (e) => { error.value = e?.message || String(e) }
const load = async () => {
  loading.value = true
  try {
    const [r, c, s, f] = await Promise.all([catalogApi.list('regions'), catalogApi.list('countries'), catalogApi.list('states'), catalogApi.list('force')])
    regions.value = r; countries.value = c; states.value = s; force.value = f
    lists.continents = r
    cascade()
    form.includes = form.includes.filter((x) => f.some((y) => y.code === x))
    form.excludes = form.excludes.filter((x) => f.some((y) => y.code === x))
  } catch (e) { fail(e) } finally { loading.value = false }
}
const loadSaved = async () => { try { saved.value = await catalogApi.find('selections-2', key.value) } catch { saved.value = null } }

const dedupe = (items) => { const seen = new Set(); return items.filter((c) => !seen.has(c.code) && seen.add(c.code)) }
const narrow = (listKey, formKey, items) => {
  lists[listKey] = items
  form[formKey] = form[formKey].filter((x) => items.some((i) => i.code === x))
}
const cascadeStates = () => narrow('states', 'states', dedupe(form.countriesWest.flatMap(statesOf)))
const cascade = () => {
  narrow('countriesEast', 'countriesEast', dedupe(form.continents.filter((c) => !isWest(c)).flatMap(countriesOf)))
  narrow('countriesWest', 'countriesWest', dedupe(form.continents.filter(isWest).flatMap(countriesOf)))
  cascadeStates()
}

const pick = (key, value, on, after) => {
  form[key] = on ? [...form[key], value] : form[key].filter((x) => x !== value)
  after?.()
}
const toggleAll = () => { form.continents = allContinents.value ? [] : lists.continents.map((c) => c.code); cascade() }
const fill = (key) => {
  const other = key === 'includes' ? 'excludes' : 'includes'
  const free = force.value.map((f) => f.code).filter((x) => !form[other].includes(x))
  form[key] = form[key].length === free.length ? [] : free
}

const addState = async () => {
  if (!newState.label.trim() || !newState.parent) return
  busy.state = true
  try { await catalogApi.create('states', { label: newState.label.trim(), parents: [newState.parent] }); newState.label = ''; newState.parent = undefined; await load() } catch (e) { fail(e) } finally { busy.state = false }
}
const addForce = async () => {
  if (!newForce.value.trim()) return
  busy.force = true
  try { await catalogApi.create('force', { label: newForce.value.trim(), sort: force.value.length + 1 }); newForce.value = ''; await load() } catch (e) { fail(e) } finally { busy.force = false }
}
const removeItem = async (kind, item) => { try { await catalogApi.remove(kind, item.code); await load() } catch (e) { fail(e) } }

const run = async () => {
  saving.value = true
  try {
    saved.value = await catalogApi.upsert('selections-2', key.value, { label: `Cascade 2 run of ${key.value}`, attributes: JSON.parse(JSON.stringify(form)) })
    message.success('Run recorded — see Last run')
  } catch (e) { fail(e) } finally { saving.value = false }
}
const restore = () => {
  const a = saved.value?.attributes || {}
  form.continents = [...(a.continents || [])]; cascade()
  form.countriesEast = (a.countriesEast || []).filter((x) => lists.countriesEast.some((i) => i.code === x))
  form.countriesWest = (a.countriesWest || []).filter((x) => lists.countriesWest.some((i) => i.code === x)); cascadeStates()
  form.states = (a.states || []).filter((x) => lists.states.some((i) => i.code === x))
  form.includes = [...(a.includes || [])]; form.excludes = [...(a.excludes || [])]
}
const clear = async () => {
  Object.assign(form, { continents: [], countriesEast: [], countriesWest: [], states: [], includes: [], excludes: [] }); cascade()
  if (saved.value) { try { await catalogApi.remove('selections-2', key.value); saved.value = null } catch (e) { fail(e) } }
}

onMounted(() => Promise.all([load(), loadSaved()]))
useChangeFeed(() => Promise.all([load(), loadSaved()]), { resources: ['catalog'] })
</script>

<style scoped>
.alert { margin-bottom: 1rem; }
.c2-grid { display: grid; gap: 1rem; grid-template-columns: repeat(2, minmax(0, 1fr)); align-items: start; }
@media (max-width: 1100px) { .c2-grid { grid-template-columns: 1fr; } }
.c2-wide { grid-column: 1 / -1; }
.chips { display: flex; flex-wrap: wrap; gap: 0.4rem; }
.chipwrap { position: relative; display: inline-flex; }
.chip { margin: 0; padding: 0.3rem 0.7rem; border-radius: 999px; border: 1px solid var(--p-border); background: var(--p-bg); font-size: 0.85rem; line-height: 1.3; cursor: pointer; display: inline-flex; align-items: center; gap: 0.3rem; user-select: none; }
.chip:hover { border-color: var(--p-accent); color: var(--p-accent); }
.chip.ant-tag-checkable-checked { background: var(--p-accent); border-color: var(--p-accent); color: #fff; }
.chip--in.ant-tag-checkable-checked { background: #16a34a; border-color: #16a34a; }
.chip--out.ant-tag-checkable-checked { background: #dc2626; border-color: #dc2626; }
.chip--blocked { opacity: 0.35; cursor: not-allowed; text-decoration: line-through; }
.chip--blocked:hover { border-color: var(--p-border); color: inherit; }
.chip__n { font-size: 0.7rem; opacity: 0.7; padding: 0 0.35rem; border-radius: 999px; background: rgba(0, 0, 0, 0.08); }
.chip__side { font-size: 0.65rem; font-weight: 700; opacity: 0.6; }
.chip.ant-tag-checkable-checked .chip__n { background: rgba(255, 255, 255, 0.25); }
.chip__x { position: absolute; top: -0.35rem; right: -0.35rem; width: 1.1rem; height: 1.1rem; border-radius: 50%; border: 1px solid var(--p-border); background: var(--p-card); color: var(--p-muted); font-size: 0.55rem; display: grid; place-items: center; cursor: pointer; opacity: 0; transition: opacity 0.15s; padding: 0; }
.chipwrap:hover .chip__x, .chip__x:focus-visible { opacity: 1; }
.chip__x:hover { color: #ef4444; border-color: #ef4444; }
.add { display: grid; grid-template-columns: 1fr auto; gap: 0.4rem; margin-top: 0.75rem; }
.add--state { grid-template-columns: 1fr 1fr auto; }
.group + .group { margin-top: 0.9rem; }
.group__label { display: flex; align-items: center; gap: 0.4rem; font-size: 0.85rem; font-weight: 600; margin-bottom: 0.45rem; }
.tree-grid { display: grid; gap: 0.75rem; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); }
.tree__col { display: grid; gap: 0.5rem; align-content: start; }
.tree__region { padding: 0.55rem 0.7rem; border-radius: 10px; background: var(--p-bg); border: 1px solid var(--p-border); display: grid; gap: 0.35rem; }
.tree__label { font-weight: 600; display: inline-flex; gap: 0.35rem; align-items: center; }
.tree__countries { display: flex; flex-wrap: wrap; gap: 0.25rem; padding-left: 1.3rem; }
.tree__countries .ant-tag { margin: 0; }
</style>
