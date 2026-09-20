import { start, sleep, API, BASE, forgetSession } from '../lib.mjs'

// Several devices per account: a second sign-in (a "phone", by API) does not sign this browser out; the Profile
// page lists both, can sign the phone out, and "revoke all" ends every session.
const t = await start()
await t.login()
const phone = async (path, init = {}) => fetch(API + path, { ...init, headers: { 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile/15E148 Safari/604.1', ...(init.headers || {}) } })
const login = await (await phone('/api/auth/login', { method: 'POST', body: JSON.stringify({ email: 'admin@techtest.dev', password: 'Techtest123!' }) })).json()
const otp = await phone('/api/auth/otp', { method: 'POST', body: JSON.stringify({ id: login.otp, pin: '111111' }) })
const phoneToken = (await otp.json()).access_token
t.check('a second device signs in', otp.status === 200 && !!phoneToken)

// this browser still refreshes (the template used to sign the first device out here)
const refreshed = await t.page.evaluate(async (api) => (await fetch(api + '/api/auth/refresh', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ access_token: JSON.parse(localStorage.getItem('vt.session')).tokens.access }) })).status, API)
t.check('the first device keeps its session', refreshed === 200, String(refreshed))

await t.go('/profile', 2000)
const devices = await t.page.$$eval('[data-cy=devices] .device', (els) => els.map((e) => ({ text: e.textContent.replace(/\s+/g, ' ').trim(), current: e.classList.contains('device--current') })))
t.check('the Profile page lists both devices, this one marked', devices.length >= 2 && devices.some((d) => d.current) && devices.some((d) => /iOS|Safari|Mobile/i.test(d.text) && !d.current), JSON.stringify(devices.map((d) => d.text.slice(0, 40))))

const btn = await t.page.evaluateHandle(() => [...document.querySelectorAll('[data-cy=devices] .device')].find((e) => /iOS|Safari/i.test(e.textContent) && !e.classList.contains('device--current'))?.querySelector('button'))
await btn.asElement().click(); await sleep(1500)
const phoneRefresh = await phone('/api/auth/refresh', { method: 'POST', body: JSON.stringify({ access_token: phoneToken }) })
t.check('signing the phone out from the laptop ends the phone session', phoneRefresh.status === 401, String(phoneRefresh.status))
t.check('the list no longer shows it', (await t.page.$$eval('[data-cy=devices] .device', (els) => els.length)) === devices.length - 1)

await t.page.click('[data-cy=signout-everywhere]'); await sleep(2500)
t.check('revoke all signs this browser out too', t.page.url().endsWith('/signin'), t.page.url())
forgetSession() // every session of the account is gone, so the cached one is useless now
await t.done()
