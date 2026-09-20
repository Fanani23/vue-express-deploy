import { AxePuppeteer } from '@axe-core/puppeteer'
import { start, sleep, MENU, BASE } from '../lib.mjs'

const t = await start()
const audit = async (label) => {
  const results = await new AxePuppeteer(t.page).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
  const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')
  const summary = results.violations.map((v) => `${v.impact}:${v.id}(${v.nodes.length})`).join(' ')
  t.check(`${label} — no serious/critical axe violations`, serious.length === 0, summary || 'clean')
  for (const v of serious) t.log(`   ${v.id}: ${v.help} → ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`)
}

await t.page.goto(BASE + '/signin', { waitUntil: 'load' }); await sleep(1500)
await audit('/signin')
await t.login()
for (const p of Object.keys(MENU)) {
  await t.go(p, 1800)
  await audit(p)
}
await t.done()
