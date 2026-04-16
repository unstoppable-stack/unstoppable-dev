import { existsSync } from 'fs'
import { mkdir, writeFile, readFile, readdir } from 'fs/promises'
import { join } from 'path'
import { classifyError } from './classifier.js'
import type { ExperimentRun, IterationResult, StepRunResult, MeasureRunResult, ErrorCategory } from './types.js'

// ─── Per-run report ──────────────────────────────────────────────────────────

interface VariantSummary {
  variant: string
  passed: boolean
  iterations: number
  errors: ErrorSummary[]
}

interface ErrorSummary {
  step: string
  category: ErrorCategory
  message: string
  stderr: string
}

/**
 * Generate a markdown report for a single experiment run.
 * Classifies each failure as infrastructure / experiment / environment / timeout.
 */
export function generateRunReport(run: ExperimentRun): string {
  const lines: string[] = []
  const ts = run.startedAt.replace('T', ' ').replace(/\.\d+Z$/, ' UTC')

  lines.push(`# ${run.experimentId} — Run Report`)
  lines.push('')
  lines.push(`**Date:** ${ts}`)
  lines.push(`**Status:** ${run.finalStatus.toUpperCase()}`)
  lines.push(`**Duration:** ${formatDuration(run)}`)
  lines.push('')

  // Summary table
  const variants = groupByVariant(run)
  const passedCount = variants.filter((v) => v.passed).length

  lines.push(`## Summary`)
  lines.push('')
  lines.push(`${passedCount}/${variants.length} variants passed`)
  lines.push('')
  lines.push('| Variant | Status | Iterations | Errors |')
  lines.push('|---------|--------|------------|--------|')
  for (const v of variants) {
    const status = v.passed ? 'PASS' : 'FAIL'
    const errorTypes = v.errors.map((e) => e.category).filter(unique).join(', ') || '—'
    lines.push(`| ${v.variant} | ${status} | ${v.iterations} | ${errorTypes} |`)
  }
  lines.push('')

  // Error categorization
  const allErrors = variants.flatMap((v) => v.errors)
  const infraErrors = allErrors.filter((e) => e.category === 'infrastructure')
  const envErrors = allErrors.filter((e) => e.category === 'environment')
  const expErrors = allErrors.filter((e) => e.category === 'experiment')
  const timeoutErrors = allErrors.filter((e) => e.category === 'timeout')

  if (infraErrors.length > 0) {
    lines.push(`## Infrastructure Errors (research framework bug)`)
    lines.push('')
    lines.push(`> These are bugs in the research process itself, not in the scaffolded code.`)
    lines.push(`> Fix these first — they prevent experiments from running correctly.`)
    lines.push('')
    for (const e of infraErrors) {
      lines.push(`### ${e.step}`)
      lines.push('```')
      lines.push(e.message.slice(0, 500))
      lines.push('```')
      if (e.stderr) {
        lines.push('<details><summary>stderr</summary>')
        lines.push('')
        lines.push('```')
        lines.push(e.stderr.slice(0, 1000))
        lines.push('```')
        lines.push('</details>')
      }
      lines.push('')
    }
  }

  if (envErrors.length > 0) {
    lines.push(`## Environment Errors (missing tools)`)
    lines.push('')
    lines.push(`> These indicate missing tools or misconfigured dev environment.`)
    lines.push(`> Run \`us doctor\` to check your setup.`)
    lines.push('')
    for (const e of dedup(envErrors)) {
      lines.push(`- **${e.step}**: ${e.message.split('\n')[0].slice(0, 200)}`)
    }
    lines.push('')
  }

  if (expErrors.length > 0) {
    lines.push(`## Experiment Errors (scaffold bugs)`)
    lines.push('')
    lines.push(`> These are real failures in the scaffolded code — the things we need to fix.`)
    lines.push('')
    for (const e of expErrors) {
      lines.push(`### ${e.step}`)
      lines.push('```')
      lines.push(e.message.slice(0, 500))
      lines.push('```')
      if (e.stderr) {
        lines.push('<details><summary>stderr</summary>')
        lines.push('')
        lines.push('```')
        lines.push(e.stderr.slice(0, 1000))
        lines.push('```')
        lines.push('</details>')
      }
      lines.push('')
    }
  }

  if (timeoutErrors.length > 0) {
    lines.push(`## Timeout Errors`)
    lines.push('')
    for (const e of dedup(timeoutErrors)) {
      lines.push(`- **${e.step}**: ${e.message.split('\n')[0].slice(0, 200)}`)
    }
    lines.push('')
  }

  // Changeable files hint (for AI consumption)
  lines.push(`## Files to Investigate`)
  lines.push('')
  lines.push(`If experiment errors above need code changes, look at:`)
  lines.push('')
  // This gets filled by the caller with experiment.changeable
  lines.push(`_(see experiment config for changeable files)_`)
  lines.push('')

  return lines.join('\n')
}

