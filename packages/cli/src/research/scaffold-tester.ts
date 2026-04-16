import { existsSync } from 'fs'
import { mkdir, rm, readdir, readFile } from 'fs/promises'
import { join } from 'path'
import { execSync } from 'child_process'
import { tmpdir } from 'os'
import { getGenerator, PLATFORMS, FEATURES } from '../generators/index.js'
import type { Platform, Feature, GeneratorOptions } from '../generators/index.js'

export type TestDepth = 'quick' | 'install' | 'build'

export interface TestCase {
  platform: Platform
  features: Feature[]
  label: string
}

export interface TestResult {
  label: string
  platform: Platform
  features: Feature[]
  steps: StepResult[]
  passed: boolean
  duration: number
}

interface StepResult {
  name: string
  passed: boolean
  error?: string
  duration: number
}

/**
 * Generate all valid platform × feature combinations
 */
export function generateTestMatrix(): TestCase[] {
  const cases: TestCase[] = []

  for (const platform of PLATFORMS) {
    const availableFeatures = FEATURES.filter((f) => f.platforms.includes(platform.id))

    // No features
    cases.push({
      platform: platform.id,
      features: [],
      label: `${platform.id} (bare)`,
    })

    // Each feature alone
    for (const feat of availableFeatures) {
      cases.push({
        platform: platform.id,
        features: [feat.id],
        label: `${platform.id} + ${feat.id}`,
      })
    }

    // Interesting combos
    const p2p = availableFeatures.find((f) => f.id === 'p2p')
    const qvac = availableFeatures.find((f) => f.id === 'qvac')
    const kv = availableFeatures.find((f) => f.id === 'kv-storage')
    const autobase = availableFeatures.find((f) => f.id === 'autobase')

    if (p2p && qvac) {
      cases.push({
        platform: platform.id,
        features: ['p2p', 'qvac'],
        label: `${platform.id} + p2p,qvac`,
      })
    }

    if (p2p && kv) {
      cases.push({
        platform: platform.id,
        features: ['p2p', 'kv-storage'],
        label: `${platform.id} + p2p,kv-storage`,
      })
    }

    // All features available for this platform
    const allFeatureIds = availableFeatures.map((f) => f.id)
    if (allFeatureIds.length > 1) {
      cases.push({
        platform: platform.id,
        features: allFeatureIds,
        label: `${platform.id} + ALL`,
      })
    }
  }

  return cases
}

/**
 * Run the full test suite
 */
export async function runScaffoldTests(
  depth: TestDepth,
  onProgress?: (result: TestResult, index: number, total: number) => void,
): Promise<TestResult[]> {
  const matrix = generateTestMatrix()
  const results: TestResult[] = []
  const baseDir = join(tmpdir(), `us-scaffold-test-${Date.now()}`)
  await mkdir(baseDir, { recursive: true })

  try {
    for (let i = 0; i < matrix.length; i++) {
      const tc = matrix[i]
      const result = await runSingleTest(tc, baseDir, depth)
      results.push(result)
      onProgress?.(result, i + 1, matrix.length)
    }
  } finally {
    await rm(baseDir, { recursive: true, force: true }).catch(() => {})
  }

  return results
}

