import { start, sleep, TASKPULSE } from '../lib.mjs'

// Cursor paging: a page's nextCursor continues after the last row shown, so a task someone adds at the front
// meanwhile does not push a row from page 1 onto page 2 - offset paging shows that row twice.
const t = await start()
await t.login()
const tok = await t.page.evaluate(() => JSON.parse(localStorage.getItem('vt.session')).tokens.access)
const auth = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tok }
const tag = 'cur' + Date.now().toString(36)
await t.page.evaluate(async (u, h, tag) => {
  for (let i = 0; i < 12; i++) await fetch(u + '/api/tasks', { method: 'POST', headers: h, body: JSON.stringify({ title: `${tag} ${i}`, labels: [tag], dueAt: new Date(Date.now() + (i + 2) * 3600e3).toISOString() }) })
}, TASKPULSE, auth, tag)
const list = (q) => t.page.evaluate(async (u, q) => (await fetch(u + '/api/tasks?label=' + q)).json(), TASKPULSE, tag + q)

const page1 = await list('&pageSize=8')
t.check('page 1 comes with a cursor', page1.items.length === 8 && !!page1.nextCursor, JSON.stringify(page1.nextCursor))
// someone else adds a task that sorts to the very front (open, due before every other one)
await t.page.evaluate(async (u, h, tag) => fetch(u + '/api/tasks', { method: 'POST', headers: h, body: JSON.stringify({ title: `${tag} inserted`, labels: [tag], dueAt: '2001-01-01T00:00:00Z' }) }), TASKPULSE, auth, tag)
const byCursor = await list('&pageSize=8&page=2&cursor=' + encodeURIComponent(page1.nextCursor))
const byOffset = await list('&pageSize=8&page=2')
const titles = (p) => p.items.map((x) => x.title)
t.check('by cursor, page 2 continues after page 1: nothing repeats, the newcomer is not on it', titles(byCursor).length === 4 && !titles(byCursor).some((x) => titles(page1).includes(x)) && !titles(byCursor).includes(`${tag} inserted`) && byCursor.page === 2 && byCursor.total === 13 && !byCursor.nextCursor, JSON.stringify(titles(byCursor)))
t.check('by offset, the same page 2 repeats the last row of page 1', titles(byOffset).includes(titles(page1)[7]), JSON.stringify(titles(byOffset)))

// the Tasks page's Next button uses the cursor
await t.go('/tasks', 2500)
const shown1 = await t.page.$$eval('.tasks tbody tr .task__title', (els) => els.map((e) => e.textContent.trim()))
await t.page.click('[data-cy=pager-next]'); await sleep(1500)
const shown2 = await t.page.$$eval('.tasks tbody tr .task__title', (els) => els.map((e) => e.textContent.trim()))
const usedCursor = await t.page.evaluate(() => performance.getEntriesByType('resource').some((e) => /\/api\/tasks\?.*cursor=/.test(e.name)))
t.check('Next on the Tasks page continues by cursor (no repeated row)', usedCursor && shown2.length > 0 && !shown2.some((x) => shown1.includes(x)), `cursor request ${usedCursor}; page 2 ${JSON.stringify(shown2.slice(0, 3))}`)

await t.page.evaluate(async (u, h, tag) => { const l = await (await fetch(u + '/api/tasks?label=' + tag + '&pageSize=50')).json(); for (const x of l.items) await fetch(u + `/api/tasks/${x.id}?permanent=true`, { method: 'DELETE', headers: h }) }, TASKPULSE, auth, tag)
await t.done()
