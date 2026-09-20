import { start, sleep, TASKPULSE } from '../lib.mjs'

// An Admin registers a webhook on the Dashboard and a task change is delivered to it. The receiver is the API's own
// audit-ingest endpoint on loopback: it rejects the webhook body (a 4xx, no internal token and not its shape) every
// time, which is exactly what the delivery log should show: three attempts, the sink's status, not delivered.
const t = await start()
await t.login()
// the sink is the API's own loopback address (E2E_WEBHOOK_SINK when the API listens elsewhere, e.g. in a container)
const url = process.env.E2E_WEBHOOK_SINK || 'http://127.0.0.1:5080/api/audit'
await t.page.type('[data-cy=hook-url]', url)
await t.page.type('[data-cy=hook-secret]', 'e2e-webhook-secret-0123456789')
await t.page.click('[data-cy=hook-add]'); await sleep(1500)
const listed = await t.page.$$eval('[data-cy=webhooks] .hook', (els) => els.map((e) => e.textContent.replace(/\s+/g, ' ').trim()))
t.check('the webhook is listed', listed.some((x) => x.includes(url.replace(/^https?:\/\//, ''))), listed.join(' | '))

const tok = await t.page.evaluate(() => JSON.parse(localStorage.getItem('vt.session')).tokens.access)
const created = await t.page.evaluate(async (u, tok) => (await fetch(u + '/api/tasks', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tok }, body: JSON.stringify({ title: 'webhook e2e' }) })).json(), TASKPULSE, tok)
await sleep(7000) // three attempts, 1 s + 4 s apart
const hooks = await t.page.evaluate(async (u, tok) => (await fetch(u + '/api/webhooks', { headers: { Authorization: 'Bearer ' + tok } })).json(), TASKPULSE, tok)
const hook = hooks.find((h) => h.url === url)
const deliveries = await t.page.evaluate(async (u, tok, id) => (await fetch(u + `/api/webhooks/${id}/deliveries`, { headers: { Authorization: 'Bearer ' + tok } })).json(), TASKPULSE, tok, hook.id)
const d = deliveries.find((x) => x.event === 'task.create')
t.check('the change was delivered (three attempts, the sink answers 4xx) and logged', !!d && d.attempts === 3 && d.status >= 400 && d.status < 500 && !d.delivered, JSON.stringify(d) + ' :: ' + JSON.stringify(deliveries).slice(0, 200))
await t.page.reload({ waitUntil: 'networkidle0' }); await sleep(800)
const card = (await t.page.$eval('[data-cy=webhooks]', (e) => e.textContent)).replace(/\s+/g, ' ')
t.check('the hook shows its last status on the card', /last 4\d\d /.test(card), card)

await t.page.evaluate(async (u, tok, id, taskId) => { await fetch(u + `/api/webhooks/${id}`, { method: 'DELETE', headers: { Authorization: 'Bearer ' + tok } }); await fetch(u + `/api/tasks/${taskId}?permanent=true`, { method: 'DELETE', headers: { Authorization: 'Bearer ' + tok } }) }, TASKPULSE, tok, hook.id, created.id)
await t.done()
