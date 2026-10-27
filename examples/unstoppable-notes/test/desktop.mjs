// Real Electron → preload → Pear/Bare on two isolated profiles. Synthetic notes
// only; no private product checkout, model or publicly reachable bootstrap.
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { mkdir } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { _electron } from 'playwright'
import { environment } from './helpers.mjs'

const require = createRequire(import.meta.url)
const appDir = resolve(import.meta.dirname, '..')
const output = join(appDir, 'artifacts/desktop-ui')
await mkdir(output, { recursive: true })
const env = await environment()
const apps = new Set()
const errors = []
async function launch(name) {
  const app = await _electron.launch({
    executablePath: require('electron'),
    args: [
      appDir,
      '--storage',
      join(env.directory, name),
      `--user-data-dir=${join(env.directory, name + '-browser')}`,
    ],
    env: {
      ...process.env,
      NOTES_EXAMPLE_BOOTSTRAP: JSON.stringify(env.bootstrap),
    },
    timeout: 60000,
  })
  apps.add(app)
  const page = await app.firstWindow()
  page.setDefaultTimeout(20000)
  page.on('pageerror', (error) => errors.push(error.message))
  await page
    .locator('#storage-status')
    .filter({ hasText: 'Saved on this desktop' })
    .waitFor({ timeout: 60000 })
  return { app, page }
}
async function close(app) {
  await app.close()
  apps.delete(app)
}
async function save(page, title, text) {
  await page.locator('#new-note').click()
  await page.locator('#note-title').fill(title)
  await page.locator('#note-text').fill(text)
  await page.locator('#save-note').click()
  await page
    .locator('#draft-status')
    .filter({ hasText: 'Saved on this desktop' })
    .waitFor()
  await page
    .locator('#notice')
    .filter({ hasText: 'Saved on this desktop.' })
    .waitFor()
}
async function sync(page) {
  await page.locator('#nav-devices').click()
  await page.locator('#sync-notes').click()
  await page.waitForFunction(
    () =>
      document.querySelector('#notice').getAttribute('role') === 'alert' ||
      document
        .querySelector('#notice')
        .textContent.includes(
          'Saved notebook copies exchanged with 1 desktop.',
        ),
    undefined,
    { timeout: 55000 },
  )
  assert.notEqual(
    await page.locator('#notice').getAttribute('role'),
    'alert',
    await page.locator('#notice').textContent(),
  )
}
async function read(page, title) {
  await page.locator('#nav-notes').click()
  await page.locator('#search').fill(title)
  await page.locator('.note-item').filter({ hasText: title }).click()
}
try {
  let left = await launch('left')
  console.log('Desktop: local writing and editing')
  assert.equal(await left.page.locator('.note-item').count(), 0)
  await save(
    left.page,
    'Coffee with Maya',
    'Tuesday, 3 pm at the little place by the station.\n\nBring the prototype and ask how her exhibition went.',
  )
  await save(
    left.page,
    'A weekend in the garden',
    'Rosemary by the kitchen window. Mint in its own pot.\n\nFind a quiet hour on Saturday to get started.',
  )
  await read(left.page, 'Coffee with Maya')
  await left.page
    .locator('#note-text')
    .fill(
      'Wednesday, 3 pm at the little place by the station.\n\nBring the prototype and ask how her exhibition went.',
    )
  await left.page.locator('#save-note').click()
  await left.page
    .locator('#draft-status')
    .filter({ hasText: 'Saved on this desktop' })
    .waitFor()
  await left.page
    .locator('#notice')
    .filter({ hasText: 'Saved on this desktop.' })
    .waitFor()
  await left.page.locator('#search').fill('')
  assert.equal(await left.page.locator('.note-item').count(), 2)

  let right = await launch('right')
  console.log('Desktop: initial pairing and bidirectional exchange')
  await save(
    right.page,
    'The book Ben mentioned',
    'The Creative Act — look for it at the bookshop on the way home.',
  )
  await left.page.locator('#nav-devices').click()
  await left.page.locator('#create-code').click()
  await left.page.locator('#invitation').waitFor()
  const code = await left.page.locator('#pairing-code').inputValue()
  await right.page.locator('#nav-devices').click()
  await right.page.locator('#pair-input').fill(code)
  await right.page.locator('#pair-device').click()
  await right.page
    .locator('#notice')
    .filter({ hasText: 'Saved notebook copies exchanged with 1 desktop.' })
    .waitFor({ timeout: 55000 })
  await read(right.page, 'Coffee with Maya')
  assert(
    (await right.page.locator('#received-text').textContent()).includes(
      'Wednesday',
    ),
  )
  assert(await right.page.locator('#editor').isHidden())

  await read(left.page, 'The book Ben mentioned')
  assert(
    (await left.page.locator('#received-text').textContent()).includes(
      'The Creative Act',
    ),
  )
  await left.page.locator('#search').fill('')
  await left.page.emulateMedia({ colorScheme: 'light' })
  await left.page.getByRole('button', { name: 'Dismiss notification' }).click()
  await left.page.locator('#search').blur()
  await left.page.screenshot({ path: join(output, 'notes-light.png') })
  await left.page.emulateMedia({ colorScheme: 'dark' })
  await left.page.screenshot({ path: join(output, 'notes-dark.png') })
  await left.page.locator('#nav-devices').click()
  await left.page.screenshot({ path: join(output, 'devices-dark.png') })
  await left.page.emulateMedia({ colorScheme: 'light' })
  await left.page.locator('#nav-notes').click()
  const window = await left.app.browserWindow(left.page)
  await window.evaluate((win) => win.setContentSize(650, 900))
  assert(
    await left.page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  )
  await left.page.screenshot({
    path: join(output, 'notes-narrow.png'),
    fullPage: true,
  })

  // A received snapshot must not erase an original draft being written locally.
  console.log('Desktop: drafts, invalid input and plain-text rendering')
  await left.page.locator('#new-note').click()
  await left.page.locator('#note-title').fill('A thought in progress')
  await left.page
    .locator('#note-text')
    .fill('This draft should stay right here.')
  await save(
    right.page,
    'Fresh from the other desktop',
    'An update after pairing.',
  )
  await sync(right.page)
  assert.equal(
    await left.page.locator('#note-text').inputValue(),
    'This draft should stay right here.',
  )
  assert.equal(
    await left.page.locator('#draft-status').textContent(),
    'Unsaved changes',
  )
  await left.page.locator('#save-note').click()
  await left.page
    .locator('#notice')
    .filter({ hasText: 'Saved on this desktop.' })
    .waitFor()

  // Empty-input failure leaves the editor recoverable; markup stays plain text.
  await left.page.locator('#new-note').click()
  await left.page.locator('#save-note').click()
  await left.page
    .locator('#notice[role=alert]')
    .filter({ hasText: 'Write a note' })
    .waitFor()
  await left.page.locator('#note-title').fill('<img src=x onerror=alert(1)>')
  await left.page
    .locator('#note-text')
    .fill('<script>This is a note, never executable markup.</script>')
  await left.page.locator('#save-note').click()
  await left.page
    .locator('#notice')
    .filter({ hasText: 'Saved on this desktop.' })
    .waitFor()
  assert.equal(await left.page.locator('.note-item img').count(), 0)
  await sync(left.page)
  await read(right.page, '<img src=x')
  assert.equal(
    await right.page
      .locator('#received-reader img, #received-reader script')
      .count(),
    0,
  )
  assert(
    (await right.page.locator('#received-text').textContent()).startsWith(
      '<script>',
    ),
  )

  await close(right.app)
  await close(left.app)
  console.log('Desktop: source-offline restart and cancellation')
  left = await launch('left')
  await read(left.page, 'The book Ben mentioned')
  assert(
    (await left.page.locator('#received-text').textContent()).includes(
      'The Creative Act',
    ),
  )
  assert.equal(await left.page.locator('#device-count').textContent(), '1')
  await save(
    left.page,
    'Written while the other desktop was away',
    'Still available without a peer.',
  )
  await left.page.locator('#nav-devices').click()
  await left.page.locator('#sync-notes').click()
  await left.page.locator('#cancel-operation').waitFor()
  await left.page.locator('#cancel-operation').click()
  await left.page
    .locator('#notice[role=alert]')
    .filter({ hasText: 'cancelled' })
    .waitFor()
  right = await launch('right')
  console.log('Desktop: fresh note after saved-pair reconnect')
  await save(
    right.page,
    'Back after restart',
    'Fresh content with the saved pairing.',
  )
  await sync(left.page)
  await read(left.page, 'Back after restart')
  assert(
    (await left.page.locator('#received-text').textContent()).includes(
      'saved pairing',
    ),
  )
  await read(right.page, 'Written while the other desktop was away')
  assert(
    (await right.page.locator('#received-text').textContent()).includes(
      'without a peer',
    ),
  )
  assert.deepEqual(errors, [])
  console.log(
    'PASS: real Electron/Pear/Bare note writing/editing, browsing/search, scoped bidirectional sync, original/received separation, drafts, safe text, offline restart, cancellation and reconnect without re-pairing.',
  )
  console.log(
    'Screenshots: light, dark, Devices and narrow. Isolated loopback only; no physical-device, public-network or packaged-app acceptance.',
  )
} catch (error) {
  for (const [index, app] of [...apps].entries()) {
    const page = app.windows()[0]
    if (!page) continue
    await page
      .screenshot({
        path: join(output, `failure-${index}.png`),
        fullPage: true,
      })
      .catch(() => {})
    console.error(
      'Desktop failure status:',
      await page
        .locator('#notice')
        .textContent()
        .catch(() => 'window closed'),
    )
    console.error(
      'Desktop failure state:',
      await page
        .evaluate(async () =>
          (await import('./app/bridge.js')).request('state'),
        )
        .catch(() => 'worker unavailable'),
    )
  }
  throw error
} finally {
  for (const app of apps) await app.close().catch(() => {})
  await env.cleanup()
}
