import { mkdir, readFile, writeFile, readdir, copyFile, cp } from 'fs/promises'
import { existsSync } from 'fs'
import { join, dirname, basename } from 'path'
import { fileURLToPath } from 'url'
import type { AssistantId, TemplateId } from '../constants.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Path to agent pack source (in package root, not in dist)
const AGENT_PACK_SRC = join(__dirname, '..', 'agent-pack-src')

export interface BuildOptions {
  tool: AssistantId
  template: TemplateId
  modules: string[]
  outputDir: string
  projectName: string
}

export interface BuildResult {
  filesWritten: string[]
  warnings: string[]
}

// ─── Content Loading ─────────────────────────────────────────────────────────

async function loadContent(template: string, modules: string[]) {
  const content = {
    modules: [] as { id: string; content: string }[],
    recipes: [] as { id: string; content: string }[],
    core: [] as { id: string; content: string }[],
    skills: [] as { id: string; skillMd: string; resources: { name: string; content: string }[] }[],
    hooks: {
      skillRules: null as any,
    }
  }

  // Load modules
  const modulesDir = join(AGENT_PACK_SRC, 'modules')
  if (existsSync(modulesDir)) {
    for (const mod of modules) {
      const modPath = join(modulesDir, `${mod}.md`)
      if (existsSync(modPath)) {
        content.modules.push({ id: mod, content: await readFile(modPath, 'utf-8') })
      }
    }
  }

  // Load ALL recipes
  const recipesDir = join(AGENT_PACK_SRC, 'recipes')
  if (existsSync(recipesDir)) {
    const recipes = await readdir(recipesDir)
    for (const recipe of recipes.filter(f => f.endsWith('.md'))) {
      content.recipes.push({
        id: recipe.replace('.md', ''),
        content: await readFile(join(recipesDir, recipe), 'utf-8')
      })
    }
  }

  // Load core
  const coreDir = join(AGENT_PACK_SRC, 'core')
  if (existsSync(coreDir)) {
    const coreFiles = await readdir(coreDir)
    for (const file of coreFiles.filter(f => f.endsWith('.md'))) {
      content.core.push({
        id: file.replace('.md', ''),
        content: await readFile(join(coreDir, file), 'utf-8')
      })
    }
  }

  // Load skills (thin SKILL.md + resources/)
  const skillsDir = join(AGENT_PACK_SRC, 'skills')
  if (existsSync(skillsDir)) {
    const skillDirs = await readdir(skillsDir, { withFileTypes: true })
    for (const dir of skillDirs.filter(d => d.isDirectory())) {
      const skillMdPath = join(skillsDir, dir.name, 'SKILL.md')
      if (!existsSync(skillMdPath)) continue

      const skillMd = await readFile(skillMdPath, 'utf-8')
      const resources: { name: string; content: string }[] = []

      const resourcesDir = join(skillsDir, dir.name, 'resources')
      if (existsSync(resourcesDir)) {
        const resFiles = await readdir(resourcesDir)
        for (const resFile of resFiles.filter(f => f.endsWith('.md'))) {
          resources.push({
            name: resFile,
            content: await readFile(join(resourcesDir, resFile), 'utf-8')
          })
        }
      }

      content.skills.push({ id: dir.name, skillMd, resources })
    }
  }

  // Load hooks
  const skillRulesPath = join(AGENT_PACK_SRC, 'hooks', 'skill-rules.json')
  if (existsSync(skillRulesPath)) {
    content.hooks.skillRules = JSON.parse(await readFile(skillRulesPath, 'utf-8'))
  }

  return content
}

// ─── Utilities ───────────────────────────────────────────────────────────────

function stripFrontmatter(content: string): string {
  if (!content.trimStart().startsWith('---')) return content
  const match = content.match(/^---\n[\s\S]*?\n---\n([\s\S]*)$/)
  return match ? match[1].trim() : content
}

