import { start, sleep } from '../lib.mjs'

const t = await start()
await t.login()
const stored = await t.page.evaluate(() => {
  const s = JSON.parse(localStorage.getItem('vt.session') || 'null')
  return s ? { access: !!s.tokens.access, refresh: !!s.tokens.refresh, cookieVisible: document.cookie.includes('refresh_token') } : null
})
t.check('session stored with the access token only', !!stored && stored.access && !stored.refresh && !stored.cookieVisible, JSON.stringify(stored))

await t.page.reload({ waitUntil: 'load' }); await sleep(2500)
t.check('refresh keeps the session', t.page.url().endsWith('/dashboard'), t.page.url())

await t.go('/tasks', 1500)
await t.page.reload({ waitUntil: 'load' }); await sleep(2500)
t.check('refresh on a deep page keeps the page', t.page.url().endsWith('/tasks'), t.page.url())

await t.page.evaluate(() => { const s = JSON.parse(localStorage.getItem('vt.session')); s.lastActive = Date.now() - 31 * 60 * 1000; localStorage.setItem('vt.session', JSON.stringify(s)) })
await t.page.reload({ waitUntil: 'load' }); await sleep(2500)
t.check('31 minutes idle signs out with a reason', t.page.url().endsWith('/signin') && (await t.text('[data-cy=signout-reason]')).includes('without activity'))

await t.login()
await t.clickText('.ant-menu-item', 'Logout'); await sleep(2000)
const after = await t.page.evaluate(() => localStorage.getItem('vt.session'))
t.check('logout clears the stored session', after === null && t.page.url().endsWith('/signin'))
await t.done()