// ─── Cumulative report ───────────────────────────────────────────────────────

interface RunSnapshot {
  date: string
  status: string
  passed: number
  failed: number
  total: number
  infraErrors: number
  expErrors: number
  envErrors: number
}

/**
 * Generate a cumulative report tracking improvement over time
 * by reading all past run results for an experiment.
 */
export function generateCumulativeReport(experimentId: string, runs: ExperimentRun[]): string {
  const lines: string[] = []

  lines.push(`# ${experimentId} — Improvement History`)
  lines.push('')

  if (runs.length === 0) {
    lines.push('No runs recorded yet.')
    return lines.join('\n')
  }

  const snapshots: RunSnapshot[] = runs.map((run) => {
    const variants = groupByVariant(run)
    const allErrors = variants.flatMap((v) => v.errors)
    return {
      date: run.startedAt.replace('T', ' ').replace(/\.\d+Z$/, ''),
      status: run.finalStatus,
      passed: variants.filter((v) => v.passed).length,
      failed: variants.filter((v) => !v.passed).length,
      total: variants.length,
      infraErrors: allErrors.filter((e) => e.category === 'infrastructure').length,
      expErrors: allErrors.filter((e) => e.category === 'experiment').length,
      envErrors: allErrors.filter((e) => e.category === 'environment').length,
    }
  })

  // Progress table
  lines.push('## Run History')
  lines.push('')
  lines.push('| # | Date | Status | Pass/Total | Infra Err | Exp Err | Env Err |')
  lines.push('|---|------|--------|------------|-----------|---------|---------|')
  for (let i = 0; i < snapshots.length; i++) {
    const s = snapshots[i]
    lines.push(`| ${i + 1} | ${s.date} | ${s.status} | ${s.passed}/${s.total} | ${s.infraErrors} | ${s.expErrors} | ${s.envErrors} |`)
  }
  lines.push('')

  // Trend
  if (snapshots.length >= 2) {
    const first = snapshots[0]
    const last = snapshots[snapshots.length - 1]
    const passedDelta = last.passed - first.passed
    const expErrDelta = last.expErrors - first.expErrors

    lines.push('## Trend')
    lines.push('')
    if (passedDelta > 0) {
      lines.push(`- **Improved**: ${passedDelta} more variants passing since first run`)
    } else if (passedDelta < 0) {
      lines.push(`- **Regressed**: ${Math.abs(passedDelta)} fewer variants passing since first run`)
    } else {
      lines.push(`- **No change** in pass rate`)
    }

    if (expErrDelta < 0) {
      lines.push(`- **${Math.abs(expErrDelta)} fewer experiment errors** since first run`)
    } else if (expErrDelta > 0) {
      lines.push(`- **${expErrDelta} more experiment errors** since first run (regression)`)
    }
    lines.push('')
  }

  // Current failures (from latest run)
  const latest = runs[runs.length - 1]
  const latestVariants = groupByVariant(latest)
  const failing = latestVariants.filter((v) => !v.passed)

  if (failing.length > 0) {
    lines.push('## Current Failures (latest run)')
    lines.push('')
    for (const v of failing) {
      lines.push(`### ${v.variant}`)
      for (const e of v.errors) {
        lines.push(`- **[${e.category}]** ${e.step}: ${e.message.split('\n')[0].slice(0, 200)}`)
      }
      lines.push('')
    }
  } else {
    lines.push('## All variants passing in latest run')
    lines.push('')
  }

  return lines.join('\n')
}