function parseFrontmatter(content: string): { data: any; body: string } {
  if (!content.trimStart().startsWith('---')) {
    return { data: {}, body: content }
  }
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
  if (!match) return { data: {}, body: content }

  const data: any = {}
  match[1].split('\n').forEach(line => {
    const colonIndex = line.indexOf(':')
    if (colonIndex > 0) {
      const key = line.substring(0, colonIndex).trim()
      const value = line.substring(colonIndex + 1).trim()
      data[key] = value
    }
  })
  return { data, body: match[2] }
}

/** Pick only the 2-3 most important core files for slim output */
function selectSlimCore(core: { id: string; content: string }[]) {
  const priority = ['architecture', 'principles', 'patterns', 'cheatsheet']
  return core
    .filter(c => priority.includes(c.id))
    .sort((a, b) => priority.indexOf(a.id) - priority.indexOf(b.id))
}

// ─── Claude Code Builder ─────────────────────────────────────────────────────

async function buildClaude(
  content: any,
  options: BuildOptions
): Promise<BuildResult> {
  const files: string[] = []

  // 1. Build SLIM CLAUDE.md (≤8KB target — overview + patterns summary only)
  let claudeMd = `# ${options.projectName}

## Overview
This is an Unstoppable Stack project using the ${options.template} template.

Build truly unstoppable apps: P2P networking, local-first data, offline AI, and crypto payments — all without centralized servers.

## Tech Stack
${options.modules.map(m => `- **${m}**`).join('\n')}

## Commands
- \`pnpm dev\` - Start development
- \`pnpm build\` - Build for production
- \`pnpm test\` - Run tests

## Project Structure
\`\`\`
├── planning/         # Architecture decisions & feature plans
├── src/              # Application source code
│   ├── app/          # Application logic
│   ├── p2p/          # P2P networking
│   ├── data/         # Database/storage
│   └── ui/           # UI components
└── README.md
\`\`\`

## Before Building

**You MUST follow this process:**

1. **Ask the pre-implementation checklist questions** (see Principles in .claude/rules/)
2. **Propose an architecture** listing all apps to be created
3. **Get user confirmation** before writing any code
4. **Create each app** with its own folder and README

## Available Skills

Use these slash commands for guided implementation:

${content.skills.map((s: any) => {
    const { data } = parseFrontmatter(s.skillMd)
    return `- \`/${s.id}\` — ${data.description || s.id}`
  }).join('\n')}

## Key Patterns

- **Local-first**: Always write locally first, sync is opportunistic
- **P2P**: No central servers — data lives on user devices
- **Privacy**: Users control their data
- **Offline AI**: Local inference via QVAC, no API calls needed

For detailed architecture, patterns, and module docs, see \`.claude/rules/\`.
`

  await writeFile(join(options.outputDir, 'CLAUDE.md'), claudeMd)
  files.push('CLAUDE.md')

  // 2. Create .claude directories
  const claudeDir = join(options.outputDir, '.claude')
  await mkdir(join(claudeDir, 'rules'), { recursive: true })
  await mkdir(join(claudeDir, 'skills'), { recursive: true })

  // 3. Write settings.json with hooks
  const settings: any = {
    permissions: {
      allow: [
        'Bash(npm:*)', 'Bash(pnpm:*)', 'Bash(pear:*)',
        'Bash(git add:*)', 'Bash(git commit:*)'
      ],
      ask: ['Bash(git push:*)'],
      deny: ['Read(.env*)', 'Edit(.env*)']
    },
    hooks: {
      PostToolUse: [
        {
          matcher: 'Edit|Write',
          hooks: [{
            type: 'command',
            command: 'npx prettier --write "$CLAUDE_FILE" 2>/dev/null || true'
          }]
        }
      ]
    }
  }

  await writeFile(join(claudeDir, 'settings.json'), JSON.stringify(settings, null, 2))
  files.push('.claude/settings.json')

  // 4. Write core docs as path-agnostic rules
  for (const core of content.core) {
    await writeFile(join(claudeDir, 'rules', `${core.id}.md`), stripFrontmatter(core.content))
    files.push(`.claude/rules/${core.id}.md`)
  }

  // 5. Write module docs as path-scoped rules
  for (const mod of content.modules) {
    const body = stripFrontmatter(mod.content)
    const pathScoped = `---
paths:
  - "src/p2p/**/*.ts"
  - "src/data/**/*.ts"
  - "src/ai/**/*.ts"
---

${body}
`
    await writeFile(join(claudeDir, 'rules', `module-${mod.id}.md`), pathScoped)
    files.push(`.claude/rules/module-${mod.id}.md`)
  }

  // 6. Write skills with resources (progressive disclosure)
  for (const skill of content.skills) {
    const skillDir = join(claudeDir, 'skills', skill.id)
    await mkdir(skillDir, { recursive: true })
    await writeFile(join(skillDir, 'SKILL.md'), skill.skillMd)
    files.push(`.claude/skills/${skill.id}/SKILL.md`)

    if (skill.resources.length > 0) {
      const resDir = join(skillDir, 'resources')
      await mkdir(resDir, { recursive: true })
      for (const res of skill.resources) {
        await writeFile(join(resDir, res.name), res.content)
        files.push(`.claude/skills/${skill.id}/resources/${res.name}`)
      }
    }
  }

  return { filesWritten: files, warnings: [] }
}

