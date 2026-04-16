import type { ErrorCategory, StepRunResult } from './types.js'

const INFRASTRUCTURE_PATTERNS = [
  'ENOENT',
  'spawnSync',
  'Cannot find module',
  'SyntaxError',                // JSON parse error in experiment config
  'is not a function',          // framework bug
  'ENAMETOOLONG',
  'interpolate',                // variable substitution failure
]

const ENVIRONMENT_PATTERNS = [
  'command not found',
  'not recognized as',          // Windows
  'xcrun: error:',              // Xcode missing
  'No such file or directory: maestro',
  'ANDROID_HOME',
  'No simulators found',
  'No emulators found',
  'pod: command not found',
  'pear: command not found',
]

const TIMEOUT_PATTERNS = [
  'ETIMEDOUT',
  'Timeout',
  'timed out',
]

/**
 * Classify an error into a category based on the error message, stdout, stderr
 */
export function classifyError(result: StepRunResult): ErrorCategory {
  if (result.passed) return 'unknown'

  const haystack = [result.error, result.stderr, result.stdout]
    .filter(Boolean)
    .join('\n')

  for (const pattern of TIMEOUT_PATTERNS) {
    if (haystack.includes(pattern)) return 'timeout'
  }

  for (const pattern of INFRASTRUCTURE_PATTERNS) {
    if (haystack.includes(pattern)) return 'infrastructure'
  }

  for (const pattern of ENVIRONMENT_PATTERNS) {
    if (haystack.includes(pattern)) return 'environment'
  }

  return 'experiment'
}