// ─── Save reports to disk ────────────────────────────────────────────────────

export async function saveReport(
  run: ExperimentRun,
  reportDir: string,
  changeable: string[] = [],
): Promise<{ runReportPath: string; cumulativeReportPath: string }> {
  await mkdir(reportDir, { recursive: true })

  // Per-run report
  let report = generateRunReport(run)
  if (changeable.length > 0) {
    report = report.replace(
      '_(see experiment config for changeable files)_',
      changeable.map((f) => `- \`${f}\``).join('\n'),
    )
  }

  const runFilename = `${run.experimentId}-${run.startedAt.replace(/[:.]/g, '-')}.md`
  const runReportPath = join(reportDir, runFilename)
  await writeFile(runReportPath, report)

  // Cumulative report — load all past JSON results from sibling data/ dir
  const resultsDir = join(reportDir, '..', 'data')
  const allRuns = await loadAllRuns(run.experimentId, resultsDir)
  // Include the current run if not already saved
  if (!allRuns.find((r) => r.startedAt === run.startedAt)) {
    allRuns.push(run)
  }

  const cumReport = generateCumulativeReport(run.experimentId, allRuns)
  const cumulativeReportPath = join(reportDir, `${run.experimentId}-history.md`)
  await writeFile(cumulativeReportPath, cumReport)

  return { runReportPath, cumulativeReportPath }
}

async function loadAllRuns(experimentId: string, resultsDir: string): Promise<ExperimentRun[]> {
  if (!existsSync(resultsDir)) return []

  const files = await readdir(resultsDir)
  const matching = files.filter((f) => f.startsWith(experimentId) && f.endsWith('.json'))

  const runs: ExperimentRun[] = []
  for (const file of matching) {
    try {
      const content = await readFile(join(resultsDir, file), 'utf-8')
      runs.push(JSON.parse(content))
    } catch {}
  }

  return runs.sort((a, b) => a.startedAt.localeCompare(b.startedAt))
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function groupByVariant(run: ExperimentRun): VariantSummary[] {
  const variantMap = new Map<string, VariantSummary>()

  for (const iter of run.iterations) {
    const vars = iter.variant ?? run.variant
    const variantKey = vars
      ? Object.entries(vars)
          .filter(([k]) => !['experiment_id', 'id', 'features_flag', 'features_slug'].includes(k))
          .map(([k, v]) => `${k}=${v || '(bare)'}`)
          .join(', ')
      : `iteration-${iter.iteration}`

    if (!variantMap.has(variantKey)) {
      variantMap.set(variantKey, {
        variant: variantKey,
        passed: false,
        iterations: 0,
        errors: [],
      })
    }

    const summary = variantMap.get(variantKey)!
    summary.iterations++
    summary.passed = iter.allPassed

    const allSteps = [...iter.setupResults, ...iter.measureResults, ...iter.cleanupResults]
    for (const step of allSteps) {
      if (!step.passed && step.error) {
        const category = step.errorCategory ?? classifyError(step)
        summary.errors.push({
          step: step.name,
          category,
          message: step.error,
          stderr: step.stderr,
        })
      }
    }
  }

  return Array.from(variantMap.values())
}

function formatDuration(run: ExperimentRun): string {
  if (!run.completedAt) return 'running'
  const ms = new Date(run.completedAt).getTime() - new Date(run.startedAt).getTime()
  if (ms < 1000) return `${ms}ms`
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`
  return `${(ms / 60_000).toFixed(1)}m`
}

function unique(val: string, i: number, arr: string[]) {
  return arr.indexOf(val) === i
}

function dedup(errors: ErrorSummary[]): ErrorSummary[] {
  const seen = new Set<string>()
  return errors.filter((e) => {
    const key = `${e.step}:${e.message.slice(0, 100)}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}
