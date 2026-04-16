/**
 * Research Experiment Framework
 *
 * An experiment defines:
 * 1. HOW to run something (execute)
 * 2. HOW to measure if it worked (measure)
 * 3. WHAT the AI can change to improve it (changeable)
 * 4. HOW to clean up between iterations (cleanup)
 */

export interface Experiment {
  /** Unique experiment identifier */
  id: string

  /** Human-readable name */
  name: string

  /** What this experiment validates */
  description: string

  /** Command to rebuild the thing being tested (runs before each retry) */
  build?: {
    command: string
    /** cwd relative to project root */
    cwd?: string
  }

  /** Where to write reports and prompts (relative to project root) */
  output?: string

  /** Variables that define the experiment variants (e.g., platform, features) */
  variants?: ExperimentVariant[]

  /** Steps to set up the experiment (run once before all measures) */
  setup: ExperimentStep[]

  /** Steps that measure success/failure — each one is scored independently */
  measure: AnyMeasureStep[]

  /** Files the AI is allowed to modify to fix failures */
  changeable: string[]

  /** Additional files to include in the AI prompt as context */
  context?: string[]

  /** AI agent configuration */
  agent?: {
    /** System instructions for the AI when fixing failures */
    instructions?: string
  }

  /** Steps to clean up after the experiment */
  cleanup: ExperimentStep[]

  /** Max improvement iterations before giving up */
  maxIterations?: number

  /** Working directory for commands (supports {{variable}} interpolation) */
  workDir?: string
}

export interface ExperimentVariant {
  /** Variable name (used in {{variable}} interpolation) */
  name: string

  /** Possible values */
  values: string[]
}

export interface ExperimentStep {
  /** Human-readable description */
  name: string

  /** Shell command to run (supports {{variable}} interpolation) */
  command: string

  /** Timeout in milliseconds */
  timeout?: number

  /** If true, failure of this step is not fatal */
  optional?: boolean
}

export interface MeasureStep extends ExperimentStep {
  /** How to determine success */
  successCriteria: SuccessCriteria
}

export type SuccessCriteria =
  | { type: 'exit-code'; expected: number }
  | { type: 'stdout-contains'; pattern: string }
  | { type: 'file-exists'; path: string }
  | { type: 'stdout-json'; field: string; expected: any }

/**
 * A measure step that spawns a long-running process, watches stdout
 * for expected patterns, then kills it. Used for runtime smoke tests.
 */
export interface SpawnMeasureStep {
  /** Human-readable description */
  name: string

  /** Shell command to spawn (supports {{variable}} interpolation) */
  command: string

  /** Patterns that must appear in stdout for the test to pass */
  expectedOutput: string[]

  /** Max time to wait for all patterns before killing (ms) */
  timeout?: number

  /** If true, failure of this step is not fatal */
  optional?: boolean

  /** Signals this is a spawn step (not a regular command) */
  mode: 'spawn'
}

/**
 * A Maestro UI test step for mobile apps.
 * Generates a Maestro YAML flow, runs it against a simulator/emulator.
 */
export interface MaestroMeasureStep {
  /** Human-readable description */
  name: string

  /** App bundle identifier */
  appId: string

  /** Text strings that must be visible on screen after launch */
  assertVisible: string[]

  /** Max time to wait for assertions (ms) */
  timeout?: number

  /** If true, failure is not fatal */
  optional?: boolean

  /** Which device to target */
  device?: 'ios' | 'android'

  /** Signals this is a maestro step */
  mode: 'maestro'
}

export type AnyMeasureStep = MeasureStep | SpawnMeasureStep | MaestroMeasureStep

// ─── Run Results ─────────────────────────────────────────────────────────────

export interface ExperimentRun {
  experimentId: string
  startedAt: string
  completedAt?: string
  variant?: Record<string, string>
  iterations: IterationResult[]
  finalStatus: 'passed' | 'failed' | 'running'
}

export interface IterationResult {
  iteration: number
  variant?: Record<string, string>
  setupResults: StepRunResult[]
  measureResults: MeasureRunResult[]
  cleanupResults: StepRunResult[]
  allPassed: boolean
  changesApplied?: string
}

export type ErrorCategory =
  | 'infrastructure'  // Research framework bug (bad cwd, missing tool, config parse error)
  | 'experiment'      // The thing being tested is broken (build failed, runtime crash)
  | 'environment'     // Missing dependency, wrong Node version, no simulator
  | 'timeout'         // Step took too long
  | 'unknown'

export interface StepRunResult {
  name: string
  command: string
  exitCode: number | null
  stdout: string
  stderr: string
  duration: number
  passed: boolean
  error?: string
  errorCategory?: ErrorCategory
}

export interface MeasureRunResult extends StepRunResult {
  criteria: SuccessCriteria
}

// ─── Experiment Registry ─────────────────────────────────────────────────────

export interface ExperimentRegistry {
  experiments: Experiment[]
  resultsDir: string
}
