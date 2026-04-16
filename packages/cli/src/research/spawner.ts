import { spawn, execSync } from 'child_process'
import { homedir } from 'os'
import { join } from 'path'
import { writeFile, rm } from 'fs/promises'
import { tmpdir } from 'os'
import type { MeasureRunResult } from './types.js'

function enrichedPath(): string {
  const extra = [join(homedir(), '.maestro', 'bin')]
  return [...extra, process.env.PATH].filter(Boolean).join(':')
}

const DEFAULT_SPAWN_TIMEOUT = 30_000

interface SpawnTestOptions {
  name: string
  command: string
  expectedOutput: string[]
  timeout?: number
  cwd?: string
}

export function runSpawnTest(options: SpawnTestOptions): Promise<MeasureRunResult> {
  const { name, command, expectedOutput, cwd } = options
  const timeout = options.timeout ?? DEFAULT_SPAWN_TIMEOUT

  return new Promise((resolve) => {
    const start = Date.now()
    const remaining = new Set(expectedOutput)
    let stdout = ''
    let stderr = ''
    let settled = false

    const parts = command.split(' ')
    const proc = spawn(parts[0], parts.slice(1), {
      cwd,
      shell: true,
      stdio: 'pipe',
      env: { ...process.env, PATH: enrichedPath(), FORCE_COLOR: '0', NO_COLOR: '1' },
    })

    function finish(passed: boolean, error?: string) {
      if (settled) return
      settled = true
      proc.kill('SIGTERM')
      setTimeout(() => {
        try { proc.kill('SIGKILL') } catch {}
      }, 2000)

      resolve({
        name,
        command,
        exitCode: null,
        stdout: stdout.slice(-5000),
        stderr: stderr.slice(-2000),
        duration: Date.now() - start,
        passed,
        error,
        criteria: { type: 'stdout-contains', pattern: expectedOutput.join(' && ') },
      })
    }

    function checkPatterns() {
      for (const pattern of remaining) {
        if (stdout.includes(pattern) || stderr.includes(pattern)) {
          remaining.delete(pattern)
        }
      }
      if (remaining.size === 0) {
        finish(true)
      }
    }

    proc.stdout?.on('data', (data: Buffer) => {
      stdout += data.toString()
      checkPatterns()
    })

    proc.stderr?.on('data', (data: Buffer) => {
      stderr += data.toString()
      checkPatterns()
    })

    proc.on('error', (err) => {
      finish(false, `Process error: ${err.message}`)
    })

    proc.on('exit', (code) => {
      if (!settled) {
        if (remaining.size === 0) {
          finish(true)
        } else {
          const missing = Array.from(remaining).join(', ')
          finish(false, `Process exited (code ${code}) before all patterns found. Missing: ${missing}`)
        }
      }
    })

    setTimeout(() => {
      if (!settled) {
        const missing = Array.from(remaining).join(', ')
        finish(false, `Timeout after ${timeout}ms. Missing patterns: ${missing}`)
      }
    }, timeout)
  })
}

const DEFAULT_MAESTRO_TIMEOUT = 60_000

interface MaestroTestOptions {
  name: string
  appId: string
  assertVisible: string[]
  timeout?: number
  device?: 'ios' | 'android'
  cwd?: string
}

/**
 * Run a Maestro E2E test: boot simulator if needed, install app, run flow.
 */
