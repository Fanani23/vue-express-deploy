import { start, MENU } from '../lib.mjs'

const t = await start()
await t.login()
for (const p of Object.keys(MENU)) {
  const before = t.out.length
  await t.go(p, 2200)
  const errs = t.out.slice(before).filter((l) => /pageerror|console\.error|^(4|5)\d\d /.test(l))
  t.check(`${p} loads clean`, errs.length === 0, errs.join(' ; '))
}
await t.done()
