import { createRequire } from 'node:module'
import { spawn } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync, readdirSync, statSync, createReadStream, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'

const root = fileURLToPath(new URL('../', import.meta.url))
const require = createRequire(join(root, 'packages/cli/package.json'))
const { chromium } = require('playwright')
const app = join(root, 'examples/coffee-assistant')
const work = mkdtempSync(join(tmpdir(), 'qvac-download-e2e-'))
const cache = join(work, 'models')
mkdirSync(cache)
const config = join(work, 'qvac.config.json')
writeFileSync(config, JSON.stringify({ cacheDirectory: cache }))
const sessions = []
const pause = ms => new Promise(resolve => setTimeout(resolve, ms))
const expectedBytes = 532517120
const expectedHash = 'bd258782e35f7f458f8aced1adc053e6e92e89bc735ba3be89d38a06121dc517'

function cacheFiles(directory = cache) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = join(directory, entry.name)
    return entry.isDirectory() ? cacheFiles(path) : [path]
  })
}
const cacheBytes = () => cacheFiles().reduce((bytes, path) => bytes + statSync(path).size, 0)

async function stop(session) {
  if (!session || session.stopped) return
  session.stopped = true
  try { process.kill(-session.proc.pid, 'SIGKILL') } catch {}
  await session.browser?.close().catch(() => {})
  await pause(300)
}

async function launch(port, offline = false) {
  const electron = join(app, 'node_modules/.bin/electron')
  const args = ['.', `--user-data-dir=${join(work, 'browser-' + port)}`, '--storage', join(work, 'storage'), `--remote-debugging-port=${port}`]
  if (offline) args.push('--no-sandbox') // Outer macOS sandbox enforces the network restriction.
  const profile = '(version 1)(allow default)(deny network*)(allow network-outbound (remote ip "localhost:*"))(allow network-inbound (local ip "localhost:*"))'
  const proc = spawn(offline ? '/usr/bin/sandbox-exec' : electron, offline ? ['-p', profile, electron, ...args] : args, {
    cwd: app, env: { ...process.env, QVAC_CONFIG_PATH: config, QVAC_MOCK: '0' }, detached: true, stdio: ['ignore', 'pipe', 'pipe'],
  })
  const session = { proc, browser: null, stopped: false }
  sessions.push(session)
  let diagnostics = ''
  for (const stream of [proc.stdout, proc.stderr]) stream.on('data', bytes => { diagnostics = (diagnostics + bytes).slice(-4000) })
  for (let attempt = 0; attempt < 60; attempt++) {
    await pause(500)
    try { session.browser = await chromium.connectOverCDP(`http://localhost:${port}`); break } catch {}
  }
  if (!session.browser) throw new Error(`Electron startup failed: ${diagnostics}`)
  let page
  for (let attempt = 0; attempt < 60 && !page; attempt++) {
    for (const candidate of session.browser.contexts().flatMap(context => context.pages())) {
      if (candidate.url().startsWith('file:') && await candidate.locator('#worker-status').count()) { page = candidate; break }
    }
    if (!page) await pause(500)
  }
  if (!page) throw new Error(`No app page: ${diagnostics}`)
  await page.waitForFunction(() => /ready/i.test(document.querySelector('#worker-status')?.textContent || ''), undefined, { timeout: 30000 })
  return { session, page }
}

async function waitReady(page) {
  const deadline = Date.now() + 600000
  while (Date.now() < deadline) {
    if (await page.locator('#ai-chat').isVisible()) return
    if (await page.locator('#ai-error').isVisible()) throw new Error(await page.locator('#ai-error-msg').textContent())
    await pause(200)
  }
  throw new Error('Model load did not finish within ten minutes')
}

async function completion(page) {
  await page.locator('#chat-input').fill('Suggest one mild coffee in a short sentence.')
  await page.locator('#chat-send').click()
  await page.waitForFunction(() => {
    const input = document.querySelector('#chat-input')
    const text = document.querySelector('.bubble-assistant')?.textContent?.trim() || ''
    return input && !input.disabled && text.length > 0 && !text.startsWith('Error:')
  }, undefined, { timeout: 120000 })
}

try {
  const port = 20000 + Math.floor(Math.random() * 20000)
  const first = await launch(port)
  await first.page.locator('#load-ai').click()
  const deadline = Date.now() + 180000
  let interruptedBytes = 0
  while (Date.now() < deadline) {
    interruptedBytes = cacheBytes()
    if (interruptedBytes > 1048576 && interruptedBytes < expectedBytes) break
    if (await first.page.locator('#ai-error').isVisible()) throw new Error(await first.page.locator('#ai-error-msg').textContent())
    await pause(50)
  }
  if (!(interruptedBytes > 0 && interruptedBytes < expectedBytes)) throw new Error('No partial model transfer observed; cannot claim an interruption test')
  await stop(first.session)
  console.log(`Interrupted an actual model download after ${interruptedBytes} bytes`)

  const retry = await launch(port + 1)
  const started = Date.now()
  await retry.page.locator('#load-ai').click()
  await waitReady(retry.page)
  const recoveryMs = Date.now() - started
  const file = cacheFiles().find(path => path.endsWith('.gguf') && statSync(path).size === expectedBytes)
  if (!file) throw new Error('Complete pinned model is missing from isolated cache')
  const hash = createHash('sha256')
  for await (const bytes of createReadStream(file)) hash.update(bytes)
  if (hash.digest('hex') !== expectedHash) throw new Error('Recovered model checksum differs from pinned release model')
  await completion(retry.page)
  console.log(`PASS: interrupted download recovered, checksum matched and real completion succeeded (${recoveryMs}ms to ready, ${cacheBytes()} cache bytes)`)
  await stop(retry.session)

  if (process.platform === 'darwin') {
    const offline = await launch(port + 2, true)
    await offline.page.locator('#load-ai').click()
    await waitReady(offline.page)
    await completion(offline.page)
    console.log('PASS: recovered model completed another prompt after a network-isolated restart')
  }
} finally {
  for (const session of sessions) await stop(session)
  rmSync(work, { recursive: true, force: true })
}
