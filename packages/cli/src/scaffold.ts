import { existsSync } from 'fs'
import { mkdir, readdir, readFile, writeFile, copyFile, cp } from 'fs/promises'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { execSync } from 'child_process'
import { MODULE_DEPS, type AssistantId, type TemplateId } from './constants.js'
import { buildAgentPack } from './agent-pack/index.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Path to components source (in package root, not in dist)
const COMPONENTS_SRC = join(__dirname, '..', 'agent-pack-src', 'components')

export interface ScaffoldOptions {
  projectName: string
  template: TemplateId
  assistant: AssistantId
  modules: string[]
  install: boolean
}

export interface ScaffoldResult {
  projectName: string
  projectPath: string
  template: string
  assistant: string
  modules: string[]
  agentFiles: string[]
  installed: boolean
}

/**
 * Resolve all module dependencies
 */
function resolveModules(selected: string[]): string[] {
  const resolved = new Set<string>()
  const queue = [...selected]

  while (queue.length > 0) {
    const mod = queue.pop()!
    if (resolved.has(mod)) continue
    resolved.add(mod)
    const deps = MODULE_DEPS[mod] || []
    queue.push(...deps)
  }

  return Array.from(resolved)
}

/**
 * Copy template files to project directory
 */
async function copyTemplate(templateId: string, destDir: string): Promise<void> {
  // Templates are relative to the CLI package
  const templateDir = join(__dirname, '..', 'templates', templateId)

  if (!existsSync(templateDir)) {
    throw new Error(`Template '${templateId}' not found at ${templateDir}`)
  }

  await copyDir(templateDir, destDir)
}

/**
 * Recursively copy a directory
 */
async function copyDir(src: string, dest: string): Promise<void> {
  await mkdir(dest, { recursive: true })

  const entries = await readdir(src, { withFileTypes: true })

  for (const entry of entries) {
    const srcPath = join(src, entry.name)
    const destPath = join(dest, entry.name)

    if (entry.isDirectory()) {
      await copyDir(srcPath, destPath)
    } else {
      await copyFile(srcPath, destPath)
    }
  }
}

/**
 * Process package.json with project-specific values
 */
async function processPackageJson(
  projectDir: string,
  projectName: string,
  modules: string[]
): Promise<void> {
  const pkgPath = join(projectDir, 'package.json')

  if (!existsSync(pkgPath)) {
    // Create a basic package.json if template doesn't have one
    const pkg = {
      name: projectName,
      version: '0.1.0',
      type: 'module',
      scripts: {
        dev: 'pear dev',
        build: 'pear stage',
        test: 'echo "No tests specified"'
      },
      dependencies: {} as Record<string, string>,
      devDependencies: {
        typescript: '^5.0.0'
      }
    }

    // Add module dependencies
    if (modules.includes('hyperdb')) {
      pkg.dependencies['hyperdb'] = '^5.0.0'
    }
    if (modules.includes('hypercore')) {
      pkg.dependencies['hypercore'] = '^10.0.0'
    }
    if (modules.includes('hyperswarm')) {
      pkg.dependencies['hyperswarm'] = '^4.0.0'
    }
    if (modules.includes('hyperdrive')) {
      pkg.dependencies['hyperdrive'] = '^11.0.0'
    }
    if (modules.includes('qvac')) {
      pkg.dependencies['@aspect/qvac'] = '^1.0.0'
    }
    if (modules.includes('wdk')) {
      pkg.dependencies['@aspect/wdk'] = '^1.0.0'
    }

    await writeFile(pkgPath, JSON.stringify(pkg, null, 2))
    return
  }

  // Update existing package.json
  const content = await readFile(pkgPath, 'utf-8')
  const pkg = JSON.parse(content)

  pkg.name = projectName

  await writeFile(pkgPath, JSON.stringify(pkg, null, 2))
}

/**
 * Update .gitignore to include agent-specific ignores
 */
