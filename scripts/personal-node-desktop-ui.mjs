// Renderer interaction and layout acceptance with a simulated worker.
// Native pairing/replication is covered separately by personal-node-dashboard-e2e.mjs.
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { createServer } from 'node:http'
import { readFile, mkdir } from 'node:fs/promises'
import { resolve, extname, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const require = createRequire(resolve(root, 'packages/cli/package.json'))
const { chromium, expect } = require('playwright/test')
const desktop = resolve(root, 'packages/node-desktop')
const output = process.argv[2] || '/tmp/personal-node-desktop-ui'
await mkdir(output, { recursive: true })
const server = createServer(async (request, response) => {
  try {
    const path = resolve(desktop, '.' + new URL(request.url, 'http://localhost').pathname)
    if (!path.startsWith(desktop + sep)) throw new Error('Invalid asset')
    response.setHeader('Content-Type', { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' }[extname(path)] || 'application/octet-stream')
    response.end(await readFile(path))
  } catch { response.writeHead(404); response.end() }
})
await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve) })
let browser
const keyA = 'a'.repeat(64), keyB = 'b'.repeat(64)
const snapshot = {
  type: 'status', peers: [
    { publicKey: keyA, appName: 'Notebook', online: true, grantsGiven: { sync: ['manifest.replace'] } },
    { publicKey: keyB, appName: 'Briefing', online: false, grantsGiven: { sync: ['manifest.replace'], ai: ['completion.stream'] } }
  ],
  cores: [
    { owner: keyA, key: 'c'.repeat(64), name: 'Notes', type: 'hyperbee', protection: { mode: 'mirror', state: 'syncing' } },
    { owner: keyB, key: 'd'.repeat(64), name: 'Reports', type: 'hyperbee', protection: { mode: 'mirror', state: 'protected', caughtUpAt: '2026-10-22T12:00:00Z' } }
  ],
  storage: { total: 2457600, perOwner: { [keyA]: 1638400, [keyB]: 819200 }, quotas: { perPeer: { [keyA]: { limit: 524288000 }, [keyB]: { limit: 104857600 } } } },
  capabilities: { sync: {}, ai: {} }, ai: { ready: false }, trust: { approved: {}, denied: {} }
}
try {
  browser = await chromium.launch({ channel: process.env.DESKTOP_UI_BROWSER || 'chrome', headless: true })
  const page = await browser.newPage({ viewport: { width: 1100, height: 800 }, colorScheme: 'dark' })
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.addInitScript(() => {
    localStorage.setItem('unstoppable-node-welcome-seen', '1')
    window.__commands = []
    const handlers = new Set()
    window.__emit = message => handlers.forEach(handler => handler(message))
    window.personalNode = {
      onWorkerMessage: handler => { handlers.add(handler); return () => handlers.delete(handler) },
      sendCommand: message => window.__commands.push(message),
      rendererReady: () => setTimeout(() => window.__emit({ type: 'ready', capabilities: { sync: {}, ai: {} } }), 0),
      onTrayAction: () => () => {}, trayReady() {}, windowAction: async () => false,
      selectSettingsPath: async (_mode, path) => path
    }
    document.addEventListener('DOMContentLoaded', () => document.body.classList.add('electron-shell'))
  })
  await page.goto(`http://127.0.0.1:${server.address().port}/index.html`)
  await expect(page.locator('#simple-connect')).toBeEnabled()
  await expect(page.locator('.empty-state')).toBeVisible()
  await expect(page.locator('#simple-pause-all')).toBeDisabled()
  const emit = value => page.evaluate(value => window.__emit(value), value)
  const commands = () => page.evaluate(() => window.__commands)
  await emit(snapshot)
  await expect(page.locator('.simple-app')).toHaveCount(2)
  await expect(page.locator('#simple-inspector h3')).toHaveText('Notebook')
  await page.locator(`[data-select-app="${keyB}"]`).click()
  await expect(page.locator('#simple-inspector')).toContainText('Its last shared data is still available here.')
  await expect(page.locator('#simple-inspector')).toContainText('AI access: allowed')
  await page.getByRole('button', { name: 'Pause copying', exact: true }).click()
  assert.deepEqual((await commands()).at(-1), { type: 'pause-peer', publicKey: keyB })
  await page.locator('#simple-pause-all').click()
  assert.deepEqual((await commands()).slice(-2), [{ type: 'pause-peer', publicKey: keyA }, { type: 'pause-peer', publicKey: keyB }])
  const paused = structuredClone(snapshot)
  paused.cores.forEach(core => { core.paused = true })
  await emit(paused)
  await page.locator('#simple-pause-all').click()
  assert.deepEqual((await commands()).slice(-2), [{ type: 'resume-peer', publicKey: keyA }, { type: 'resume-peer', publicKey: keyB }])
  await emit(snapshot)
  await page.getByRole('button', { name: 'Storage limit', exact: true }).click()
  await page.locator('#simple-limit-value').fill('not a size')
  const beforeInvalidLimit = (await commands()).length
  await page.getByRole('button', { name: 'Save limit', exact: true }).click()
  await expect(page.locator('#simple-limit-error')).toContainText('Enter a size')
  assert.equal((await commands()).length, beforeInvalidLimit)
  await page.locator('#simple-limit-value').fill('2 GB')
  const updated = structuredClone(snapshot)
  updated.storage.total += 1024
  await emit(updated)
  await expect(page.locator('#simple-limit-value')).toBeFocused()
  await expect(page.locator('#simple-limit-value')).toHaveValue('2 GB')
  await page.getByRole('button', { name: 'Save limit', exact: true }).click()
  assert.deepEqual((await commands()).at(-1), { type: 'set-peer-quota', publicKey: keyB, quotaBytes: 2 * 1024 ** 3 })
  await expect(page.getByRole('button', { name: 'Storage limit', exact: true })).toBeFocused()
  await page.getByRole('button', { name: 'Pause copying', exact: true }).focus()
  updated.peers[1].online = true
  await emit(updated)
  await expect(page.getByRole('button', { name: 'Pause copying', exact: true })).toBeFocused()
  await expect(page.locator('#simple-inspector h3')).toHaveText('Briefing')
  // No user-supplied app label may become markup in either list or inspector.
  updated.peers[1].appName = '<img src=x onerror=alert(1)>'
  await emit(updated)
  assert.equal(await page.locator('#simple-home img').count(), 0)
  await expect(page.locator('#simple-inspector h3')).toHaveText('<img src=x onerror=alert(1)>')
  await emit(snapshot)
  await page.locator('#simple-connect').click()
  assert.deepEqual((await commands()).at(-1), { type: 'create-invite', uses: 1, expiresIn: 900000, grants: { sync: ['manifest.replace', 'status', 'usage', 'pause', 'resume'] } })
  await emit({ type: 'invite-result', invite: { id: 'test-code', code: 'illustrative-code' } })
  await expect(page.locator('#simple-code')).toHaveValue('illustrative-code')
  await emit({ type: 'inviteRedeemed', id: 'test-code', publicKey: keyA, remaining: 0 })
  await expect(page.locator('#simple-pairing')).toBeHidden()
  for (const [tab, panel] of [['storage', 'tab-storage'], ['ai', 'tab-ai'], ['config', 'tab-config']]) {
    await page.locator(`[data-tab="${tab}"]`).click()
    await expect(page.locator('#' + panel)).toBeVisible()
    await expect(page.locator('#dashboard-view')).toHaveValue('advanced')
  }
  // Existing Advanced workflows retain their command and confirmation boundaries.
  await page.locator('[data-tab="overview"]').click()
  await page.locator(`[data-ai-grant-peer="${keyA}"]`).click()
  assert.deepEqual((await commands()).at(-1), { type: 'set-peer-grant', publicKey: keyA, capability: 'ai', methods: ['completion.stream'] })
  await page.locator('[data-tab="config"]').click()
  await page.locator('#cfg-storage-global').fill('1073741824')
  await page.locator('#config-save').click()
  assert.equal((await commands()).at(-1).patch.storage.globalQuotaBytes, 1073741824)
  await page.locator('#backup-path').fill('/tmp/ui-settings.uns')
  await page.locator('#backup-export').click()
  assert.deepEqual((await commands()).at(-1), { type: 'export-state', path: '/tmp/ui-settings.uns' })
  await page.locator('#backup-import').click()
  assert.deepEqual((await commands()).at(-1), { type: 'preview-import', path: '/tmp/ui-settings.uns' })
  await emit({ type: 'import-preview', path: '/tmp/ui-settings.uns', preview: { peerCount: 2, trustCounts: { approved: 1, denied: 0 }, peers: [], hasConfig: true } })
  await expect(page.locator('#import-modal')).toBeVisible()
  await page.locator('#import-cancel').click()
  assert.equal((await commands()).at(-1).type, 'preview-import', 'cancel must not import')
  await emit({ type: 'import-preview', path: '/tmp/ui-settings.uns', preview: { peerCount: 2, trustCounts: { approved: 1, denied: 0 }, peers: [], hasConfig: true } })
  await page.locator('#import-confirm').click()
  assert.deepEqual((await commands()).at(-1), { type: 'import-state', path: '/tmp/ui-settings.uns' })
  await emit({ type: 'import-result', peers: 2, path: '/tmp/ui-settings.uns' })
  await expect(page.locator('#import-modal')).toBeHidden()
  await emit({ type: 'pairAwaitingApproval', publicKey: 'e'.repeat(64), appName: 'Pending app' })
  await expect(page.locator('#approval-modal')).toBeVisible()
  await page.locator('#modal-approve-once').click()
  assert.deepEqual((await commands()).at(-1), { type: 'pair-approve', publicKey: 'e'.repeat(64), remember: false })
  await page.locator('[data-section="saved"]').click()
  await expect(page.locator('#simple-title')).toHaveText('Saved app data')
  await expect(page.locator('#dashboard-view')).toHaveValue('simple')
  await page.getByRole('button', { name: 'Browse saved data', exact: true }).click()
  await expect(page.locator('#peek-modal')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.locator('#peek-modal')).toBeHidden()
  await page.locator('[data-section="overview"]').click()
  assert.equal(await page.locator('.content').evaluate(element => element.scrollTop), 0, 'navigation must reveal the top of the destination screen')
  await page.locator(`[data-select-app="${keyA}"]`).click()
  for (const scheme of ['dark', 'light']) {
    await page.emulateMedia({ colorScheme: scheme })
    for (const width of [1100, 780, 390]) {
      await page.setViewportSize({ width, height: 850 })
      const overflow = await page.evaluate(() => [...document.querySelectorAll('.hdr,.sidebar,.content,.simple-inspector,.simple-apps')].filter(el => el.scrollWidth > el.clientWidth + 1).map(el => el.className))
      assert.deepEqual(overflow, [], `Horizontal overflow at ${width}px / ${scheme}`)
      await page.locator('.content').evaluate(element => { element.scrollTop = 0 })
      await page.screenshot({ path: resolve(output, `cloud-${scheme}-${width}.png`) })
    }
  }
  await page.setViewportSize({ width: 1100, height: 800 })
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.locator(`[data-select-app="${keyB}"]`).click()
  await page.getByRole('button', { name: 'Storage limit', exact: true }).click()
  const removed = structuredClone(snapshot)
  removed.peers = [snapshot.peers[0]]
  await emit(removed)
  await expect(page.locator('#simple-limit-form')).toBeHidden()
  await expect(page.locator('#simple-inspector h3')).toHaveText('Notebook')
  await emit({ type: 'fatal', error: 'Fixture worker failure' })
  await emit(snapshot) // A stale status must not re-enable controls after failure.
  await expect(page.locator('#simple-connect')).toBeDisabled()
  await expect(page.locator('#simple-pause-all')).toBeDisabled()
  assert.equal(await page.locator('#simple-inspector button:enabled').count(), 0)
  assert.deepEqual(errors, [])
  console.log(`PASS: renderer navigation, app selection, commands, quota validation, pairing, focus retention, Advanced grants/settings/import/export/approval, escaped names, failure handling, and dark/light layouts at 1100/780/390px. Screenshots: ${output}`)
} finally {
  await browser?.close()
  await new Promise(resolve => server.close(resolve))
}
