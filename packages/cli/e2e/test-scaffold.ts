/**
 * E2E scaffold test runner
 *
 * Tests that scaffolded apps build, launch, and show the correct feature UI.
 *
 * Platforms:
 *   expo-mobile  — scaffold → install → xcodebuild → Maestro (launch + feature UI)
 *   pear-desktop — scaffold → install → file integrity check
 *
 * Test levels (--level N):
 *   1  scaffold only
 *   2  scaffold + npm install
 *   3  expo-mobile: xcodebuild / pear-desktop: file integrity check
 *   4  expo-mobile: Maestro UI test (requires simulator + Maestro CLI)
 *   5  all (default)
 *
 * Usage:
 *   npx tsx e2e/test-scaffold.ts                             # all mobile variants, level 5
 *   npx tsx e2e/test-scaffold.ts --platform pear-desktop     # all desktop variants
 *   npx tsx e2e/test-scaffold.ts --variant qvac              # single variant
 *   npx tsx e2e/test-scaffold.ts --level 2                   # scaffold + install only
 *   npx tsx e2e/test-scaffold.ts --skip-build                # reuse previous build
 *
 * Prerequisites (expo-mobile level 4+):
 *   - Xcode + iOS Simulator runtime
 *   - Maestro CLI: brew install mobile-dev-inc/tap/maestro
 */

