import { existsSync } from 'fs'
import { mkdir, readdir, readFile, writeFile, copyFile } from 'fs/promises'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { execSync } from 'child_process'
import type { AssistantId, TemplateId } from './constants.js'
import { buildAgentPack } from './agent-pack/index.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

export interface ScaffoldOptions {
  projectName: string
  template: TemplateId
  assistant: AssistantId
  install: boolean
}

export interface ScaffoldResult {
  projectName: string
  projectPath: string
  template: string
  assistant: string
  agentFiles: string[]
  installed: boolean
  installAttempted: boolean
  installError?: string
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
): Promise<void> {
  const pkgPath = join(projectDir, 'package.json')

  if (!existsSync(pkgPath)) {
    // Create a basic package.json if template doesn't have one
    const pkg = {
      name: projectName,
      version: '0.1.0',
      type: 'module',
      scripts: {
        dev: 'echo "Run the dev script for your app(s) - see README.md"',
        build: 'echo "Run the build script for your app(s)"',
        test: 'echo "No tests configured yet"'
      },
      devDependencies: {
        typescript: '^5.0.0'
      }
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
async function installDependencies(
  projectDir: string,
): Promise<{ installed: boolean; error?: string }> {
  try {
    // Try pnpm first, then npm
    const packageManager = existsSync(join(projectDir, 'pnpm-lock.yaml'))
      ? 'pnpm'
      : 'npm'

    execSync(`${packageManager} install`, {
      cwd: projectDir,
      stdio: 'pipe'
    })
    return { installed: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { installed: false, error: message }
  }
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

  // 1. Copy template
  await copyTemplate(options.template, projectPath)

  // 2. Process package.json
  await processPackageJson(projectPath, options.projectName)

  // 3. Build agent pack (includes all skills and modules)
  let agentFiles: string[] = []
  if (options.assistant !== 'none') {
    const result = await buildAgentPack({
      tool: options.assistant,
      template: options.template,
      outputDir: projectPath,
      projectName: options.projectName
    })
    agentFiles = result.filesWritten
  }

  // 4. Update .gitignore
  await updateGitignore(projectPath, options.assistant)

  // 5. Install dependencies
  let installed = false
  let installError: string | undefined
  if (options.install) {
    const installResult = await installDependencies(projectPath)
    installed = installResult.installed
    installError = installResult.error
  }

  return {
    projectName: options.projectName,
    projectPath,
    template: options.template,
    assistant: options.assistant,
    agentFiles,
    installed,
    installAttempted: options.install,
    installError,
  }
}
