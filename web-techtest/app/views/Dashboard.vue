<template>
  <div class="page dash2" data-cy="dashboard">
    <header class="page__head">
      <div>
        <h1 class="page__title">Dashboard</h1>
        <p class="page__subtitle">{{ greeting }}, {{ firstName }}. Everything on this page is read from and written to TaskPulse.</p>
      </div>
      <div class="page__actions">
        <router-link to="/tasks" class="dash2__tasks">
          <span class="dash2__tasks-icon"><CheckSquareOutlined /></span>
          <span class="dash2__tasks-text">
            <strong>{{ stats ? `${stats.total} tasks in TaskPulse` : 'TaskPulse' }}</strong>
            <span>{{ stats ? 'open the task board' : loading ? 'checking the API…' : 'API unreachable' }}</span>
          </span>
          <RightOutlined class="dash2__tasks-arrow" />
        </router-link>
        <a-tooltip title="Reload everything"><a-button @click="loadAll" :loading="loading"><template #icon><ReloadOutlined /></template></a-button></a-tooltip>
      </div>
    </header>

    <transition name="pop"><a-alert v-if="error" class="dash__alert" type="error" show-icon closable :message="error" @close="error = ''" /></transition>

    <a-row :gutter="[16, 16]" class="dash2__stats">
      <a-col v-for="s in statCards" :key="s.title" :xs="24" :sm="12" :xl="6">
        <div class="stat2" :data-tone="s.tone" :data-cy="s.cy">
          <span class="stat2__icon"><component :is="s.icon" /></span>
          <div class="stat2__body">
            <span class="stat2__label">{{ s.title }}</span>
            <span class="stat2__value">{{ s.value }}<span v-if="s.suffix" class="stat2__suffix">{{ s.suffix }}</span></span>
            <span class="stat2__hint">{{ s.hint }}</span>
          </div>
          <span v-if="s.trend" class="stat2__trend" :data-tone="s.tone"><component :is="s.trend" /></span>
        </div>
      </a-col>
    </a-row>

    <a-row :gutter="[16, 16]">
      <a-col :xs="24" :xl="16">
        <a-row :gutter="[16, 16]">
          <a-col :xs="24" :md="12">
            <div class="page__card">
              <div class="sec">
                <span class="sec__icon"><TeamOutlined /></span>
                <h3 class="sec__title">Team Members</h3>
                <span class="sec__count">{{ members.length }}</span>
              </div>
              <div v-if="!members.length && !loading" class="empty"><TeamOutlined class="empty__icon" /><span>No members yet</span><span class="empty__hint">Add the first one below.</span></div>
              <ul v-else class="team">
                <li v-for="m in members" :key="m.code" class="member">
                  <span class="member__avatar" :style="{ background: hue(m.label) }">{{ m.label.slice(0, 1).toUpperCase() }}</span>
                  <span class="member__name">{{ m.label }}</span>
                  <span class="member__title">{{ m.attributes?.title || 'no title' }}</span>
                  <span class="member__tools">
                    <a-tooltip title="Edit"><a-button size="small" type="text" @click="editMember(m)"><template #icon><EditOutlined /></template></a-button></a-tooltip>
                    <a-popconfirm title="Remove this member?" ok-text="Remove" ok-type="danger" @confirm="removeMember(m)"><a-button size="small" type="text" danger><template #icon><DeleteOutlined /></template></a-button></a-popconfirm>
                  </span>
                </li>
              </ul>
              <form class="inline-add" @submit.prevent="addMember">
                <a-input v-model:value="newMember.name" placeholder="Name" :maxlength="120" size="small" />
                <a-input v-model:value="newMember.title" placeholder="Role" :maxlength="60" size="small" />
                <a-button size="small" type="primary" html-type="submit" :disabled="!newMember.name.trim()" :loading="busy.member"><template #icon><PlusOutlined /></template>Add</a-button>
              </form>
            </div>
          </a-col>
          <a-col :xs="24" :md="12">
            <div class="page__card">
              <div class="sec">
                <span class="sec__icon"><HistoryOutlined /></span>
                <h3 class="sec__title">Recent activity</h3>
                <span class="sec__count">{{ recent.length }}</span>
              </div>
              <div v-if="!recent.length" class="empty"><HistoryOutlined class="empty__icon" /><span>No activity</span><span class="empty__hint">Tasks you create or move show up here.</span></div>
              <ul v-else class="activity">
                <li v-for="t in recent" :key="t.id" class="act">
                  <span class="act__mark" :data-status="t.status"><CheckOutlined v-if="t.status === 'Done'" /><ClockCircleOutlined v-else-if="t.status === 'InProgress'" /><BorderOutlined v-else /></span>
                  <div class="act__body">
                    <router-link :to="{ path: '/tasks', query: { q: t.title.slice(0, 40) } }" class="act__title" :title="t.title">{{ t.title }}</router-link>
                    <p class="act__text">{{ activityWord(t) }} · {{ timeAgo(t.updatedAt) }}</p>
                  </div>
                </li>
              </ul>
            </div>
          </a-col>
          <a-col :span="24">
            <div class="page__card">
              <div class="sec">
                <span class="sec__icon"><HourglassOutlined /></span>
                <h3 class="sec__title">Oldest open task</h3>
                <span v-if="stats?.oldestOpen" class="sec__count">{{ timeAgo(stats.oldestOpen.createdAt) }}</span>
              </div>
              <div v-if="!stats?.oldestOpen" class="empty"><InboxOutlined class="empty__icon" /><span>Nothing open</span><span class="empty__hint">Every task is done — or the API is unreachable.</span></div>
              <div v-else class="oldest">
                <span class="act__mark act__mark--lg" :data-status="stats.oldestOpen.status"><ClockCircleOutlined v-if="stats.oldestOpen.status === 'InProgress'" /><BorderOutlined v-else /></span>
                <div class="oldest__body">
                  <strong class="oldest__title">{{ stats.oldestOpen.title }}</strong>
                  <span class="page__muted">{{ STATUS_LABEL[stats.oldestOpen.status] }} since {{ new Date(stats.oldestOpen.createdAt).toLocaleString() }}</span>
                </div>
                <a-button v-if="stats.oldestOpen.status === 'Todo'" size="small" @click="advanceOldest('InProgress')"><template #icon><ArrowRightOutlined /></template>Start it</a-button>
                <a-button size="small" type="primary" @click="advanceOldest('Done')"><template #icon><CheckOutlined /></template>Mark done</a-button>
              </div>
            </div>
          </a-col>
        </a-row>
      </a-col>

      <a-col :xs="24" :xl="8">
        <div class="page__stack">
          <div class="page__card">
            <div class="sec">
              <span class="sec__icon"><LinkOutlined /></span>
              <h3 class="sec__title">Useful Links</h3>
              <span class="sec__count">{{ links.length }}</span>
            </div>
            <div v-if="!links.length && !loading" class="empty"><LinkOutlined class="empty__icon" /><span>No links yet</span><span class="empty__hint">Add one below — it is stored on the server.</span></div>
            <ul v-else class="links">
              <li v-for="l in links" :key="l.code" class="link">
                <a :href="linkHref(l)" target="_blank" rel="noopener" class="link__a"><LinkOutlined /> {{ l.label }}</a>
                <span class="link__url">{{ l.attributes?.url }}</span>
                <span class="link__tools">
                  <a-tooltip title="Edit"><a-button size="small" type="text" @click="editLink(l)"><template #icon><EditOutlined /></template></a-button></a-tooltip>
                  <a-popconfirm title="Remove this link?" ok-text="Remove" ok-type="danger" @confirm="removeLink(l)"><a-button size="small" type="text" danger><template #icon><DeleteOutlined /></template></a-button></a-popconfirm>
                </span>
              </li>
            </ul>
            <form class="inline-add inline-add--col" @submit.prevent="addLink">
              <a-input v-model:value="newLink.label" placeholder="Label" :maxlength="120" size="small" />
              <a-input v-model:value="newLink.url" placeholder="https://…" :maxlength="500" size="small" />
              <a-button size="small" type="primary" html-type="submit" :disabled="!newLink.label.trim() || !validUrl(newLink.url)" :loading="busy.link"><template #icon><PlusOutlined /></template>Add link</a-button>
            </form>
          </div>
          <div class="page__card">
            <div class="sec">
              <span class="sec__icon"><DatabaseOutlined /></span>
              <h3 class="sec__title">Reference data</h3>
              <span class="sec__count">{{ kinds.length }} kinds</span>
            </div>
            <div v-if="!kinds.length" class="empty"><DatabaseOutlined class="empty__icon" /><span>No catalog data</span><span class="empty__hint">Run scripts/seed.sh on TaskPulse.</span></div>
            <ul v-else class="kinds">
              <li v-for="k in kinds" :key="k.kind" class="kind">
                <router-link v-if="KIND_PAGE[k.kind]" :to="KIND_PAGE[k.kind]" class="kind__name">{{ k.kind }}</router-link>
                <span v-else class="kind__name kind__name--plain">{{ k.kind }}</span>
                <span class="kind__count">{{ k.count }}</span>
              </li>
            </ul>
            <p class="page__note">Every list on the demo pages lives in <code>/api/catalog</code>; click a kind to open the page that edits it.</p>
          </div>
        </div>
      </a-col>
    </a-row>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, h } from 'vue'
