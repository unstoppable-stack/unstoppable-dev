import { execSync } from 'child_process'
import { existsSync } from 'fs'
import { mkdir, writeFile, readFile } from 'fs/promises'
import { join } from 'path'
import { runSpawnTest, runMaestroTest } from './spawner.js'
import { classifyError } from './classifier.js'
import { improveFromFailure } from './ai-improver.js'
import type { IterationHistory } from './ai-improver.js'
import type {
  Experiment,
  ExperimentRun,
  IterationResult,
  ExperimentStep,
  MeasureStep,
  AnyMeasureStep,
  SpawnMeasureStep,
  MaestroMeasureStep,
  StepRunResult,
  MeasureRunResult,
  SuccessCriteria,
} from './types.js'

const DEFAULT_TIMEOUT = 120_000

function interpolate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? `{{${key}}}`)
}

function interpolateDeep(obj: any, vars: Record<string, string>): any {
  if (typeof obj === 'string') return interpolate(obj, vars)
  if (Array.isArray(obj)) return obj.map((item) => interpolateDeep(item, vars))
  if (obj && typeof obj === 'object') {
    const result: any = {}
    for (const [key, val] of Object.entries(obj)) {
      result[key] = interpolateDeep(val, vars)
    }
    return result
  }
  return obj
}

// ─── Shell step execution ────────────────────────────────────────────────────

function resolveCwd(workDir: string | undefined, vars: Record<string, string>): string {
  if (!workDir) return process.cwd()
  const resolved = interpolate(workDir, vars)
  return existsSync(resolved) ? resolved : process.cwd()
}

function runStep(step: ExperimentStep, vars: Record<string, string>, workDir?: string): StepRunResult {
  const command = interpolate(step.command, vars)
  const cwd = resolveCwd(workDir, vars)
  const start = Date.now()

  try {
    const stdout = execSync(command, {
      cwd,
      stdio: 'pipe',
      timeout: step.timeout ?? DEFAULT_TIMEOUT,
      env: { ...process.env, FORCE_COLOR: '0' },
    }).toString()

    return {
      name: step.name,
      command,
      exitCode: 0,
      stdout,
      stderr: '',
      duration: Date.now() - start,
      passed: true,
    }
  } catch (err: any) {
    const result: StepRunResult = {
      name: step.name,
      command,
      exitCode: err.status ?? 1,
      stdout: err.stdout?.toString() ?? '',
      stderr: err.stderr?.toString() ?? '',
      duration: Date.now() - start,
      passed: false,
      error: err.message,
    }
    result.errorCategory = classifyError(result)
    return result
  }
}

function evaluateCriteria(result: StepRunResult, criteria: SuccessCriteria): boolean {
  switch (criteria.type) {
    case 'exit-code':
      return result.exitCode === criteria.expected
    case 'stdout-contains':
      return result.stdout.includes(criteria.pattern)
    case 'file-exists':
      return existsSync(criteria.path)
    case 'stdout-json':
      try {
        const data = JSON.parse(result.stdout)
        return data[criteria.field] === criteria.expected
      } catch {
        return false
      }
  }
}

function runShellMeasure(step: MeasureStep, vars: Record<string, string>, workDir?: string): MeasureRunResult {
  const result = runStep(step, vars, workDir)
  const criteriaPass = evaluateCriteria(result, step.successCriteria)

  let errorMsg: string | undefined
  if (!criteriaPass) {
    const detail = result.stderr?.trim() || result.error || result.stdout?.trim().slice(-500)
    errorMsg = detail || `Criteria not met: ${JSON.stringify(step.successCriteria)}`
  }

  const measureResult: MeasureRunResult = {
    ...result,
    passed: criteriaPass,
    criteria: step.successCriteria,
    error: errorMsg,
  }
  if (!criteriaPass) {
    measureResult.errorCategory = classifyError(measureResult)
  }
  return measureResult
}

// ─── Dispatch to the right measure handler ───────────────────────────────────

function isSpawnStep(step: AnyMeasureStep): step is SpawnMeasureStep {
  return 'mode' in step && step.mode === 'spawn'
}

function isMaestroStep(step: AnyMeasureStep): step is MaestroMeasureStep {
  return 'mode' in step && step.mode === 'maestro'
}