export async function runMaestroTest(options: MaestroTestOptions): Promise<MeasureRunResult> {
  const { name, appId, assertVisible, cwd, device } = options
  const timeout = options.timeout ?? DEFAULT_MAESTRO_TIMEOUT
  const start = Date.now()
  const env = { ...process.env, PATH: enrichedPath(), FORCE_COLOR: '0' }

  try {
    execSync('maestro --version', { stdio: 'pipe', env })
  } catch {
    return makeFail(name, 'maestro not installed — run: curl -fsSL "https://get.maestro.mobile.dev" | bash', start)
  }

  if (device === 'ios') {
    try {
      const simList = execSync('xcrun simctl list devices booted -j', { stdio: 'pipe', env }).toString()
      const parsed = JSON.parse(simList)
      const allBooted = (Object.values(parsed.devices).flat() as any[]).filter((d: any) => d.state === 'Booted')

      if (allBooted.length === 0) {
        const allDevices = execSync('xcrun simctl list devices available -j', { stdio: 'pipe', env }).toString()
        const allParsed = JSON.parse(allDevices)
        const iphones = (Object.values(allParsed.devices).flat() as any[]).filter(
          (d: any) => d.name?.includes('iPhone') && d.isAvailable,
        )
        if (iphones.length === 0) return makeFail(name, 'No iPhone simulator available', start)
        execSync(`xcrun simctl boot "${iphones[0].udid}"`, { stdio: 'pipe', env, timeout: 60_000 })
      }

      // Install the .app if we can find it
      const appPath = findBuiltApp(cwd ?? '.', 'ios')
      if (appPath) {
        execSync(`xcrun simctl install booted "${appPath}"`, { stdio: 'pipe', env, timeout: 30_000 })
      }
    } catch (err: any) {
      return makeFail(name, `iOS simulator setup: ${err.message?.split('\n')[0]}`, start)
    }
  }

  // Generate Maestro flow YAML
  const flowLines = [`appId: ${appId}`, '---', '- launchApp']
  for (const text of assertVisible) {
    flowLines.push(`- assertVisible: "${text}"`)
  }
  const flowPath = join(tmpdir(), `us-maestro-${Date.now()}.yaml`)
  await writeFile(flowPath, flowLines.join('\n') + '\n')

  try {
    const deviceFlag = device === 'android' ? '--platform android' : device === 'ios' ? '--platform ios' : ''
    const cmd = `maestro test ${deviceFlag} ${flowPath}`.trim()

    const stdout = execSync(cmd, { cwd, stdio: 'pipe', timeout, env }).toString()

    return {
      name,
      command: cmd,
      exitCode: 0,
      stdout: stdout.slice(-5000),
      stderr: '',
      duration: Date.now() - start,
      passed: true,
      criteria: { type: 'exit-code', expected: 0 },
    }
  } catch (err: any) {
    return {
      name,
      command: `maestro test ${flowPath}`,
      exitCode: err.status ?? 1,
      stdout: err.stdout?.toString()?.slice(-5000) ?? '',
      stderr: err.stderr?.toString()?.slice(-2000) ?? '',
      duration: Date.now() - start,
      passed: false,
      error: err.message?.split('\n')[0],
      criteria: { type: 'exit-code', expected: 0 },
    }
  } finally {
    await rm(flowPath, { force: true }).catch(() => {})
  }
}

function makeFail(name: string, error: string, start: number): MeasureRunResult {
  return {
    name,
    command: 'maestro test',
    exitCode: 1,
    stdout: '',
    stderr: '',
    duration: Date.now() - start,
    passed: false,
    error,
    criteria: { type: 'exit-code', expected: 0 },
  }
}

function findBuiltApp(projectDir: string, platform: 'ios'): string | null {
  try {
    // Check local build dir first (if xcodebuild used -derivedDataPath)
    const localBuild = execSync(
      `find "${projectDir}/ios/build" -name "*.app" -type d 2>/dev/null | head -1`,
      { stdio: 'pipe' },
    ).toString().trim()
    if (localBuild) return localBuild

    // Fall back to Xcode DerivedData
    const derivedData = execSync(
      `find ~/Library/Developer/Xcode/DerivedData -path "*/Debug-iphonesimulator/*.app" -type d -newer "${projectDir}/package.json" 2>/dev/null | head -1`,
      { stdio: 'pipe' },
    ).toString().trim()
    return derivedData || null
  } catch {
    return null
  }
}
