import { start, sleep, API, BASE } from '../lib.mjs'

// Five wrong passwords lock the account (423, also with the right password); an Admin unlocks it from the Dashboard.
// Uses viewer@ so the other scripts' account is never locked; the direct API calls keep the sign-in form's
// per-address limiter out of the picture.
const t = await start()
// The per-address limiter (10 sign-ins/min) may still hold attempts from whatever ran before; a 429 means wait it out.
const post = async (path, body) => {
  for (let i = 0; i < 3; i++) {
    const r = await fetch(API + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    if (r.status !== 429) return r
    t.log('sign-in limiter hit - waiting a minute'); await sleep(61_000)
  }
  throw new Error('still rate limited')
}
const wrong = async () => { const r = await post('/api/auth/login', { email: 'viewer@techtest.dev', password: 'wrong-password-1' }); return { status: r.status, body: await r.json() } }
let last
for (let i = 0; i < 5; i++) last = await wrong()
t.check('the fifth wrong password locks the account', last.status === 423 && /locked/.test(last.body.message), `${last.status} ${last.body.message}`)

await t.page.goto(BASE + '/signin', { waitUntil: 'load' }); await sleep(1000)
await t.page.type('[data-cy=username]', 'viewer@techtest.dev'); await t.page.type('[data-cy=password]', 'Techtest123!')
await t.page.click('[data-cy=login]'); await sleep(1500)
t.check('the right password is refused while locked, and the form says why', /locked/.test(await t.body(800)))

await t.login() // admin (cached session)
const card = await t.page.evaluate(() => { const c = [...document.querySelectorAll('.member')].find((m) => m.textContent.includes('viewer')); return c ? { locked: !!c.querySelector('.member__locked'), unlock: !!c.querySelector('[data-cy=unlock]') } : null })
t.check('the Admin sees the lock on the account card', !!card && card.locked && card.unlock, JSON.stringify(card))
await t.page.evaluate(() => { const c = [...document.querySelectorAll('.member')].find((m) => m.textContent.includes('viewer')); c.querySelector('[data-cy=unlock]').click() }); await sleep(1500)
const after = await t.page.evaluate(() => { const c = [...document.querySelectorAll('.member')].find((m) => m.textContent.includes('viewer')); return !!c?.querySelector('.member__locked') })
t.check('unlock clears it', after === false)
const ok = await post('/api/auth/login', { email: 'viewer@techtest.dev', password: 'Techtest123!' })
t.check('viewer can sign in again', ok.status === 200, String(ok.status))
await t.done()
