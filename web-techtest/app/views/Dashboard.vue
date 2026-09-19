<template>
  <div class="page dash2" data-cy="dashboard">
    <header class="page__head">
      <div>
        <h1 class="page__title">Dashboard</h1>
        <p class="page__subtitle">{{ greeting }}, {{ firstName }}. Here is the overview.</p>
      </div>
      <router-link to="/tasks" class="dash2__tasks">
        <span class="dash2__tasks-icon"><CheckSquareOutlined /></span>
        <span class="dash2__tasks-text">
          <strong>{{ taskTotal === null ? 'TaskPulse' : `${taskTotal} tasks in TaskPulse` }}</strong>
          <span>{{ taskTotal === null ? 'checking the API…' : 'open the task board' }}</span>
        </span>
        <RightOutlined class="dash2__tasks-arrow" />
      </router-link>
    </header>

    <a-row :gutter="[16, 16]" class="dash2__stats">
      <a-col v-for="s in stats" :key="s.title" :xs="24" :sm="12" :xl="6">
        <div class="stat2" :data-tone="s.tone">
          <span class="stat2__icon"><component :is="s.icon" /></span>
          <div class="stat2__body">
            <span class="stat2__label">{{ s.title }}</span>
            <span class="stat2__value">{{ s.value }}<span v-if="s.suffix" class="stat2__suffix">{{ s.suffix }}</span></span>
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
                <span class="sec__count">{{ team.length }}</span>
              </div>
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
              <div class="sec">
                <span class="sec__icon"><MessageOutlined /></span>
                <h3 class="sec__title">Comments</h3>
                <span class="sec__count">{{ team.length }}</span>
              </div>
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
              <div class="sec">
                <span class="sec__icon"><AppstoreOutlined /></span>
                <h3 class="sec__title">Something Here</h3>
              </div>
              <div class="empty"><InboxOutlined class="empty__icon" /><span>No data</span><span class="empty__hint">Nothing has been added to this section yet.</span></div>
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
            </div>
            <div class="empty"><LinkOutlined class="empty__icon" /><span>No links yet</span></div>
          </div>
          <div class="page__card">
            <div class="sec">
              <span class="sec__icon"><LinkOutlined /></span>
              <h3 class="sec__title">Useful Links 2</h3>
            </div>
            <div class="empty"><LinkOutlined class="empty__icon" /><span>No links yet</span></div>
          </div>
        </div>
      </a-col>
    </a-row>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { ArrowUpOutlined, ArrowDownOutlined, LikeOutlined, ClockCircleOutlined, TeamOutlined, WalletOutlined, MessageOutlined, AppstoreOutlined, LinkOutlined, InboxOutlined, CheckSquareOutlined, RightOutlined } from '@ant-design/icons-vue'
import { useMainStore } from '../store.js'
import { tasksApi } from '../taskpulse.js'

const store = useMainStore()
const identity = computed(() => store.user?.nickname || store.user?.user_meta?.email || store.user?.username || 'there')
const firstName = computed(() => identity.value.replace(/@.*/, ''))
const greeting = computed(() => { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening' })

const stats = [
  { title: 'Feedback', value: '11.28', suffix: '%', trend: ArrowUpOutlined, icon: LikeOutlined, tone: 'up' },
  { title: 'Idle', value: '9.30', suffix: '%', trend: ArrowDownOutlined, icon: ClockCircleOutlined, tone: 'down' },
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
.dash2__tasks { display: flex; align-items: center; gap: 0.75rem; padding: 0.6rem 0.9rem; border-radius: 12px; background: var(--p-card); border: 1px solid var(--p-border); color: var(--p-text); text-decoration: none; transition: border-color 0.15s, box-shadow 0.15s; }
.dash2__tasks:hover { border-color: var(--p-accent); box-shadow: 0 0 0 3px color-mix(in srgb, var(--p-accent) 15%, transparent); color: var(--p-text); }
.dash2__tasks-icon { width: 2.25rem; height: 2.25rem; border-radius: 10px; display: grid; place-items: center; background: color-mix(in srgb, var(--p-accent) 12%, transparent); color: var(--p-accent); font-size: 1.1rem; }
.dash2__tasks-text { display: grid; line-height: 1.25; }
.dash2__tasks-text span { font-size: 0.78rem; color: var(--p-muted); }
.dash2__tasks-arrow { color: var(--p-muted); font-size: 0.8rem; }

.stat2 { display: flex; align-items: center; gap: 0.9rem; background: var(--p-card); border: 1px solid var(--p-border); border-radius: 14px; padding: 1rem 1.1rem; transition: transform 0.25s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.25s; }
.stat2:hover { transform: translateY(-2px); box-shadow: 0 10px 30px rgba(15, 23, 42, 0.08); }
.stat2__icon { flex: none; width: 3rem; height: 3rem; border-radius: 12px; display: grid; place-items: center; font-size: 1.3rem; background: color-mix(in srgb, var(--p-accent) 12%, transparent); color: var(--p-accent); }
.stat2[data-tone="up"] .stat2__icon { background: rgba(22, 163, 74, 0.12); color: #16a34a; }
.stat2[data-tone="down"] .stat2__icon { background: rgba(239, 68, 68, 0.12); color: #ef4444; }
.stat2__body { display: grid; gap: 0.15rem; min-width: 0; flex: 1; }
.stat2__label { font-size: 0.74rem; color: var(--p-muted); text-transform: uppercase; letter-spacing: 0.06em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.stat2__value { font-size: 1.6rem; font-weight: 700; line-height: 1.1; font-variant-numeric: tabular-nums; }
.stat2__suffix { font-size: 0.95rem; font-weight: 600; margin-left: 0.15rem; color: var(--p-muted); }
.stat2__trend { flex: none; width: 1.75rem; height: 1.75rem; border-radius: 50%; display: grid; place-items: center; font-size: 0.85rem; }
.stat2__trend[data-tone="up"] { background: rgba(22, 163, 74, 0.12); color: #16a34a; }
.stat2__trend[data-tone="down"] { background: rgba(239, 68, 68, 0.12); color: #ef4444; }

.team { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.75rem; }
.member { display: grid; justify-items: center; gap: 0.2rem; padding: 0.9rem 0.5rem; border-radius: 12px; background: var(--p-bg); border: 1px solid var(--p-border); text-align: center; }
.member__avatar { width: 52px; height: 52px; border-radius: 50%; display: grid; place-items: center; color: #fff; font-weight: 700; font-size: 1.2rem; margin-bottom: 0.25rem; }
.member__name { font-weight: 600; }
.member__title { font-size: 0.78rem; color: var(--p-muted); }
.comments { list-style: none; margin: 0; padding: 0; display: grid; }
.comment { display: flex; gap: 0.75rem; padding: 0.7rem 0; border-bottom: 1px solid var(--p-border); }
.comment:first-child { padding-top: 0; }
.comment:last-child { border-bottom: 0; padding-bottom: 0; }
.comment__body { min-width: 0; }
.comment__title { font-weight: 600; color: var(--p-text); }
.comment__title:hover { color: var(--p-accent); }
.comment__text { margin: 0.15rem 0 0; font-size: 0.85rem; color: var(--p-muted); }

</style>
