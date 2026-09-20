import { start, sleep, TASKPULSE, API } from '../lib.mjs'

const t = await start()
await t.login()
const stats = await t.page.$$eval('.stat2', (els) => els.map((e) => e.innerText.replace(/\s+/g, ' ')))
const api = await t.page.evaluate(async (u) => (await fetch(u + '/api/tasks/stats?days=14')).json(), TASKPULSE)
t.check('stat cards match /api/tasks/stats', stats[0].includes(String(api.doneThisWeek)) && stats[1].includes(String(api.byStatus.InProgress)), stats.join(' | '))

const name = 'E2E ' + Date.now().toString().slice(-5)
const email = `e2e-${Date.now()}@techtest.dev`

// Team members are real accounts: an Admin creates one (temporary password shown once), and it can sign in.
await t.page.type('[data-cy=user-email]', email)
await t.page.type('[data-cy=user-name]', name)
await t.page.click('[data-cy=user-add]'); await sleep(2000)
const tempPassword = await t.page.$eval('[data-cy=temp-password]', (e) => e.value).catch(() => '')
t.check('account created through the UI with a one-time temporary password', tempPassword.length >= 16 && (await t.page.$$eval('.member__name', (els) => els.map((e) => e.textContent))).some((x) => x.startsWith(name)), tempPassword ? 'password shown' : 'no password modal')
await t.clickText('.ant-modal button', 'Done'); await sleep(500)

const login = await t.page.evaluate(async (api, email, password) => (await fetch(api + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) })).status, API, email, tempPassword)
t.check('the new account passes the password step', login === 200, String(login))

const del = await t.page.evaluateHandle((n) => [...document.querySelectorAll('.member')].find((e) => e.textContent.includes(n))?.querySelector('.ant-btn-dangerous'), name)
if (del.asElement()) { await del.asElement().click(); await sleep(400); await t.clickText('.ant-popconfirm button', 'Delete'); await sleep(1200) }
t.check('account deleted', !(await t.page.$$eval('.member__name', (els) => els.map((e) => e.textContent))).some((x) => x.startsWith(name)))
t.check('you cannot delete yourself (no button on your own card)', await t.page.evaluate(() => !document.querySelector('.member--me .ant-btn-dangerous') && !!document.querySelector('.member--me')))

await t.page.type('.inline-add--col input[placeholder="Label"]', name)
await t.page.type('.inline-add--col input[placeholder="https://…"]', 'https://example.com/e2e')
await t.clickText('.inline-add--col button', 'Add link'); await sleep(1500)
t.check('link created', (await t.page.$$eval('.link__a', (els) => els.map((e) => e.textContent.trim()))).includes(name))

const delLink = await t.page.evaluateHandle((n) => [...document.querySelectorAll('.link')].find((e) => e.textContent.includes(n))?.querySelector('.ant-btn-dangerous'), name)
if (delLink.asElement()) { await delLink.asElement().click(); await sleep(400); await t.clickText('.ant-popconfirm button', 'Remove'); await sleep(1200) }
t.check('link deleted', !(await t.page.$$eval('.link__a', (els) => els.map((e) => e.textContent.trim()))).includes(name))
await t.done()
