import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { spawn } from 'node:child_process'
import { mkdtemp, mkdir, writeFile, rm, realpath } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import { setTimeout as delay } from 'node:timers/promises'

const root = fileURLToPath(new URL('../', import.meta.url))
const require = createRequire(join(root, 'packages/cli/package.json'))
const { _electron } = require('playwright')
const desktop = join(root, 'packages/node-desktop')
const electron = createRequire(join(desktop, 'package.json'))('electron')
const example = join(root, 'examples/personal-node-ecosystem')
const { values } = parseArgs({ options: { 'keep-open': { type: 'boolean' }, output: { type: 'string' } } })
const work = await realpath(await mkdtemp(join(tmpdir(), 'personal-node-dashboard-')))
const output = values.output || work
await mkdir(output, { recursive: true })
const children = new Set()
let app, page
const pageErrors = []

function start(script, args, storage) {
  const child = spawn(process.execPath, [join(example, script), ...args, '--storage', join(work, storage)], { cwd: example, stdio: ['ignore', 'pipe', 'pipe'] })
  const proc = { child, stdout: '', stderr: '', exited: false }
  children.add(proc)
  child.stdout.on('data', data => { proc.stdout += data })
  child.stderr.on('data', data => { proc.stderr += data })
  proc.exit = new Promise((resolve, reject) => {
    child.once('error', reject)
    child.once('exit', code => { proc.exited = true; resolve(code) })
  })
  return proc
}
async function matches(proc, pattern, timeout = 45000) {
  const deadline = Date.now() + timeout
  while (Date.now() < deadline) {
    const match = proc.stdout.match(pattern)
    if (match) return match
    if (proc.exited) throw new Error(`Example exited: ${proc.stderr}`)
    await delay(100)
  }
  throw new Error(`Example timed out: ${proc.stderr}`)
}
async function run(script, args, storage) {
  const proc = start(script, args, storage)
  let timer
  try {
    const result = await Promise.race([proc.exit, new Promise((resolve, reject) => {
      timer = setTimeout(() => reject(new Error('Example command timed out')), 45000)
    })])
    assert.equal(result, 0, proc.stderr)
    return proc.stdout
  } finally { clearTimeout(timer) }
}
async function stop(proc) {
  if (proc.exited) return
  proc.child.kill('SIGINT')
  const timeout = setTimeout(() => proc.child.kill('SIGKILL'), 5000)
  try { await proc.exit } finally { clearTimeout(timeout) }
}
async function view(value) {
  await page.locator('#dashboard-view').selectOption(value)
}
function simpleRow(name) {
  return page.locator('.simple-app').filter({ has: page.getByRole('heading', { name, exact: true }) })
}
async function invite(mode = 'simple') {
  await view(mode)
  if (mode === 'simple') {
    const previous = await page.locator('#simple-code').inputValue()
    await page.getByRole('button', { name: 'Connect an app', exact: true }).click()
    await page.waitForFunction(previous => {
      const value = document.querySelector('#simple-code')?.value
      return value && value !== previous
    }, previous, { timeout: 45000 })
    return page.locator('#simple-code').inputValue()
  }
  await page.locator('[data-tab="config"]').click()
  const previous = await page.locator('#invite-code').textContent()
  await page.locator('#invite-create').click()
  await page.waitForFunction(previous => {
    const code = document.querySelector('#invite-code')?.textContent
    return code && code !== previous
  }, previous, { timeout: 45000 })
  const code = await page.locator('#invite-code').textContent()
  await page.locator('[data-tab="overview"]').click()
  return code.trim()
}
async function verified(count) {
  await page.waitForFunction(count => {
    const rows = [...document.querySelectorAll('#apps-list .app-row')]
    return rows.length === count && rows.every(row => row.textContent.includes('verified copy'))
  }, count, { timeout: 30000 })
}
function appRow(name) {
  return page.locator('#apps-list .app-row').filter({ has: page.locator(`[data-peek-app="${name}"]`) })
}
async function connections(count) {
  await page.waitForFunction(count =>
    document.querySelector('#m-peers')?.textContent === String(count) &&
    document.querySelectorAll('#apps-list [data-connection="online"]').length === count,
  count, { timeout: 30000 })
}

