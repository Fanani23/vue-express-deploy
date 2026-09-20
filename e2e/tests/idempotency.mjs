import { start, TASKPULSE } from '../lib.mjs'

// Safe retries: the same POST sent twice with one Idempotency-Key makes one task; the repeat is the first answer.
const t = await start()
await t.login()
const tok = await t.page.evaluate(() => JSON.parse(localStorage.getItem('vt.session')).tokens.access)
const title = 'Idempotent ' + Date.now()
const key = 'e2e-' + Date.now()
const post = (body, k = key) => t.page.evaluate(async (u, tok, b, k) => {
  const r = await fetch(u + '/api/tasks', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tok, 'Idempotency-Key': k }, body: JSON.stringify(b) })
  return { status: r.status, replayed: r.headers.get('Idempotent-Replayed'), location: r.headers.get('Location'), body: await r.json().catch(() => null) }
}, TASKPULSE, tok, body, k)

const first = await post({ title })
const again = await post({ title })
t.check('the first POST creates, the repeat replays the same task', first.status === 201 && again.status === 201 && again.replayed === 'true' && again.body?.id === first.body?.id && again.location === first.location, JSON.stringify([first.status, again.status, again.replayed]))
const changed = await post({ title: title + ' other' })
t.check('the same key with another body is refused (422)', changed.status === 422 && /different request/.test(changed.body?.title || ''), JSON.stringify(changed).slice(0, 200))
const list = await t.page.evaluate(async (u, q) => (await fetch(u + '/api/tasks?q=' + encodeURIComponent(q))).json(), TASKPULSE, title)
t.check('exactly one task exists', list.total === 1, `total ${list.total}`)

await t.page.evaluate(async (u, tok, id) => fetch(u + `/api/tasks/${id}?permanent=true`, { method: 'DELETE', headers: { Authorization: 'Bearer ' + tok } }), TASKPULSE, tok, first.body.id)
await t.done()