import { execSync, spawn, type ChildProcess } from 'child_process'
import { existsSync, mkdirSync, rmSync, writeFileSync, readFileSync } from 'fs'
import { join, resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const CLI_ROOT = resolve(__dirname, '..')

const TMP_BASE = '/tmp/us-e2e-scaffold'
const SIMULATOR_NAME = process.env.US_SIMULATOR || 'iPhone 16'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Platform = 'expo-mobile' | 'pear-desktop'

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
// Variants
// ---------------------------------------------------------------------------

const VARIANTS_MOBILE: Variant[] = [
  { name: 'bare', features: [] },
  { name: 'p2p', features: ['p2p'] },
  { name: 'qvac', features: ['qvac'] },
  { name: 'kv-storage', features: ['kv-storage'] },
  { name: 'p2p-qvac', features: ['p2p', 'qvac'] },
  { name: 'p2p-kv', features: ['p2p', 'kv-storage'] },
  { name: 'p2p-kv-qvac', features: ['p2p', 'kv-storage', 'qvac'] },
]

const VARIANTS_DESKTOP: Variant[] = [
  { name: 'bare', features: [] },
  { name: 'p2p', features: ['p2p'] },
  { name: 'kv-storage', features: ['kv-storage'] },
  { name: 'qvac', features: ['qvac'] },
  { name: 'p2p-kv', features: ['p2p', 'kv-storage'] },
  { name: 'p2p-qvac', features: ['p2p', 'qvac'] },
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function log(msg: string) {
  const ts = new Date().toISOString().slice(11, 19)
  console.log(`[${ts}] ${msg}`)
}

function exec(cmd: string, opts?: { cwd?: string; timeout?: number }): string {
  const timeout = opts?.timeout ?? 60_000
  try {
    return execSync(cmd, {
      cwd: opts?.cwd,
      timeout,
      maxBuffer: 50 * 1024 * 1024,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim()
  } catch (err: any) {
    const stderr = err.stderr?.toString?.() || ''
    const stdout = err.stdout?.toString?.() || ''
    throw new Error(
      `Command failed (exit ${err.status}): ${cmd}\n${(stderr || stdout).slice(0, 2000)}`,
    )
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
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

function checkPrereqs(platform: Platform, level: number) {
  if (platform === 'expo-mobile') {
    exec('which xcrun', { timeout: 5000 })
    if (level >= 4) {
      exec('maestro --version', { timeout: 10_000 })
    }
  }
}

// ---------------------------------------------------------------------------
// Simulator helpers
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
  const proc = spawn('npx', ['expo', 'start', '--port', '8081'], {
    cwd,
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env, EXPO_NO_TELEMETRY: '1' },
    detached: true,
  })
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
// Maestro flow generation — feature-specific UI assertions
// ---------------------------------------------------------------------------

function generateMaestroFlow(projectName: string, features: string[]): string {
  const bundleId = `com.unstoppable.${projectName.replace(/-/g, '')}`
  const hasP2p = features.includes('p2p')
  const hasQvac = features.includes('qvac')
  const hasKv = features.includes('kv-storage')

  const lines: string[] = [
    `appId: ${bundleId}`,
    '---',
    '',
    '# --- Launch and verify app header ---',
    '- launchApp',
    `- extendedWaitUntil:`,
    `    visible: "${projectName}"`,
    `    timeout: 30000`,
    `- assertVisible: "Unstoppable Stack · Expo Mobile"`,
    '',
    '# --- Verify docs section is always present ---',
    `- assertVisible: "Docs — unstoppable.dev"`,
  ]

  if (hasP2p) {
    lines.push(
      '',
      '# --- P2P section ---',
      `- assertVisible: "P2P Network"`,
      `- assertVisible: "Worklet:"`,
    )
  }

  if (hasKv) {
    lines.push(
      '',
      '# --- KV Storage section: save and fetch a value ---',
      `- assertVisible: "KV Storage"`,
      `- tapOn:`,
      `    id: "kv-key-input"`,
      `- inputText: "e2e-key"`,
      `- tapOn:`,
      `    id: "kv-value-input"`,
      `- inputText: "hello from e2e"`,
      `- tapOn:`,
      `    id: "kv-save-btn"`,
      `- assertVisible: 'Saved "e2e-key"'`,
      `- clearText`,
      `- tapOn:`,
      `    id: "kv-key-input"`,
      `- inputText: "e2e-key"`,
      `- tapOn:`,
      `    id: "kv-fetch-btn"`,
      `- assertVisible: '"e2e-key"'`,
    )
  }

  if (hasQvac) {
    lines.push(
      '',
      '# --- AI Assistant section: verify button is visible (model load skipped in CI) ---',
      `- assertVisible: "AI Assistant"`,
      `- assertVisible:`,
      `    id: "load-ai-btn"`,
    )
  }

  lines.push(
    '',
    '# --- Relaunch to verify state restores cleanly ---',
    '- stopApp',
    '- launchApp',
    `- extendedWaitUntil:`,
    `    visible: "${projectName}"`,
    `    timeout: 30000`,
    `- assertVisible: "Unstoppable Stack · Expo Mobile"`,
  )

  return lines.join('\n') + '\n'
}

// ---------------------------------------------------------------------------
// Pear Desktop: expected files check
// ---------------------------------------------------------------------------

const DESKTOP_REQUIRED_FILES = [
  'package.json',
  'index.html',
  'index.js',
  'worker.js',
  'app/bridge.js',
  'app/index.js',
]

function checkDesktopFiles(projectDir: string, features: string[]) {
  for (const f of DESKTOP_REQUIRED_FILES) {
    const full = join(projectDir, f)
    if (!existsSync(full)) throw new Error(`Missing expected file: ${f}`)
  }

  // Validate package.json has required pear fields
  const pkg = JSON.parse(readFileSync(join(projectDir, 'package.json'), 'utf8'))
  if (!pkg.pear) throw new Error('package.json missing "pear" field')
  if (pkg.pear.type !== 'desktop') throw new Error('pear.type should be "desktop"')

  // Validate feature-specific content in worker.js
  const worker = readFileSync(join(projectDir, 'worker.js'), 'utf8')
  if (features.includes('qvac') && !worker.includes('@qvac/sdk')) {
    throw new Error('worker.js missing @qvac/sdk import for qvac feature')
  }
  if (features.includes('kv-storage') && !worker.includes('Hyperbee')) {
    throw new Error('worker.js missing Hyperbee for kv-storage feature')
  }
  if (features.includes('p2p') && !worker.includes('Hyperswarm')) {
    throw new Error('worker.js missing Hyperswarm for p2p feature')
  }

  // Validate feature-specific UI sections in app/index.js
  const ui = readFileSync(join(projectDir, 'app/index.js'), 'utf8')
  if (features.includes('qvac') && !ui.includes('data-testid="ai-section"')) {
    throw new Error('app/index.js missing AI section for qvac feature')
  }
  if (features.includes('kv-storage') && !ui.includes('data-testid="kv-section"')) {
    throw new Error('app/index.js missing KV section for kv-storage feature')
  }
  if (features.includes('p2p') && !ui.includes('data-testid="p2p-section"')) {
    throw new Error('app/index.js missing P2P section for p2p feature')
  }
}

// ---------------------------------------------------------------------------
// Test a single mobile variant
// ---------------------------------------------------------------------------

async function testMobileVariant(
  variant: Variant,
  opts: { skipBuild: boolean; level: number },
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
  if (!aborted && opts.level >= 2 && !opts.skipBuild) {
    push(
      await runStep('npm install', async () => {
        exec('npm install', { cwd: projectDir, timeout: 300_000 })
      }),
    )
  } else if (opts.level < 2) {
    steps.push(skipStep('npm install'))
  }

  // Level 3: xcodebuild
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
          { cwd: projectDir, timeout: 600_000 },
        )

        if (!output.includes('BUILD SUCCEEDED')) {
          throw new Error(`Build did not succeed:\n${output.slice(-1000)}`)
        }
      }),
    )
  } else if (opts.level >= 3) {
    steps.push(skipStep('xcodebuild'))
  }

  // Level 4+: Maestro runtime test
  let metro: ChildProcess | undefined

  if (!aborted && opts.level >= 4) {
    push(
      await runStep('boot simulator', async () => {
        const udid = getSimulatorUDID()
        bootSimulator(udid)
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

          exec(`xcrun simctl install booted "${join(projectDir, appPath)}"`)
        }),
      )
    }

    if (!aborted) {
      push(
        await runStep('maestro: feature UI test', async () => {
          const flowContent = generateMaestroFlow(projectName, variant.features)
          const flowDir = join(projectDir, '.maestro')
          mkdirSync(flowDir, { recursive: true })
          const flowPath = join(flowDir, 'feature-test.yaml')
          writeFileSync(flowPath, flowContent)

          const output = exec(`maestro test "${flowPath}"`, { timeout: 180_000 })

          if (output.includes('FAILED')) {
            throw new Error(`Maestro test failed:\n${output.slice(-1000)}`)
          }
        }),
      )
    }

    if (metro) killMetro(metro)
  }

  const passed = steps.every((s) => s.passed)
  return { variant: variant.name, platform: 'expo-mobile', steps, passed, duration: Date.now() - start }
}

