import { createRequire } from 'node:module'
import { spawn } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const out = process.env.COFFEE_DEMO_DIR || join(root, 'planning/status/evidence/20261007/demo')
const require = createRequire(join(root, 'packages/cli/package.json'))
const { chromium } = require('playwright')
const app = join(root, 'examples/coffee-assistant')
const testnet = process.env.COFFEE_TEST_PUBLIC_DHT === '1' ? null : await require('@hyperswarm/testnet')(3)
const work = mkdtempSync(join(tmpdir(), 'coffee-peer-e2e-'))
const sessions = []
const wait = ms => new Promise(resolve => setTimeout(resolve, ms))

async function launch(storage, port) {
  const proc = spawn(join(app, 'node_modules/.bin/electron'), ['.', `--user-data-dir=${join(work, 'browser-' + port)}`, '--storage', storage, `--remote-debugging-port=${port}`], {
    cwd: app, env: { ...process.env, COFFEE_P2P_BOOTSTRAP: testnet ? JSON.stringify(testnet.bootstrap) : '' }, detached: true, stdio: ['ignore', 'pipe', 'pipe'],
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
  const a = await launch(join(work, 'a'), port)
  const b = await launch(join(work, 'b'), port + 1)
  const order = `one oat latte ${Date.now()}`
  await a.page.locator('#kv-key').fill('morning')
  await a.page.locator('#kv-value').fill(order)
  await a.page.locator('#kv-save').click()
  await a.page.waitForFunction(() => document.querySelector('#kv-result')?.textContent?.includes('Saved'))
  await b.page.locator('#kv-key').fill('morning')
  await b.page.locator('#kv-fetch').click()
  await b.page.waitForFunction(() => document.querySelector('#kv-result')?.textContent?.includes('not found'))
  await a.page.locator('#share-orders').click()
  await a.page.waitForFunction(() => /^[a-f0-9]{64}$/.test(document.querySelector('#sharing-key')?.textContent || ''), undefined, { timeout: 30000 })
  await a.page.waitForFunction(() => document.querySelector('#sharing-key')?.dataset.ready === 'true', undefined, { timeout: 90000 })
  console.log('Sharing announced on DHT')
  const key = await a.page.locator('#sharing-key').textContent()
  await b.page.locator('#peer-key').fill(key)
  await b.page.locator('#peer-order-name').fill('morning')
  await b.page.locator('#fetch-peer-order').click()
  try {
    await b.page.waitForFunction(value => document.querySelector('#peer-order-result')?.textContent?.includes(value), order, { timeout: 45000 })
  } catch (err) {
    throw new Error(`Peer retrieval failed: ${await b.page.locator('#peer-order-result').textContent()}; ${err.message}`)
  }
  await b.page.setViewportSize({width:1100,height:1600})
  await b.page.screenshot({path:out+'/05-peer-retrieval.png'})
  console.log('PASS: second app fetched the first app’s unique order over a real peer connection')
  await stop(a.session)
  await b.page.waitForFunction(() => document.querySelector('#p2p-status')?.textContent?.includes('0 connected'), undefined, { timeout: 45000 })
  console.log('PASS: peer disconnection is visible')
  const restarted = await launch(join(work, 'a'), port + 2)
  await restarted.page.locator('#kv-key').fill('morning')
  await restarted.page.locator('#kv-fetch').click()
  await restarted.page.waitForFunction(value => document.querySelector('#kv-result')?.textContent?.includes(value), order)
  await restarted.page.setViewportSize({width:1100,height:1600})
  await restarted.page.screenshot({path:out+'/06-restart-persistence.png'})
  console.log('PASS: saved order survived full application restart')
  const revised = order + ' updated after restart'
  await restarted.page.locator('#kv-value').fill(revised)
  await restarted.page.locator('#kv-save').click()
  await restarted.page.waitForFunction(() => document.querySelector('#kv-result')?.textContent?.includes('Saved'))
  await restarted.page.locator('#share-orders').click()
  await restarted.page.waitForFunction(() => document.querySelector('#sharing-key')?.dataset.ready === 'true', undefined, { timeout: 90000 })
  await b.page.locator('#fetch-peer-order').click()
  await b.page.waitForFunction(value => document.querySelector('#peer-order-result')?.textContent?.includes(value), revised, { timeout: 45000 })
  await b.page.setViewportSize({width:1100,height:1600})
  await b.page.screenshot({path:out+'/07-reconnected-updated-order.png'})
  console.log('PASS: reconnected peer fetches the updated order, rather than an old cached copy')
} finally {
  for (const session of sessions) await stop(session)
  rmSync(work, { recursive: true, force: true })
  await testnet?.destroy()
}
