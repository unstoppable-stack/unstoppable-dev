import { Command } from 'commander'
import { execSync } from 'child_process'
import chalk from 'chalk'

/**
 * us doctor
 *
 * Validates that the developer's machine has the tools required to scaffold
 * and run unstoppable stack apps. Each check is scoped to one or more
 * platforms; when `--platform <p>` is passed we only report checks relevant
 * to that platform (so CI/sandbox machines don't get dinged for missing
 * Xcode when they only target Node CLI).
 *
 * A check may include a `minVersion` (parsed as semver major.minor) — if the
 * parsed runtime version is below that, the check is demoted to a warning
 * even when the binary is found. This catches the common "Node 18 looks
 * fine but Bare needs 20" footgun.
 */

type Platform = 'pear-desktop' | 'node-cli' | 'expo-mobile'

interface Check {
  name: string
  command: string
  required: boolean
  // Platforms this check is meaningful for. Empty = always relevant.
  platforms?: Platform[]
  // Regex matching the binary's `--version` output. First capture group is
  // the version string. Without it we just report the raw output.
  versionPattern?: RegExp
  // Minimum version as `[major, minor]`. The parsed version must be >= this.
  minVersion?: [number, number]
  // Actionable one-liner the user can run to install/fix this.
  hint?: string
}

// Platforms that exist in the CLI today. Keep in sync with
// `src/generators/index.ts`.
const ALL_PLATFORMS: Platform[] = ['pear-desktop', 'node-cli', 'expo-mobile']

export interface DoctorCommandOptions {
  includeNode?: boolean
  publicPreview?: boolean
}

export function getDoctorPlatforms(options: DoctorCommandOptions = {}): Platform[] {
  return options.publicPreview ? ['pear-desktop'] : [...ALL_PLATFORMS]
}

const NODE_CHECK: Check = {
  name: 'Unstoppable Node',
  // `unstoppable-node help` exits 0 and prints a banner; we parse the
  // fixed "Unstoppable Node" string rather than a version number because
  // the daemon doesn't ship `--version` yet.
  command: 'unstoppable-node help',
  required: false,
  versionPattern: /(Unstoppable Node)/,
  hint: 'Deferred alpha. Link it from packages/node when validating the internal full profile.',
}

const CHECKS: Check[] = [
  // --- Core toolchain (everyone needs these) ---
  {
    name: 'Node.js',
    command: 'node --version',
    required: true,
    versionPattern: /v(\d+\.\d+)/,
    minVersion: [20, 0],
    hint: 'Install Node.js 20+ LTS from https://nodejs.org',
  },
  {
    name: 'npm',
    command: 'npm --version',
    required: true,
    versionPattern: /(\d+\.\d+)/,
    minVersion: [9, 0],
    hint: 'Comes with Node.js. `npm install -g npm@latest` to update.',
  },
  {
    name: 'git',
    command: 'git --version',
    required: true,
    versionPattern: /(\d+\.\d+)/,
    hint: 'Install git from https://git-scm.com',
  },

  // --- Expo mobile ---
  {
    name: 'Xcode command-line tools',
    command: 'xcrun --version',
    required: false,
    platforms: ['expo-mobile'],
    versionPattern: /(\d+(?:\.\d+)?)/,
    hint: 'Install Xcode from the Mac App Store, then `xcode-select --install`.',
  },
  {
    name: 'iOS Simulator',
    command: 'xcrun simctl list devices available | grep -q "iPhone"',
    required: false,
    platforms: ['expo-mobile'],
    hint: 'Open Xcode → Settings → Platforms and install an iOS runtime.',
  },
  {
    name: 'CocoaPods',
    command: 'pod --version',
    required: false,
    platforms: ['expo-mobile'],
    versionPattern: /(\d+\.\d+)/,
    hint: 'sudo gem install cocoapods',
  },
  {
    name: 'Maestro (mobile E2E)',
    command: 'maestro --version',
    required: false,
    platforms: ['expo-mobile'],
    versionPattern: /(\d+\.\d+)/,
    hint: 'curl -Ls "https://get.maestro.mobile.dev" | bash',
  },

  // --- Nice-to-haves (not platform-scoped) ---
  {
    name: 'TypeScript',
    // Try a globally-installed tsc first (fast), fall back to npx with
    // --no-install so we never trigger a surprise download during `doctor`.
    command: 'tsc --version 2>/dev/null || npx --no-install tsc --version',
    required: false,
    versionPattern: /Version (\d+\.\d+)/,
    hint: 'npm i -g typescript (optional — tsc comes via scaffolded projects)',
  },
]

interface Result {
  name: string
  ok: boolean
  version?: string
  // True when the binary was found but below minVersion. UX: yellow warning
  // instead of green check.
  outdated?: boolean
  platforms?: Platform[]
  required: boolean
  hint?: string
}

export function parseVersion(output: string, pattern: RegExp): string | null {
  const m = output.match(pattern)
  return m ? (m[1] ?? m[0]) : null
}

export function compareVersion(
  versionStr: string,
  min: [number, number],
): boolean {
  const m = versionStr.match(/(\d+)\.(\d+)/)
  if (!m) return true
  const major = parseInt(m[1]!, 10)
  const minor = parseInt(m[2]!, 10)
  if (major > min[0]) return true
  if (major < min[0]) return false
  return minor >= min[1]
}

