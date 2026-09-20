import { AxePuppeteer } from '@axe-core/puppeteer'
import { start, sleep, TASKPULSE } from '../lib.mjs'

// Phone width: the Tasks page is a card list with "Load more" (the API's cursor) instead of a table and a pager;
// no horizontal scroll, touch-sized buttons, and the page still passes the axe audit.
const t = await start({ width: 390, height: 844 })
await t.login()
const tok = await t.page.evaluate(() => JSON.parse(localStorage.getItem('vt.session')).tokens.access)
const tag = 'mob' + Date.now().toString(36)
await t.page.evaluate(async (u, tok, tag) => { for (let i = 0; i < 10; i++) await fetch(u + '/api/tasks', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tok }, body: JSON.stringify({ title: `${tag} ${i}`, labels: [tag] }) }) }, TASKPULSE, tok, tag)

// the menu is collapsed at this width: open it, then the page
await t.page.evaluate(() => { if (!document.querySelector('.ant-menu-item')) document.querySelector('.shell__trigger')?.click() }); await sleep(500)
await t.go('/tasks', 2500)
await t.page.evaluate(() => { const b = document.querySelector('.shell__trigger'); if (b && b.getAttribute('aria-label') === 'Hide menu') b.click() }); await sleep(400)

const cards = () => t.page.$$eval('[data-cy=task-cards] .card .task__title', (els) => els.map((e) => e.textContent.trim()))
const first = await cards()
t.check('tasks are cards, not a table', first.length === 8 && !(await t.page.$('.tasks table')), `${first.length} cards`)
t.check('no horizontal scroll', await t.page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), await t.page.evaluate(() => `${document.documentElement.scrollWidth} > ${window.innerWidth}`))
t.check('touch targets are at least 40px', await t.page.evaluate(() => [...document.querySelectorAll('.card .task__btn')].every((b) => b.getBoundingClientRect().height >= 38)))

await t.page.click('[data-cy=load-more]'); await sleep(1500)
const more = await cards()
t.check('Load more appends the next page (cursor), nothing repeats', more.length === 16 && new Set(more).size === 16 && more.slice(0, 8).join() === first.join(), `${more.length} cards`)
const counter = await t.text('.cards__more')
t.check('the counter shows how far the list goes', /16 of \d+/.test(counter), counter)

const results = await new AxePuppeteer(t.page).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')
t.check('the phone layout passes the axe audit', serious.length === 0, serious.map((v) => `${v.id}(${v.nodes.length})`).join(' ') || 'clean')

await t.page.evaluate(async (u, tok, tag) => { const l = await (await fetch(u + '/api/tasks?label=' + tag + '&pageSize=50')).json(); for (const x of l.items) await fetch(u + `/api/tasks/${x.id}?permanent=true`, { method: 'DELETE', headers: { Authorization: 'Bearer ' + tok } }) }, TASKPULSE, tok, tag)
await t.done()
