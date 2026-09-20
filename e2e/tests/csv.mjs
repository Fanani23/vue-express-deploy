import { start, sleep, TASKPULSE } from '../lib.mjs'

// CSV export honours the list's filters; import creates/updates tasks and reports bad rows on the page.
const t = await start()
await t.login()
await t.go('/tasks', 2500)
const href = await t.page.$eval('[data-cy=export-csv]', (a) => a.getAttribute('href'))
t.check('the export button links to the CSV with the current filters', /\/api\/tasks\/export\.csv/.test(href), href)
const csv = await t.page.evaluate(async (u) => (await fetch(u + '/api/tasks/export.csv?pageSize=5')).text(), TASKPULSE)
t.check('the export is a CSV with the documented header', csv.startsWith('id,title,description,status,priority,dueAt,assigneeId,assigneeName,labels,createdAt,updatedAt'), csv.slice(0, 60))

const marker = 'csv' + Date.now().toString().slice(-5)
const file = `title,status,priority,labels\n${marker} imported one,Done,High,${marker}|csv\n${marker} imported two,,,${marker}\n,no title here\n`
// The file is built inside the page (a puppeteer uploadFile needs a path on the browser's machine, which is not
// the script's machine when connecting to a remote Chrome); the change event is what the upload widget listens to.
await t.page.evaluate((text) => {
  const input = document.querySelector('.task-filters__csv input[type=file]')
  const dt = new DataTransfer(); dt.items.add(new File([text], 'import.csv', { type: 'text/csv' }))
  input.files = dt.files; input.dispatchEvent(new Event('change', { bubbles: true }))
}, file)
await sleep(2500)
const result = await t.text('[data-cy=import-result]')
t.check('the page reports the import (2 created, 1 skipped with the row number)', /2 new, 0 updated, 1 skipped/.test(result) && /row 4/.test(result), result + ' :: ' + t.out.filter((l) => /import|error/i.test(l)).join(' ; '))
const api = await t.page.evaluate(async (u, m) => (await fetch(u + '/api/tasks?q=' + m + '&label=csv')).json(), TASKPULSE, marker)
t.check('imported tasks carry status, priority and labels', api.total === 1 && api.items[0].status === 'Done' && api.items[0].priority === 'High', JSON.stringify(api.items[0] || {}))

// clean up through the API
const tok = await t.page.evaluate(() => JSON.parse(localStorage.getItem('vt.session')).tokens.access)
const mine = await t.page.evaluate(async (u, m) => (await fetch(u + '/api/tasks?q=' + m)).json(), TASKPULSE, marker)
for (const it of mine.items) await t.page.evaluate(async (u, id, tok) => fetch(u + '/api/tasks/' + id + '?permanent=true', { method: 'DELETE', headers: { Authorization: 'Bearer ' + tok } }), TASKPULSE, it.id, tok)
await t.done()
