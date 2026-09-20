import puppeteer from 'puppeteer-core'
import { existsSync } from 'node:fs'

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

export const BASE = (process.env.E2E_BASE || 'http://127.0.0.1:8080').replace(/\/$/, '')
export const TASKPULSE = (process.env.E2E_TASKPULSE || 'http://127.0.0.1:8088').replace(/\/$/, '')
export const USER = process.env.E2E_USER || 'admin@techtest.dev'
export const PASSWORD = process.env.E2E_PASSWORD || 'Techtest123!'
export const CODE = process.env.E2E_CODE || '111111'

// Sidebar labels per route; navigation goes through real clicks so the router sees ordinary history entries.
export const MENU = {
  '/dashboard': 'Dashboard', '/tasks': 'Tasks', '/analytics': 'Analytics', '/profile': 'Profile',
  '/template-demos/tests': 'Vue tests', '/template-demos/web-cam': 'Web cam', '/template-demos/sign-pad': 'Sign pad',
  '/template-demos/chart': 'Chart', '/template-demos/map': 'Map', '/template-demos/form': 'Form', '/template-demos/card': 'Card',
  '/template-demos/cascade': 'Cascade', '/template-demos/cascade2': 'Cascade 2', '/template-demos/cascade2-api': 'Cascade 2 (API)',
  '/template-demos/fill': 'Route params',
}

const chromePath = () => {
  if (process.env.E2E_CHROME) return process.env.E2E_CHROME
  for (const p of ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/opt/google/chrome/chrome',
    'C:/Program Files/Google/Chrome/Application/chrome.exe', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome']) {
    if (existsSync(p)) return p
  }
  throw new Error('No Chrome found: set E2E_CHROME=/path/to/chrome or E2E_BROWSER_URL=http://127.0.0.1:9333')
}

export const start = async ({ width = 1500, height = 940, dark = false } = {}) => {
  const browser = process.env.E2E_BROWSER_URL
    ? await puppeteer.connect({ browserURL: process.env.E2E_BROWSER_URL })
    : await puppeteer.launch({ executablePath: chromePath(), headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', `--window-size=${width},${height}`] })
  // Own cookies + storage per script, so a signed-in session from a previous script never leaks in.
  const context = await browser.createBrowserContext()
  const page = await context.newPage()
  const out = []
  let failed = 0
  const dump = (e) => { console.log(out.join('\n')); console.log('ERR ' + (e && e.message || e)); process.exit(1) }
  process.on('unhandledRejection', dump)
  process.on('uncaughtException', dump)
  page.on('pageerror', (e) => out.push('pageerror: ' + String(e).slice(0, 300)))
  page.on('console', (m) => { if (m.type() === 'error') out.push('console.error: ' + m.text().slice(0, 200)) })
  page.on('response', (r) => { const u = r.url(); if (/\/api\//.test(u) && !/\/api\/auth\/(providers|login|otp)/.test(u)) out.push(`${r.status()} ${r.request().method()} ${u.replace(/^https?:\/\/[^/]+/, '')}`) })
  await page.setCacheEnabled(false)
  await page.setViewport({ width, height })
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: dark ? 'dark' : 'light' }])

  const login = async (user = USER, pass = PASSWORD) => {
    await page.goto(BASE + '/signin', { waitUntil: 'load', timeout: 60000 })
    await page.waitForSelector('[data-cy=username]', { timeout: 60000 })
    await page.type('[data-cy=username]', user); await page.type('[data-cy=password]', pass)
    await page.click('[data-cy=login]')
    await page.waitForSelector('[data-cy=pin]', { timeout: 15000 })
    await sleep(400); await page.type('[data-cy=pin]', CODE); await sleep(300); await page.keyboard.press('Enter')
    await page.waitForSelector('[data-cy=dashboard]', { timeout: 20000 })
    await sleep(800)
  }
  const clickMenu = async (label) => {
    const h = await page.evaluateHandle((l) => [...document.querySelectorAll('.ant-menu-item, .ant-menu-submenu-title')].find((e) => e.textContent.trim() === l), label)
    if (!h.asElement()) throw new Error('no menu item ' + label)
    await h.asElement().click()
  }
  const go = async (path, wait = 2000) => {
    const label = MENU[path]
    if (!label) throw new Error('no menu mapping for ' + path)
    if (path.startsWith('/template-demos') && !(await page.$('.ant-menu-submenu-open'))) { await clickMenu('Template Demos'); await sleep(500) }
    await clickMenu(label); await sleep(wait)
  }
  const text = async (sel) => page.$eval(sel, (e) => e.innerText.replace(/\s+/g, ' ').trim()).catch(() => '(missing ' + sel + ')')
  const body = async (n = 400) => page.evaluate((n) => document.body.innerText.replace(/\s+/g, ' ').slice(0, n), n)
  const clickText = async (selector, label) => {
    const h = await page.evaluateHandle((s, l) => [...document.querySelectorAll(s)].find((e) => e.textContent.trim().includes(l)), selector, label)
    if (!h.asElement()) throw new Error('no element ' + selector + ' with text ' + label)
    await h.asElement().click()
  }
  const check = (name, ok, detail = '') => { out.push(`${ok ? '[ ok ]' : '[FAIL]'} ${name}${detail ? ' — ' + detail : ''}`); if (!ok) failed++ }
  const done = async () => {
    console.log(out.filter((l) => !/^\d{3} (GET|OPTIONS) /.test(l)).join('\n'))
    await context.close().catch(() => {})
    if (process.env.E2E_BROWSER_URL) await browser.disconnect(); else await browser.close()
    if (failed) { console.log(`${failed} check(s) failed`); process.exit(1) }
  }
  return { browser, page, out, login, go, text, body, clickText, check, done, log: (s) => out.push(s), errors: () => out.filter((l) => /pageerror|console\.error|^(4|5)\d\d /.test(l)) }
}