function runCheck(check: Check): Result {
  try {
    const output = execSync(check.command, {
      stdio: 'pipe',
      timeout: 10_000,
      shell: '/bin/bash',
    })
      .toString()
      .trim()

    // Some checks are shell expressions (e.g. `grep -q`) that exit 0 on
    // success with no stdout — treat empty output as a bare pass.
    const version = check.versionPattern
      ? parseVersion(output, check.versionPattern)
      : output || null

    let outdated = false
    if (check.minVersion && version) {
      outdated = !compareVersion(version, check.minVersion)
    }

    return {
      name: check.name,
      ok: !outdated,
      version: version ?? undefined,
      outdated,
      platforms: check.platforms,
      required: check.required,
      hint: outdated ? check.hint : undefined,
    }
  } catch {
    return {
      name: check.name,
      ok: false,
      platforms: check.platforms,
      required: check.required,
      hint: check.hint,
    }
  }
}

function summariseReadiness(results: Result[]): Record<Platform, boolean> {
  const ready: Record<Platform, boolean> = {
    'pear-desktop': true,
    'node-cli': true,
    'expo-mobile': true,
  }
  for (const r of results) {
    if (r.ok) continue
    // Core (platform-less) failures hit every platform; platform-scoped
    // failures only matter when required.
    const platforms = r.platforms ?? ALL_PLATFORMS
    if (r.required) {
      for (const p of platforms) ready[p] = false
    }
    // Platform-scoped optional misses still count against that platform
    // (you can't `expo run:ios` without Xcode, even though Xcode is
    // technically "optional" at the toolchain level).
    if (!r.required && r.platforms) {
      for (const p of r.platforms) ready[p] = false
    }
  }
  return ready
}

export function registerDoctorCommand(program: Command, config: DoctorCommandOptions = {}) {
  const availablePlatforms = getDoctorPlatforms(config)
  program
    .command('doctor')
    .description('Check your development environment')
    .option(
      '-p, --platform <platform>',
      `Only check tools needed for this platform (${availablePlatforms.join(' | ')})`,
    )
    .option('--json', 'Output as JSON')
    .action(async (commandOptions) => {
      const platformFilter = commandOptions.platform as Platform | undefined
      if (platformFilter && !availablePlatforms.includes(platformFilter)) {
        const knownButExcluded = ALL_PLATFORMS.includes(platformFilter)
        const reason = knownButExcluded && config.publicPreview
          ? 'is outside the public-preview scope'
          : 'is unknown'
        console.error(
          `Platform "${platformFilter}" ${reason}. Expected one of: ${availablePlatforms.join(', ')}`,
        )
        process.exit(2)
      }

      const checks = config.includeNode ? [...CHECKS, NODE_CHECK] : CHECKS
      const scoped = checks.filter((c) => {
        if (!platformFilter) {
          return !c.platforms || c.platforms.some((platform) => availablePlatforms.includes(platform))
        }
        if (!c.platforms) return true // core check
        return c.platforms.includes(platformFilter)
      })

      const results = scoped.map(runCheck)
      const readiness = summariseReadiness(results)

      if (commandOptions.json) {
        console.log(
          JSON.stringify(
            {
              environment: {
                cli: program.version(),
                platform: process.platform,
                architecture: process.arch,
              },
              results,
              readiness: platformFilter
                ? { [platformFilter]: readiness[platformFilter] }
                : Object.fromEntries(
                    availablePlatforms.map((platform) => [platform, readiness[platform]]),
                  ),
            },
            null,
            2,
          ),
        )
        return
      }

      console.log()
      console.log(chalk.bold('  Environment Check'))
      console.log(chalk.gray(`  CLI ${program.version()} · ${process.platform}/${process.arch}`))
      console.log()

      for (const r of results) {
        const icon = r.ok
          ? chalk.green('  +')
          : r.outdated
            ? chalk.yellow('  !')
            : r.required
              ? chalk.red('  x')
              : chalk.yellow('  -')
        const version = r.version ? chalk.gray(` (${r.version})`) : ''
        let status = ''
        if (!r.ok) {
          if (r.outdated) status = chalk.yellow(' OUTDATED')
          else if (r.required) status = chalk.red(' REQUIRED')
          else status = chalk.yellow(' optional')
        }
        console.log(`${icon} ${r.name}${version}${status}`)
        if (!r.ok && r.hint) {
          console.log(chalk.gray(`      ${r.hint}`))
        }
      }

      console.log()

      // Platform readiness summary — only when not filtering (otherwise the
      // single-platform result is implicit in the individual check lines).
      if (!platformFilter) {
        console.log(chalk.bold('  Platform readiness'))
        for (const p of availablePlatforms) {
          const ok = readiness[p]
          const icon = ok ? chalk.green('  +') : chalk.yellow('  -')
          console.log(`${icon} ${p}${ok ? '' : chalk.gray('   missing tools above')}`)
        }
        console.log()
      }

      const requiredMissing = results.filter((r) => !r.ok && r.required && !r.outdated)
      const outdatedRequired = results.filter((r) => r.outdated && r.required)

      if (requiredMissing.length > 0) {
        console.log(chalk.red(`  ${requiredMissing.length} required tool(s) missing`))
        process.exit(1)
      } else if (outdatedRequired.length > 0) {
        console.log(chalk.yellow(`  ${outdatedRequired.length} required tool(s) outdated`))
        process.exit(1)
      } else {
        console.log(chalk.green('  All required tools found'))
      }
      console.log()
    })
}
