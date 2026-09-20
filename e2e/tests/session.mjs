import { start, sleep, API, forgetSession } from '../lib.mjs'

const t = await start()
await t.login({ fresh: true })
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

await t.login({ fresh: true })

// Refresh-token rotation with reuse detection: the browser refreshes (its cookie is rotated), a replay of the old
// cookie 11 s later is refused and revokes the family, so the browser's current cookie no longer refreshes either.
const cookieOf = async () => (await t.page.browserContext().cookies()).find((c) => c.name === 'refresh_token')
const old = await cookieOf()
const refresh = () => t.page.evaluate(async (api) => (await fetch(api + '/api/auth/refresh', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ access_token: JSON.parse(localStorage.getItem('vt.session')).tokens.access }) })).status, API)
t.check('refresh rotates the HttpOnly cookie', (await refresh()) === 200 && (await cookieOf())?.value !== old?.value)
await sleep(11000)
const replay = await fetch(API + '/api/auth/refresh', { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: `refresh_token=${old.value}` }, body: JSON.stringify({ access_token: await t.page.evaluate(() => JSON.parse(localStorage.getItem('vt.session')).tokens.access) }) })
t.check('a replayed (rotated-away) refresh token is refused as reuse', replay.status === 401 && /Reuse/.test(await replay.text()), String(replay.status))
t.check('…and revokes the whole family', (await refresh()) === 401)

await t.clickText('.ant-menu-item', 'Logout'); await sleep(2000)
forgetSession()
const after = await t.page.evaluate(() => localStorage.getItem('vt.session'))
t.check('logout clears the stored session', after === null && t.page.url().endsWith('/signin'))
await t.done()