// ─── Cursor Builder ──────────────────────────────────────────────────────────

async function buildCursor(
  content: any,
  options: BuildOptions
): Promise<BuildResult> {
  const files: string[] = []

  const rulesDir = join(options.outputDir, '.cursor', 'rules')
  await mkdir(rulesDir, { recursive: true })

  // 1. Project overview (always apply) — slim
  const projectMdc = `---
description: ${options.projectName} - Unstoppable Stack project overview and key patterns
alwaysApply: true
---

# ${options.projectName}

Build truly unstoppable apps: P2P networking, local-first data, offline AI, and crypto payments.

## Tech Stack
${options.modules.map(m => `- **${m}**`).join('\n')}

## Commands
- \`pnpm dev\` - Start development
- \`pnpm build\` - Build for production
- \`pnpm test\` - Run tests

## Project Structure
\`\`\`
├── planning/         # Architecture decisions & feature plans
├── src/
│   ├── app/          # Application logic
│   ├── p2p/          # P2P networking
│   ├── data/         # Database/storage
│   └── ui/           # UI components
└── README.md
\`\`\`

## Before Building

**You MUST follow this process:**

1. **Ask the pre-implementation checklist questions** (see @principles rule)
2. **Propose an architecture** listing all apps to be created
3. **Get user confirmation** before writing any code

## Core Principles

- **Local-first**: Apps work offline, sync when connected
- **P2P**: No central servers, data lives on user devices
- **Privacy**: Users control their data
- **Offline AI**: Local inference, no API calls
`

  await writeFile(join(rulesDir, 'project.mdc'), projectMdc)
  files.push('.cursor/rules/project.mdc')

  // 2. Core docs as individual rules (agent-choice via description)
  for (const core of content.core) {
    const body = stripFrontmatter(core.content)
    const coreMdc = `---
description: ${core.id} - Unstoppable Stack core knowledge for architecture, patterns, and best practices
---

${body}
`
    await writeFile(join(rulesDir, `core-${core.id}.mdc`), coreMdc)
    files.push(`.cursor/rules/core-${core.id}.mdc`)
  }

  // 3. Module docs with specific descriptions and file globs
  const moduleGlobs: Record<string, string[]> = {
    hyperdb: ['src/data/**/*.ts', 'src/db/**/*.ts'],
    hyperdrive: ['src/files/**/*.ts', 'src/storage/**/*.ts'],
    hyperswarm: ['src/p2p/**/*.ts', 'src/network/**/*.ts'],
    hypercore: ['src/data/**/*.ts', 'src/p2p/**/*.ts'],
    hyperbee: ['src/data/**/*.ts', 'src/db/**/*.ts'],
    corestore: ['src/data/**/*.ts'],
    qvac: ['src/ai/**/*.ts', 'src/inference/**/*.ts'],
    wdk: ['src/wallet/**/*.ts', 'src/payments/**/*.ts'],
    pear: ['index.html', 'app.js', 'src/ui/**/*.ts'],
    bare: ['src/**/*.ts'],
  }

  for (const mod of content.modules) {
    const body = stripFrontmatter(mod.content)
    const globs = moduleGlobs[mod.id] || []
    const globLine = globs.length > 0 ? `\nglobs: ${JSON.stringify(globs)}` : ''
    const modMdc = `---
description: ${mod.id} module - API reference, patterns, and gotchas for ${mod.id}${globLine}
---

${body}
`
    await writeFile(join(rulesDir, `module-${mod.id}.mdc`), modMdc)
    files.push(`.cursor/rules/module-${mod.id}.mdc`)
  }

  // 4. Skills as description-triggered rules
  for (const skill of content.skills) {
    const { data, body } = parseFrontmatter(skill.skillMd)
    const skillMdc = `---
description: Skill - ${data.description || skill.id}
---

${body}
`
    await writeFile(join(rulesDir, `skill-${skill.id}.mdc`), skillMdc)
    files.push(`.cursor/rules/skill-${skill.id}.mdc`)
  }

  // 5. P2P patterns (glob-scoped)
  if (options.modules.includes('hyperswarm') || options.modules.includes('hyperdb')) {
    const p2pMdc = `---
description: P2P coding patterns for Hypercore stack - connection handling, replication, and discovery
globs: ["src/p2p/**/*.ts", "src/data/**/*.ts"]
---

# P2P Patterns

## Always Do
- Await \`db.ready()\` / \`core.ready()\` before operations
- Handle peer disconnection gracefully (\`conn.on('close')\`, \`conn.on('error')\`)
- Use proper error handling on socket errors
- Replicate your data structures over connections
- Use \`swarm.flush()\` before reading on the consumer side

## Common Mistakes
- Don't assume peers are always connected
- Don't store large blobs in HyperDB (use Hyperdrive)
- Don't hardcode discovery keys
- Don't forget to close connections on cleanup
- Don't block app startup waiting for peers — read local data first
`
    await writeFile(join(rulesDir, 'p2p-patterns.mdc'), p2pMdc)
    files.push('.cursor/rules/p2p-patterns.mdc')
  }

  // 6. QVAC patterns (glob-scoped)
  if (options.modules.includes('qvac')) {
    const qvacMdc = `---
description: QVAC local AI inference patterns - model loading, streaming, tool calling
globs: ["src/ai/**/*.ts", "src/inference/**/*.ts"]
---

# QVAC Patterns

## Always Do
- Always \`unloadModel()\` when done to free memory
- Use \`onProgress\` callback for download UX
- Use \`kvCache: true\` for multi-turn conversations
- Use streaming (\`stream: true\`) for responsive UX

## Model Selection
- General chat: LLAMA_3_2 family
- Tool calling: QWEN_2_5 family (1.7B+ recommended)
- Mobile: 1B variants
- Desktop quality: 3B or 7B variants

## Common Mistakes
- Don't run multiple models simultaneously (memory)
- Don't use Zod refinements (.integer(), .min()) in ToolInput schemas
- Don't send entire conversation history without trimming
`
    await writeFile(join(rulesDir, 'qvac-patterns.mdc'), qvacMdc)
    files.push('.cursor/rules/qvac-patterns.mdc')
  }

  // 7. .cursorignore
  const cursorignore = `# Cursor ignore
node_modules/
dist/
.pear/
*.log
.env*
`
  await writeFile(join(options.outputDir, '.cursorignore'), cursorignore)
  files.push('.cursorignore')

  return { filesWritten: files, warnings: [] }
}

