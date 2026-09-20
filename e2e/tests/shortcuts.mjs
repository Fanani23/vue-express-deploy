import { start, sleep } from '../lib.mjs'

// Keyboard: Ctrl K opens the command palette (type, Enter runs), `g d` / `g t` jump between pages, `n` on the
// Tasks page focuses the new-task box, `?` lists the shortcuts, and none of it fires while typing in a field.
const t = await start()
await t.login()
await t.go('/tasks', 2500)

await t.page.keyboard.down('Control'); await t.page.keyboard.press('k'); await t.page.keyboard.up('Control'); await sleep(600)
t.check('Ctrl K opens the palette with the input focused', await t.page.evaluate(() => document.activeElement?.dataset.cy === 'palette-input'))
await t.page.keyboard.type('analyt'); await sleep(300)
const first = await t.page.$eval('.palette__item--on .palette__title', (e) => e.textContent).catch(() => '')
t.check('typing filters to the matching page', first === 'Go to Analytics', first)
await t.page.keyboard.press('Enter'); await sleep(1500)
t.check('Enter runs it: the Analytics page opened', await t.page.evaluate(() => location.pathname.endsWith('/analytics')), await t.page.evaluate(() => location.pathname))

await t.page.keyboard.press('g'); await t.page.keyboard.press('t'); await sleep(1500)
t.check('g t jumps to Tasks', await t.page.evaluate(() => location.pathname.endsWith('/tasks')))
await t.page.keyboard.press('n'); await sleep(300)
t.check('n focuses the new-task title on the Tasks page', await t.page.evaluate(() => document.activeElement?.dataset.cy === 'new-title'))
await t.page.keyboard.type('g d'); await sleep(800)
t.check('keys typed into a field are text, not shortcuts', await t.page.evaluate(() => location.pathname.endsWith('/tasks') && document.querySelector('[data-cy=new-title]').value === 'g d'))
await t.page.keyboard.press('Escape'); await t.page.evaluate(() => document.activeElement.blur())
await t.page.keyboard.press('?'); await sleep(600)
const help = await t.text('[data-cy=shortcut-help]')
t.check('? lists the shortcuts, including the page\'s own', /g d.*Go to Dashboard/.test(help) && /n ?New task/.test(help) && /\/ ?Search tasks/.test(help), help.slice(0, 160))
await t.page.keyboard.press('Escape'); await sleep(400)
await t.page.keyboard.press('g'); await t.page.keyboard.press('d'); await sleep(1500)
t.check('g d jumps to the Dashboard', await t.page.evaluate(() => location.pathname.endsWith('/dashboard')))
await t.done()