try {
  app = await _electron.launch({ executablePath: electron, args: [desktop, '--user-data-dir=' + join(work, 'desktop')], timeout: 30000 })
  assert.equal(await app.evaluate(({ app }) => app.getPath('userData')), join(work, 'desktop'))
  page = await app.firstWindow()
  page.on('pageerror', error => pageErrors.push(error.message))
  await page.locator('#welcome-dismiss').click()
  await page.waitForFunction(() => document.querySelector('#node-status')?.textContent.includes('Node is running'), undefined, { timeout: 60000 })
  console.log('PASS: actual Electron dashboard and Bare daemon ready in an isolated profile')
  assert.equal(await page.locator('#dashboard-view').inputValue(), 'simple')
  assert.equal(await page.locator('#advanced-dashboard').isVisible(), false)
  await page.screenshot({ path: join(output, 'simple-empty.png') })
  await run('notebook.js', ['put', 'launch', 'Launch plan', 'Ship a useful local app'], 'notebook')
  let notebook = start('notebook.js', ['serve', '--node-invite', await invite()], 'notebook')
  const nodeKey = (await matches(notebook, /"nodePublicKey": "([a-f0-9]+)"/))[1]
  const notebookCode = (await matches(notebook, /"invitation": "([^"]+)"/))[1]
  await verified(1)
  await simpleRow('Notebook').getByText('Latest shared data copied', { exact: true }).waitFor()
  console.log('PASS: Notebook paired using a code created through the dashboard; its data is verified')
  await run('briefing.js', ['link', '--invite', notebookCode], 'briefing')
  await stop(notebook)
  await connections(0)
  await simpleRow('Notebook').getByText('Not connected', { exact: true }).waitFor()
  assert.match(await simpleRow('Notebook').innerText(), /last shared data is still available/)
  assert.equal(await appRow('Notebook').locator('[data-connection="offline"]').count(), 1)
  assert.match(await appRow('Notebook').innerText(), /verified copy/i)
  let briefing = start('briefing.js', ['sync', '--node-invite', await invite('advanced'), '--stay-open'], 'briefing')
  await matches(briefing, /Report synced\./)
  assert.match(briefing.stdout, /Launch plan/)
  await verified(2)
  console.log('PASS: Briefing retrieved notes while Notebook was stopped and synced its own report')
  notebook = start('notebook.js', ['serve', '--node-key', nodeKey], 'notebook')
  await matches(notebook, /"invitation":/)
  await connections(2)
  await verified(2)
  assert.equal(await page.locator('[data-promote]').count(), 0, 'pairing codes already authorize these apps')
  for (const name of ['Notebook', 'Briefing']) assert.match(await appRow(name).innerText(), /paired by code/i)
  await view('simple')
  assert.match(await simpleRow('Notebook').innerText(), /AI access: not allowed/)
  assert.match(await simpleRow('Briefing').innerText(), /AI access: allowed/)
  page.once('dialog', dialog => dialog.dismiss())
  await simpleRow('Briefing').getByRole('button', { name: 'Disconnect app', exact: true }).click()
  await connections(2)
  await simpleRow('Notebook').getByRole('button', { name: 'Pause copying', exact: true }).click()
  await simpleRow('Notebook').getByText('Copying is paused', { exact: true }).waitFor()
  await view('advanced')
  await appRow('Notebook').getByRole('button', { name: 'Resume protection', exact: true }).waitFor()
  assert.match(await appRow('Notebook').innerText(), /paused/i)
  await appRow('Notebook').getByRole('button', { name: 'Resume protection', exact: true }).click()
  await verified(2)
  await view('simple')
  await simpleRow('Notebook').getByText('Latest shared data copied', { exact: true }).waitFor()
  await simpleRow('Notebook').getByRole('button', { name: 'Storage limit', exact: true }).click()
  await page.locator('#simple-limit-value').fill('not a size')
  await page.getByRole('button', { name: 'Save limit', exact: true }).click()
  assert.match(await page.locator('#simple-limit-error').innerText(), /Enter a size/)
  await page.locator('#simple-limit-value').fill('2 GB')
  await page.getByRole('button', { name: 'Save limit', exact: true }).click()
  await simpleRow('Notebook').getByText(/Storage limit: 2.0 GB/).waitFor()
  await view('advanced')
  await appRow('Notebook').getByRole('button', { name: 'Storage limit: 2.0 GB', exact: true }).waitFor()
  await page.reload()
  assert.equal(await page.locator('#dashboard-view').inputValue(), 'advanced')
  assert.equal(await page.locator('#welcome-modal').isVisible(), false)
  await connections(2)
  await view('simple')
  await page.reload()
  assert.equal(await page.locator('#dashboard-view').inputValue(), 'simple')
  assert.equal(await page.locator('#welcome-modal').isVisible(), false)
  await simpleRow('Notebook').getByText('Latest shared data copied', { exact: true }).waitFor()
  assert.equal(await page.locator('#node-key').isVisible(), false)
  assert.match(await simpleRow('Notebook').innerText(), /AI access: not allowed/)
  console.log('PASS: Simple and Advanced share live state; pause/resume, storage limit validation, unchanged grants and saved view choice')

  await stop(briefing)
  await stop(notebook)
  await connections(0)
  await run('notebook.js', ['put', 'launch', 'Updated launch plan', 'Both apps share data through the desktop node'], 'notebook')
  notebook = start('notebook.js', ['serve', '--node-key', nodeKey], 'notebook')
  await matches(notebook, /"invitation":/)
  await run('briefing.js', ['link'], 'briefing')
  briefing = start('briefing.js', ['sync', '--node-key', nodeKey, '--stay-open'], 'briefing')
  await matches(briefing, /Report synced\./)
  assert.match(briefing.stdout, /Updated launch plan/)
  await connections(2)
  await verified(2)
  console.log('PASS: an offline edit propagated into Briefing’s updated report and both verified node datasets')
  await view('simple')
  await page.screenshot({ path: join(output, 'simple-connected.png') })
  for (const name of ['Notebook', 'Briefing']) {
    await simpleRow(name).getByRole('button', { name: 'Browse saved data' }).click()
    await page.waitForFunction(() => document.querySelector('#peek-body')?.textContent.includes('Updated launch plan'), undefined, { timeout: 15000 })
    assert.equal(await page.locator('#dashboard-view').inputValue(), 'simple')
    assert.doesNotMatch(await page.locator('#peek-body').innerText(), /schemaVersion|schema Version|publicKey|sourceKey|Core key/ )
    assert.equal(await page.locator(name === 'Notebook' ? '.saved-note' : '.saved-report').count(), 1)
    await page.screenshot({ path: join(output, `${name.toLowerCase()}-saved-data.png`) })
    await page.locator('#peek-close').click()
  }
  console.log('PASS: Simple displays readable Notebook notes and Briefing report contents')
  await view('advanced')
  await page.screenshot({ path: join(output, 'dashboard-connected.png') })
  console.log(await page.locator('#tab-overview').innerText())
  await page.locator('[data-peek-app="Notebook"]').click()
  await page.waitForFunction(() => document.querySelector('#peek-body')?.textContent.includes('schemaVersion'), undefined, { timeout: 15000 })
  await page.screenshot({ path: join(output, 'notebook-data.png') })
  await page.locator('#peek-close').click()
  await page.locator('[data-peek-app="Briefing"]').click()
  await page.waitForFunction(() => document.querySelector('#peek-body')?.textContent.includes('schemaVersion'), undefined, { timeout: 15000 })
  await page.screenshot({ path: join(output, 'briefing-data.png') })
  await page.locator('#peek-close').click()
  await view('simple')
  assert.deepEqual(pageErrors, [])
  await writeFile(join(output, 'result.json'), JSON.stringify({ passed: true, views: ['simple', 'advanced'], viewPersistence: true, transport: 'public DHT', apps: ['Notebook', 'Briefing'], connected: 2, verifiedDatasets: 2, pageErrors }, null, 2))
  console.log(`PASS: both apps connected and verified in the dashboard. Screenshots: ${output}`)
  if (values['keep-open']) {
    console.log('Dashboard and app processes remain open for inspection. Stop this runner with Ctrl+C to close them.')
    await new Promise(resolve => { process.once('SIGINT', resolve); process.once('SIGTERM', resolve) })
  }
} catch (error) {
  await page?.screenshot({ path: join(output, 'failure.png') }).catch(() => {})
  console.error('Dashboard test failed:', error)
  console.error('Visible UI:', await page?.locator('body').innerText().catch(() => 'unavailable'))
  process.exitCode = 1
} finally {
  await Promise.allSettled([...children].map(stop))
  await app?.close().catch(() => {})
  // Keep evidence on failure, or when it was explicitly requested outside work.
  if (!process.exitCode && values.output) await rm(work, { recursive: true, force: true })
}
