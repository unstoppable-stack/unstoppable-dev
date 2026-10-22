// Browser-only acceptance for generated UI and the first-party commerce example.
// The worker bridge is simulated. Native behavior has separate acceptance runners.
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { mkdir, readFile } from 'node:fs/promises'
import { resolve, extname, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium, expect } from 'playwright/test'
import { generatePearDesktop } from '../src/generators/pear-desktop.js'

const root = fileURLToPath(new URL('../../../', import.meta.url))
const output = resolve(process.argv[2] || '/tmp/unstoppable-ui-design')
await mkdir(output, { recursive: true })
const variants = new Map([
  ['base', new Map(generatePearDesktop({ projectName: 'local-workspace', platform: 'pear-desktop', features: [] }).map(file => [file.path, file.content]))],
  ['features', new Map(generatePearDesktop({ projectName: 'local-workspace', platform: 'pear-desktop', features: ['local-ai', 'wallet', 'node-sync'] }).map(file => [file.path, file.content]))],
])
const server = createServer(async (request, response) => {
  try {
    const [variant, ...parts] = new URL(request.url!, 'http://localhost').pathname.slice(1).split('/')
    const path = parts.join('/')
    let content: string | Buffer | undefined
    if (variant === 'commerce') {
      const base = resolve(root, 'examples/ecommerce-assistant')
      const file = resolve(base, path)
      if (!file.startsWith(base + sep)) throw new Error('Invalid asset')
      content = await readFile(file)
    } else content = variants.get(variant)?.get(path)
    if (content === undefined) throw new Error('Missing fixture asset')
    response.setHeader('Content-Type', { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' }[extname(path)] || 'application/octet-stream')
    response.end(content)
  } catch { response.writeHead(404); response.end() }
})
await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve) })
const bridge = `
const handlers = new Set(), values = new Map()
window.__commands = []
window.__emit = message => { for (const handler of handlers) handler(message) }
export function onWorkerMessage(handler) { handlers.add(handler); return () => handlers.delete(handler) }
export const workerReady = Promise.resolve()
export function sendToWorker(message) {
  window.__commands.push(message)
  if (message.type === 'db-put') { values.set(message.key, message.value); queueMicrotask(() => window.__emit({ type: 'db-put-ok', key: message.key })) }
  if (message.type === 'db-get') queueMicrotask(() => window.__emit({ type: 'db-get-ok', key: message.key, value: values.get(message.key) ?? null }))
  if (message.type === 'cart-get') queueMicrotask(() => window.__emit({ type: 'cart', cart: [], items: [], total: 0 }))
  if (message.type === 'load-ai') queueMicrotask(() => window.__emit({ type: 'status', service: 'ai', status: 'ready' }))
  return Promise.resolve()
}
`
let browser
try {
  browser = await chromium.launch({ channel: process.env.DESKTOP_UI_BROWSER || 'chrome', headless: true })
  for (const variant of ['base', 'features', 'commerce']) {
    const page = await browser.newPage({ viewport: { width: 1100, height: 850 } })
    const errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    await page.route('**/app/bridge.js', route => route.fulfill({ contentType: 'text/javascript', body: bridge }))
    await page.goto(`http://127.0.0.1:${(server.address() as { port: number }).port}/${variant}/index.html`)
    await page.locator('#kv-save').waitFor()
    await page.evaluate(() => {
      const fixture = window as unknown as { __emit: (message: unknown) => void }
      fixture.__emit({ type: 'init-complete' })
      fixture.__emit({ type: 'status', service: 'p2p', status: 'ready' })
    })
    const links = page.locator('.sidebar .nav-link')
    for (let index = 0; index < await links.count(); index++) {
      await links.nth(index).click()
      await expect(links.nth(index)).toHaveAttribute('aria-current', 'location')
      const hash = await links.nth(index).getAttribute('href')
      await expect(page.locator(hash!)).toBeVisible()
    }
    if (variant !== 'commerce') {
      await page.locator('#kv-key').fill('note')
      await page.locator('#kv-value').fill('Local first')
      await page.locator('#kv-save').click()
      await expect(page.locator('#kv-result')).toContainText('Saved')
      await page.locator('#kv-fetch').click()
      await expect(page.locator('#kv-result')).toContainText('Local first')
    }
    if (variant === 'features') {
      await page.locator('#load-ai').click()
      await expect(page.locator('#ai-chat')).toBeVisible()
      await page.locator('#chat-input').fill('Check the chat controls')
      await page.locator('#chat-send').click()
      await expect(page.locator('#chat-stop')).toBeVisible()
      await page.locator('#chat-stop').click()
      assert.equal(await page.evaluate(() => (window as unknown as { __commands: { type: string }[] }).__commands.at(-1)?.type), 'cancel-chat')
    }
    await page.evaluate(() => (document.activeElement as HTMLElement)?.blur())
    for (const scheme of ['dark', 'light'] as const) {
      await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' })
      for (const width of [1100, 780, 390]) {
        await page.setViewportSize({ width, height: 850 })
        await page.locator('.content').evaluate(element => { element.scrollTop = 0 })
        const overflow = await page.evaluate(() => [...document.querySelectorAll<HTMLElement>('.app-header,.sidebar,.content,.card,.product')].filter(element => element.scrollWidth > element.clientWidth + 1).map(element => element.className))
        assert.deepEqual(overflow, [], `${variant}, ${scheme}, ${width}px overflow`)
        await page.screenshot({ path: resolve(output, `${variant}-${scheme}-${width}.png`), animations: 'disabled' })
      }
    }
    assert.deepEqual(errors, [], variant)
    await page.close()
  }
  console.log(`PASS: scaffold and commerce navigation, KV controls, AI Stop command, and dark/light layouts at 1100/780/390px. Simulated worker only. Screenshots: ${output}`)
} finally {
  await browser?.close()
  await new Promise<void>(resolve => server.close(() => resolve()))
}