import { Modal, Input, message } from 'ant-design-vue'
import { ArrowUpOutlined, ArrowDownOutlined, MinusOutlined, CheckSquareOutlined, RightOutlined, ReloadOutlined, TeamOutlined, EditOutlined, DeleteOutlined, PlusOutlined, HistoryOutlined, CheckOutlined, ClockCircleOutlined, BorderOutlined, HourglassOutlined, InboxOutlined, ArrowRightOutlined, LinkOutlined, DatabaseOutlined, CheckCircleOutlined, PlusCircleOutlined, PercentageOutlined } from '@ant-design/icons-vue'
import { useMainStore } from '../store.js'
import { tasksApi, catalogApi, timeAgo, STATUS_LABEL } from '../taskpulse.js'

const KIND_PAGE = { regions: '/template-demos/cascade', countries: '/template-demos/cascade', states: '/template-demos/cascade2', force: '/template-demos/cascade2', places: '/template-demos/map', members: '/dashboard', links: '/dashboard', types: '/template-demos/form', tags: '/template-demos/form', sites: '/template-demos/form' }

const store = useMainStore()
const identity = computed(() => store.user?.nickname || store.user?.user_meta?.email || store.user?.username || 'there')
const firstName = computed(() => identity.value.replace(/@.*/, ''))
const greeting = computed(() => { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening' })
const hue = (name) => `hsl(${[...name].reduce((a, c) => a + c.charCodeAt(0), 0) % 360} 55% 45%)`

const loading = ref(false)
const error = ref('')
const stats = ref(null)
const members = ref([])
const links = ref([])
const kinds = ref([])
const busy = reactive({ member: false, link: false })
const newMember = reactive({ name: '', title: '' })
const newLink = reactive({ label: '', url: '' })

const recent = computed(() => stats.value?.recentlyUpdated || [])
const activityWord = (t) => (t.createdAt === t.updatedAt ? 'created' : t.status === 'Done' ? 'completed' : t.status === 'InProgress' ? 'started' : 'updated')
const trendOf = (now, before) => (now > before ? { icon: ArrowUpOutlined, tone: 'up' } : now < before ? { icon: ArrowDownOutlined, tone: 'down' } : { icon: MinusOutlined, tone: 'neutral' })
const statCards = computed(() => {
  const s = stats.value
  if (!s) return [
    { title: 'Done this week', value: '—', icon: CheckCircleOutlined, tone: 'neutral', hint: 'waiting for TaskPulse', cy: 'stat-done-week' },
    { title: 'In progress', value: '—', icon: ClockCircleOutlined, tone: 'neutral', hint: '', cy: 'stat-in-progress' },
    { title: 'Created today', value: '—', icon: PlusCircleOutlined, tone: 'neutral', hint: '', cy: 'stat-created-today' },
    { title: 'Completion rate', value: '—', icon: PercentageOutlined, tone: 'neutral', hint: '', cy: 'stat-completion' },
  ]
  const week = trendOf(s.doneThisWeek, s.donePreviousWeek)
  const rate = Math.round(s.completionRate * 100)
  return [
    { title: 'Done this week', value: String(s.doneThisWeek), icon: CheckCircleOutlined, trend: week.icon, tone: week.tone, hint: `${s.donePreviousWeek} the week before`, cy: 'stat-done-week' },
    { title: 'In progress', value: String(s.byStatus.InProgress), icon: ClockCircleOutlined, tone: 'neutral', hint: `${s.byStatus.Todo} still to do`, cy: 'stat-in-progress' },
    { title: 'Created today', value: String(s.createdToday), icon: PlusCircleOutlined, tone: 'neutral', hint: `${s.total} in total`, cy: 'stat-created-today' },
    { title: 'Completion rate', value: String(rate), suffix: '%', icon: PercentageOutlined, trend: rate >= 50 ? ArrowUpOutlined : ArrowDownOutlined, tone: rate >= 50 ? 'up' : 'down', hint: `${s.byStatus.Done} of ${s.total} done`, cy: 'stat-completion' },
  ]
})

const fail = (e) => { error.value = e?.message || String(e) }
const loadStats = async () => { try { stats.value = await tasksApi.stats(14) } catch (e) { stats.value = null; fail(e) } }
const loadMembers = async () => { try { members.value = await catalogApi.list('members') } catch (e) { fail(e) } }
const loadLinks = async () => { try { links.value = await catalogApi.list('links') } catch (e) { fail(e) } }
const loadKinds = async () => { try { kinds.value = await catalogApi.kinds() } catch (e) { fail(e) } }
const loadAll = async () => {
  loading.value = true
  error.value = ''
  await Promise.all([loadStats(), loadMembers(), loadLinks(), loadKinds()])
  loading.value = false
}

const twoFieldModal = (title, fields, onOk) => {
  const values = Object.fromEntries(fields.map((f) => [f.key, f.value]))
  Modal.confirm({
    title,
    icon: null,
    content: () => h('div', { class: 'modal-fields' }, fields.map((f) => h(Input, { defaultValue: f.value, placeholder: f.placeholder, maxlength: f.max, onChange: (e) => { values[f.key] = e.target.value } }))),
    okText: 'Save',
    onOk: () => onOk(values),
  })
}

const addMember = async () => {
  if (!newMember.name.trim()) return
  busy.member = true
  try {
    await catalogApi.create('members', { label: newMember.name.trim(), attributes: { title: newMember.title.trim() || 'Team member' }, sort: members.value.length + 1 })
    newMember.name = ''; newMember.title = ''
    await Promise.all([loadMembers(), loadKinds()])
  } catch (e) { fail(e) } finally { busy.member = false }
}
const editMember = (m) => twoFieldModal('Edit member', [{ key: 'name', value: m.label, placeholder: 'Name', max: 120 }, { key: 'title', value: m.attributes?.title || '', placeholder: 'Role', max: 60 }], async (v) => {
  if (!v.name.trim()) return
  try { await catalogApi.update('members', m.code, { label: v.name.trim(), attributes: { title: v.title.trim() || 'Team member' }, sort: m.sort }); await loadMembers() } catch (e) { fail(e) }
})
const removeMember = async (m) => { try { await catalogApi.remove('members', m.code); await Promise.all([loadMembers(), loadKinds()]) } catch (e) { fail(e) } }

const validUrl = (u) => /^(https?:\/\/|\/)/.test((u || '').trim())
const linkHref = (l) => l.attributes?.url || '#'
const addLink = async () => {
  if (!newLink.label.trim() || !validUrl(newLink.url)) return
  busy.link = true
  try {
    await catalogApi.create('links', { label: newLink.label.trim(), attributes: { url: newLink.url.trim() }, sort: links.value.length + 1 })
    newLink.label = ''; newLink.url = ''
    await Promise.all([loadLinks(), loadKinds()])
  } catch (e) { fail(e) } finally { busy.link = false }
}
const editLink = (l) => twoFieldModal('Edit link', [{ key: 'label', value: l.label, placeholder: 'Label', max: 120 }, { key: 'url', value: l.attributes?.url || '', placeholder: 'https://…', max: 500 }], async (v) => {
  if (!v.label.trim() || !validUrl(v.url)) { message.error('A label and a valid URL are required'); return }
  try { await catalogApi.update('links', l.code, { label: v.label.trim(), attributes: { url: v.url.trim() }, sort: l.sort }); await loadLinks() } catch (e) { fail(e) }
})
const removeLink = async (l) => { try { await catalogApi.remove('links', l.code); await Promise.all([loadLinks(), loadKinds()]) } catch (e) { fail(e) } }

const advanceOldest = async (status) => {
  const t = stats.value?.oldestOpen
  if (!t) return
  try {
    const full = await tasksApi.get(t.id)
    await tasksApi.update(t.id, { title: full.title, description: full.description, status })
    message.success(`"${full.title}" → ${STATUS_LABEL[status]}`)
    await loadStats()
  } catch (e) { fail(e) }
}

onMounted(loadAll)
</script>

<style scoped>
.dash2__stats { margin-bottom: 1rem; }
.dash2__tasks { display: flex; align-items: center; gap: 0.75rem; padding: 0.6rem 0.9rem; border-radius: 12px; background: var(--p-card); border: 1px solid var(--p-border); color: var(--p-text); text-decoration: none; transition: border-color 0.15s, box-shadow 0.15s; }
.dash2__tasks:hover { border-color: var(--p-accent); box-shadow: 0 0 0 3px color-mix(in srgb, var(--p-accent) 15%, transparent); color: var(--p-text); }
.dash2__tasks-icon { width: 2.25rem; height: 2.25rem; border-radius: 10px; display: grid; place-items: center; background: color-mix(in srgb, var(--p-accent) 12%, transparent); color: var(--p-accent); font-size: 1.1rem; }
.dash2__tasks-text { display: grid; line-height: 1.25; }
.dash2__tasks-text span { font-size: 0.78rem; color: var(--p-muted); }
.dash2__tasks-arrow { color: var(--p-muted); font-size: 0.8rem; }
.dash__alert { margin-bottom: 1rem; }

.stat2 { display: flex; align-items: center; gap: 0.9rem; background: var(--p-card); border: 1px solid var(--p-border); border-radius: 14px; padding: 1rem 1.1rem; transition: transform 0.25s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.25s; }
.stat2:hover { transform: translateY(-2px); box-shadow: 0 10px 30px rgba(15, 23, 42, 0.08); }
.stat2__icon { flex: none; width: 3rem; height: 3rem; border-radius: 12px; display: grid; place-items: center; font-size: 1.3rem; background: color-mix(in srgb, var(--p-accent) 12%, transparent); color: var(--p-accent); }
.stat2[data-tone="up"] .stat2__icon { background: rgba(22, 163, 74, 0.12); color: #16a34a; }
.stat2[data-tone="down"] .stat2__icon { background: rgba(239, 68, 68, 0.12); color: #ef4444; }
.stat2__body { display: grid; gap: 0.1rem; min-width: 0; flex: 1; }
.stat2__label { font-size: 0.74rem; color: var(--p-muted); text-transform: uppercase; letter-spacing: 0.06em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.stat2__value { font-size: 1.6rem; font-weight: 700; line-height: 1.1; font-variant-numeric: tabular-nums; }
.stat2__suffix { font-size: 0.95rem; font-weight: 600; margin-left: 0.15rem; color: var(--p-muted); }
.stat2__hint { font-size: 0.75rem; color: var(--p-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.stat2__trend { flex: none; width: 1.75rem; height: 1.75rem; border-radius: 50%; display: grid; place-items: center; font-size: 0.85rem; background: var(--p-bg); color: var(--p-muted); }
.stat2__trend[data-tone="up"] { background: rgba(22, 163, 74, 0.12); color: #16a34a; }
.stat2__trend[data-tone="down"] { background: rgba(239, 68, 68, 0.12); color: #ef4444; }

.team { list-style: none; margin: 0 0 0.75rem; padding: 0; display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.75rem; }
.member { position: relative; display: grid; justify-items: center; gap: 0.2rem; padding: 0.9rem 0.5rem 0.6rem; border-radius: 12px; background: var(--p-bg); border: 1px solid var(--p-border); text-align: center; }
.member__avatar { width: 52px; height: 52px; border-radius: 50%; display: grid; place-items: center; color: #fff; font-weight: 700; font-size: 1.2rem; margin-bottom: 0.25rem; }
.member__name { font-weight: 600; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.member__title { font-size: 0.78rem; color: var(--p-muted); }
.member__tools { position: absolute; top: 0.25rem; right: 0.25rem; display: flex; opacity: 0; transition: opacity 0.15s; }
.member:hover .member__tools, .member:focus-within .member__tools { opacity: 1; }
.inline-add { display: grid; grid-template-columns: 1fr 1fr auto; gap: 0.4rem; }
.inline-add--col { grid-template-columns: 1fr; }

.activity, .links, .kinds { list-style: none; margin: 0; padding: 0; display: grid; }
.act { display: flex; gap: 0.75rem; padding: 0.6rem 0; border-bottom: 1px solid var(--p-border); align-items: center; }
.act:first-child { padding-top: 0; }
.act:last-child { border-bottom: 0; padding-bottom: 0; }
.act__mark { flex: none; width: 1.8rem; height: 1.8rem; border-radius: 8px; display: grid; place-items: center; font-size: 0.85rem; background: rgba(148, 163, 184, 0.2); color: #64748b; }
.act__mark--lg { width: 2.4rem; height: 2.4rem; font-size: 1.1rem; border-radius: 10px; }
.act__mark[data-status="InProgress"] { background: rgba(59, 130, 246, 0.15); color: #3b82f6; }
.act__mark[data-status="Done"] { background: rgba(22, 163, 74, 0.15); color: #16a34a; }
.act__body { min-width: 0; }
.act__title { font-weight: 600; color: var(--p-text); display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.act__title:hover { color: var(--p-accent); }
.act__text { margin: 0.1rem 0 0; font-size: 0.8rem; color: var(--p-muted); }
.oldest { display: flex; align-items: center; gap: 0.9rem; flex-wrap: wrap; }
.oldest__body { flex: 1; min-width: 12rem; display: grid; gap: 0.15rem; }
.oldest__title { font-size: 1rem; }

.link { display: grid; grid-template-columns: 1fr auto; gap: 0 0.5rem; padding: 0.5rem 0; border-bottom: 1px solid var(--p-border); align-items: center; }
.link:last-child { border-bottom: 0; }
.link__a { grid-column: 1; font-weight: 600; color: var(--p-text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.link__a:hover { color: var(--p-accent); }
.link__url { grid-column: 1; font-size: 0.75rem; color: var(--p-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.link__tools { grid-column: 2; grid-row: 1 / span 2; display: flex; }
.links { margin-bottom: 0.75rem; }
.kind { display: flex; justify-content: space-between; align-items: center; padding: 0.35rem 0; border-bottom: 1px solid var(--p-border); font-size: 0.9rem; }
.kind:last-child { border-bottom: 0; }
.kind__name { font-family: ui-monospace, Menlo, Consolas, monospace; color: var(--p-accent); }
.kind__name--plain { color: var(--p-text); }
.kind__count { font-size: 0.75rem; font-weight: 600; padding: 0.05rem 0.5rem; border-radius: 999px; background: var(--p-bg); border: 1px solid var(--p-border); color: var(--p-muted); }
</style>
<style>
.modal-fields { display: grid; gap: 0.5rem; margin-top: 0.5rem; }
</style>
