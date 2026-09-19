<template>
  <div class="page dash2" data-cy="dashboard">
    <header class="page__head">
      <div>
        <h1 class="page__title">Dashboard</h1>
        <p class="page__subtitle">{{ greeting }}, {{ firstName }}. Here is the overview.</p>
      </div>
      <a-space>
        <a-tag class="pill" :color="taskTotal === null ? 'default' : 'success'"><span class="pill__dot" />TaskPulse {{ taskTotal === null ? 'checking…' : `${taskTotal} tasks` }}</a-tag>
        <router-link to="/tasks"><a-button size="small">open task board</a-button></router-link>
      </a-space>
    </header>

    <a-row :gutter="[16, 16]" class="dash2__stats">
      <a-col v-for="s in stats" :key="s.title" :xs="12" :xl="6">
        <div class="stat2" :data-tone="s.tone">
          <div class="stat2__top">
            <span class="stat2__label">{{ s.title }}</span>
            <span class="stat2__icon"><component :is="s.icon" /></span>
          </div>
          <div class="stat2__value">
            <component v-if="s.arrow" :is="s.arrow" class="stat2__arrow" />
            {{ s.value }}<span v-if="s.suffix" class="stat2__suffix">{{ s.suffix }}</span>
          </div>
        </div>
      </a-col>
    </a-row>

    <a-row :gutter="[16, 16]">
      <a-col :xs="24" :xl="16">
        <a-row :gutter="[16, 16]">
          <a-col :xs="24" :md="12">
            <div class="page__card">
              <div class="panel__head"><h3 class="page__h3" style="margin: 0">Team Members</h3><span class="page__muted">{{ team.length }}</span></div>
              <ul class="team">
                <li v-for="m in team" :key="m.name" class="member">
                  <span class="member__avatar" :style="{ background: hue(m.name) }">{{ m.name.slice(0, 1) }}</span>
                  <span class="member__name">{{ m.name }}</span>
                  <span class="member__title">{{ m.title }}</span>
                </li>
              </ul>
            </div>
          </a-col>
          <a-col :xs="24" :md="12">
            <div class="page__card">
              <div class="panel__head"><h3 class="page__h3" style="margin: 0">Comments</h3><span class="page__muted">{{ team.length }}</span></div>
              <ul class="comments">
                <li v-for="(m, i) in team" :key="i" class="comment">
                  <a-avatar :src="commentAvatar" :size="36" />
                  <div class="comment__body">
                    <a href="https://www.antdv.com/" target="_blank" rel="noopener" class="comment__title">{{ m.title }}</a>
                    <p class="comment__text">Ant Design, a design language for background applications, is refined by Ant UED Team</p>
                  </div>
                </li>
              </ul>
            </div>
          </a-col>
          <a-col :span="24">
            <div class="page__card">
              <h3 class="page__h3">Something Here</h3>
              <a-skeleton active :paragraph="{ rows: 2 }" :title="false" />
            </div>
          </a-col>
        </a-row>
      </a-col>

      <a-col :xs="24" :xl="8">
        <div class="page__stack">
          <div class="page__card">
            <h3 class="page__h3">Useful Links</h3>
            <a-skeleton active :paragraph="{ rows: 3 }" :title="false" />
          </div>
          <div class="page__card">
            <h3 class="page__h3">Useful Links 2</h3>
            <a-skeleton active :paragraph="{ rows: 15 }" :title="false" />
          </div>
        </div>
      </a-col>
    </a-row>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { ArrowUpOutlined, ArrowDownOutlined, LikeOutlined, ClockCircleOutlined, TeamOutlined, WalletOutlined } from '@ant-design/icons-vue'
import { useMainStore } from '../store.js'
import { tasksApi } from '../taskpulse.js'