async function runAnyMeasureStep(
  step: AnyMeasureStep,
  vars: Record<string, string>,
  workDir?: string,
): Promise<MeasureRunResult> {
  const resolvedWorkDir = resolveCwd(workDir, vars)

  if (isSpawnStep(step)) {
    const resolved = interpolateDeep(step, vars) as SpawnMeasureStep
    return runSpawnTest({
      name: resolved.name,
      command: resolved.command,
      expectedOutput: resolved.expectedOutput,
      timeout: resolved.timeout,
      cwd: resolvedWorkDir,
    })
  }

  if (isMaestroStep(step)) {
    const resolved = interpolateDeep(step, vars) as MaestroMeasureStep
    return runMaestroTest({
      name: resolved.name,
      appId: resolved.appId,
      assertVisible: resolved.assertVisible,
      timeout: resolved.timeout,
      device: resolved.device,
      cwd: resolvedWorkDir,
    })
  }

  // Regular shell measure step
  return runShellMeasure(step as MeasureStep, vars, workDir)
}

// ─── Iteration ───────────────────────────────────────────────────────────────

async function runIteration(
  experiment: Experiment,
  vars: Record<string, string>,
  iteration: number,
): Promise<IterationResult> {
  const setupResults: StepRunResult[] = []
  const measureResults: MeasureRunResult[] = []
  const cleanupResults: StepRunResult[] = []

  let setupFailed = false

  // Setup (synchronous shell steps)
  for (const step of experiment.setup) {
    const result = runStep(step, vars, experiment.workDir)
    setupResults.push(result)
    if (!result.passed && !step.optional) {
      setupFailed = true
      break
    }
  }

  // Measure (only if setup succeeded)
  if (!setupFailed) {
    for (const step of experiment.measure) {
      const result = await runAnyMeasureStep(step, vars, experiment.workDir)
      measureResults.push(result)
    }
  }

  // Cleanup always runs — even on setup failure
  for (const step of experiment.cleanup) {
    const result = runStep(step, vars, experiment.workDir)
    cleanupResults.push(result)
  }

  if (setupFailed) {
    return { iteration, variant: vars, setupResults, measureResults, cleanupResults, allPassed: false }
  }

  const requiredResults = measureResults.filter((r) => {
    const step = experiment.measure.find((m) => m.name === r.name)
    return !step || !('optional' in step && step.optional)
  })
  const allPassed = requiredResults.every((r) => r.passed)
  return { iteration, variant: vars, setupResults, measureResults, cleanupResults, allPassed }
}

// ─── Experiment runner ───────────────────────────────────────────────────────

export interface RunOptions {
  vars?: Record<string, string>
  onProgress?: (event: ProgressEvent) => void
  dryRun?: boolean
  /** AI agent to use for improvement loop. 'prompt-only' just generates the prompt. */
  agent?: 'cursor' | 'claude' | 'prompt-only'
  /** Project root for reading changeable files and invoking agents */
  projectRoot?: string
}

export type ProgressEvent =
  | { type: 'variant-start'; variant: Record<string, string> }
  | { type: 'iteration-start'; iteration: number }
  | { type: 'step-complete'; step: string; passed: boolean; duration: number; error?: string; errorCategory?: string; optional?: boolean }
  | { type: 'iteration-complete'; result: IterationResult }
  | { type: 'variant-complete'; passed: boolean }
  | { type: 'ai-improve'; message: string }

