import { Command } from 'commander'
import { execSync } from 'child_process'
import chalk from 'chalk'

interface Check {
  name: string
  command: string
  versionPattern?: RegExp
  required: boolean
  platforms?: string[]
  hint?: string
}

const CHECKS: Check[] = [
  {
    name: 'Node.js',
    command: 'node --version',
    versionPattern: /v(\d+)\./,
    required: true,
    hint: 'Install Node.js 20+ from https://nodejs.org',
  },
  {
    name: 'npm',
    command: 'npm --version',
    required: true,
    hint: 'Comes with Node.js',
  },
  {
    name: 'git',
    command: 'git --version',
    required: true,
    hint: 'Install git from https://git-scm.com',
  },
  {
    name: 'Pear CLI',
    command: 'pear --version',
    required: false,
    platforms: ['pear-desktop', 'pear-terminal'],
    hint: 'npm i -g pear && export PATH="$HOME/Library/Application Support/pear/bin:$PATH"',
  },
  {
    name: 'Expo CLI',
    command: 'npx expo --version',
    required: false,
    platforms: ['expo-mobile'],
    hint: 'Included via npx — requires expo in your project deps',
  },
  {
    name: 'Xcode (xcrun)',
    command: 'xcrun --version',
    required: false,
    platforms: ['expo-mobile'],
    hint: 'Install Xcode from the Mac App Store',
  },
  {
    name: 'CocoaPods',
    command: 'pod --version',
    required: false,
    platforms: ['expo-mobile'],
    hint: 'sudo gem install cocoapods',
  },
  {
    name: 'TypeScript',
    command: 'npx tsc --version',
    required: false,
    hint: 'npm i -g typescript',
  },
]

export function registerDoctorCommand(program: Command) {
  program
    .command('doctor')
    .description('Check your development environment')
    .option('-p, --platform <platform>', 'Check for a specific platform')
    .option('--json', 'Output as JSON')
    .action(async (options) => {
      const results: { name: string; ok: boolean; version?: string; hint?: string; required: boolean }[] = []

      for (const check of CHECKS) {
        if (options.platform && check.platforms && !check.platforms.includes(options.platform)) {
          continue
        }

        try {
          const output = execSync(check.command, { stdio: 'pipe', timeout: 10000 }).toString().trim()
          results.push({ name: check.name, ok: true, version: output, required: check.required })
        } catch {
          results.push({ name: check.name, ok: false, hint: check.hint, required: check.required })
        }
      }

      if (options.json) {
        console.log(JSON.stringify(results, null, 2))
        return
      }

      console.log()
      console.log(chalk.bold('  Environment Check'))
      console.log()

      for (const r of results) {
        const icon = r.ok ? chalk.green('  +') : r.required ? chalk.red('  x') : chalk.yellow('  -')
        const version = r.ok && r.version ? chalk.gray(` (${r.version})`) : ''
        const status = r.ok ? '' : r.required ? chalk.red(' REQUIRED') : chalk.yellow(' optional')
        console.log(`${icon} ${r.name}${version}${status}`)
        if (!r.ok && r.hint) {
          console.log(chalk.gray(`      ${r.hint}`))
        }
      }

      console.log()

      const failed = results.filter((r) => !r.ok && r.required)
      if (failed.length > 0) {
        console.log(chalk.red(`  ${failed.length} required tool(s) missing`))
        process.exit(1)
      } else {
        console.log(chalk.green('  All required tools found'))
      }
      console.log()
    })
}
