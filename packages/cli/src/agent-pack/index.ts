import { mkdir, readFile, writeFile, readdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { AssistantId, TemplateId } from '../constants.js'
import type { Platform, Feature } from '../generators/types.js'
import { manifest } from '../compatibility/index.js'

const moduleDirectory = dirname(fileURLToPath(import.meta.url))
// Bundled CLI modules live in dist; source execution lives in src/agent-pack.
const AGENT_PACK_SRC = [join(moduleDirectory, '..', 'agent-pack-src'), join(moduleDirectory, '..', '..', 'agent-pack-src')]
  .find(path => existsSync(join(path, 'skills')))

export interface BuildOptions {
  tool: AssistantId
  template: TemplateId
  outputDir: string
  projectName: string
  platform?: Platform
  features?: Feature[]
}
export interface BuildResult { filesWritten: string[]; warnings: string[] }
interface Reference { id: string; content: string }
interface Skill { id: string; content: string; resources: { name: string; content: string }[] }

function stripFrontmatter(content: string) { return content.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '').trim() }
function description(content: string, fallback: string) {
  const frontmatter = content.match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1] || ''
  return frontmatter.match(/^description:\s*(.+)$/m)?.[1].replace(/^["']|["']$/g, '') || fallback
}

async function references(group: string): Promise<Reference[]> {
  const dir = join(AGENT_PACK_SRC!, group)
  const files = (await readdir(dir)).filter(f => /\.mdc?$/.test(f)).sort()
  return Promise.all(files.map(async name => ({ id: name.replace(/\.mdc?$/, ''), content: await readFile(join(dir, name), 'utf8') })))
}
async function skills(): Promise<Skill[]> {
  const dir = join(AGENT_PACK_SRC!, 'skills')
  const entries = (await readdir(dir, { withFileTypes: true })).filter(e => e.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))
  return Promise.all(entries.map(async entry => {
    const resources = join(dir, entry.name, 'resources')
    const names = existsSync(resources) ? (await readdir(resources)).filter(n => n.endsWith('.md')).sort() : []
    return {
      id: entry.name, content: await readFile(join(dir, entry.name, 'SKILL.md'), 'utf8'),
      resources: await Promise.all(names.map(async name => ({ name, content: await readFile(join(resources, name), 'utf8') }))),
    }
  }))
}

