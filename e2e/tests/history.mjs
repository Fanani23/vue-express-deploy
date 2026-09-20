import { start, sleep, TASKPULSE } from '../lib.mjs'

// A record's history: who changed what, with the per-field diff of every update - on a task row and, for a whole
// catalog kind, on the Dashboard's reference-data card.
const t = await start()
await t.login()
const tok = await t.page.evaluate(() => JSON.parse(localStorage.getItem('vt.session')).tokens.access)
const auth = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tok }
const title = 'History ' + Date.now()
const task = await t.page.evaluate(async (u, h, tt) => (await fetch(u + '/api/tasks', { method: 'POST', headers: h, body: JSON.stringify({ title: tt, priority: 'Low' }) })).json(), TASKPULSE, auth, title)
await t.page.evaluate(async (u, h, tk) => fetch(u + '/api/tasks/' + tk.id, { method: 'PUT', headers: h, body: JSON.stringify({ title: tk.title, status: 'Done', priority: 'High', labels: ['hist'] }) }), TASKPULSE, auth, task)

await t.go('/tasks', 2500)
await t.page.type('[data-cy=search]', title); await t.page.keyboard.press('Enter'); await sleep(1500)
await t.page.click(`[data-cy="history-${task.id}"]`); await sleep(1500)
const drawer = (await t.page.$eval('[data-cy=history]', (e) => e.textContent)).replace(/\s+/g, ' ')
t.check('the drawer lists the create and the move with the actor', /Created/.test(drawer) && /Moved/.test(drawer) && /admin@techtest\.dev/.test(drawer), drawer.slice(0, 200))
t.check('the move shows each field that changed, from → to', /status ?Todo ?→ ?Done/.test(drawer) && /priority ?Low ?→ ?High/.test(drawer) && /labels ?— ?→ ?hist/.test(drawer), drawer.slice(0, 300))
await t.page.keyboard.press('Escape'); await sleep(400)

// catalog: change an item, then the kind's history on the Dashboard names the item and the diff
const kind = 'e2e-hist'; const code = 'c' + Date.now().toString(36)
await t.page.evaluate(async (u, h, k, c) => {
  await fetch(u + `/api/catalog/${k}`, { method: 'POST', headers: h, body: JSON.stringify({ code: c, label: 'One', attributes: { color: 'red' } }) })
  await fetch(u + `/api/catalog/${k}/${c}`, { method: 'PUT', headers: h, body: JSON.stringify({ label: 'One!', attributes: { color: 'blue' } }) })
}, TASKPULSE, auth, kind, code)
const api = await t.page.evaluate(async (u, h, k, c) => (await fetch(u + `/api/catalog/${k}/${c}/history`, { headers: h })).json(), TASKPULSE, auth, kind, code)
t.check('GET …/history carries the attribute diff', api.length === 2 && api[0].action === 'update' && api[0].changes?.['attributes.color']?.from === 'red' && api[0].changes?.['attributes.color']?.to === 'blue' && api[0].changes?.label?.to === 'One!', JSON.stringify(api).slice(0, 300))

await t.go('/dashboard', 2500)
await t.page.click(`[data-cy="kind-history-${kind}"]`); await sleep(1500)
const kd = (await t.page.$eval('[data-cy=history]', (e) => e.textContent)).replace(/\s+/g, ' ')
t.check('the kind history names the item and shows the attribute change', new RegExp('Updated ?' + code).test(kd) && /attributes\.color ?red ?→ ?blue/.test(kd) && new RegExp('Created ?' + code).test(kd), kd.slice(0, 300))
await t.page.keyboard.press('Escape'); await sleep(300)

await t.page.evaluate(async (u, h, k, c, id) => { await fetch(u + `/api/catalog/${k}/${c}`, { method: 'DELETE', headers: h }); await fetch(u + `/api/tasks/${id}?permanent=true`, { method: 'DELETE', headers: h }) }, TASKPULSE, auth, kind, code, task.id)
await t.done()