// ---------------------------------------------------------------------------
// Test a single desktop variant
// ---------------------------------------------------------------------------

async function testDesktopVariant(
  variant: Variant,
  opts: { skipBuild: boolean; level: number },
): Promise<VariantResult> {
  const start = Date.now()
  const projectName = `e2e-desktop-${variant.name}`
  const projectDir = join(TMP_BASE, 'desktop', variant.name)
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
        exec('npm install', { cwd: projectDir, timeout: 120_000 })
      }),
    )
  } else if (opts.level >= 2) {
    steps.push(skipStep('npm install'))
  }

  // Level 3: file integrity check (no build needed — Pear runs directly from source)
  if (!aborted && opts.level >= 3) {
    push(
      await runStep('file integrity check', async () => {
        checkDesktopFiles(projectDir, variant.features)
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
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2)

  const platform = (args.includes('--platform')
    ? args[args.indexOf('--platform') + 1]
    : 'expo-mobile') as Platform

  const variantFilter = args.includes('--variant')
    ? args[args.indexOf('--variant') + 1]
    : null

  const skipBuild = args.includes('--skip-build')

  const level = args.includes('--level')
    ? parseInt(args[args.indexOf('--level') + 1], 10)
    : platform === 'pear-desktop'
      ? 3   // default: scaffold + install + file check
      : 5   // default: full mobile test

  log('Unstoppable Stack — Scaffold E2E Test Runner')
  log(`Platform: ${platform}, Level: ${level}`)
  if (platform === 'expo-mobile' && level >= 4) log(`Simulator: ${SIMULATOR_NAME}, Runtime: Maestro`)
  log(`Output: ${TMP_BASE}`)

  checkPrereqs(platform, level)

  if (!existsSync(join(CLI_ROOT, 'dist', 'us.js'))) {
    log('Building CLI...')
    exec('npm run build', { cwd: CLI_ROOT, timeout: 30_000 })
  }

  mkdirSync(TMP_BASE, { recursive: true })

  const allVariants = platform === 'pear-desktop' ? VARIANTS_DESKTOP : VARIANTS_MOBILE
  const variants = variantFilter
    ? allVariants.filter((v) => v.name === variantFilter)
    : allVariants

  if (variants.length === 0) {
    console.error(
      `Unknown variant "${variantFilter}". Available: ${allVariants.map((v) => v.name).join(', ')}`,
    )
    process.exit(1)
  }

  const results: VariantResult[] = []
  for (const variant of variants) {
    const result =
      platform === 'pear-desktop'
        ? await testDesktopVariant(variant, { skipBuild, level })
        : await testMobileVariant(variant, { skipBuild, level })
    results.push(result)
  }

  // Summary
  console.log('\n' + '═'.repeat(60))
  console.log('RESULTS')
  console.log('═'.repeat(60))

  for (const r of results) {
    const icon = r.passed ? '✓' : '✗'
    const dur = (r.duration / 1000).toFixed(0)
    console.log(`  ${icon} ${r.platform}/${r.variant.padEnd(18)} ${dur}s`)
    for (const s of r.steps) {
      if (s.skipped) continue
      const si = s.passed ? '  ✓' : '  ✗'
      console.log(`    ${si} ${s.name}`)
      if (s.error) console.log(`      ${s.error.split('\n')[0].slice(0, 100)}`)
    }
  }

  const passed = results.filter((r) => r.passed).length
  const total = results.length
  console.log(`\n${passed}/${total} variants passed`)

  const reportPath = join(
    TMP_BASE,
    `report-${new Date().toISOString().replace(/[:.]/g, '-')}.json`,
  )
  writeFileSync(reportPath, JSON.stringify({ results, platform, level }, null, 2))
  log(`Report: ${reportPath}`)

  process.exit(passed === total ? 0 : 1)
}

main().catch((err) => {
  console.error('Fatal:', err.message)
  process.exit(1)
})