// ─── OpenCode Builder ────────────────────────────────────────────────────────

async function buildOpenCode(
  content: any,
  options: BuildOptions
): Promise<BuildResult> {
  const files: string[] = []

  const openCodeDir = join(options.outputDir, '.opencode')
  await mkdir(join(openCodeDir, 'agents'), { recursive: true })
  await mkdir(join(openCodeDir, 'skills'), { recursive: true })

  // 1. Build opencode.json with skill gating
  const config: any = {
    $schema: 'https://opencode.ai/config.json',
    model: 'anthropic/claude-sonnet-4-5',
    instructions: ['.opencode/instructions.md'],
    default_agent: 'build',
    permission: {
      edit: 'allow',
      bash: {
        'npm *': 'allow', 'pnpm *': 'allow', 'pear *': 'allow',
        'git commit *': 'allow', 'git push *': 'ask'
      },
      // Skill gating: only enable skills relevant to selected modules
      skill: { '*': false }
    },
    formatter: {
      prettier: {
        command: ['npx', 'prettier', '--write', '$FILE'],
        extensions: ['.ts', '.tsx', '.js', '.jsx']
      }
    },
    agent: {}
  }

  // Enable relevant skills based on modules
  const skillModuleMap: Record<string, string[]> = {
    'add-p2p-sync': ['hypercore', 'hyperswarm', 'hyperdb'],
    'local-inference': ['qvac'],
    'qvac-tool-calling': ['qvac'],
    'qvac-chat-app': ['qvac'],
    'file-sharing': ['hyperdrive'],
    'offline-first-app': ['hypercore', 'hyperbee'],
    'p2p-rpc': ['hyperswarm'],
    'secure-communication': ['hyperswarm'],
    'wallet-integration': ['wdk'],
  }

  for (const [skillId, requiredMods] of Object.entries(skillModuleMap)) {
    if (requiredMods.some(m => options.modules.includes(m))) {
      config.permission.skill[skillId] = 'allow'
    }
  }

  // Planning agent (always)
  config.agent['planner'] = {
    description: 'Planning agent - helps create implementation plans before coding',
    mode: 'subagent',
    prompt: '.opencode/agents/planner.md'
  }

  // P2P expert agent
  if (options.modules.some((m: string) => ['hyperswarm', 'hyperdb', 'hyperdrive', 'hypercore'].includes(m))) {
    config.agent['p2p-expert'] = {
      description: 'Expert in P2P patterns, Hypercore, HyperDB, Hyperswarm, Hyperdrive',
      mode: 'subagent',
      prompt: '.opencode/agents/p2p-expert.md'
    }
  }

  // AI expert agent
  if (options.modules.includes('qvac')) {
    config.agent['ai-expert'] = {
      description: 'Expert in QVAC local AI inference, model selection, and tool calling',
      mode: 'subagent',
      prompt: '.opencode/agents/ai-expert.md'
    }
  }

  await writeFile(join(options.outputDir, 'opencode.json'), JSON.stringify(config, null, 2))
  files.push('opencode.json')

  // 2. Build SLIM instructions.md (lazy loading guidance)
  let instructions = `# ${options.projectName}

Build truly unstoppable apps: P2P networking, local-first data, offline AI, and crypto payments.

## Tech Stack
${options.modules.map(m => `- **${m}**`).join('\n')}

## Commands
- \`pnpm dev\` - Start development
- \`pnpm build\` - Build for production
- \`pnpm test\` - Run tests

## Before Building

**You MUST follow this process:**
1. Ask the pre-implementation checklist questions
2. Propose an architecture listing all apps
3. Get user confirmation before writing any code

## Available Agents
${Object.entries(config.agent).map(([name, agent]: [string, any]) => `- \`@${name}\`: ${agent.description}`).join('\n')}