export async function buildAgentPack(options: BuildOptions): Promise<BuildResult> {
  if (options.tool === 'none') return { filesWritten: [], warnings: [] }
  if (!AGENT_PACK_SRC) throw new Error('CLI agent-pack assets are missing. Reinstall the CLI.')
  const [core, allModules, recipes, allSkills] = await Promise.all([references('core'), references('modules'), references('recipes'), skills()])
  const aiEnabled = !options.platform || options.features?.includes('local-ai')
  const modules = allModules.filter(m => aiEnabled || m.id !== 'qvac')
  const selectedSkills = allSkills.filter(s => aiEnabled || !(s.id.startsWith('add-ai-') || s.id === 'add-openai-server'))
  const files: string[] = []
  async function emit(path: string, content: string) {
    await mkdir(dirname(join(options.outputDir, path)), { recursive: true })
    await writeFile(join(options.outputDir, path), content)
    files.push(path)
  }
  const guidance = '.unstoppable/guidance'
  for (const [group, refs] of Object.entries({ core, modules, recipes })) {
    for (const ref of refs) await emit(`${guidance}/${group}/${ref.id}.md`, stripFrontmatter(ref.content) + '\n')
    await emit(`${guidance}/${group}/INDEX.md`, `# ${group}\n\nRead only the reference relevant to the task.\n\n` + refs.map(ref => `- [${ref.id}](${ref.id}.md): ${description(ref.content, ref.id)}`).join('\n') + '\n')
  }
  await emit('.unstoppable/compatibility-profiles.json', JSON.stringify(manifest, null, 2) + '\n')

  const skillRoot = { claude: '.claude/skills', codex: '.agents/skills', opencode: '.opencode/skills', cursor: '.cursor/skills' }[options.tool]
  for (const skill of selectedSkills) {
    await emit(`${skillRoot}/${skill.id}/SKILL.md`, skill.content)
    for (const resource of skill.resources) await emit(`${skillRoot}/${skill.id}/resources/${resource.name}`, resource.content)
  }
  // Keep existing foundation/module/recipe names as thin, on-demand routers.
  for (const [name, group, purpose] of [
    ['unstoppable-foundations', 'core', 'Architecture and lifecycle invariants for Unstoppable apps'],
    ['unstoppable-modules', 'modules', 'Runtime boundaries and integration notes for stack modules'],
    ['unstoppable-recipes', 'recipes', 'Composition patterns for extending scaffolded apps'],
  ]) {
    await emit(`${skillRoot}/${name}/SKILL.md`, `---\nname: ${name}\ndescription: ${purpose}; read only the relevant reference when designing or extending an app.\n---\n\n# ${purpose}\n\nDiscover the target app and read its \`.unstoppable/project.json\` first. Open \`${guidance}/${group}/INDEX.md\` relative to the workspace root, then select the matching reference. Installed contracts and version-matched SDK types take precedence over generic examples.\n`)
  }
  const project = `# ${options.projectName}

This workspace builds local-first apps with the Unstoppable Stack.

## Find the app before changing it

Run \`us compatibility list -o .\` or locate \`.unstoppable/project.json\` files.
Read the target app's metadata, package.json, scripts, and generated entrypoints.
${options.platform ? `Target: ${options.platform}; selected features: ${(options.features || []).join(', ') || 'base P2P and storage'}.` : 'This workspace can contain several apps with different runtimes and compatibility profiles.'}
For older apps without metadata, inspect the installed dependencies and runtime before applying guidance. Do not infer support from a current web page.

## Extend the existing contract

- Create a new supported target with \`us scaffold app\`; inspect \`us scaffold list-platforms\` and \`us scaffold list-features\` for the installed CLI's actual surface.
- Existing apps already have infrastructure. Extend their UI, domain logic, prompts, and schemas through generated managers and runtime contracts.
- Desktop native code runs in the Bare worker; the renderer uses the preload/IPC bridge.
${aiEnabled ? `- Desktop/Node local AI uses \`.unstoppable/runtime-ai/index.js\`. Read the AI contract in \`${guidance}/modules/qvac.md\` before changing lifecycle behavior.` : '- This target has no local AI feature; do not assume an AI runtime is installed.'}
- Data is local-first. Read locally before waiting for peers; keep private data outside replicated stores. Pairing and grants use P2P runtime only when that feature is present.
- Read the relevant local integration note or skill. Use version-matched upstream docs and installed types for detailed SDK APIs.
- Dependency/native-runtime upgrades are deliberate migrations. Run \`us compatibility check -o <app>\`; preserve app edits and validate the new combination. Never use \`--force\` to upgrade an edited app.
- Expo, wallet and Personal Node maturity is recorded separately; a scaffold or mock test alone does not establish native support.

## Validate the change

Use the app's own scripts. Exercise affected behavior, including failure/retry, real cancellation followed by reuse, and cached offline startup when changing AI. Keep mock evidence visibly identified. Do not claim native acceptance from structural checks.

## On-demand guidance

- \`${guidance}/core/INDEX.md\`: architecture and app policy
- \`${guidance}/modules/INDEX.md\`: runtime integration notes
- \`${guidance}/recipes/INDEX.md\`: composition patterns
- Skills: \`${skillRoot}/\`; load the matching workflow only

Use existing user decisions and authorization. Clarify only missing decisions that materially affect the task.
`
  if (options.tool === 'claude') {
    await emit('CLAUDE.md', project)
    await emit('.claude/settings.json', JSON.stringify({ permissions: { allow: ['Bash(npm:*)', 'Bash(pnpm:*)', 'Bash(pear:*)'], ask: ['Bash(git push:*)'] } }, null, 2) + '\n')
  } else if (options.tool === 'cursor') {
    await emit('.cursor/rules/project.mdc', `---\ndescription: Discover app profiles and extend Unstoppable runtime contracts\nalwaysApply: true\n---\n\n${project}`)
    // Cursor can select skills through ordinary description-triggered rules.
    for (const skill of selectedSkills) {
      await emit(`.cursor/rules/skill-${skill.id}.mdc`, `---\ndescription: ${description(skill.content, skill.id)}\nalwaysApply: false\n---\n\nRead \`${skillRoot}/${skill.id}/SKILL.md\` when this workflow applies.\n`)
    }
  } else {
    await emit('AGENTS.md', project)
    if (options.tool === 'opencode') await emit('opencode.json', JSON.stringify({ $schema: 'https://opencode.ai/config.json', instructions: ['AGENTS.md'] }, null, 2) + '\n')
  }
  return { filesWritten: files, warnings: [] }
}
