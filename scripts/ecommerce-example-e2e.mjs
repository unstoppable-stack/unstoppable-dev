import { createRequire } from 'node:module'
import { spawn } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const require = createRequire(join(root, 'packages/cli/package.json'))
const { chromium } = require('playwright')
const app = join(root, 'examples/ecommerce-assistant')
const testnet = process.env.ECOMMERCE_TEST_PUBLIC_DHT === '1' ? null : await require('@hyperswarm/testnet')(3)
const work = mkdtempSync(join(tmpdir(), 'ecommerce-peer-e2e-'))
const sessions = []
const wait = ms => new Promise(resolve => setTimeout(resolve, ms))

async function launch(storage, port, bootstrap = testnet?.bootstrap) {
  const proc = spawn(join(app, 'node_modules/.bin/electron'), ['.', `--user-data-dir=${join(work, 'browser-' + port)}`, '--storage', storage, `--remote-debugging-port=${port}`], {
    cwd: app, env: { ...process.env, ECOMMERCE_P2P_BOOTSTRAP: bootstrap ? JSON.stringify(bootstrap) : '' }, detached: true, stdio: ['ignore', 'pipe', 'pipe'],
  })
  const session = { proc, browser: null }
  sessions.push(session)
  let diagnostics = ''
  for (const stream of [proc.stdout, proc.stderr]) stream.on('data', bytes => { diagnostics = (diagnostics + bytes).slice(-4000) })
  let browser
  for (let attempt = 0; attempt < 60; attempt++) {
    await wait(500)
    try { browser = await chromium.connectOverCDP(`http://localhost:${port}`); break } catch {}
  }
  if (!browser) throw new Error(`Electron did not start: ${diagnostics}`)
  session.browser = browser
  let page
  for (let attempt = 0; attempt < 60 && !page; attempt++) {
    for (const candidate of browser.contexts().flatMap(context => context.pages())) {
      if (candidate.url().startsWith('file:') && await candidate.locator('#worker-status').count()) { page = candidate; break }
    }
    if (!page) await wait(500)
  }
  if (!page) throw new Error(`App page not found: ${diagnostics}`)
  await page.locator('#worker-status').waitFor({ timeout: 30000 })
  await page.waitForFunction(() => /ready/i.test(document.querySelector('#worker-status')?.textContent || ''), undefined, { timeout: 30000 })
  session.page = page
  return { page, session }
}

async function stop(session) {
  if (session.stopped) return
  session.stopped = true
  await session.page?.evaluate(() => window.unstoppable.sendToWorker({ type: 'shutdown' })).catch(() => {})
  await wait(500)
  await session.browser?.close().catch(() => {})
  try { process.kill(-session.proc.pid, 'SIGTERM') } catch {}
  await wait(1000)
  try { process.kill(-session.proc.pid, 'SIGKILL') } catch {}
}

