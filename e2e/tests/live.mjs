import { start, sleep, BASE, TASKPULSE } from '../lib.mjs'

const t = await start()
await t.login()
await t.go('/tasks', 2500)

// A second tab on the Dashboard: it must follow changes made in the first tab without a reload.
const tab2 = await t.page.browserContext().newPage()
tab2.on('console', () => {})
tab2.goto(BASE + '/dashboard', { waitUntil: 'load' }).catch(() => {})
const createdToday = async () => {
  for (let i = 0; i < 10; i++) {
    await sleep(1000)
    const r = await Promise.race([tab2.evaluate(() => document.querySelector('[data-cy=stat-created-today] .stat2__value')?.textContent ?? null), sleep(3000).then(() => null)])
    if (r != null) return Number(r)
  }
  return null
}
const before = await createdToday()

await t.page.bringToFront()
const title = 'Live ' + Date.now()
await t.page.type('[data-cy=new-title]', title); await t.page.click('[data-cy=new-submit]'); await sleep(2500)

await tab2.bringToFront()
const after = await createdToday()
const activity = await tab2.evaluate(() => [...document.querySelectorAll('.act__title')].map((e) => e.textContent))
t.check('another tab updates without a reload (change event)', after === before + 1 && activity.includes(title), `created today ${before} → ${after}`)

await t.page.bringToFront()
t.check('the feed shows the change event', (await t.page.$$eval('[data-cy=feed] li', (els) => els.map((e) => e.textContent))).some((x) => /create task/.test(x)))

// Optimistic delete: hold the server's answer for 1.5 s and check the row is already gone after 150 ms.
await t.page.type('[data-cy=search]', title); await sleep(1500)
const row = await t.page.evaluateHandle((tt) => [...document.querySelectorAll('.tasks tbody tr')].find((r) => r.textContent.includes(tt)), title)
await t.page.setRequestInterception(true)
t.page.on('request', (r) => { if (r.method() === 'DELETE') setTimeout(() => r.continue(), 1500); else r.continue() })
await (await row.asElement().$('.ant-btn-dangerous')).click(); await sleep(300)
await t.clickText('.ant-popconfirm button', 'Delete'); await sleep(150)
const gone = await t.page.evaluate((tt) => ![...document.querySelectorAll('.tasks tbody tr')].some((r) => r.querySelector('.ant-select') && r.textContent.includes(tt)), title)
t.check('optimistic delete: row gone before the server answers', gone)
await sleep(2000)

const audit = await t.page.evaluate(async (u) => (await fetch(u + '/api/audit?resource=task&limit=3', { headers: { Authorization: 'Bearer ' + JSON.parse(localStorage.getItem('vt.session')).tokens.access } })).json(), TASKPULSE)
t.check('audit trail names the actor', audit.some((a) => a.action === 'delete' && a.summary === title && /@/.test(a.actor || '')), audit.map((a) => `${a.actor} ${a.action}`).join(' | '))

const anon = await t.page.evaluate(async (u) => (await fetch(u + '/api/tasks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"title":"x"}' })).status, TASKPULSE)
t.check('anonymous write is refused', anon === 401, String(anon))

// The socket: the app signs in on it with the access token, so the broadcast box is enabled and peers see who spoke;
// an anonymous connection is refused when it tries to broadcast.
const feed = await t.page.$$eval('[data-cy=feed] li', (els) => els.map((e) => e.textContent))
t.check('socket signed in with the session', feed.some((x) => /Signed in on the socket as .+@/.test(x)) && !(await t.page.$('[data-cy=broadcast-text] input[disabled], input[data-cy=broadcast-text][disabled]')))
const ws = TASKPULSE.replace(/^http/, 'ws') + '/ws'
const anonWs = await t.page.evaluate((url) => new Promise((resolve) => {
  const s = new WebSocket(url); const seen = []
  s.onmessage = (e) => { const m = JSON.parse(e.data); seen.push(m); if (m.type === 'welcome') s.send(JSON.stringify({ type: 'broadcast', data: 'anon' })); if (m.type === 'error') { s.close(); resolve(m.error) } }
  setTimeout(() => resolve('timeout ' + JSON.stringify(seen)), 4000)
}), ws)
t.check('anonymous socket cannot broadcast', /Sign in to broadcast/.test(anonWs), anonWs)

await tab2.close()
await t.done()