async function runSingleTest(tc: TestCase, baseDir: string, depth: TestDepth): Promise<TestResult> {
  const start = Date.now()
  const steps: StepResult[] = []
  const projectName = `test-${tc.platform}-${tc.features.join('-') || 'bare'}`
  const outputDir = join(baseDir, projectName)

  // Step 1: Scaffold
  const scaffoldResult = await runStep('scaffold', () => {
    const generator = getGenerator(tc.platform)
    const opts: GeneratorOptions = {
      projectName,
      platform: tc.platform,
      features: tc.features,
    }
    return generator(opts)
  })
  steps.push(scaffoldResult)

  if (!scaffoldResult.passed) {
    return { label: tc.label, platform: tc.platform, features: tc.features, steps, passed: false, duration: Date.now() - start }
  }

  // Step 2: Write files
  const writeResult = await runStep('write-files', async () => {
    const generator = getGenerator(tc.platform)
    const files = generator({ projectName, platform: tc.platform, features: tc.features })
    for (const file of files) {
      const fullPath = join(outputDir, file.path)
      const { mkdir: mkdirFs, writeFile } = await import('fs/promises')
      const { dirname } = await import('path')
      await mkdirFs(dirname(fullPath), { recursive: true })
      await writeFile(fullPath, file.content)
    }
    return files.length
  })
  steps.push(writeResult)

  if (!writeResult.passed) {
    return { label: tc.label, platform: tc.platform, features: tc.features, steps, passed: false, duration: Date.now() - start }
  }

  // Step 3: Validate files exist
  const validateResult = await runStep('validate-files', async () => {
    const pkgPath = join(outputDir, 'package.json')
    if (!existsSync(pkgPath)) throw new Error('package.json not found')
    const pkg = JSON.parse(await readFile(pkgPath, 'utf-8'))
    if (!pkg.name) throw new Error('package.json missing name')
    if (!pkg.scripts) throw new Error('package.json missing scripts')

    // Platform-specific checks
    if (tc.platform === 'expo-mobile') {
      if (!existsSync(join(outputDir, 'app.json'))) throw new Error('app.json not found')
      if (!existsSync(join(outputDir, 'metro.config.js'))) throw new Error('metro.config.js not found')
      if (!existsSync(join(outputDir, 'mocks', 'empty.js'))) throw new Error('mocks/empty.js not found')
      if (!existsSync(join(outputDir, 'plugins', 'withAndroidNdkVersion.js'))) throw new Error('plugin not found')
      if (!existsSync(join(outputDir, 'app', '_layout.tsx'))) throw new Error('app/_layout.tsx not found')
      if (tc.features.includes('p2p') && !existsSync(join(outputDir, 'bare', 'index.js'))) {
        throw new Error('bare/index.js not found (p2p selected)')
      }
    }

    if (tc.platform === 'pear-desktop') {
      if (!existsSync(join(outputDir, 'index.html'))) throw new Error('index.html not found')
      if (!existsSync(join(outputDir, 'index.js'))) throw new Error('index.js not found')
      if (!existsSync(join(outputDir, 'worker.js'))) throw new Error('worker.js not found')
      if (!existsSync(join(outputDir, 'app', 'bridge.js'))) throw new Error('app/bridge.js not found')
      if (!existsSync(join(outputDir, 'app', 'index.js'))) throw new Error('app/index.js not found')
      const pkg = JSON.parse(await readFile(join(outputDir, 'package.json'), 'utf-8'))
      if (!pkg.pear?.pre) throw new Error('package.json missing pear.pre')
      if (!pkg.pear?.routes) throw new Error('package.json missing pear.routes')
      if (!pkg.pear?.unrouted) throw new Error('package.json missing pear.unrouted')
      if (!pkg.dependencies?.['pear-electron']) throw new Error('missing pear-electron dependency')
      if (!pkg.dependencies?.['pear-bridge']) throw new Error('missing pear-bridge dependency')
      if (!pkg.dependencies?.['pear-run']) throw new Error('missing pear-run dependency')
    }

    if (tc.platform === 'node-cli') {
      if (!existsSync(join(outputDir, 'src', 'index.ts'))) throw new Error('src/index.ts not found')
      if (!existsSync(join(outputDir, 'tsconfig.json'))) throw new Error('tsconfig.json not found')
    }

    return 'ok'
  })
  steps.push(validateResult)

  if (!validateResult.passed || depth === 'quick') {
    const passed = steps.every((s) => s.passed)
    return { label: tc.label, platform: tc.platform, features: tc.features, steps, passed, duration: Date.now() - start }
  }

  // Step 4: npm install
  const installResult = await runStep('npm-install', async () => {
    execSync('npm install --ignore-scripts', { cwd: outputDir, stdio: 'pipe', timeout: 120_000 })
    if (!existsSync(join(outputDir, 'node_modules'))) throw new Error('node_modules not created')
    return 'ok'
  })
  steps.push(installResult)

  if (!installResult.passed || depth === 'install') {
    const passed = steps.every((s) => s.passed)
    return { label: tc.label, platform: tc.platform, features: tc.features, steps, passed, duration: Date.now() - start }
  }

  // Step 5: Build/type-check
  const buildResult = await runStep('build', async () => {
    switch (tc.platform) {
      case 'node-cli':
        execSync('npx tsc --noEmit', { cwd: outputDir, stdio: 'pipe', timeout: 60_000 })
        break
      case 'pear-desktop':
        // Parse JS files to verify syntax
        const workerJs = await readFile(join(outputDir, 'worker.js'), 'utf-8')
        new Function(workerJs) // syntax check (will throw on parse error)
        break
      case 'expo-mobile':
        // Verify metro config is valid JS
        const metroJs = await readFile(join(outputDir, 'metro.config.js'), 'utf-8')
        new Function(metroJs)
        // Verify app.json is valid
        const appJson = JSON.parse(await readFile(join(outputDir, 'app.json'), 'utf-8'))
        if (!appJson.expo) throw new Error('app.json missing expo key')
        break
    }
    return 'ok'
  })
  steps.push(buildResult)

  const passed = steps.every((s) => s.passed)
  return { label: tc.label, platform: tc.platform, features: tc.features, steps, passed, duration: Date.now() - start }
}

async function runStep(name: string, fn: () => any): Promise<StepResult> {
  const start = Date.now()
  try {
    await fn()
    return { name, passed: true, duration: Date.now() - start }
  } catch (err: any) {
    return { name, passed: false, error: err.message, duration: Date.now() - start }
  }
}

/**
 * Format results for terminal display
 */
export function formatResults(results: TestResult[]): string {
  const lines: string[] = []
  const passed = results.filter((r) => r.passed).length
  const failed = results.filter((r) => !r.passed).length

  lines.push('')
  lines.push(`  Scaffold Test Results: ${passed} passed, ${failed} failed, ${results.length} total`)
  lines.push('')

  for (const r of results) {
    const icon = r.passed ? '  +' : '  x'
    const time = `${r.duration}ms`
    lines.push(`${icon} ${r.label} (${time})`)

    if (!r.passed) {
      for (const step of r.steps) {
        if (!step.passed) {
          lines.push(`      FAILED at "${step.name}": ${step.error}`)
        }
      }
    }
  }

  lines.push('')
  return lines.join('\n')
}