const store = useMainStore()
const identity = computed(() => store.user?.nickname || store.user?.user_meta?.email || store.user?.username || 'there')
const firstName = computed(() => identity.value.replace(/@.*/, ''))
const greeting = computed(() => { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening' })

const stats = [
  { title: 'Feedback', value: '11.28', suffix: '%', arrow: ArrowUpOutlined, icon: LikeOutlined, tone: 'up' },
  { title: 'Idle', value: '9.30', suffix: '%', arrow: ArrowDownOutlined, icon: ClockCircleOutlined, tone: 'down' },
  { title: 'Active Users', value: '112,893', icon: TeamOutlined, tone: 'neutral' },
  { title: 'Account Balance (CNY)', value: '112,893.00', icon: WalletOutlined, tone: 'neutral' },
]
const team = [
  { name: 'Faith', title: 'Full-stack Dev' },
  { name: 'Hope', title: 'Data Scientist' },
  { name: 'Charity', title: 'Data Engineer' },
  { name: 'Love', title: 'Data Scientist' },
]
const commentAvatar = 'https://zos.alipayobjects.com/rmsportal/ODTLcjxAfvqbxHnVXCYX.png'
const hue = (name) => `hsl(${[...name].reduce((a, c) => a + c.charCodeAt(0), 0) % 360} 55% 45%)`

const taskTotal = ref(null)
onMounted(async () => {
  try { taskTotal.value = (await tasksApi.list({ pageSize: 1 })).total } catch { taskTotal.value = null }
})
</script>

<style scoped>
.dash2__stats { margin-bottom: 1rem; }
.stat2 { background: var(--p-card); border: 1px solid var(--p-border); border-radius: 14px; padding: 1rem 1.1rem; display: grid; gap: 0.35rem; transition: transform 0.25s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.25s; }
.stat2:hover { transform: translateY(-2px); box-shadow: 0 10px 30px rgba(15, 23, 42, 0.08); }
.stat2__top { display: flex; justify-content: space-between; align-items: center; }
.stat2__label { font-size: 0.8rem; color: var(--p-muted); text-transform: uppercase; letter-spacing: 0.06em; }
.stat2__icon { width: 2rem; height: 2rem; border-radius: 8px; display: grid; place-items: center; background: color-mix(in srgb, var(--p-accent) 12%, transparent); color: var(--p-accent); }
.stat2[data-tone="up"] .stat2__icon { background: rgba(22, 163, 74, 0.12); color: #16a34a; }
.stat2[data-tone="down"] .stat2__icon { background: rgba(239, 68, 68, 0.12); color: #ef4444; }
.stat2__value { font-size: 1.9rem; font-weight: 700; line-height: 1.1; font-variant-numeric: tabular-nums; display: flex; align-items: baseline; gap: 0.35rem; }
.stat2[data-tone="up"] .stat2__value { color: #16a34a; }
.stat2[data-tone="down"] .stat2__value { color: #ef4444; }
.stat2__arrow { font-size: 1.1rem; }
.stat2__suffix { font-size: 1rem; font-weight: 600; margin-left: 0.15rem; }
.team { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 0.75rem; }
.member { display: grid; justify-items: center; gap: 0.25rem; padding: 1rem 0.5rem; border-radius: 12px; background: var(--p-bg); border: 1px solid var(--p-border); text-align: center; }
.member__avatar { width: 56px; height: 56px; border-radius: 50%; display: grid; place-items: center; color: #fff; font-weight: 700; font-size: 1.3rem; }
.member__name { font-weight: 600; }
.member__title { font-size: 0.78rem; color: var(--p-muted); }
.comments { list-style: none; margin: 0; padding: 0; display: grid; }
.comment { display: flex; gap: 0.75rem; padding: 0.75rem 0; border-bottom: 1px solid var(--p-border); }
.comment:last-child { border-bottom: 0; padding-bottom: 0; }
.comment__body { min-width: 0; }
.comment__title { font-weight: 600; color: var(--p-text); }
.comment__title:hover { color: var(--p-accent); }
.comment__text { margin: 0.15rem 0 0; font-size: 0.85rem; color: var(--p-muted); }
</style>
