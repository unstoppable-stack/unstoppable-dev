/**
 * E2E scaffold test runner
 *
 * Tests that scaffolded apps install, build, and behave correctly at runtime.
 *
 * Platforms:
 *   pear-desktop  — scaffold → install → file-integrity → worker spawn test
 *   expo-mobile   — scaffold → install → xcodebuild → simulator → Maestro
 *   node-cli      — scaffold → install → spawn process, assert stdout
 *
 * Test levels (--level N):
 *   1  scaffold only                    (all platforms, fast)
 *   2  scaffold + npm install           (all platforms, installs deps)
 *   3  platform-specific structural checks (CI-safe, no running app):
 *         pear-desktop: file-integrity check
 *         expo-mobile:  xcodebuild (needs Xcode)
 *         node-cli:     spawn process, assert stdout
 *   4  runtime smoke:
 *         pear-desktop: spawn worker.js via harness, assert NDJSON events
 *         expo-mobile:  boot simulator + install app
 *   5  full UI:
 *         expo-mobile:  Maestro flow on simulator. Asserts:
 *                       (a) KV write/read and persistence after restart,
 *                       (b) non-mock model loading refuses simulators before
 *                           download, with physical-device instructions,
 *                       (c) QVAC_MOCK=1 exercises mocked chat, not inference.
 *         pear-desktop: launch Electron through CDP, verify the visible KV UI,
 *                       and optionally stream a real QVAC reply with
 *                       QVAC_REAL_E2E=1
 *   6  device runtime (expo-mobile only, opt-in via --device <udid>):
 *         expo-mobile:  drives Maestro against an already-installed dev
 *                       build on a connected iPhone. Toggles GPU on,
 *                       taps Load Assistant, waits for the real ~400MB
 *                       Qwen3 download (5-min timeout), sends a chat
 *                       message, asserts a streamed assistant response.
 *                       This is the only level that exercises the full
 *                       model-load + inference path. The runner does NOT
 *                       build/install the app — run
 *                       `npx expo run:ios --device` once first.
 *
 * Variants (after feature simplification):
 *   pear-desktop: bare, local-ai, wallet, local-ai+wallet, multi-writer
 *   expo-mobile:  bare, local-ai    (wallet/multi-writer not supported on mobile)
 *   node-cli:     bare, local-ai, wallet, multi-writer
 *
 * Usage:
 *   npx tsx e2e/test-scaffold.ts                               # mobile, level 5
 *   npx tsx e2e/test-scaffold.ts --platform pear-desktop       # desktop, level 4
 *   npx tsx e2e/test-scaffold.ts --platform node-cli           # node cli, level 3
 *   npx tsx e2e/test-scaffold.ts --platform all                # all platforms (safe defaults)
 *   npx tsx e2e/test-scaffold.ts --platform all \
 *       --level-expo-mobile 5                                  # all + full mobile run
 *   npx tsx e2e/test-scaffold.ts --variant local-ai            # single variant
 *   npx tsx e2e/test-scaffold.ts --level 2                     # scaffold+install only
 *   npx tsx e2e/test-scaffold.ts --skip-build                  # reuse previous scaffold
 *   npx tsx e2e/test-scaffold.ts --device 00008110-001AB...    # full real-load test on iPhone
 *
 * Env vars:
 *   QVAC_MOCK=1          — skip model loading, echo input as "Mock: <input>"
 *   QVAC_REAL_E2E=1      — at Pear Desktop level 5, load the real default
 *                          model and require a non-empty streamed UI reply
 *   QVAC_OFFLINE_E2E=1   — on macOS, deny all non-localhost network access
 *                          while running the real cached-model UI flow
 *   QVAC_REAL_LOAD_TIMEOUT_MS — real desktop model-load timeout (default 600000)
 *   US_SIMULATOR=<name>  — override iOS simulator (default: iPhone 16)
 *
 * Prerequisites:
 *   level 2+:   Node.js, npm
 *   expo-mobile level 3+: Xcode + iOS Simulator runtime
 *   expo-mobile level 5:  Maestro (brew install mobile-dev-inc/tap/maestro)
 *   expo-mobile --device: Maestro + a connected iPhone with the dev
 *                          build pre-installed (run `npx expo run:ios
 *                          --device` once from the scaffolded project).
 */