try {
  const port = 20000 + Math.floor(Math.random() * 20000)
  console.log(testnet ? 'Using a real local DHT test network (public Internet discovery not tested)' : 'Using public DHT discovery')
  const offline = await launch(join(work, 'offline'), port + 4, [{ host: '127.0.0.1', port: 9 }])
  await offline.page.locator('[data-add="daypack"]').click()
  await offline.page.waitForFunction(() => document.querySelector('#cart-total')?.textContent?.includes('68.00'))
  await offline.page.locator('#kv-key').fill('offline-order')
  await offline.page.locator('#kv-save').click()
  await offline.page.waitForFunction(() => document.querySelector('#kv-result')?.textContent?.includes('Saved demo order'))
  await stop(offline.session)
  console.log('PASS: startup and local checkout without a reachable DHT bootstrap')
  let a = await launch(join(work, 'a'), port)
  const b = await launch(join(work, 'b'), port + 1)
  const order = `order-${Date.now()}`
  await a.page.locator('[data-add="daypack"]').click()
  await a.page.waitForFunction(() => document.querySelector('#cart-total')?.textContent?.includes('68.00'))
  await a.page.locator('[data-add="notebook"]').click()
  await a.page.waitForFunction(() => document.querySelector('#cart-total')?.textContent?.includes('80.00'))
  await a.page.locator('#catalog-search').fill('carry')
  if (await a.page.locator('[data-add]').count() !== 2) throw new Error('Category search did not filter catalog')
  await a.page.locator('#catalog-search').fill('')
  await a.page.getByRole('button', { name: 'Increase Field Notebook quantity', exact: true }).click()
  await a.page.waitForFunction(() => document.querySelector('#cart-total')?.textContent?.includes('92.00'))
  await a.page.getByRole('button', { name: 'Decrease Field Notebook quantity', exact: true }).click()
  await a.page.waitForFunction(() => document.querySelector('#cart-total')?.textContent?.includes('80.00'))
  await stop(a.session)
  a = await launch(join(work, 'a'), port + 3)
  await a.page.waitForFunction(() => document.querySelector('#cart-total')?.textContent?.includes('80.00'))
  console.log('PASS: search, quantity controls and cart persistence across full restart')
  await a.page.locator('#kv-key').fill(order)
  await a.page.locator('#kv-save').click()
  await a.page.waitForFunction(() => document.querySelector('#kv-result')?.textContent?.includes('Saved demo order'))
  await a.page.waitForFunction(() => document.querySelector('#cart-total')?.textContent?.includes('0.00'))
  await b.page.locator('#kv-key').fill(order)
  await b.page.locator('#kv-fetch').click()
  await b.page.waitForFunction(() => document.querySelector('#kv-result')?.textContent?.includes('not found'))
  await a.page.locator('#share-orders').click()
  await a.page.waitForFunction(() => /^[ybndrfg8ejkmcpqxot1uwisza345h769]{79}$/.test(document.querySelector('#sharing-key')?.textContent || ''), undefined, { timeout: 30000 })
  await a.page.waitForFunction(() => document.querySelector('#sharing-key')?.dataset.ready === 'true', undefined, { timeout: 90000 })
  console.log('Scoped RPC invitation announced on DHT')
  const key = await a.page.locator('#sharing-key').textContent()
  await b.page.locator('#peer-key').fill(key)
  await b.page.locator('#peer-order-name').fill(order)
  await b.page.locator('#fetch-peer-order').click()
  try {
    await b.page.waitForFunction(value => document.querySelector('#peer-order-result')?.textContent?.includes(value), order, { timeout: 45000 })
  } catch (err) {
    throw new Error(`Peer retrieval failed: ${await b.page.locator('#peer-order-result').textContent()}; ${err.message}`)
  }
  await b.page.waitForFunction(() => document.querySelector('#peer-order-result')?.textContent?.includes('8000'))
  await b.page.locator('#peer-order-name').fill('_cart')
  await b.page.locator('#fetch-peer-order').click()
  await b.page.waitForFunction(() => document.querySelector('#peer-order-result')?.textContent?.includes('1–80'))
  console.log('PASS: private cart key is rejected by the receipt API')
  if (process.env.ECOMMERCE_SCREENSHOT) {
    await a.page.setViewportSize({ width: 1100, height: 1600 })
    await a.page.evaluate(() => { document.activeElement?.blur(); for (const el of document.querySelectorAll('.content, .layout, #app')) el.scrollTop = 0; window.scrollTo(0, 0) })
    await a.page.screenshot({ path: process.env.ECOMMERCE_SCREENSHOT, mask: [a.page.locator('#sharing-key')], maskColor: '#161d23' })
  }
  console.log('PASS: second app fetched the first app’s unique order over a real peer connection')
  await stop(a.session)
  await b.page.waitForFunction(() => document.querySelector('#p2p-status')?.textContent?.includes('0 connected'), undefined, { timeout: 45000 })
  console.log('PASS: peer disconnection is visible')
  const restarted = await launch(join(work, 'a'), port + 2)
  await restarted.page.locator('#kv-key').fill(order)
  await restarted.page.locator('#kv-fetch').click()
  await restarted.page.waitForFunction(value => document.querySelector('#kv-result')?.textContent?.includes(value), order)
  console.log('PASS: saved order survived full application restart')
  const revised = order + '-new'
  await restarted.page.locator('[data-add="bottle"]').click()
  await restarted.page.waitForFunction(() => document.querySelector('#cart-total')?.textContent?.includes('28.00'))
  await restarted.page.locator('#kv-key').fill(order)
  await restarted.page.locator('#kv-save').click()
  await restarted.page.waitForFunction(() => document.querySelector('#kv-result')?.textContent?.includes('already exists'))
  if (!(await restarted.page.locator('#cart-total').textContent()).includes('28.00')) throw new Error('Duplicate checkout lost the cart')
  console.log('PASS: duplicate order reference rejected without losing cart')
  await restarted.page.locator('#kv-key').fill(revised)
  await restarted.page.locator('#kv-save').click()
  await restarted.page.waitForFunction(() => document.querySelector('#kv-result')?.textContent?.includes('Saved'))
  await restarted.page.locator('#share-orders').click()
  await restarted.page.waitForFunction(() => document.querySelector('#sharing-key')?.dataset.ready === 'true', undefined, { timeout: 90000 })
  await b.page.locator('#peer-order-name').fill(revised)
  await b.page.locator('#fetch-peer-order').click()
  try {
    await b.page.waitForFunction(value => document.querySelector('#peer-order-result')?.textContent?.includes(value), revised, { timeout: 45000 })
  } catch (err) {
    throw new Error(`Reconnect retrieval failed: ${await b.page.locator('#peer-order-result').textContent()}; ${err.message}`)
  }
  console.log('PASS: reconnected peer fetches the new order after restart')
} finally {
  for (const session of sessions) await stop(session)
  rmSync(work, { recursive: true, force: true })
  await testnet?.destroy()
}
