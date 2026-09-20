import { start, sleep, TASKPULSE } from '../lib.mjs'

const t = await start()
await t.login()
const stats = await t.page.$$eval('.stat2', (els) => els.map((e) => e.innerText.replace(/\s+/g, ' ')))
const api = await t.page.evaluate(async (u) => (await fetch(u + '/api/tasks/stats?days=14')).json(), TASKPULSE)
t.check('stat cards match /api/tasks/stats', stats[0].includes(String(api.doneThisWeek)) && stats[1].includes(String(api.byStatus.InProgress)), stats.join(' | '))

const name = 'E2E ' + Date.now().toString().slice(-5)
await t.page.type('.inline-add input[placeholder="Name"]', name)
await t.page.type('.inline-add input[placeholder="Role"]', 'Tester')
await t.clickText('.inline-add button', 'Add'); await sleep(1500)
t.check('team member created through the UI', (await t.page.$$eval('.member__name', (els) => els.map((e) => e.textContent))).includes(name))

const del = await t.page.evaluateHandle((n) => [...document.querySelectorAll('.member')].find((e) => e.textContent.includes(n))?.querySelector('.ant-btn-dangerous'), name)
if (del.asElement()) { await del.asElement().click(); await sleep(400); await t.clickText('.ant-popconfirm button', 'Remove'); await sleep(1200) }
t.check('team member deleted', !(await t.page.$$eval('.member__name', (els) => els.map((e) => e.textContent))).includes(name))

await t.page.type('.inline-add--col input[placeholder="Label"]', name)
await t.page.type('.inline-add--col input[placeholder="https://…"]', 'https://example.com/e2e')
await t.clickText('.inline-add--col button', 'Add link'); await sleep(1500)
t.check('link created', (await t.page.$$eval('.link__a', (els) => els.map((e) => e.textContent.trim()))).includes(name))

const delLink = await t.page.evaluateHandle((n) => [...document.querySelectorAll('.link')].find((e) => e.textContent.includes(n))?.querySelector('.ant-btn-dangerous'), name)
if (delLink.asElement()) { await delLink.asElement().click(); await sleep(400); await t.clickText('.ant-popconfirm button', 'Remove'); await sleep(1200) }
t.check('link deleted', !(await t.page.$$eval('.link__a', (els) => els.map((e) => e.textContent.trim()))).includes(name))
await t.done()
