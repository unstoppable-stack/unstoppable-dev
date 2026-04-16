import { existsSync } from 'fs'
import { readdir, readFile } from 'fs/promises'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import type { Experiment } from './types.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

/**
 * Directories to search for experiment configs (.json files with Experiment shape)
 */
function getExperimentDirs(): string[] {
  return [
    // Bundled experiments (shipped with the CLI)
    join(__dirname, '..', 'experiments'),
    // Local experiments (in the user's project)
    join(process.cwd(), '.us', 'experiments'),
  ]
}

/**
 * Load all available experiments from config dirs
 */
export async function loadExperiments(): Promise<Experiment[]> {
  const experiments: Experiment[] = []

  for (const dir of getExperimentDirs()) {
    if (!existsSync(dir)) continue

    const files = await readdir(dir)
    for (const file of files) {
      if (!file.endsWith('.json')) continue
      try {
        const content = await readFile(join(dir, file), 'utf-8')
        const exp = JSON.parse(content) as Experiment
        if (exp.id && exp.name && exp.setup && exp.measure) {
          experiments.push(exp)
        }
      } catch {
        // Skip malformed configs
      }
    }
  }

  return experiments
}

/**
 * Find an experiment by ID
 */
export async function findExperiment(id: string): Promise<Experiment | null> {
  const experiments = await loadExperiments()
  return experiments.find((e) => e.id === id) ?? null
}

/**
 * Default results directory
 */
export function getResultsDir(): string {
  return join(process.cwd(), '.us', 'research-results')
}