## Available Skills

Use \`/skill-name\` to invoke. Only load skill resources when actively implementing.

${content.skills.map((s: any) => {
    const { data } = parseFrontmatter(s.skillMd)
    return `- \`/${s.id}\` — ${data.description || s.id}`
  }).join('\n')}

## Core Principles

- **Local-first**: Always write locally first, sync is opportunistic
- **P2P**: No central servers — data lives on user devices
- **Offline AI**: Local inference via QVAC, no API calls

## Key Patterns

- Always \`await db.ready()\` / \`core.ready()\` before operations
- Handle peer disconnection gracefully
- Use Hyperswarm topics for discoverability
- Replicate data structures over connections

For detailed module docs and patterns, use the relevant skill or agent.
`

  await writeFile(join(openCodeDir, 'instructions.md'), instructions)
  files.push('.opencode/instructions.md')

  // 3. Write agent files
  await writeFile(join(openCodeDir, 'agents', 'planner.md'), `---
description: Planning agent for creating implementation plans
mode: subagent
---

# Planning Agent

Help create clear, actionable implementation plans in \`planning/\`.

## Process
1. Understand the goal — What are we building?
2. Identify modules — Which stack modules will this use?
3. Break into phases — Logical implementation steps
4. Document patterns — Which skills/recipes apply?
5. Write the plan — Create markdown in \`planning/\`

## Plan Template

\`\`\`markdown
# Feature: [Name]

## Goal
[Clear description]

## Modules Required
- [Module]: [Why]

## Implementation Steps
### Phase 1: [Name]
- [ ] Step 1
- [ ] Step 2

## Skills to Use
- [/skill-name]: [Why]

## Testing Strategy
[How to verify]
\`\`\`
`)
  files.push('.opencode/agents/planner.md')

  if (config.agent['p2p-expert']) {
    await writeFile(join(openCodeDir, 'agents', 'p2p-expert.md'), `---
description: Expert in P2P patterns and Holepunch stack
mode: subagent
---

# P2P Expert Agent

You are an expert in P2P application development with the Holepunch stack.

## Your Knowledge
- Hypercore append-only logs and replication
- HyperDB distributed database with schemas
- Hyperswarm P2P networking and discovery
- Hyperdrive P2P filesystem
- Pear desktop runtime

## Key Patterns
- Always await \`db.ready()\` / \`core.ready()\`
- Handle peer disconnection gracefully
- Use proper replication patterns
- Manage Hyperswarm topics correctly
- Read local data first, sync opportunistically

## When to Use
Call me for P2P data sync, connection debugging, replication setup, or peer discovery issues.
`)
    files.push('.opencode/agents/p2p-expert.md')
  }

  if (config.agent['ai-expert']) {
    await writeFile(join(openCodeDir, 'agents', 'ai-expert.md'), `---
description: Expert in QVAC local AI inference
mode: subagent
---

# AI Expert Agent

You are an expert in local AI inference with QVAC.

## Your Knowledge
- QVAC SDK setup, model loading, streaming
- Model selection (Llama, Qwen families)
- Tool calling with Zod schemas
- KV cache, delegated inference
- Memory management and context overflow

## Key Patterns
- Use streaming for responsive UX
- Always unloadModel() when done
- Use kvCache for multi-turn conversations
- Use Qwen models for tool calling
- Validate constraints in handlers, not Zod schemas

## When to Use
Call me for model setup, inference debugging, tool calling, or performance optimization.
`)
    files.push('.opencode/agents/ai-expert.md')
  }

  // 4. Write skills with resources
  for (const skill of content.skills) {
    const skillDir = join(openCodeDir, 'skills', skill.id)
    await mkdir(skillDir, { recursive: true })
    await writeFile(join(skillDir, 'SKILL.md'), skill.skillMd)
    files.push(`.opencode/skills/${skill.id}/SKILL.md`)

    if (skill.resources.length > 0) {
      const resDir = join(skillDir, 'resources')
      await mkdir(resDir, { recursive: true })
      for (const res of skill.resources) {
        await writeFile(join(resDir, res.name), res.content)
        files.push(`.opencode/skills/${skill.id}/resources/${res.name}`)
      }
    }
  }

  return { filesWritten: files, warnings: [] }
}

// ─── Main ────────────────────────────────────────────────────────────────────

export async function buildAgentPack(options: BuildOptions): Promise<BuildResult> {
  if (options.tool === 'none') {
    return { filesWritten: [], warnings: [] }
  }

  const content = await loadContent(options.template, options.modules)

  switch (options.tool) {
    case 'claude':
      return buildClaude(content, options)
    case 'cursor':
      return buildCursor(content, options)
    case 'opencode':
      return buildOpenCode(content, options)
    default:
      return { filesWritten: [], warnings: ['Unknown tool'] }
  }
}
