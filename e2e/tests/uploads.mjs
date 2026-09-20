import { start, TASKPULSE } from '../lib.mjs'

// Uploaded images are re-encoded on the server: the bytes that come back are pixels only - a PNG text chunk and a
// payload glued after the image do not survive - and a file that only starts like a PNG is refused.
const t = await start()
await t.login()
const tok = await t.page.evaluate(() => JSON.parse(localStorage.getItem('vt.session')).tokens.access)
const r = await t.page.evaluate(async (u, tok) => {
  // a real 2×2 PNG drawn on a canvas, then a tEXt chunk and a trailing "script" appended by hand
  const c = document.createElement('canvas'); c.width = 2; c.height = 2
  const g = c.getContext('2d'); g.fillStyle = '#c81e1e'; g.fillRect(0, 0, 2, 2)
  const png = Uint8Array.from(atob(c.toDataURL('image/png').split(',')[1]), (ch) => ch.charCodeAt(0))
  const enc = new TextEncoder()
  const crc = (buf) => { let c = -1; for (const b of buf) { c ^= b; for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1 } return (c ^ -1) >>> 0 }
  const chunk = (type, data) => { const len = new Uint8Array(4); new DataView(len.buffer).setUint32(0, data.length); const td = new Uint8Array([...enc.encode(type), ...data]); const cv = new Uint8Array(4); new DataView(cv.buffer).setUint32(0, crc(td)); return [...len, ...td, ...cv] }
  const text = chunk('tEXt', enc.encode('Comment\0SECRET-TEXT-CHUNK'))
  const iend = png.length - 12 // IEND chunk starts here
  const dirty = new Uint8Array([...png.slice(0, iend), ...text, ...png.slice(iend), ...enc.encode('<?php evil(); ?> TRAILING-PAYLOAD')])
  const post = async (bytes, name) => {
    const form = new FormData(); form.append('files', new File([bytes], name, { type: 'image/png' })); form.append('source', 'e2e-clean')
    const res = await fetch(u + '/api/uploads', { method: 'POST', headers: { Authorization: 'Bearer ' + tok }, body: form })
    return { status: res.status, body: await res.json().catch(() => null) }
  }
  const ok = await post(dirty, 'dirty.png')
  const stored = ok.status === 201 ? new Uint8Array(await (await fetch(u + `/api/uploads/${ok.body[0].id}/content`)).arrayBuffer()) : null
  const latin = stored ? new TextDecoder('latin1').decode(stored) : ''
  const bad = await post(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...enc.encode('just the magic bytes')]), 'junk.png')
  if (ok.status === 201) await fetch(u + `/api/uploads/${ok.body[0].id}`, { method: 'DELETE', headers: { Authorization: 'Bearer ' + tok } })
  return { status: ok.status, sentHasSecret: new TextDecoder('latin1').decode(dirty).includes('SECRET-TEXT-CHUNK'), storedSize: stored?.length, listedSize: ok.body?.[0]?.size, isPng: stored && stored[1] === 0x50 && stored[2] === 0x4e, hasSecret: latin.includes('SECRET-TEXT-CHUNK'), hasPayload: latin.includes('TRAILING-PAYLOAD'), bad: bad.status }
}, TASKPULSE, tok)
t.check('the dirty PNG was accepted (it is a real image)', r.status === 201 && r.sentHasSecret, JSON.stringify(r))
t.check('what is stored is a PNG without the text chunk or the trailing payload', r.isPng && !r.hasSecret && !r.hasPayload && r.storedSize === r.listedSize, JSON.stringify(r))
t.check('a file that only starts like a PNG is refused (415)', r.bad === 415, String(r.bad))
await t.done()
