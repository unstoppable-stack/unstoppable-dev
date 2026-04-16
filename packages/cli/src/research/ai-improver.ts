import { readFile, writeFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import { execSync } from 'child_process'
import { join, dirname } from 'path'
import type { Experiment, IterationResult } from './types.js'

export interface ImproveOptions {
  /** Which AI tool to invoke */
  agent: 'claude' | 'cursor' | 'prompt-only'

  /** Project root — where the agent runs from (has CLAUDE.md, skills, etc.) */
  projectRoot: string

  /** Previous iteration prompts and results (for history) */
  history?: IterationHistory[]

  onProgress?: (message: string) => void
}

export interface IterationHistory {
  iteration: number
  prompt: string
  passed: boolean
  failedSteps: string[]
}

export interface ImproveResult {
  prompt: string
  promptPath: string
  applied: boolean
  description: string
}

/**
 * On experiment failure:
 * 1. Build a prompt with errors + changeable files + context + history
 * 2. Save it to the output folder
 * 3. Optionally invoke the AI agent from the project root
 */
export async function improveFromFailure(
  experiment: Experiment,
  iteration: IterationResult,
  options: ImproveOptions,
): Promise<ImproveResult> {
  const failures = [
    ...iteration.setupResults.filter((r) => !r.passed),
    ...iteration.measureResults.filter((r) => !r.passed),
  ]

  // Only try to fix experiment errors — skip infra/env issues
  const fixable = failures.filter(
    (f) => f.errorCategory === 'experiment' || f.errorCategory === 'unknown' || !f.errorCategory,
  )
  if (fixable.length === 0) {
    return {
      prompt: '',
      promptPath: '',
      applied: false,
      description: 'No fixable errors (only infrastructure/environment issues)',
    }
  }

  // Read changeable files
  const changeableContents = await readFiles(experiment.changeable, options.projectRoot)

  // Read context files
  const contextContents = await readFiles(experiment.context ?? [], options.projectRoot)

  // Build prompt
  const prompt = buildPrompt(experiment, fixable, changeableContents, contextContents, options.history ?? [])

  // Save prompt
  const outputDir = experiment.output
    ? join(options.projectRoot, experiment.output, 'prompts')
    : join(options.projectRoot, '.us', 'research-prompts')
  await mkdir(outputDir, { recursive: true })
  const promptPath = join(outputDir, `iter-${iteration.iteration}.md`)
  await writeFile(promptPath, prompt)
  options.onProgress?.(`Prompt saved: ${promptPath}`)

  if (options.agent === 'prompt-only') {
    return { prompt, promptPath, applied: false, description: 'Prompt generated (no agent invoked)' }
  }

  // Invoke AI agent from the project root
  const applied = await invokeAgent(prompt, options)

  if (applied) {
    // Rebuild after AI changes
    await rebuildIfNeeded(experiment, options)
  }

  return {
    prompt,
    promptPath,
    applied,
    description: applied ? 'AI agent applied changes and CLI rebuilt' : 'AI agent invocation failed',
  }
}

async function readFiles(paths: string[], projectRoot: string): Promise<{ path: string; content: string }[]> {
  const results: { path: string; content: string }[] = []
  for (const p of paths) {
    const fullPath = p.startsWith('/') ? p : join(projectRoot, p)
    if (existsSync(fullPath)) {
      try {
        const content = await readFile(fullPath, 'utf-8')
        results.push({ path: p, content })
      } catch {}
    }
  }
  return results
}

function buildPrompt(
  experiment: Experiment,
  failures: { name: string; command: string; error?: string; stderr: string; stdout: string; errorCategory?: string }[],
  changeable: { path: string; content: string }[],
  context: { path: string; content: string }[],
  history: IterationHistory[],
): string {
  const lines: string[] = []

  // Agent instructions
  if (experiment.agent?.instructions) {
    lines.push(experiment.agent.instructions)
    lines.push('')
  }

  lines.push(`# Fix: ${experiment.name}`)
  lines.push('')

  // History of previous attempts
  if (history.length > 0) {
    lines.push('## Previous Attempts')
    lines.push('')
    for (const h of history) {
      const status = h.passed ? 'PASSED' : 'FAILED'
      lines.push(`### Iteration ${h.iteration} — ${status}`)
      if (h.failedSteps.length > 0) {
        lines.push(`Failed steps: ${h.failedSteps.join(', ')}`)
      }
      lines.push('')
    }
    lines.push('Do NOT repeat changes that already failed. Try a different approach.')
    lines.push('')
  }

  // What failed
  lines.push('## Current Failures')
  lines.push('')

  for (const f of failures) {
    lines.push(`### ${f.name}`)
    lines.push(`Command: \`${f.command}\``)
    lines.push('')
    if (f.error) {
      lines.push('Error:')
      lines.push('```')
      lines.push(truncate(f.error, 1500))
      lines.push('```')
    }
    if (f.stderr) {
      lines.push('Stderr:')
      lines.push('```')
      lines.push(truncate(f.stderr, 2000))
      lines.push('```')
    }
    if (f.stdout) {
      lines.push('Stdout (tail):')
      lines.push('```')
      lines.push(truncate(f.stdout, 1000))
      lines.push('```')
    }
    lines.push('')
  }

  // Files to change
  lines.push('## Files to Fix')
  lines.push('')
  lines.push('Edit ONLY these files to fix the failures:')
  lines.push('')

  for (const file of changeable) {
    lines.push(`### \`${file.path}\``)
    lines.push('```typescript')
    lines.push(file.content)
    lines.push('```')
    lines.push('')
  }

  // Context (reference material)
  if (context.length > 0) {
    lines.push('## Reference Material')
    lines.push('')
    lines.push('Use these as reference for how the output should look:')
    lines.push('')

    for (const file of context) {
      lines.push(`### \`${file.path}\``)
      lines.push('```')
      lines.push(truncate(file.content, 3000))
      lines.push('```')
      lines.push('')
    }
  }

  // Rules
  lines.push('## Rules')
  lines.push('')
  lines.push('1. Only modify the files listed under "Files to Fix"')
  lines.push('2. These are generators that produce project files — fix the generated output')
  lines.push('3. Do not break other feature combinations that are currently passing')
  lines.push('4. After your changes the CLI will be rebuilt and the experiment re-run')
  lines.push('')

  return lines.join('\n')
}

async function invokeAgent(prompt: string, options: ImproveOptions): Promise<boolean> {
  const tmpPrompt = join(options.projectRoot, '.us', 'tmp-prompt.md')
  await mkdir(dirname(tmpPrompt), { recursive: true })
  await writeFile(tmpPrompt, prompt)

  const agentName = options.agent === 'cursor' ? 'Cursor Agent' : 'Claude Code'
  const command = options.agent === 'cursor'
    ? `cat "${tmpPrompt}" | cursor agent -p --trust --yolo`
    : `cat "${tmpPrompt}" | claude --print`

  try {
    options.onProgress?.(`Invoking ${agentName} from project root...`)

    execSync(command, {
      cwd: options.projectRoot,
      stdio: 'pipe',
      timeout: 300_000,
    })

    options.onProgress?.(`${agentName} finished`)
    return true
  } catch (err: any) {
    options.onProgress?.(`${agentName} error: ${err.message?.split('\n')[0]}`)
    return false
  }
}

async function rebuildIfNeeded(experiment: Experiment, options: ImproveOptions): Promise<void> {
  if (!experiment.build) return

  options.onProgress?.('Rebuilding...')
  try {
    const cwd = experiment.build.cwd
      ? join(options.projectRoot, experiment.build.cwd)
      : options.projectRoot

    execSync(experiment.build.command, {
      cwd,
      stdio: 'pipe',
      timeout: 60_000,
    })
    options.onProgress?.('Rebuild complete')
  } catch (err: any) {
    options.onProgress?.(`Rebuild failed: ${err.message?.split('\n')[0]}`)
  }
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s
  return '...' + s.slice(-max)
}