export async function runExperiment(
  experiment: Experiment,
  options: RunOptions = {},
): Promise<ExperimentRun> {
  const run: ExperimentRun = {
    experimentId: experiment.id,
    startedAt: new Date().toISOString(),
    iterations: [],
    finalStatus: 'running',
  }

  const variantCombos = buildVariantCombinations(experiment.variants ?? [])
  if (variantCombos.length === 0) variantCombos.push({})

  const baseVars = options.vars ?? {}

  // Build before first run
  if (experiment.build) {
    options.onProgress?.({ type: 'ai-improve', message: 'Running initial build...' })
    runBuild(experiment, options.projectRoot ?? process.cwd())
  }

  for (const variantVars of variantCombos) {
    const vars = { ...baseVars, ...variantVars, experiment_id: experiment.id, id: experiment.id }

    // Derived variables
    const rawFeatures = vars.features ?? ''
    const isBareMeta = rawFeatures === '' || rawFeatures === 'bare'
    vars.features_flag = isBareMeta ? '' : `-f ${rawFeatures}`
    vars.features_slug = isBareMeta ? 'bare' : rawFeatures.replace(/,/g, '-')

    run.variant = vars

    options.onProgress?.({ type: 'variant-start', variant: vars })

    const maxIter = options.dryRun ? 1 : (experiment.maxIterations ?? 1)
    const history: IterationHistory[] = []

    for (let i = 0; i < maxIter; i++) {
      options.onProgress?.({ type: 'iteration-start', iteration: i + 1 })

      const result = await runIteration(experiment, vars, i + 1)
      run.iterations.push(result)

      for (const s of [...result.setupResults, ...result.measureResults]) {
        const stepDef = [...experiment.setup, ...experiment.measure].find((m) => m.name === s.name)
        const isOptional = stepDef && 'optional' in stepDef && stepDef.optional
        options.onProgress?.({
          type: 'step-complete',
          step: s.name,
          passed: s.passed,
          duration: s.duration,
          error: s.error,
          errorCategory: s.errorCategory,
          optional: isOptional,
        })
      }

      options.onProgress?.({ type: 'iteration-complete', result })

      if (result.allPassed) {
        options.onProgress?.({ type: 'variant-complete', passed: true })
        break
      }

      // AI improvement step
      if (options.agent && !options.dryRun) {
        const projectRoot = options.projectRoot ?? process.cwd()
        const improveResult = await improveFromFailure(experiment, result, {
          agent: options.agent,
          projectRoot,
          history,
          onProgress: (msg) => options.onProgress?.({ type: 'ai-improve', message: msg }),
        })

        // Track history for next iteration
        history.push({
          iteration: i + 1,
          prompt: improveResult.prompt.slice(0, 500),
          passed: result.allPassed,
          failedSteps: result.measureResults.filter((r) => !r.passed).map((r) => r.name),
        })

        result.changesApplied = improveResult.description

        if (!improveResult.applied) {
          options.onProgress?.({ type: 'ai-improve', message: 'No changes applied — stopping' })
          break
        }
      } else if (!options.dryRun) {
        break
      }
    }
  }

  const allPassed = run.iterations.length > 0 && run.iterations[run.iterations.length - 1].allPassed
  run.finalStatus = allPassed ? 'passed' : 'failed'
  run.completedAt = new Date().toISOString()

  return run
}

function runBuild(experiment: Experiment, projectRoot: string): void {
  if (!experiment.build) return
  const cwd = experiment.build.cwd
    ? join(projectRoot, experiment.build.cwd)
    : projectRoot
  try {
    execSync(experiment.build.command, { cwd, stdio: 'pipe', timeout: 60_000 })
  } catch {}
}

function buildVariantCombinations(variants: { name: string; values: string[] }[]): Record<string, string>[] {
  if (variants.length === 0) return [{}]

  const [first, ...rest] = variants
  const restCombos = buildVariantCombinations(rest)

  const combos: Record<string, string>[] = []
  for (const value of first.values) {
    for (const restCombo of restCombos) {
      combos.push({ [first.name]: value, ...restCombo })
    }
  }

  return combos
}

export async function saveRunResults(run: ExperimentRun, resultsDir: string): Promise<string> {
  await mkdir(resultsDir, { recursive: true })

  const filename = `${run.experimentId}-${run.startedAt.replace(/[:.]/g, '-')}.json`
  const filepath = join(resultsDir, filename)

  await writeFile(filepath, JSON.stringify(run, null, 2))
  return filepath
}

export async function loadRunResults(experimentId: string, resultsDir: string): Promise<ExperimentRun[]> {
  if (!existsSync(resultsDir)) return []

  const { readdir } = await import('fs/promises')
  const files = await readdir(resultsDir)
  const matching = files.filter((f) => f.startsWith(experimentId) && f.endsWith('.json'))

  const runs: ExperimentRun[] = []
  for (const file of matching) {
    const content = await readFile(join(resultsDir, file), 'utf-8')
    runs.push(JSON.parse(content))
  }

  return runs.sort((a, b) => a.startedAt.localeCompare(b.startedAt))
}