import { execSync, spawn, type ChildProcess } from 'child_process'
import { existsSync, mkdirSync, rmSync, writeFileSync, appendFileSync, readFileSync } from 'fs'
import { join, resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

import { generateMaestroFlow } from '../src/e2e/maestro-flow.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const CLI_ROOT = resolve(__dirname, '..')

const TMP_BASE = '/tmp/us-e2e-scaffold'
const SIMULATOR_NAME = process.env.US_SIMULATOR || 'iPhone 16'
const QVAC_MOCK = process.env.QVAC_MOCK === '1'
const QVAC_REAL_E2E = process.env.QVAC_REAL_E2E === '1'
const QVAC_OFFLINE_E2E = process.env.QVAC_OFFLINE_E2E === '1'
const QVAC_REAL_LOAD_TIMEOUT_MS = Number(process.env.QVAC_REAL_LOAD_TIMEOUT_MS || 600_000)

if (QVAC_MOCK && QVAC_REAL_E2E) {
  throw new Error('QVAC_MOCK=1 and QVAC_REAL_E2E=1 are mutually exclusive')
}
if (QVAC_OFFLINE_E2E && (!QVAC_REAL_E2E || process.platform !== 'darwin')) {
  throw new Error('QVAC_OFFLINE_E2E=1 requires QVAC_REAL_E2E=1 on macOS')
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Platform = 'expo-mobile' | 'pear-desktop' | 'node-cli'

interface Variant {
  name: string
  features: string[]
}

interface StepResult {
  name: string
  passed: boolean
  duration: number
  error?: string
  skipped?: boolean
}

interface VariantResult {
  variant: string
  platform: Platform
  steps: StepResult[]
  passed: boolean
  duration: number
}

// ---------------------------------------------------------------------------
// Variants — match the feature set (local-ai, wallet, multi-writer).
// multi-writer is desktop/node only, and cannot combine with node-sync.
// ---------------------------------------------------------------------------

const VARIANTS_MOBILE: Variant[] = [
  { name: 'bare', features: [] },
  { name: 'local-ai', features: ['local-ai'] },
]

const VARIANTS_DESKTOP: Variant[] = [
  { name: 'bare', features: [] },
  { name: 'local-ai', features: ['local-ai'] },
  { name: 'wallet', features: ['wallet'] },
  { name: 'local-ai+wallet', features: ['local-ai', 'wallet'] },
  // multi-writer swaps the Hyperbee KV for Autobee + HyperDB and adds a
  // postinstall schema codegen step, so npm install exercises real work here.
  { name: 'multi-writer', features: ['multi-writer'] },
]

const VARIANTS_NODE: Variant[] = [
  { name: 'bare', features: [] },
  { name: 'local-ai', features: ['local-ai'] },
  { name: 'wallet', features: ['wallet'] },
  { name: 'multi-writer', features: ['multi-writer'] },
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function log(msg: string) {
  const ts = new Date().toISOString().slice(11, 19)
  console.log(`[${ts}] ${msg}`)
}

function exec(cmd: string, opts?: { cwd?: string; timeout?: number; env?: NodeJS.ProcessEnv; logFile?: string }): string {
  const timeout = opts?.timeout ?? 60_000
  try {
    const output = execSync(cmd, {
      cwd: opts?.cwd,
      timeout,
      maxBuffer: 50 * 1024 * 1024,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
      env: opts?.env ?? process.env,
    })
    if (opts?.logFile) writeFileSync(opts.logFile, output)
    return output.trim()
  } catch (err: any) {
    const stderr = err.stderr?.toString?.() || ''
    const stdout = err.stdout?.toString?.() || ''
    if (opts?.logFile) writeFileSync(opts.logFile, stdout + '\n' + stderr)
    throw new Error(
      `Command failed (exit ${err.status}): ${cmd}\n${(stderr || stdout).slice(0, 2000)}`,
    )
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

function processTreeRssMiB(rootPid: number | undefined): number | null {
  if (!rootPid || !['darwin', 'linux'].includes(process.platform)) return null
  try {
    const rows = execSync('ps -axo pid=,ppid=,rss=', { encoding: 'utf8' })
      .trim()
      .split('\n')
      .map((line) => line.trim().split(/\s+/).map(Number))
      .filter(([pid, ppid, rss]) => Number.isFinite(pid) && Number.isFinite(ppid) && Number.isFinite(rss))
    const included = new Set([rootPid])
    let changed = true
    while (changed) {
      changed = false
      for (const [pid, ppid] of rows) {
        if (included.has(ppid) && !included.has(pid)) {
          included.add(pid)
          changed = true
        }
      }
    }
    const rssKiB = rows.reduce((sum, [pid, , rss]) => sum + (included.has(pid) ? rss : 0), 0)
    return Math.round((rssKiB / 1024) * 10) / 10
  } catch {
    return null
  }
}

async function runStep(name: string, fn: () => Promise<void>): Promise<StepResult> {
  const start = Date.now()
  log(`  ▸ ${name}`)
  try {
    await fn()
    const dur = Date.now() - start
    log(`  ✓ ${name} (${(dur / 1000).toFixed(1)}s)`)
    return { name, passed: true, duration: dur }
  } catch (err: any) {
    const dur = Date.now() - start
    log(`  ✗ ${name} — ${err.message.split('\n')[0]}`)
    return { name, passed: false, duration: dur, error: err.message }
  }
}

function skipStep(name: string): StepResult {
  log(`  ○ ${name} (skipped)`)
  return { name, passed: true, duration: 0, skipped: true }
}

// ---------------------------------------------------------------------------
// Prerequisite checks
// ---------------------------------------------------------------------------

function checkPrereqs(platform: Platform, level: number, deviceMode: boolean = false) {
  if (platform === 'expo-mobile') {
    // Device mode skips xcodebuild — only Maestro is required because
    // the dev build is already installed on the phone.
    if (deviceMode) {
      exec('maestro --version', { timeout: 10_000 })
      return
    }
    if (level >= 3) exec('which xcrun', { timeout: 5000 })
    if (level >= 5) exec('maestro --version', { timeout: 10_000 })
  }
  if (platform === 'pear-desktop') {
    if (level >= 5) {
      // Playwright ships as an npm dep of the CLI package so we can run
      // `npx playwright --version` from inside `packages/cli/`. Fail early
      // with an actionable hint rather than waiting for Electron to spawn.
      try {
        exec('npx --no-install playwright --version', {
          cwd: CLI_ROOT,
          timeout: 10_000,
        })
      } catch {
        throw new Error(
          'pear-desktop Level 5 needs @playwright/test. Install with: cd packages/cli && pnpm add -D @playwright/test',
        )
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Simulator helpers (iOS)
// ---------------------------------------------------------------------------

function getSimulatorUDID(): string {
  const json = exec('xcrun simctl list devices available -j', { timeout: 10_000 })
  const data = JSON.parse(json)
  for (const runtime of Object.values(data.devices) as any[][]) {
    for (const device of runtime) {
      if (device.name === SIMULATOR_NAME && device.isAvailable) return device.udid
    }
  }
  throw new Error(`Simulator "${SIMULATOR_NAME}" not found`)
}

function bootSimulator(udid: string) {
  try {
    exec(`xcrun simctl boot ${udid}`, { timeout: 60_000 })
  } catch (err: any) {
    if (!err.message.includes('current state: Booted')) throw err
  }
}

// ---------------------------------------------------------------------------
// Metro helper
// ---------------------------------------------------------------------------

function startMetro(cwd: string): ChildProcess {
  const env: NodeJS.ProcessEnv = { ...process.env, EXPO_NO_TELEMETRY: '1' }
  if (QVAC_MOCK) env.EXPO_PUBLIC_QVAC_MOCK = '1'

  const proc = spawn('npx', ['expo', 'start', '--port', '8081'], {
    cwd,
    stdio: ['pipe', 'pipe', 'pipe'],
    env,
    detached: true,
  })
  const metroLog = join(cwd, 'metro.log')
  writeFileSync(metroLog, '')
  proc.stdout?.on('data', data => appendFileSync(metroLog, data))
  proc.stderr?.on('data', data => appendFileSync(metroLog, data))
  proc.unref()
  return proc
}

function killMetro(proc: ChildProcess) {
  try {
    if (proc.pid) process.kill(-proc.pid, 'SIGTERM')
  } catch {
    // already dead
  }
}

// ---------------------------------------------------------------------------
// Pear Desktop: file integrity check
// ---------------------------------------------------------------------------

const DESKTOP_REQUIRED_FILES = [
  'package.json',
  'index.html',
  'electron/main.js',
  'electron/preload.cjs',
  'worker.js',
  'app/bridge.js',
  'app/index.js',
]

function checkDesktopFiles(projectDir: string, features: string[]) {
  for (const f of DESKTOP_REQUIRED_FILES) {
    const full = join(projectDir, f)
    if (!existsSync(full)) throw new Error(`Missing expected file: ${f}`)
  }

  const pkg = JSON.parse(readFileSync(join(projectDir, 'package.json'), 'utf8'))
  if (pkg.main !== 'electron/main.js') throw new Error('package.json missing Electron main entry')
  if (!pkg.dependencies?.['pear-runtime']) throw new Error('package.json missing pear-runtime')
  if (pkg.dependencies?.['pear-electron'] || pkg.dependencies?.['pear-run']) {
    throw new Error('package.json still includes legacy Pear runtime dependencies')
  }

  // Base infra — always present
  const worker = readFileSync(join(projectDir, 'worker.js'), 'utf8')
  if (!worker.includes('Hyperswarm')) throw new Error('worker.js missing Hyperswarm (base)')

  if (features.includes('multi-writer')) {
    // multi-writer swaps the single-writer Hyperbee KV for Autobee + HyperDB.
    if (!worker.includes("from './multi-writer-store.js'"))
      throw new Error('worker.js missing multi-writer store import')
    if (worker.includes("from 'hyperbee'"))
      throw new Error('worker.js should not import hyperbee when multi-writer is on')
    if (!worker.includes('db.autobee.replicate(conn)'))
      throw new Error('worker.js must replicate via Autobee, not Corestore')
    if (!existsSync(join(projectDir, 'schema/spec/app/index.js')))
      throw new Error('schema/spec not generated by postinstall')
    if (!existsSync(join(projectDir, 'schema/spec/local/index.js')))
      throw new Error('schema/spec local namespace not generated')
  } else {
    if (!worker.includes('Hyperbee')) throw new Error('worker.js missing Hyperbee (base)')
  }
  if (!worker.includes('Corestore')) throw new Error('worker.js missing Corestore (base)')

  const ui = readFileSync(join(projectDir, 'app/index.js'), 'utf8')
  if (!ui.includes('data-testid="p2p-section"')) throw new Error('app/index.js missing P2P section')
  if (!ui.includes('data-testid="kv-section"')) throw new Error('app/index.js missing KV section')

  // Optional features
  if (features.includes('local-ai')) {
    if (!worker.includes('@qvac/sdk') && !worker.includes('@qvac/inference')) throw new Error('worker.js missing @qvac/sdk for local-ai')
    if (!worker.includes('QVAC_MOCK')) throw new Error('worker.js missing QVAC_MOCK support')
    if (!ui.includes('data-testid="ai-section"')) throw new Error('app/index.js missing AI section')
  }

  if (features.includes('wallet')) {
    if (!ui.includes('data-testid="wallet-section"'))
      throw new Error('app/index.js missing wallet section')
    if (!worker.includes("service: 'wallet'")) throw new Error('worker.js missing wallet service')
  }
}

// ---------------------------------------------------------------------------
// Pear Desktop: worker spawn test (Level 4)
//
// Spawns `worker.js` via the harness with a fake Bare global, sends commands
// over stdin as NDJSON, reads responses from stdout, asserts expected events.
// ---------------------------------------------------------------------------

interface WorkerMessage {
  type: string
  [key: string]: any
}

async function runWorkerSpawnTest(projectDir: string, features: string[]): Promise<void> {
  const harnessPath = join(CLI_ROOT, 'e2e', 'worker-harness.js')
  const workerPath = join(projectDir, 'worker.js')

  if (!existsSync(harnessPath)) throw new Error(`Harness not found: ${harnessPath}`)
  if (!existsSync(workerPath)) throw new Error(`Worker not found: ${workerPath}`)

  // Install dir is the project's own node_modules so imports resolve.
  const env: NodeJS.ProcessEnv = { ...process.env }
  if (features.includes('local-ai')) env.QVAC_MOCK = '1'

  const proc = spawn('node', [harnessPath, workerPath], {
    cwd: projectDir,
    stdio: ['pipe', 'pipe', 'pipe'],
    env,
  })

  const messages: WorkerMessage[] = []
  let stdoutBuffer = ''
  let stderrBuffer = ''

  proc.stdout!.on('data', (chunk) => {
    stdoutBuffer += chunk.toString()
    const lines = stdoutBuffer.split('\n')
    stdoutBuffer = lines.pop() || ''
    for (const line of lines) {
      if (!line.trim()) continue
      try {
        messages.push(JSON.parse(line))
      } catch {
        // non-JSON output (shouldn't happen)
      }
    }
  })

  proc.stderr!.on('data', (chunk) => {
    stderrBuffer += chunk.toString()
  })

  async function waitFor(
    predicate: (msgs: WorkerMessage[]) => boolean,
    timeoutMs: number,
    description: string,
  ) {
    const start = Date.now()
    while (Date.now() - start < timeoutMs) {
      if (predicate(messages)) return
      if (proc.exitCode !== null) {
        throw new Error(
          `Worker exited with code ${proc.exitCode} while waiting for ${description}\nstderr: ${stderrBuffer.slice(0, 500)}\nmessages: ${JSON.stringify(messages.slice(-5))}`,
        )
      }
      await sleep(100)
    }
    throw new Error(
      `Timeout (${timeoutMs}ms) waiting for ${description}\nstderr: ${stderrBuffer.slice(0, 500)}\nlast messages: ${JSON.stringify(messages.slice(-5))}`,
    )
  }

  function send(msg: any) {
    proc.stdin!.write(JSON.stringify(msg) + '\n')
  }

  try {
    // 1. workerReady should arrive within 2s (emitted synchronously at startup)
    await waitFor((m) => m.some((x) => x.type === 'workerReady'), 5_000, 'workerReady')

    // 2. init-complete should arrive after P2P + KV are ready (Hyperswarm init
    // is fast in-memory; Corestore on tmpdir is fast too)
    await waitFor((m) => m.some((x) => x.type === 'init-complete'), 30_000, 'init-complete')

    // 3. P2P status should be ready
    const hasP2pReady = messages.some(
      (m) => m.type === 'status' && m.service === 'p2p' && m.status === 'ready',
    )
    if (!hasP2pReady) throw new Error('P2P service did not emit ready status')

    // 4. KV storage status should be ready
    const hasStorageReady = messages.some(
      (m) => m.type === 'status' && m.service === 'storage' && m.status === 'ready',
    )
    if (!hasStorageReady) throw new Error('Storage service did not emit ready status')

    // 5. KV round-trip: put then get
    send({ type: 'db-put', key: 'smoke-test', value: { hello: 'world' } })
    await waitFor(
      (m) => m.some((x) => x.type === 'db-put-ok' && x.key === 'smoke-test'),
      5_000,
      'db-put-ok',
    )

    send({ type: 'db-get', key: 'smoke-test' })
    await waitFor(
      (m) =>
        m.some(
          (x) =>
            x.type === 'db-get-ok' &&
            x.key === 'smoke-test' &&
            x.value?.hello === 'world',
        ),
      5_000,
      'db-get-ok with expected value',
    )

    // 6. local-ai (with QVAC_MOCK=1): initial status is `idle` — the UI triggers
    // the load on user click. Exercise the same flow here: verify idle, send
    // `load-ai`, wait for ready, then chat.
    if (features.includes('local-ai')) {
      await waitFor(
        (m) => m.some((x) => x.type === 'status' && x.service === 'ai' && x.status === 'idle'),
        5_000,
        'AI service idle (awaiting load)',
      )

      send({ type: 'load-ai' })

      await waitFor(
        (m) => m.some((x) => x.type === 'status' && x.service === 'ai' && x.status === 'ready'),
        5_000,
        'AI service ready (mock)',
      )

      send({ type: 'chat', history: [{ role: 'user', content: 'ping' }] })

      await waitFor((m) => m.some((x) => x.type === 'chat-token'), 5_000, 'chat-token')
      await waitFor((m) => m.some((x) => x.type === 'chat-done'), 5_000, 'chat-done')

      const tokens = messages
        .filter((m) => m.type === 'chat-token')
        .map((m) => m.token)
        .join('')
      if (!tokens.startsWith('Mock:'))
        throw new Error(`Mock chat did not echo as expected, got: ${tokens}`)
    }

    // 7. wallet stub: should emit ready status
    if (features.includes('wallet')) {
      const hasWalletReady = messages.some(
        (m) => m.type === 'status' && m.service === 'wallet' && m.status === 'ready',
      )
      if (!hasWalletReady) throw new Error('Wallet stub did not emit ready status')
    }

    // 8. Graceful shutdown
    send({ type: 'shutdown' })
    await new Promise<void>((resolve) => {
      const t = setTimeout(() => {
        try {
          proc.kill('SIGKILL')
        } catch {}
        resolve()
      }, 3_000)
      proc.once('exit', () => {
        clearTimeout(t)
        resolve()
      })
    })
  } finally {
    if (proc.exitCode === null) {
      try {
        proc.kill('SIGKILL')
      } catch {}
    }
  }
}

// ---------------------------------------------------------------------------
// Pear Desktop: launch app with Playwright attached via CDP (Level 5)
// ---------------------------------------------------------------------------
//
// Electron exposes Chromium's remote debugging endpoint, so we can
// pass `--remote-debugging-port` and have Playwright connect over CDP —
// same trick the qvac-workbench-desktop reference app uses for its own
// test suite. We spawn the generated Electron app, drive its window, and
// tear everything down on exit (including the detached process group).

async function runPearPlaywrightTest(
  projectDir: string,
  projectName: string,
  features: string[],
): Promise<void> {
  // Lazy-require so `test-scaffold.ts` still imports cleanly on machines
  // without @playwright/test — the prereq check throws a friendlier error
  // before we get here when Playwright is genuinely missing.
  const { chromium } = await import('playwright')

  // Bind-once on a random high port to avoid collisions across repeat runs.
  const port = 10_000 + Math.floor(Math.random() * 50_000)

  // `--no-sandbox` is required when running CI in rootless containers.
  const electron = join(projectDir, 'node_modules', '.bin', 'electron')
  const electronArgs = ['.', `--remote-debugging-port=${port}`, '--no-sandbox']
  const offlineProfile =
    '(version 1)(allow default)(deny network*)' +
    '(allow network-outbound (remote ip "localhost:*"))' +
    '(allow network-inbound (local ip "localhost:*"))'
  const proc = spawn(
    QVAC_OFFLINE_E2E ? '/usr/bin/sandbox-exec' : electron,
    QVAC_OFFLINE_E2E ? ['-p', offlineProfile, electron, ...electronArgs] : electronArgs,
    {
      cwd: projectDir,
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: true, // own process group so we can SIGKILL the whole tree
    },
  )

  // Keep a tail of both streams so failures can point at real causes.
  // Electron and pear-runtime write useful boot diagnostics to stdout (sidecar handshake,
  // module resolution) and runtime errors to stderr.
  let stdoutTail = ''
  let stderrTail = ''
  proc.stdout?.on('data', (d) => {
    stdoutTail = (stdoutTail + d.toString()).slice(-4000)
    if (process.env.PEAR_E2E_VERBOSE) process.stdout.write(d)
  })
  proc.stderr?.on('data', (d) => {
    stderrTail = (stderrTail + d.toString()).slice(-4000)
    if (process.env.PEAR_E2E_VERBOSE) process.stderr.write(d)
  })

  // Connect to the CDP endpoint with polling. Pear takes a variable
  // amount of time to boot Electron and pear-runtime — cold-launch
  // on a loaded machine with big dep sets (local-ai+wallet) can easily
  // blow past 15s. We poll on 1s intervals up to 60s so no variant times
  // out for benign boot-time reasons; real failures surface by showing
  // both the CDP error and the pear stderr tail.
  async function connect() {
    const deadline = Date.now() + 60_000
    let lastErr: unknown
    while (Date.now() < deadline) {
      await sleep(1000)
      try {
        return await chromium.connectOverCDP(`http://localhost:${port}`)
      } catch (err) {
        lastErr = err
      }
    }
    throw new Error(
      `Failed to connect Playwright to Electron on port ${port} within 60s\n` +
        `app stdout (last 4KB):\n${stdoutTail || '(empty)'}\n` +
        `app stderr (last 4KB):\n${stderrTail || '(empty)'}\n` +
        `original error: ${lastErr instanceof Error ? lastErr.message : String(lastErr)}`,
    )
  }

  const browser = await connect()
  try {
    // Pear hands us multiple pages — devtools (when --dev is on), a
    // splash page, and eventually the real app page. Filter aggressively.
    const ctx = browser.contexts()[0]
    if (!ctx) throw new Error('No browser context from Pear')

    // Give the app a beat to hydrate after CDP attach.
    await sleep(1500)

    let appPage: (typeof ctx.pages extends () => (infer P)[] ? P : never) | undefined
    const pollDeadline = Date.now() + 20_000
    while (Date.now() < pollDeadline) {
      for (const p of ctx.pages()) {
        const url = p.url()
        if (url === 'about:blank' || url.startsWith('devtools://')) continue
        try {
          // Our scaffolded app always renders a `<h1 class="app-title">`
          // with the project name — unique enough to identify the window.
          const hasTitle = await p
            .locator('h1.app-title')
            .isVisible({ timeout: 500 })
            .catch(() => false)
          if (hasTitle) {
            appPage = p
            break
          }
        } catch {
          // page might be mid-navigation — skip and retry
        }
      }
      if (appPage) break
      await sleep(500)
    }

    if (!appPage) {
      const urls = ctx.pages().map((p) => p.url())
      throw new Error(
        `Could not find the app page among open CDP targets.\n` +
          `Open URLs: ${JSON.stringify(urls)}\n` +
          `stderr tail: ${stderrTail || '(empty)'}`,
      )
    }

    const page = appPage

    // --- Header ---
    const title = page.locator('h1.app-title')
    await title.waitFor({ state: 'visible', timeout: 10_000 })
    const titleText = await title.textContent()
    if (titleText?.trim() !== projectName) {
      throw new Error(`Title mismatch: expected "${projectName}", got "${titleText}"`)
    }

    // --- Always-on sections ---
    for (const testid of ['p2p-section', 'kv-section', 'docs-section']) {
      const el = page.locator(`[data-testid="${testid}"]`)
      await el.waitFor({ state: 'visible', timeout: 10_000 })
    }

    // --- Wait for the worker to finish init before interacting with KV.
    // The scaffolded UI flips `#worker-status` text from "Worker starting"
    // to "Ready" once the worker emits `init-complete`. Firing a kv-save
    // before this arrives racily drops the message on the floor — it reads
    // as a UI bug ("save did nothing") but it's really just a race. This
    // race reliably bites on variants with extra init work (local-ai
    // preloads `@qvac/sdk`, which is the largest scaffold).
    const workerStatus = page.locator('#worker-status')
    await workerStatus.waitFor({ state: 'visible', timeout: 15_000 })
    const deadline = Date.now() + 20_000
    while (Date.now() < deadline) {
      const txt = (await workerStatus.textContent()) ?? ''
      if (/ready/i.test(txt)) break
      await sleep(200)
    }
    const finalStatus = (await workerStatus.textContent()) ?? ''
    if (!/ready/i.test(finalStatus)) {
      throw new Error(
        `Worker never reached "Ready" status. Last status: "${finalStatus}"\n` +
          `pear stdout (last 4KB):\n${stdoutTail || '(empty)'}\n` +
          `pear stderr (last 4KB):\n${stderrTail || '(empty)'}`,
      )
    }

    // The offline second launch must retrieve the online run's unique value
    // before writing anything, so a fresh empty store cannot pass this check.
    const persistenceValue = process.env.US_DESKTOP_PERSISTENCE_VALUE || 'hello from e2e'
    if (QVAC_OFFLINE_E2E && process.env.US_DESKTOP_PERSISTENCE_VALUE) {
      await page.locator('[data-testid="kv-key-input"]').fill('e2e-key')
      await page.locator('[data-testid="kv-fetch-btn"]').click()
      await page.waitForFunction(
        value => document.querySelector('[data-testid="kv-result"]')?.textContent?.includes(value),
        persistenceValue,
        { timeout: 10_000 },
      )
      log('  ℹ saved value survived process restart before the offline run wrote data')
    }

    // --- KV round-trip: full save → assert feedback → fetch → assert value.
    // Unlike the mobile variant, desktop's bare-rpc path works reliably so
    // we drive the full happy path here. This exercises the worker bridge
    // end to end (click handler → postMessage → worker → Hyperbee → reply).
    await page.locator('[data-testid="kv-key-input"]').fill('e2e-key')
    await page.locator('[data-testid="kv-value-input"]').fill(persistenceValue)
    await page.locator('[data-testid="kv-save-btn"]').click()

    const result = page.locator('[data-testid="kv-result"]')
    await result.waitFor({ state: 'visible', timeout: 10_000 })
    const savedText = (await result.textContent()) ?? ''
    if (!/saved/i.test(savedText) || !savedText.includes('e2e-key')) {
      throw new Error(`Save feedback mismatch. Got: "${savedText}"`)
    }

    await page.locator('[data-testid="kv-fetch-btn"]').click()
    // Fetch updates the same result node; wait for the value to appear.
    const fetchDeadline = Date.now() + 10_000
    let fetched = ''
    while (Date.now() < fetchDeadline) {
      fetched = (await result.textContent()) ?? ''
      if (fetched.includes(persistenceValue)) break
      await sleep(200)
    }
    if (!fetched.includes(persistenceValue)) {
      throw new Error(`Fetch feedback mismatch. Got: "${fetched}"`)
    }

    // --- Feature-gated sections ---
    if (features.includes('local-ai')) {
      const aiSection = page.locator('[data-testid="ai-section"]')
      await aiSection.waitFor({ state: 'visible', timeout: 5_000 })
      const loadButton = page.locator('[data-testid="load-ai-btn"]')
      await loadButton.waitFor({
        state: 'visible',
        timeout: 5_000,
      })

      if (QVAC_REAL_E2E) {
        const chatInput = page.locator('[data-testid="chat-input"]')
        const aiError = page.locator('#ai-error')

        // Exercise the real SDK error path first, then recover through the
        // same Retry control a user sees. The worker's optional modelSrc is a
        // trusted renderer-bridge input; normal generated UI omits it and uses
        // the pinned default.
        await page.evaluate(() => {
          ;(window as any).unstoppable.sendToWorker({
            type: 'load-ai',
            modelSrc: 'file:///tmp/unstoppable-e2e-model-does-not-exist.gguf',
          })
        })
        await aiError.waitFor({ state: 'visible', timeout: 30_000 })
        const forcedError = (await page.locator('#ai-error-msg').textContent())?.trim() || ''
        if (!forcedError) throw new Error('Forced QVAC model failure did not expose an error message')
        const warmLoadStartedAt = Date.now()
        await page.locator('#ai-retry').click()

        const loadDeadline = Date.now() + QVAC_REAL_LOAD_TIMEOUT_MS
        while (Date.now() < loadDeadline) {
          if (await chatInput.isVisible().catch(() => false)) break
          if (await aiError.isVisible().catch(() => false)) {
            const message = (await page.locator('#ai-error-msg').textContent())?.trim() || 'unknown error'
            throw new Error(
              `Real QVAC model load failed: ${message}\n` +
                `app stdout (last 4KB):\n${stdoutTail || '(empty)'}\n` +
                `app stderr (last 4KB):\n${stderrTail || '(empty)'}`,
            )
          }
          await sleep(500)
        }
        if (!(await chatInput.isVisible().catch(() => false))) {
          const label = (await page.locator('#ai-loading-label').textContent())?.trim() || 'unknown phase'
          throw new Error(
            `Real QVAC model load did not finish within ${QVAC_REAL_LOAD_TIMEOUT_MS}ms. Last UI state: "${label}"\n` +
              `app stdout (last 4KB):\n${stdoutTail || '(empty)'}\n` +
              `app stderr (last 4KB):\n${stderrTail || '(empty)'}`,
          )
        }
        const warmLoadMs = Date.now() - warmLoadStartedAt
        const processRssMiB = processTreeRssMiB(proc.pid)
        log(
          `  ℹ real QVAC ${process.env.QVAC_COLD_E2E === '1' ? 'cold' : 'warm'} model ready in ${warmLoadMs}ms` +
            (processRssMiB === null ? '' : `; app process-tree RSS ${processRssMiB} MiB`),
        )
        await chatInput.fill('Reply with one short sentence about local-first software.')
        await page.locator('[data-testid="chat-send-btn"]').click()

        await page.waitForFunction(
          () => {
            const input = document.querySelector('[data-testid="chat-input"]') as HTMLInputElement | null
            const replies = document.querySelectorAll('.bubble-assistant')
            const reply = replies.item(replies.length - 1)?.textContent?.trim() || ''
            return Boolean(input && !input.disabled && reply.length > 0)
          },
          undefined,
          { timeout: 300_000 },
        )

        const reply = (await page.locator('.bubble-assistant').last().textContent())?.trim() || ''
        if (!reply || reply.startsWith('❌')) {
          throw new Error(`Real QVAC UI completion failed. Got: "${reply}"`)
        }

        // Prove that cancellation reaches the SDK (rather than only hiding
        // output) and that the same loaded model can serve a later request.
        await chatInput.fill('Write a detailed explanation of local-first software in at least 500 words.')
        await page.locator('[data-testid="chat-send-btn"]').click()
        await page.waitForFunction(
          () => {
            const input = document.querySelector('[data-testid="chat-input"]') as HTMLInputElement | null
            const replies = document.querySelectorAll('.bubble-assistant')
            const reply = replies.item(replies.length - 1)?.textContent?.trim() || ''
            return Boolean(input?.disabled && reply.length > 0)
          },
          undefined,
          { timeout: 60_000 },
        )
        await page.locator('[data-testid="chat-stop-btn"]').click()
        await page.waitForFunction(
          () => {
            const input = document.querySelector('[data-testid="chat-input"]') as HTMLInputElement | null
            const replies = document.querySelectorAll('.bubble-assistant')
            const reply = replies.item(replies.length - 1)?.textContent?.trim() || ''
            return Boolean(input && !input.disabled && (reply.endsWith('[stopped]') || reply === 'Stopped.'))
          },
          undefined,
          { timeout: 30_000 },
        )

        await chatInput.fill('Reply with exactly: recovered')
        await page.locator('[data-testid="chat-send-btn"]').click()
        await page.waitForFunction(
          () => {
            const input = document.querySelector('[data-testid="chat-input"]') as HTMLInputElement | null
            const replies = document.querySelectorAll('.bubble-assistant')
            const reply = replies.item(replies.length - 1)?.textContent?.trim() || ''
            return Boolean(input && !input.disabled && reply.length > 0 && !reply.endsWith('[stopped]'))
          },
          undefined,
          { timeout: 300_000 },
        )
        // Modern scaffolds bound Unicode input and recent history. An error
        // must not poison the next request or replay a partial response.
        if (existsSync(join(projectDir, 'chat-context.js'))) {
          await chatInput.fill('☕'.repeat(800))
          await page.locator('[data-testid="chat-send-btn"]').click()
          await page.waitForFunction(() => {
            const reply = document.querySelectorAll('.bubble-assistant')
            return reply.item(reply.length - 1)?.textContent?.includes('Shorten it') &&
              !(document.querySelector('[data-testid="chat-input"]') as HTMLInputElement)?.disabled
          }, undefined, { timeout: 15_000 })
          for (let turn = 0; turn < 3; turn++) {
            await chatInput.fill('Reply only OK. Background: ' + 'x '.repeat(340))
            await page.locator('[data-testid="chat-send-btn"]').click()
            await page.waitForFunction(() => {
              const reply = document.querySelectorAll('.bubble-assistant')
              const text = reply.item(reply.length - 1)?.textContent?.trim() || ''
              return text.length > 0 && !text.startsWith('❌') &&
                !(document.querySelector('[data-testid="chat-input"]') as HTMLInputElement)?.disabled
            }, undefined, { timeout: 120_000 })
          }
          if (!(await page.locator('.bubble-system').allTextContents()).some(text => text.includes('omitted'))) {
            throw new Error('Long conversation did not report omitted model context')
          }
        }

      }
    }
    if (features.includes('wallet')) {
      const walletSection = page.locator('[data-testid="wallet-section"]')
      await walletSection.waitFor({ state: 'visible', timeout: 5_000 })
    }
    if (process.env.US_DESKTOP_SCREENSHOT_PATH) {
      await page.setViewportSize({ width: 1100, height: 1600 })
      await page.evaluate(() => { const content = document.querySelector('.content'); if (content) content.scrollTop = 0 })
      await page.screenshot({ path: resolve(process.env.US_DESKTOP_SCREENSHOT_PATH), fullPage: true })
    }
  } finally {
    await browser.close().catch(() => {})
    if (proc.pid !== undefined && proc.exitCode === null) {
      // Kill the whole process group — Pear forks helper processes
      // (sidecar, renderer) that don't die when the main pid is killed.
      try {
        process.kill(-proc.pid, 'SIGKILL')
      } catch {
        try {
          proc.kill('SIGKILL')
        } catch {}
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Node CLI: spawn + stdout assertion (Level 3)
// ---------------------------------------------------------------------------

async function runNodeCliSpawnTest(projectDir: string, features: string[]): Promise<void> {
  const env: NodeJS.ProcessEnv = { ...process.env }
  if (features.includes('local-ai')) env.QVAC_MOCK = '1'

  const proc = spawn('npx', ['tsx', 'src/index.ts'], {
    cwd: projectDir,
    stdio: ['pipe', 'pipe', 'pipe'],
    env,
  })

  let stdout = ''
  let stderr = ''
  proc.stdout!.on('data', (c) => (stdout += c.toString()))
  proc.stderr!.on('data', (c) => (stderr += c.toString()))

  // Collect output for 12s or until all expected markers appear, whichever is first
  const deadline = Date.now() + 12_000
  const multiWriter = features.includes('multi-writer')
  const wantedMarkers = [
    'P2P swarm started',
    // multi-writer replaces the Hyperbee KV, so it prints its own marker.
    multiWriter ? 'Multi-writer store ready' : 'Storage ready',
    'is running',
  ]
  // The mesh only works if this device can actually write, so assert it
  // rather than just that the store came up.
  if (multiWriter) wantedMarkers.push('writable    : true')
  if (features.includes('local-ai')) wantedMarkers.push('AI')
  if (features.includes('wallet')) wantedMarkers.push('Wallet ready')

  while (Date.now() < deadline) {
    if (wantedMarkers.every((m) => stdout.includes(m))) break
    if (proc.exitCode !== null) {
      throw new Error(
        `CLI exited early (code ${proc.exitCode})\nstdout: ${stdout}\nstderr: ${stderr}`,
      )
    }
    await sleep(250)
  }

  for (const marker of wantedMarkers) {
    if (!stdout.includes(marker)) {
      try {
        proc.kill('SIGKILL')
      } catch {}
      throw new Error(
        `CLI stdout missing expected marker: "${marker}"\nstdout: ${stdout}\nstderr: ${stderr}`,
      )
    }
  }

  // Graceful shutdown via SIGINT — generated CLI installs a handler
  proc.kill('SIGINT')
  await new Promise<void>((resolve) => {
    const t = setTimeout(() => {
      try {
        proc.kill('SIGKILL')
      } catch {}
      resolve()
    }, 3_000)
    proc.once('exit', () => {
      clearTimeout(t)
      resolve()
    })
  })
}

// ---------------------------------------------------------------------------
// Test a single mobile variant
// ---------------------------------------------------------------------------

async function testMobileVariant(
  variant: Variant,
  opts: { skipBuild: boolean; level: number; deviceUdid: string | null },
): Promise<VariantResult> {
  const start = Date.now()
  const projectName = `e2e-${variant.name}`
  const projectDir = join(TMP_BASE, 'mobile', variant.name)
  const slug = projectName.replace(/-/g, '')
  const featuresFlag = variant.features.length ? `-f ${variant.features.join(',')}` : ''

  log(`\n━━━ mobile / ${variant.name} ━━━`)

  const steps: StepResult[] = []
  let aborted = false

  function push(step: StepResult) {
    steps.push(step)
    if (!step.passed) aborted = true
  }

  // Level 1: scaffold
  if (!opts.skipBuild) {
    push(
      await runStep('scaffold', async () => {
        if (existsSync(projectDir)) rmSync(projectDir, { recursive: true })
        exec(
          `node ${join(CLI_ROOT, 'dist', 'us.js')} scaffold app -p expo-mobile ` +
            `-n ${projectName} ${featuresFlag} -o "${projectDir}" --force`,
          { timeout: 15_000 },
        )
      }),
    )
  } else {
    steps.push(skipStep('scaffold'))
    if (!existsSync(projectDir)) {
      push({
        name: 'skip-check',
        passed: false,
        duration: 0,
        error: `${projectDir} not found. Run without --skip-build first.`,
      })
    }
  }

  // Level 2: npm install
  // Installation is separate from native bundling. The generated manifest
  // declares the Expo peers while QVAC owns its production dependency graph.
  if (!aborted && opts.level >= 2 && !opts.skipBuild) {
    push(
      await runStep('npm install', async () => {
        exec('npm install', { cwd: projectDir, timeout: 300_000 })
      }),
    )
  } else if (opts.level < 2) {
    steps.push(skipStep('npm install'))
  }

  // ---------------------------------------------------------------------
  // Device mode (--device <udid>): full real-load + chat on iPhone.
  //
  // Skips the simulator build/install pipeline entirely. We assume the
  // user already ran `npx expo run:ios --device` once from the
  // scaffolded project (or has otherwise installed the dev build),
  // because cross-device code-signing automation is too brittle for a
  // generic e2e runner. Maestro then drives the device-mode flow which
  // exercises the real model download + chat round-trip — the only
  // path that catches "the model can actually load and respond" class
  // of bugs.
  // ---------------------------------------------------------------------
  if (opts.deviceUdid) {
    if (!aborted) {
      push(
        await runStep('maestro: device feature UI test', async () => {
          const flowContent = generateMaestroFlow(
            projectName,
            variant.features,
            { mode: 'device' },
          )
          const flowDir = join(projectDir, '.maestro')
          mkdirSync(flowDir, { recursive: true })
          const flowPath = join(flowDir, 'device-feature-test.yaml')
          writeFileSync(flowPath, flowContent)

          // Maestro accepts `--device <udid|name>` to target a specific
          // physical device. Long timeout: covers ~400MB cold model
          // download (5 min) + load (~15s) + chat (60s) + buffer.
          const output = exec(
            `maestro --device ${opts.deviceUdid} test "${flowPath}"`,
            { timeout: 480_000 },
          )

          if (output.includes('FAILED')) {
            throw new Error(`Maestro device test failed:\n${output.slice(-1500)}`)
          }
        }),
      )
    }

    const passed = steps.every((s) => s.passed)
    return {
      variant: variant.name,
      platform: 'expo-mobile',
      steps,
      passed,
      duration: Date.now() - start,
    }
  }

  // Level 3: prebuild + xcodebuild
  if (!aborted && opts.level >= 3 && !opts.skipBuild) {
    push(
      await runStep('expo prebuild', async () => {
        // Generator deliberately keeps `bare-pack` and `expo prebuild` out of
        // postinstall (so `npm install` can succeed on its own). We run them
        // here, which mirrors what a developer does before `expo run:ios`.
        exec(`npm run prebuild`, { cwd: projectDir, timeout: 300_000, logFile: join(projectDir, 'prebuild.log') })
        // Expo may exit successfully even when CocoaPods failed. Require
        // the native outputs before recording prebuild acceptance.
        if (!existsSync(join(projectDir, `ios/${slug}.xcworkspace`)) ||
            !existsSync(join(projectDir, 'ios/Podfile.lock'))) {
          const detail = readFileSync(join(projectDir, 'prebuild.log'), 'utf8').slice(-3000)
          throw new Error(`Expo prebuild did not finish CocoaPods installation:\n${detail}`)
        }
      }),
    )
  }

  if (!aborted && opts.level >= 3 && !opts.skipBuild) {
    push(
      await runStep('xcodebuild', async () => {
        const workspace = `ios/${slug}.xcworkspace`
        if (!existsSync(join(projectDir, workspace))) {
          throw new Error(`Workspace not found: ${workspace}`)
        }

        const output = exec(
          `xcodebuild -workspace ${workspace} -scheme ${slug} ` +
            `-configuration Debug -sdk iphonesimulator -arch arm64 ` +
            `-derivedDataPath ios/build build 2>&1`,
          { cwd: projectDir, timeout: 600_000, logFile: join(projectDir, 'xcodebuild.log') },
        )

        if (!output.includes('BUILD SUCCEEDED')) {
          throw new Error(`Build did not succeed:\n${output.slice(-1000)}`)
        }
      }),
    )
  } else if (opts.level >= 3) {
    steps.push(skipStep('xcodebuild'))
  }

  // Level 4+: simulator + Maestro
  let metro: ChildProcess | undefined
  let simulatorUdid: string | undefined

  if (!aborted && opts.level >= 4) {
    push(
      await runStep('boot simulator', async () => {
        simulatorUdid = getSimulatorUDID()
        bootSimulator(simulatorUdid)
      }),
    )

    if (!aborted) {
      push(
        await runStep('start metro + install app', async () => {
          metro = startMetro(projectDir)
          await sleep(8000)

          const appPath = exec(`find ios/build -name "*.app" -type d | head -1`, {
            cwd: projectDir,
          })
          if (!appPath) throw new Error('Built .app not found in ios/build/')

          exec(`xcrun simctl install ${simulatorUdid} "${join(projectDir, appPath)}"`)
        }),
      )
    }

    if (!aborted && opts.level >= 5) {
      push(
        await runStep('maestro: feature UI test', async () => {
          const flowContent = generateMaestroFlow(
            projectName,
            variant.features,
            { mode: 'simulator', qvacMock: QVAC_MOCK },
          )
          const flowDir = join(projectDir, '.maestro')
          mkdirSync(flowDir, { recursive: true })
          const flowPath = join(flowDir, 'feature-test.yaml')
          writeFileSync(flowPath, flowContent)

          // Simulator timeout sizing:
          //   - bare variant: ~30s (no AI section)
          //   - local-ai (no QVAC_MOCK): ~60s — checks storage and
          //     explicit simulator refusal. Real inference uses --device.
          //   - local-ai + QVAC_MOCK=1: ~45s (mock chat round-trip <10s)
          // 3 min budget covers all of these comfortably.
          const output = exec(`maestro --device ${simulatorUdid} test "${flowPath}"`, { timeout: 180_000 })

          if (output.includes('FAILED')) {
            throw new Error(`Maestro test failed:\n${output.slice(-1000)}`)
          }
        }),
      )
    }

    if (metro) killMetro(metro)
  }

  const passed = steps.every((s) => s.passed)
  return {
    variant: variant.name,
    platform: 'expo-mobile',
    steps,
    passed,
    duration: Date.now() - start,
  }
}

// ---------------------------------------------------------------------------
// Test a single desktop variant
// ---------------------------------------------------------------------------

async function testDesktopVariant(
  variant: Variant,
  opts: { skipBuild: boolean; level: number },
): Promise<VariantResult> {
  const start = Date.now()
  // Pear's app-name validator rejects `+` (see ERR_INVALID_APP_NAME in
  // pear-state), so fold the plus-separated variant name (e.g.
  // "local-ai+wallet") into a Pear-safe slug before feeding it to
  // `us scaffold -n`. The variant.name stays `+`-separated for human-facing
  // report output; we only sanitize the generated package name.
  const artifactProject = process.env.US_DESKTOP_PROJECT_DIR
  if (artifactProject && !opts.skipBuild) throw new Error('US_DESKTOP_PROJECT_DIR requires --skip-build')
  const projectName = artifactProject
    ? JSON.parse(readFileSync(join(resolve(artifactProject), 'package.json'), 'utf8')).name
    : `e2e-desktop-${variant.name}`.replace(/\+/g, '-')
  const projectDir = artifactProject ? resolve(artifactProject) : join(TMP_BASE, 'desktop', variant.name)
  const featuresFlag = variant.features.length ? `-f ${variant.features.join(',')}` : ''

  log(`\n━━━ pear-desktop / ${variant.name} ━━━`)

  const steps: StepResult[] = []
  let aborted = false

  function push(step: StepResult) {
    steps.push(step)
    if (!step.passed) aborted = true
  }

  // Level 1: scaffold
  if (!opts.skipBuild) {
    push(
      await runStep('scaffold', async () => {
        if (existsSync(projectDir)) rmSync(projectDir, { recursive: true })
        exec(
          `node ${join(CLI_ROOT, 'dist', 'us.js')} scaffold app -p pear-desktop ` +
            `-n ${projectName} ${featuresFlag} -o "${projectDir}" --force`,
          { timeout: 15_000 },
        )
      }),
    )
  } else {
    steps.push(skipStep('scaffold'))
    if (!existsSync(projectDir)) {
      push({
        name: 'skip-check',
        passed: false,
        duration: 0,
        error: `${projectDir} not found. Run without --skip-build first.`,
      })
    }
  }

  // Level 2: npm install
  if (!aborted && opts.level >= 2 && !opts.skipBuild) {
    push(
      await runStep('npm install', async () => {
        exec('npm install', { cwd: projectDir, timeout: 180_000 })
      }),
    )
  } else if (opts.level >= 2) {
    steps.push(skipStep('npm install'))
  }

  // Level 3: file integrity check
  if (!aborted && opts.level >= 3) {
    push(
      await runStep('file integrity check', async () => {
        checkDesktopFiles(projectDir, variant.features)
      }),
    )
  }

  // Level 4: worker spawn runtime test (requires npm install to have run)
  if (!aborted && opts.level >= 4) {
    push(
      await runStep('worker spawn test', async () => {
        await runWorkerSpawnTest(projectDir, variant.features)
      }),
    )
  }

  // Level 5: launch the real Pear app and drive its UI with Playwright.
  // Electron exposes Chromium over CDP when passed `--remote-debugging-port`.
  if (!aborted && opts.level >= 5) {
    push(
      await runStep('playwright: feature UI test', async () => {
        await runPearPlaywrightTest(projectDir, projectName, variant.features)
      }),
    )
  }

  const passed = steps.every((s) => s.passed)
  return {
    variant: variant.name,
    platform: 'pear-desktop',
    steps,
    passed,
    duration: Date.now() - start,
  }
}

// ---------------------------------------------------------------------------
// Test a single node-cli variant
// ---------------------------------------------------------------------------

async function testNodeCliVariant(
  variant: Variant,
  opts: { skipBuild: boolean; level: number },
): Promise<VariantResult> {
  const start = Date.now()
  const projectName = `e2e-cli-${variant.name}`
  const projectDir = join(TMP_BASE, 'node-cli', variant.name)
  const featuresFlag = variant.features.length ? `-f ${variant.features.join(',')}` : ''

  log(`\n━━━ node-cli / ${variant.name} ━━━`)

  const steps: StepResult[] = []
  let aborted = false

  function push(step: StepResult) {
    steps.push(step)
    if (!step.passed) aborted = true
  }

  // Level 1: scaffold
  if (!opts.skipBuild) {
    push(
      await runStep('scaffold', async () => {
        if (existsSync(projectDir)) rmSync(projectDir, { recursive: true })
        exec(
          `node ${join(CLI_ROOT, 'dist', 'us.js')} scaffold app -p node-cli ` +
            `-n ${projectName} ${featuresFlag} -o "${projectDir}" --force`,
          { timeout: 15_000 },
        )
      }),
    )
  } else {
    steps.push(skipStep('scaffold'))
    if (!existsSync(projectDir)) {
      push({
        name: 'skip-check',
        passed: false,
        duration: 0,
        error: `${projectDir} not found. Run without --skip-build first.`,
      })
    }
  }

  // Level 2: npm install
  if (!aborted && opts.level >= 2 && !opts.skipBuild) {
    push(
      await runStep('npm install', async () => {
        exec('npm install', { cwd: projectDir, timeout: 180_000 })
      }),
    )
  } else if (opts.level >= 2) {
    steps.push(skipStep('npm install'))
  }

  // Level 3: spawn the CLI and assert stdout markers
  if (!aborted && opts.level >= 3) {
    push(
      await runStep('spawn + stdout assert', async () => {
        await runNodeCliSpawnTest(projectDir, variant.features)
      }),
    )
  }

  const passed = steps.every((s) => s.passed)
  return {
    variant: variant.name,
    platform: 'node-cli',
    steps,
    passed,
    duration: Date.now() - start,
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const ALL_PLATFORMS: Platform[] = ['pear-desktop', 'node-cli', 'expo-mobile']

/**
 * Default "highest safe level" per platform — what each platform can run
 * without extra hardware/tooling beyond Node + npm.
 *
 *   pear-desktop → Level 4  (worker spawn + NDJSON round-trip, no Electron)
 *   node-cli     → Level 3  (spawn + stdout markers)
 *   expo-mobile  → Level 2  (scaffold + install only, without Xcode)
 *                  Level 3+ requires Xcode (xcodebuild) and is macOS-only.
 */
const DEFAULT_LEVEL_PER_PLATFORM: Record<Platform, number> = {
  'pear-desktop': 4,
  'node-cli': 3,
  'expo-mobile': 2,
}

/**
 * Parse `--level N` or per-platform `--level-<platform> N` flags.
 *
 *   --level 3                    → applies to every platform
 *   --level-pear-desktop 4       → overrides for desktop only
 *   --level-expo-mobile 5        → full mobile test (Xcode + Maestro)
 *
 * If no flag is given for a platform, use DEFAULT_LEVEL_PER_PLATFORM.
 */
function resolveLevel(args: string[], platform: Platform): number {
  const perPlatFlag = `--level-${platform}`
  if (args.includes(perPlatFlag)) {
    return parseInt(args[args.indexOf(perPlatFlag) + 1], 10)
  }
  if (args.includes('--level')) {
    return parseInt(args[args.indexOf('--level') + 1], 10)
  }
  return DEFAULT_LEVEL_PER_PLATFORM[platform]
}

function variantsForPlatform(platform: Platform): Variant[] {
  switch (platform) {
    case 'pear-desktop':
      return VARIANTS_DESKTOP
    case 'node-cli':
      return VARIANTS_NODE
    case 'expo-mobile':
      return VARIANTS_MOBILE
  }
}

async function runPlatform(
  platform: Platform,
  opts: {
    level: number
    skipBuild: boolean
    variantFilter: string | null
    // Per-variant skip list, e.g. ["expo-mobile/local-ai"]. Used by CI to
    // exclude combos that need restricted package access or other credentials
    // that aren't configured in the current environment.
    skipPairs: Set<string>
    // When set, expo-mobile runs Maestro against this physical device
    // UDID instead of building/installing on the simulator. The dev
    // build must already be installed on the device.
    deviceUdid: string | null
  },
): Promise<VariantResult[]> {
  const allVariants = variantsForPlatform(platform)
  const filtered = opts.variantFilter
    ? allVariants.filter((v) => v.name === opts.variantFilter)
    : allVariants
  const variants = filtered.filter((v) => !opts.skipPairs.has(`${platform}/${v.name}`))

  const skipped = filtered.filter((v) => opts.skipPairs.has(`${platform}/${v.name}`))
  for (const v of skipped) {
    log(`○ Skipping ${platform}/${v.name} (--skip-variant)`)
  }

  if (variants.length === 0) {
    log(
      `⚠ Skipping ${platform}: no variants match filter "${opts.variantFilter}"`,
    )
    return []
  }

  const deviceMode = platform === 'expo-mobile' && !!opts.deviceUdid
  const levelLabel = deviceMode ? 'Level 6 (device)' : `Level ${opts.level}`
  log(`\n╔═══ ${platform.toUpperCase()} · ${levelLabel} · ${variants.length} variant(s) ═══╗`)

  checkPrereqs(platform, opts.level, deviceMode)

  const results: VariantResult[] = []
  for (const variant of variants) {
    const result =
      platform === 'pear-desktop'
        ? await testDesktopVariant(variant, { skipBuild: opts.skipBuild, level: opts.level })
        : platform === 'node-cli'
          ? await testNodeCliVariant(variant, { skipBuild: opts.skipBuild, level: opts.level })
          : await testMobileVariant(variant, {
              skipBuild: opts.skipBuild,
              level: opts.level,
              deviceUdid: deviceMode ? opts.deviceUdid : null,
            })
    results.push(result)
  }

  return results
}

function printAggregateSummary(
  results: VariantResult[],
  levelsByPlatform: Record<string, number>,
) {
  console.log('\n' + '═'.repeat(70))
  console.log('AGGREGATE RESULTS')
  console.log('═'.repeat(70))

  // Group by platform for a cleaner view
  const byPlatform = new Map<Platform, VariantResult[]>()
  for (const r of results) {
    const list = byPlatform.get(r.platform) ?? []
    list.push(r)
    byPlatform.set(r.platform, list)
  }

  for (const platform of ALL_PLATFORMS) {
    const rs = byPlatform.get(platform)
    if (!rs || rs.length === 0) continue

    const lvl = levelsByPlatform[platform]
    const totalDur = rs.reduce((a, r) => a + r.duration, 0)
    const passed = rs.filter((r) => r.passed).length
    const allPass = passed === rs.length
    const icon = allPass ? '✓' : '✗'
    console.log(
      `\n  ${icon} ${platform.padEnd(14)} Level ${lvl}  ${passed}/${rs.length} passed  (${(totalDur / 1000).toFixed(0)}s)`,
    )
    for (const r of rs) {
      const vi = r.passed ? '✓' : '✗'
      const dur = (r.duration / 1000).toFixed(0)
      console.log(`    ${vi} ${r.variant.padEnd(20)} ${dur}s`)
      for (const s of r.steps) {
        if (s.skipped) continue
        if (s.passed) continue // only show failed steps in aggregate view
        console.log(`      ✗ ${s.name}`)
        if (s.error) {
          for (const line of s.error.split('\n').slice(0, 40)) {
            console.log(`        ${line}`)
          }
        }
      }
    }
  }

  const totalPassed = results.filter((r) => r.passed).length
  const total = results.length
  const overallIcon = totalPassed === total ? '✓' : '✗'
  console.log('\n' + '─'.repeat(70))
  console.log(`  ${overallIcon} TOTAL: ${totalPassed}/${total} variants passed across ${byPlatform.size} platform(s)`)
  console.log('─'.repeat(70))
}

async function main() {
  const args = process.argv.slice(2)

  const platformArg = args.includes('--platform')
    ? args[args.indexOf('--platform') + 1]
    : 'expo-mobile'

  // "all" → every platform, each at its own safe default level (or overrides).
  // Explicit platform → just that one.
  const isAll = platformArg === 'all'
  const platforms: Platform[] = isAll
    ? ALL_PLATFORMS
    : ([platformArg] as Platform[])

  for (const p of platforms) {
    if (!ALL_PLATFORMS.includes(p)) {
      console.error(
        `Unknown platform "${p}". Use one of: ${ALL_PLATFORMS.join(', ')}, all`,
      )
      process.exit(1)
    }
  }

  const variantFilter = args.includes('--variant')
    ? args[args.indexOf('--variant') + 1]
    : null

  // Collect every `--skip-variant <platform>/<variant>` pair. Can be passed
  // multiple times; each excludes one combo from the run.
  const skipPairs = new Set<string>()
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--skip-variant' && i + 1 < args.length) {
      skipPairs.add(args[i + 1])
    }
  }

  const skipBuild = args.includes('--skip-build')

  // --device <udid> opts into the device-mode flow (full real-load + chat).
  // Implies --platform expo-mobile and overrides any --level (the runner
  // skips xcodebuild + simulator boot when this is set).
  const deviceUdid = args.includes('--device')
    ? args[args.indexOf('--device') + 1]
    : null
  if (deviceUdid && !platforms.includes('expo-mobile')) {
    console.error(
      `--device is only meaningful for expo-mobile. Pass --platform expo-mobile.`,
    )
    process.exit(1)
  }

  const levelsByPlatform: Record<string, number> = {}
  for (const p of platforms) levelsByPlatform[p] = resolveLevel(args, p)

  log('Unstoppable Stack — Scaffold E2E Test Runner')
  if (deviceUdid) {
    log(`Mode: expo-mobile device test (udid: ${deviceUdid})`)
  } else if (isAll) {
    const summary = platforms.map((p) => `${p}=L${levelsByPlatform[p]}`).join(', ')
    log(`Mode: all platforms (${summary})${QVAC_MOCK ? ' [QVAC_MOCK=1]' : ''}`)
  } else {
    log(
      `Platform: ${platforms[0]}, Level: ${levelsByPlatform[platforms[0]]}` +
        `${QVAC_MOCK ? ' (QVAC_MOCK=1)' : ''}`,
    )
  }
  if (deviceUdid) {
    log('Runtime: Maestro (against connected iPhone)')
    log('NOTE: dev build must already be installed on the device')
    log('      (run `npx expo run:ios --device` from the scaffolded project once)')
  } else if (
    platforms.includes('expo-mobile') &&
    levelsByPlatform['expo-mobile'] >= 5
  ) {
    log(`Simulator: ${SIMULATOR_NAME}, Runtime: Maestro`)
  }
  log(`Output: ${TMP_BASE}`)

  if (!existsSync(join(CLI_ROOT, 'dist', 'us.js'))) {
    log('Building CLI...')
    exec('npm run build', { cwd: CLI_ROOT, timeout: 30_000 })
  }

  mkdirSync(TMP_BASE, { recursive: true })

  const startAll = Date.now()
  const allResults: VariantResult[] = []

  for (const platform of platforms) {
    const level = levelsByPlatform[platform]
    try {
      const results = await runPlatform(platform, {
        level,
        skipBuild,
        variantFilter,
        skipPairs,
        deviceUdid: platform === 'expo-mobile' ? deviceUdid : null,
      })
      allResults.push(...results)
    } catch (err: any) {
      log(`\n⚠ ${platform} aborted: ${err.message.split('\n')[0]}`)
      // Record a synthetic failure so the summary reflects the skip.
      allResults.push({
        variant: '(runner-error)',
        platform,
        steps: [{ name: 'platform setup', passed: false, duration: 0, error: err.message }],
        passed: false,
        duration: 0,
      })
    }
  }

  const totalDur = Date.now() - startAll

  // Per-platform detailed summary (like before) — only when not in "all" mode
  // to keep single-platform runs readable.
  if (!isAll) {
    console.log('\n' + '═'.repeat(60))
    console.log('RESULTS')
    console.log('═'.repeat(60))
    for (const r of allResults) {
      const icon = r.passed ? '✓' : '✗'
      const dur = (r.duration / 1000).toFixed(0)
      console.log(`  ${icon} ${r.platform}/${r.variant.padEnd(18)} ${dur}s`)
      for (const s of r.steps) {
        if (s.skipped) continue
        const si = s.passed ? '  ✓' : '  ✗'
        console.log(`    ${si} ${s.name}`)
        if (s.error) {
          for (const line of s.error.split('\n').slice(0, 40)) {
            console.log(`      ${line}`)
          }
        }
      }
    }
    const passed = allResults.filter((r) => r.passed).length
    console.log(`\n${passed}/${allResults.length} variants passed`)
  } else {
    printAggregateSummary(allResults, levelsByPlatform)
    console.log(`\nWall time: ${(totalDur / 1000).toFixed(0)}s`)
  }

  const reportPath = join(
    TMP_BASE,
    `report-${new Date().toISOString().replace(/[:.]/g, '-')}.json`,
  )
  writeFileSync(
    reportPath,
    JSON.stringify(
      {
        mode: isAll ? 'all' : 'single',
        platforms,
        levels: levelsByPlatform,
        results: allResults,
        totalDurationMs: totalDur,
      },
      null,
      2,
    ),
  )
  log(`Report: ${reportPath}`)

  const overallPassed = allResults.filter((r) => r.passed).length
  process.exit(overallPassed === allResults.length ? 0 : 1)
}

main().catch((err) => {
  console.error('Fatal:', err.message)
  process.exit(1)
})
