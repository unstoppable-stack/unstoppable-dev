import { mkdir, readFile, writeFile, readdir } from 'fs/promises'
import { existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import type { AssistantId, TemplateId } from '../constants.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Path to agent pack source (in package root, not in dist)
const AGENT_PACK_SRC = join(__dirname, '..', 'agent-pack-src')

export interface BuildOptions {
  tool: AssistantId
  template: TemplateId
  outputDir: string
  projectName: string
}

export interface BuildResult {
  filesWritten: string[]
  warnings: string[]
}

// ─── Content Loading ─────────────────────────────────────────────────────────

async function loadContent() {
  const content = {
    modules: [] as { id: string; content: string }[],
    recipes: [] as { id: string; content: string }[],
    core: [] as { id: string; content: string }[],
    skills: [] as { id: string; skillMd: string; resources: { name: string; content: string }[] }[],
    hooks: {
      skillRules: null as any,
    }
  }

  const isRule = (f: string) => f.endsWith('.md') || f.endsWith('.mdc')
  const stripExt = (f: string) => f.replace(/\.mdc?$/, '')

  // Load ALL modules
  const modulesDir = join(AGENT_PACK_SRC, 'modules')
  if (existsSync(modulesDir)) {
    const moduleFiles = await readdir(modulesDir)
    for (const file of moduleFiles.filter(isRule)) {
      content.modules.push({
        id: stripExt(file),
        content: await readFile(join(modulesDir, file), 'utf-8')
      })
    }
  }

  // Load ALL recipes
  const recipesDir = join(AGENT_PACK_SRC, 'recipes')
  if (existsSync(recipesDir)) {
    const recipes = await readdir(recipesDir)
    for (const recipe of recipes.filter(isRule)) {
      content.recipes.push({
        id: stripExt(recipe),
        content: await readFile(join(recipesDir, recipe), 'utf-8')
      })
    }
  }

  // Load ALL core
  const coreDir = join(AGENT_PACK_SRC, 'core')
  if (existsSync(coreDir)) {
    const coreFiles = await readdir(coreDir)
    for (const file of coreFiles.filter(isRule)) {
      content.core.push({
        id: stripExt(file),
        content: await readFile(join(coreDir, file), 'utf-8')
      })
    }
  }

  // Load ALL skills (thin SKILL.md + resources/)
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

// ─── Claude Code Builder ─────────────────────────────────────────────────────

async function buildClaude(
  content: any,
  options: BuildOptions
): Promise<BuildResult> {
  const files: string[] = []

  // 1. Build SLIM CLAUDE.md
  let claudeMd = `# ${options.projectName}

## Overview
This is an Unstoppable Stack project using the ${options.template} template.

Build truly unstoppable apps: P2P networking, local-first data, offline AI, and crypto payments — all without centralized servers.

## Commands
- \`npm run dev\` - Start development
- \`npm run build\` - Build for production
- \`npm test\` - Run tests

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

## Available Agents

Delegate to specialized agents for domain-specific tasks:

- \`@p2p-expert\` — P2P patterns, Hypercore, HyperDB, Hyperswarm, Hyperdrive
- \`@ai-expert\` — QVAC local AI inference, model selection, tool calling
- \`@planner\` — Implementation plans and architecture decisions

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
For specialized agents, see \`.claude/agents/\`.
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
        'Bash(npm:*)', 'Bash(pnpm:*)', 'Bash(bun:*)', 'Bash(pear:*)',
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

  // 5. Write ALL module docs as path-scoped rules (each module gets its own paths)
  const claudeModulePaths: Record<string, string[]> = {
    hyperdb: ['src/data/**/*.ts', 'src/db/**/*.ts'],
    hyperdrive: ['src/files/**/*.ts', 'src/storage/**/*.ts'],
    hyperswarm: ['src/p2p/**/*.ts', 'src/network/**/*.ts'],
    hypercore: ['src/data/**/*.ts', 'src/p2p/**/*.ts'],
    hyperbee: ['src/data/**/*.ts', 'src/db/**/*.ts'],
    hyperdht: ['src/p2p/**/*.ts', 'src/network/**/*.ts'],
    corestore: ['src/data/**/*.ts'],
    qvac: ['src/ai/**/*.ts', 'src/inference/**/*.ts'],
    wdk: ['src/wallet/**/*.ts', 'src/payments/**/*.ts'],
    pear: ['index.js', 'index.html', 'src/ui/**/*.ts', 'src/components/**/*.tsx'],
    bare: ['src/**/*.ts', 'worker/**/*.ts', 'bare/**/*.js'],
    'expo-bare': ['app/**/*.tsx', 'bare/**/*.js', 'src/**/*.ts'],
  }

  for (const mod of content.modules) {
    const body = stripFrontmatter(mod.content)
    const paths = claudeModulePaths[mod.id] || ['src/**/*.ts']
    const pathLines = paths.map(p => `  - "${p}"`).join('\n')
    const pathScoped = `---
paths:
${pathLines}
---

${body}
`
    await writeFile(join(claudeDir, 'rules', `module-${mod.id}.md`), pathScoped)
    files.push(`.claude/rules/module-${mod.id}.md`)
  }

  // 6. Write ALL skills with resources (progressive disclosure)
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

  // 7. Write custom subagents (.claude/agents/)
  const agentsDir = join(claudeDir, 'agents')
  await mkdir(agentsDir, { recursive: true })

  await writeFile(join(agentsDir, 'p2p-expert.md'), `# P2P Expert Agent

You are an expert in P2P application development with the Holepunch stack.

## Your Knowledge
- Hypercore append-only logs and replication
- HyperDB distributed database with schemas
- Hyperswarm P2P networking and discovery
- Hyperdrive P2P filesystem
- Pear desktop and terminal runtime

## Key Patterns
- Always await \`db.ready()\` / \`core.ready()\`
- Handle peer disconnection gracefully
- Use proper replication patterns (replicate both sides, await swarm.flush())
- Manage Hyperswarm topics correctly
- Use Corestore for multi-core management
- Don't block on peer discovery — read local data first

## When to Use
The user should delegate to you for P2P data sync, connection debugging, replication setup, or peer discovery issues.
`)
  files.push('.claude/agents/p2p-expert.md')

  await writeFile(join(agentsDir, 'ai-expert.md'), `# AI Expert Agent

You are an expert in local AI inference with QVAC.

## Your Knowledge
- QVAC SDK setup, model loading, streaming
- Model selection (Llama 3.2 for chat, Qwen 3 for tool calling)
- Tool calling with Zod schemas (no refinements)
- KV cache for multi-turn conversations
- Memory management and context overflow
- Mobile considerations (static imports, Expo runtime)

## Key Patterns
- Use streaming for responsive UX
- Always \`unloadModel()\` when done
- Use \`kvCache: sessionId\` for multi-turn conversations
- Use Qwen models for tool calling (\`tools: true\` in modelConfig)
- Validate constraints in handlers, not Zod schemas

## When to Use
The user should delegate to you for model setup, inference debugging, tool calling patterns, or performance optimization.
`)
  files.push('.claude/agents/ai-expert.md')

  await writeFile(join(agentsDir, 'planner.md'), `# Planning Agent

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
  files.push('.claude/agents/planner.md')

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

## Commands
- \`npm run dev\` - Start development
- \`npm run build\` - Build for production
- \`npm test\` - Run tests

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

  // 3. ALL module docs with specific descriptions and file globs
  const moduleGlobs: Record<string, string[]> = {
    hyperdb: ['src/data/**/*.ts', 'src/db/**/*.ts'],
    hyperdrive: ['src/files/**/*.ts', 'src/storage/**/*.ts'],
    hyperswarm: ['src/p2p/**/*.ts', 'src/network/**/*.ts'],
    hypercore: ['src/data/**/*.ts', 'src/p2p/**/*.ts'],
    hyperbee: ['src/data/**/*.ts', 'src/db/**/*.ts'],
    corestore: ['src/data/**/*.ts'],
    qvac: ['src/ai/**/*.ts', 'src/inference/**/*.ts'],
    wdk: ['src/wallet/**/*.ts', 'src/payments/**/*.ts'],
    pear: ['index.html', 'app.js', 'src/ui/**/*.ts', 'src/components/**/*.tsx'],
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

  // 4. ALL skills as description-triggered rules + their resources
  for (const skill of content.skills) {
    const { data, body } = parseFrontmatter(skill.skillMd)
    const skillMdc = `---
description: Skill - ${data.description || skill.id}
---

${body}
`
    await writeFile(join(rulesDir, `skill-${skill.id}.mdc`), skillMdc)
    files.push(`.cursor/rules/skill-${skill.id}.mdc`)

    // Write skill resources as separate .mdc files so Cursor can find them
    for (const res of skill.resources) {
      const resName = res.name.replace('.md', '')
      const resBody = stripFrontmatter(res.content)
      const resMdc = `---
description: ${skill.id} skill resource - ${resName} (detailed reference, examples, and troubleshooting)
---

${resBody}
`
      await writeFile(join(rulesDir, `skill-${skill.id}-${resName}.mdc`), resMdc)
      files.push(`.cursor/rules/skill-${skill.id}-${resName}.mdc`)
    }
  }

  // 5. P2P patterns (glob-scoped)
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

  // 6. QVAC patterns (glob-scoped)
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
- Tool calling: QWEN_3 family (3B+ recommended)
- Mobile: 1B variants
- Desktop quality: 3B or 7B variants

## Common Mistakes
- Don't run multiple models simultaneously (memory)
- Don't use Zod refinements (.integer(), .min()) in ToolInput schemas
- Don't send entire conversation history without trimming
`
  await writeFile(join(rulesDir, 'qvac-patterns.mdc'), qvacMdc)
  files.push('.cursor/rules/qvac-patterns.mdc')

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

  // 1. Build opencode.json — all skills enabled
  const config: any = {
    $schema: 'https://opencode.ai/config.json',
    model: 'anthropic/claude-sonnet-4-5',
    instructions: ['.opencode/instructions.md'],
    default_agent: 'build',
    permission: {
      edit: 'allow',
      bash: {
        'npm *': 'allow', 'pnpm *': 'allow', 'bun *': 'allow', 'pear *': 'allow',
        'git commit *': 'allow', 'git push *': 'ask'
      },
      skill: { '*': 'allow' }
    },
    formatter: {
      prettier: {
        command: ['npx', 'prettier', '--write', '$FILE'],
        extensions: ['.ts', '.tsx', '.js', '.jsx']
      }
    },
    agent: {}
  }

  // Always include all agents
  config.agent['planner'] = {
    description: 'Planning agent - helps create implementation plans before coding',
    mode: 'subagent',
    prompt: '.opencode/agents/planner.md'
  }

  config.agent['p2p-expert'] = {
    description: 'Expert in P2P patterns, Hypercore, HyperDB, Hyperswarm, Hyperdrive',
    mode: 'subagent',
    prompt: '.opencode/agents/p2p-expert.md'
  }

  config.agent['ai-expert'] = {
    description: 'Expert in QVAC local AI inference, model selection, and tool calling',
    mode: 'subagent',
    prompt: '.opencode/agents/ai-expert.md'
  }

  await writeFile(join(options.outputDir, 'opencode.json'), JSON.stringify(config, null, 2))
  files.push('opencode.json')

  // 2. Build SLIM instructions.md
  let instructions = `# ${options.projectName}

Build truly unstoppable apps: P2P networking, local-first data, offline AI, and crypto payments.

## Commands
- \`npm run dev\` - Start development
- \`npm run build\` - Build for production
- \`npm test\` - Run tests

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
- Pear desktop and terminal runtime

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

  // 4. Write ALL skills with resources
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

// ─── Codex Builder ──────────────────────────────────────────────────────────

async function buildCodex(
  content: any,
  options: BuildOptions
): Promise<BuildResult> {
  const files: string[] = []

  // Codex uses AGENTS.md as its primary config. It auto-discovers AGENTS.md
  // files in subdirectories. No .codex/ config files needed.

  // 1. Build comprehensive root AGENTS.md
  // Codex can't progressively load skills, so we inline more context here.
  const coreContent = content.core.map((c: any) => stripFrontmatter(c.content)).join('\n\n---\n\n')

  const skillList = content.skills.map((s: any) => {
    const { data } = parseFrontmatter(s.skillMd)
    return `- **${s.id}** — ${data.description || s.id}`
  }).join('\n')

  let agentsMd = `# ${options.projectName}

## Overview
This is an Unstoppable Stack project using the ${options.template} template.

Build truly unstoppable apps: P2P networking, local-first data, offline AI, and crypto payments — all without centralized servers.

## Commands
- \`npm run dev\` - Start development
- \`npm run build\` - Build for production
- \`npm test\` - Run tests

## Project Structure
\`\`\`
├── planning/         # Architecture decisions & feature plans
├── src/              # Application source code
│   ├── app/          # Application logic
│   ├── p2p/          # P2P networking (see src/p2p/AGENTS.md)
│   ├── data/         # Database/storage (see src/data/AGENTS.md)
│   ├── ai/           # AI inference (see src/ai/AGENTS.md)
│   └── ui/           # UI components
└── README.md
\`\`\`

## Before Building

**You MUST follow this process:**

1. **Ask the pre-implementation checklist questions** (see Core Principles below)
2. **Propose an architecture** listing all apps to be created
3. **Get user confirmation** before writing any code
4. **Create each app** with its own folder and README

## Available Implementation Guides

${skillList}

## P2P Development Rules

- Always await \`db.ready()\` / \`core.ready()\` before operations
- Handle peer disconnection gracefully (\`conn.on('close')\`, \`conn.on('error')\`)
- Use Hyperswarm topics for discoverability
- Replicate data structures over connections
- Use \`swarm.flush()\` before reading on the consumer side
- Don't store large blobs in HyperDB (use Hyperdrive)
- Don't hardcode discovery keys
- Don't forget to close connections on cleanup
- Don't block app startup waiting for peers — read local data first

## QVAC (Local AI) Rules

- Always \`unloadModel()\` when done to free memory
- Use \`onProgress\` callback for download UX
- Use \`kvCache: sessionId\` for multi-turn conversations
- Set \`tools: true\` in \`modelConfig\` when using tool-calling models
- Use streaming (\`stream: true\`) for responsive UX
- Don't run multiple models simultaneously (memory)
- Don't use Zod refinements (\`.integer()\`, \`.min()\`) in ToolInput schemas

---

## Core Principles

${coreContent}

---

See directory-scoped \`AGENTS.md\` files in \`src/p2p/\`, \`src/data/\`, and \`src/ai/\` for module-specific guidance.
`

  await writeFile(join(options.outputDir, 'AGENTS.md'), agentsMd)
  files.push('AGENTS.md')

  // 2. Create directory-scoped AGENTS.md files for auto-discovery
  // Codex finds these automatically when working in these directories.
  const scopedDirs: Record<string, { modules: string[], description: string }> = {
    'src/p2p': {
      modules: ['hyperswarm', 'hypercore', 'hyperdht', 'corestore'],
      description: 'P2P Networking'
    },
    'src/data': {
      modules: ['hyperdb', 'hyperbee', 'hyperdrive'],
      description: 'Data & Storage'
    },
    'src/ai': {
      modules: ['qvac'],
      description: 'AI Inference'
    },
    'src/wallet': {
      modules: ['wdk'],
      description: 'Wallet & Payments'
    }
  }

  for (const [dir, config] of Object.entries(scopedDirs)) {
    const dirModules = content.modules.filter((m: any) => config.modules.includes(m.id))
    if (dirModules.length === 0) continue

    const moduleContent = dirModules.map((m: any) => stripFrontmatter(m.content)).join('\n\n---\n\n')
    const dirAgentsMd = `# ${config.description}

${moduleContent}
`
    const fullDir = join(options.outputDir, dir)
    await mkdir(fullDir, { recursive: true })
    await writeFile(join(fullDir, 'AGENTS.md'), dirAgentsMd)
    files.push(`${dir}/AGENTS.md`)
  }

  return { filesWritten: files, warnings: [] }
}

// ─── Main ────────────────────────────────────────────────────────────────────

export async function buildAgentPack(options: BuildOptions): Promise<BuildResult> {
  if (options.tool === 'none') {
    return { filesWritten: [], warnings: [] }
  }

  const content = await loadContent()

  switch (options.tool) {
    case 'claude':
      return buildClaude(content, options)
    case 'cursor':
      return buildCursor(content, options)
    case 'opencode':
      return buildOpenCode(content, options)
    case 'codex':
      return buildCodex(content, options)
    default:
      return { filesWritten: [], warnings: ['Unknown tool'] }
  }
}