async function updateGitignore(projectDir: string, assistant: AssistantId): Promise<void> {
  const gitignorePath = join(projectDir, '.gitignore')

  let content = ''
  if (existsSync(gitignorePath)) {
    content = await readFile(gitignorePath, 'utf-8')
  }

  const additions: string[] = [
    '',
    '# Dependencies',
    'node_modules/',
    '',
    '# Build',
    'dist/',
    '.pear/',
    '',
    '# Environment',
    '.env',
    '.env.local',
    ''
  ]

  // Tool-specific ignores
  if (assistant === 'claude') {
    additions.push('# Claude Code', '.claude/settings.local.json', '')
  }

  const newContent = content + additions.join('\n')
  await writeFile(gitignorePath, newContent)
}

/**
 * Install dependencies
 */
async function installDependencies(projectDir: string): Promise<boolean> {
  try {
    // Try pnpm first, then npm
    const packageManager = existsSync(join(projectDir, 'pnpm-lock.yaml'))
      ? 'pnpm'
      : 'npm'

    execSync(`${packageManager} install`, {
      cwd: projectDir,
      stdio: 'pipe'
    })
    return true
  } catch {
    return false
  }
}

/**
 * Component-to-module mapping.
 * Maps component directories to the modules that trigger their inclusion.
 */
const COMPONENT_MODULE_MAP: Record<string, { destDir: string; requires: string[] }> = {
  'p2p': { destDir: 'src/p2p', requires: ['hyperswarm', 'hypercore'] },
  'data': { destDir: 'src/data', requires: ['hyperdb', 'hypercore', 'hyperbee', 'corestore'] },
  'ai': { destDir: 'src/ai', requires: ['qvac'] },
  'wallet': { destDir: 'src/wallet', requires: ['wdk'] },
}

/**
 * Copy battle-tested components to the project based on selected modules.
 * Components are actual working .ts files that agents customize instead of writing from scratch.
 */
async function copyComponents(
  projectDir: string,
  modules: string[]
): Promise<string[]> {
  const files: string[] = []

  if (!existsSync(COMPONENTS_SRC)) return files

  for (const [compDir, config] of Object.entries(COMPONENT_MODULE_MAP)) {
    // Only copy if the project uses a relevant module
    if (!config.requires.some(mod => modules.includes(mod))) continue

    const srcDir = join(COMPONENTS_SRC, compDir)
    if (!existsSync(srcDir)) continue

    const destDir = join(projectDir, config.destDir)
    await mkdir(destDir, { recursive: true })

    const entries = await readdir(srcDir)
    for (const entry of entries.filter(f => f.endsWith('.ts'))) {
      await copyFile(join(srcDir, entry), join(destDir, entry))
      files.push(`${config.destDir}/${entry}`)
    }
  }

  return files
}

/**
 * Main scaffold function
 */
export async function scaffold(options: ScaffoldOptions): Promise<ScaffoldResult> {
  const projectPath = join(process.cwd(), options.projectName)

  // Check if directory exists
  if (existsSync(projectPath)) {
    throw new Error(`Directory '${options.projectName}' already exists`)
  }

  // Resolve all modules (including dependencies)
  const allModules = resolveModules(options.modules)

  // 1. Copy template
  await copyTemplate(options.template, projectPath)

  // 2. Process package.json
  await processPackageJson(projectPath, options.projectName, allModules)

  // 3. Copy battle-tested components based on selected modules
  const componentFiles = await copyComponents(projectPath, allModules)

  // 4. Build agent pack
  let agentFiles: string[] = []
  if (options.assistant !== 'none') {
    const result = await buildAgentPack({
      tool: options.assistant,
      template: options.template,
      modules: allModules,
      outputDir: projectPath,
      projectName: options.projectName
    })
    agentFiles = result.filesWritten
  }

  // 5. Update .gitignore
  await updateGitignore(projectPath, options.assistant)

  // 6. Install dependencies
  let installed = false
  if (options.install) {
    installed = await installDependencies(projectPath)
  }

  return {
    projectName: options.projectName,
    projectPath,
    template: options.template,
    assistant: options.assistant,
    modules: allModules,
    agentFiles: [...componentFiles, ...agentFiles],
    installed
  }
}
