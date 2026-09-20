import { start, sleep, TASKPULSE } from '../lib.mjs'

// Assignee, due date, priority and labels on a task: created through the form, shown on the row, filterable.
const t = await start()
await t.login()
await t.go('/tasks', 2500)

const title = 'Fields ' + Date.now()
await t.page.type('[data-cy=new-title]', title)
// Ant Design keeps closed dropdowns in the DOM; pick from the newest visible one, by JS click (their items are not
// "clickable" for puppeteer while a sibling panel is open).
const pick = (label) => t.page.evaluate((l) => {
  const panels = [...document.querySelectorAll('.ant-select-dropdown:not(.ant-select-dropdown-hidden)')]
  const items = [...panels.at(-1).querySelectorAll('.ant-select-item-option')]
  const item = l ? items.find((i) => i.textContent.includes(l)) : items[0]
  item?.click(); return item?.textContent || null
}, label)
// priority: High
await t.page.click('[data-cy=new-priority]'); await sleep(400)
t.check('priority picked', (await pick('High')) === 'High'); await sleep(200)
// due: yesterday (typed into the picker), so the task is overdue
const y = new Date(Date.now() - 86_400_000); const iso = `${y.getFullYear()}-${String(y.getMonth() + 1).padStart(2, '0')}-${String(y.getDate()).padStart(2, '0')}`
await t.page.click('.new-task__due input'); await t.page.type('.new-task__due input', iso); await t.page.keyboard.press('Enter'); await sleep(300)
// assignee: the first account in the list
await t.page.click('[data-cy=new-assignee]'); await sleep(500)
const firstAssignee = (await pick(null)) || ''
t.check('assignee picked', !!firstAssignee, firstAssignee); await sleep(200)
// labels: a typed tag
await t.page.click('[data-cy=new-labels]'); await t.page.type('[data-cy=new-labels] input', 'e2e-label'); await t.page.keyboard.press('Enter'); await t.page.keyboard.press('Escape'); await sleep(200)
await t.page.click('[data-cy=new-submit]'); await sleep(2500)

const row = await t.page.evaluate((tt) => {
  const r = [...document.querySelectorAll('.tasks tbody tr')].find((x) => x.textContent.includes(tt))
  return r ? r.querySelector('.task__meta')?.textContent.replace(/\s+/g, ' ').trim() : null
}, title)
t.check('the row shows priority, due date, assignee and label', !!row && /High/.test(row) && /overdue|yesterday/.test(row) && /e2e-label/.test(row), row || 'row not found')
t.check('the assignee chip names the account', !!row && row.includes(firstAssignee.split(' · ')[0].split('@')[0]), firstAssignee)

const api = await t.page.evaluate(async (u, tt) => (await fetch(u + '/api/tasks?q=' + encodeURIComponent(tt) + '&due=overdue&priority=High&label=e2e-label')).json(), TASKPULSE, title)
t.check('the API filters find it by due=overdue, priority and label', api.total === 1 && api.items[0].labels.includes('e2e-label'), `total ${api.total}`)
t.check('the overdue counter is shown', /overdue/.test(await t.text('[data-cy=overdue-count]')))

// The status change keeps every other field (PUT sends the whole task).
await t.page.type('[data-cy=search]', title); await sleep(1500)
const btn = await t.page.evaluateHandle((tt) => [...document.querySelectorAll('.tasks tbody tr')].find((r) => r.textContent.includes(tt))?.querySelector('.task__btn'), title)
await btn.asElement().click(); await sleep(1500)
const after = await t.page.evaluate(async (u, tt) => (await fetch(u + '/api/tasks?q=' + encodeURIComponent(tt))).json(), TASKPULSE, title)
t.check('moving the task keeps its due date, assignee and labels', after.items[0].status === 'InProgress' && !!after.items[0].dueAt && !!after.items[0].assigneeId && after.items[0].labels.length === 1, JSON.stringify({ status: after.items[0].status, dueAt: after.items[0].dueAt, assigneeId: after.items[0].assigneeId, labels: after.items[0].labels }))

const del = await t.page.evaluateHandle((tt) => [...document.querySelectorAll('.tasks tbody tr')].find((r) => r.textContent.includes(tt))?.querySelector('.ant-btn-dangerous'), title)
await del.asElement().click(); await sleep(300); await t.clickText('.ant-popconfirm button', 'Delete'); await sleep(1200)
await t.done()
