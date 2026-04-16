import { Command } from 'commander'
import { existsSync } from 'fs'
import { readFile } from 'fs/promises'
import { join } from 'path'
import chalk from 'chalk'
import { runExperiment, saveRunResults } from '../research/runner.js'
import { saveReport } from '../research/reporter.js'
import { runScaffoldTests, generateTestMatrix } from '../research/scaffold-tester.js'
import type { Experiment } from '../research/types.js'
import type { TestDepth } from '../research/scaffold-tester.js'
import type { ProgressEvent } from '../research/runner.js'

async function loadExperimentFile(path: string): Promise<Experiment> {
  const resolved = path.startsWith('/') ? path : join(process.cwd(), path)
  if (!existsSync(resolved)) {
    throw new Error(`Experiment file not found: ${resolved}`)
  }
  const content = await readFile(resolved, 'utf-8')
  const exp = JSON.parse(content) as Experiment
  if (!exp.id || !exp.setup || !exp.measure) {
    throw new Error(`Invalid experiment config: missing id, setup, or measure`)
  }
  return exp
}

export function registerResearchCommand(program: Command) {
  const research = program
    .command('research')
    .description('Run research experiments to test and improve code')

  // ─── Main command: run an experiment from a config file ──────────────────

  research
    .command('run <config-path>')
    .description('Run a research experiment from a JSON config file')
    .option('--dry-run', 'Run once, report results, no AI improvement loop')
    .option('--agent <agent>', 'AI agent for fix loop: claude, prompt-only (default: from config or prompt-only)')
    .option('--json', 'Output as JSON')
    .option('--var <vars...>', 'Override variables (key=value)')
    .action(async (configPath, options) => {
      let experiment: Experiment
      try {
        experiment = await loadExperimentFile(configPath)
      } catch (err: any) {
        console.error(chalk.red(`  Error: ${err.message}`))
        process.exit(1)
      }

      // Parse --var flags
      const vars: Record<string, string> = {}
      if (options.var) {
        for (const v of options.var) {
          const [key, ...rest] = v.split('=')
          vars[key] = rest.join('=')
        }
      }

      const projectRoot = process.cwd()

      if (!options.json) {
        console.log()
        console.log(chalk.bold(`  Research: ${experiment.name}`))
        console.log(chalk.gray(`  ${experiment.description}`))
        console.log(chalk.gray(`  Project root: ${projectRoot}`))
        console.log()
      }

      const result = await runExperiment(experiment, {
        vars,
        dryRun: options.dryRun ?? !options.agent,
        agent: options.agent,
        projectRoot,
        onProgress: options.json ? undefined : logProgress,
      })

      // Save results + reports
      const outputDir = experiment.output
        ? join(projectRoot, experiment.output)
        : join(projectRoot, '.us', 'research-results')
      const reportsDir = join(outputDir, 'reports')
      const resultsDir = join(outputDir, 'data')

      const resultsPath = await saveRunResults(result, resultsDir)
      const { runReportPath, cumulativeReportPath } = await saveReport(
        result,
        reportsDir,
        experiment.changeable,
      )

      if (options.json) {
        console.log(JSON.stringify(result, null, 2))
      } else {
        console.log()
        const icon = result.finalStatus === 'passed' ? chalk.green('PASSED') : chalk.red('FAILED')
        console.log(`  Result: ${icon}`)
        console.log()
        console.log(chalk.gray(`  Data:    ${resultsPath}`))
        console.log(chalk.gray(`  Report:  ${runReportPath}`))
        console.log(chalk.gray(`  History: ${cumulativeReportPath}`))
        console.log()
      }

      if (result.finalStatus === 'failed') process.exit(1)
    })

  // ─── Legacy quick scaffold test (kept for convenience) ──────────────────

  research
    .command('scaffold-test')
    .description('Quick scaffold validation (all platform × feature combos)')
    .option('-d, --depth <depth>', 'Test depth: quick, install, build', 'quick')
    .option('--json', 'Output as JSON')
    .option('--platform <platform>', 'Test only a specific platform')
    .action(async (options) => {
      const depth = options.depth as TestDepth
      if (!['quick', 'install', 'build'].includes(depth)) {
        console.error(`Invalid depth: "${depth}". Use: quick, install, build`)
        process.exit(1)
      }

      const matrix = generateTestMatrix()
      const total = options.platform
        ? matrix.filter((tc) => tc.platform === options.platform).length
        : matrix.length

      if (!options.json) {
        console.log()
        console.log(chalk.bold(`  Scaffold Test — depth: ${depth}, ${total} combinations`))
        console.log()
      }

      const results = await runScaffoldTests(depth, (result, index, count) => {
        if (options.platform && result.platform !== options.platform) return

        if (!options.json) {
          const icon = result.passed ? chalk.green('+') : chalk.red('x')
          const time = chalk.gray(`${result.duration}ms`)
          process.stdout.write(`  ${icon} [${index}/${count}] ${result.label} ${time}\n`)

          if (!result.passed) {
            for (const step of result.steps) {
              if (!step.passed) {
                console.log(chalk.red(`      FAILED at "${step.name}": ${step.error}`))
              }
            }
          }
        }
      })

      const filtered = options.platform
        ? results.filter((r) => r.platform === options.platform)
        : results

      if (options.json) {
        console.log(JSON.stringify({
          depth,
          total: filtered.length,
          passed: filtered.filter((r) => r.passed).length,
          failed: filtered.filter((r) => !r.passed).length,
          results: filtered,
        }, null, 2))
      } else {
        const passed = filtered.filter((r) => r.passed).length
        const failed = filtered.filter((r) => !r.passed).length

        console.log()
        if (failed === 0) {
          console.log(chalk.green(`  All ${passed} combinations passed`))
        } else {
          console.log(chalk.red(`  ${failed} failed, ${passed} passed out of ${filtered.length}`))
        }
        console.log()
      }

      if (filtered.some((r) => !r.passed)) process.exit(1)
    })

  research
    .command('scaffold-matrix')
    .description('Show the scaffold test matrix without running')
    .action(() => {
      console.log(JSON.stringify(generateTestMatrix(), null, 2))
    })
}

function logProgress(event: ProgressEvent) {
  switch (event.type) {
    case 'variant-start': {
      const vars = Object.entries(event.variant)
        .filter(([k]) => !['experiment_id', 'id', 'features_flag', 'features_slug'].includes(k))
        .map(([k, v]) => `${k}=${v || '(bare)'}`)
        .join(', ')
      if (vars) console.log(chalk.bold(`  Variant: ${vars}`))
      break
    }
    case 'iteration-start':
      console.log(chalk.gray(`  Iteration ${event.iteration}`))
      break
    case 'step-complete': {
      const time = chalk.gray(`${event.duration}ms`)
      if (event.passed) {
        console.log(`    ${chalk.green('+')} ${event.step} ${time}`)
      } else if (event.optional) {
        console.log(`    ${chalk.gray('~')} ${chalk.gray(event.step)} ${time} ${chalk.gray('(optional, skipped)')}`)
      } else {
        console.log(`    ${chalk.red('x')} ${event.step} ${time}`)
        if (event.error) {
          const lines = event.error.split('\n').filter((l) => l.trim())
          const meaningful = lines.find((l) => l.includes('error TS') || l.includes('Error:') || l.includes('error:')) ?? lines[0]
          const short = (meaningful ?? event.error).trim().slice(0, 140)
          const tag = event.errorCategory ? chalk.yellow(`[${event.errorCategory}] `) : ''
          console.log(chalk.red(`      ${tag}${short}`))
        }
      }
      break
    }
    case 'iteration-complete':
      break
    case 'variant-complete':
      console.log(event.passed ? chalk.green('    PASSED') : chalk.red('    FAILED'))
      break
    case 'ai-improve':
      console.log(chalk.magenta(`    [AI] ${event.message}`))
      break
  }
}
