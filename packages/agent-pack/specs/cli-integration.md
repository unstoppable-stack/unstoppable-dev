# CLI Integration Specification

## Overview

This document specifies how the `create-unstoppable-app` CLI uses the agent pack to generate tool-specific configurations during project scaffolding.

---

## CLI Flow

```
┌─────────────────────────────────────────────────────────────┐
│  npx create-unstoppable-app my-app                          │
├─────────────────────────────────────────────────────────────┤
│  1. Project name: my-app                                    │
│  2. AI Assistant: [Claude Code | Cursor | OpenCode | None]  │
│  3. Template: [Starter | P2P Sync | QVAC AI | Mobile]       │
│  4. Additional modules: [HyperDB | Hyperdrive | QVAC | WDK] │
├─────────────────────────────────────────────────────────────┤
│  → Scaffold template                                        │
│  → Resolve module dependencies                              │
│  → Build agent pack for selected tool                       │
│  → Write tool-specific config files                         │
│  → Install dependencies                                     │
└─────────────────────────────────────────────────────────────┘
```

---

## Build Function Interface

```typescript
// packages/agent-pack/src/build/index.ts

export interface BuildOptions {
  tool: 'claude' | 'cursor' | 'opencode' | 'none'
  template: 'starter' | 'p2p-sync' | 'qvac-ai' | 'expo-mobile'
  modules: string[]  // User-selected modules
  outputDir: string  // Project directory
  projectName: string
}

export interface BuildResult {
  filesWritten: string[]
  warnings: string[]
}

export async function buildAgentPack(options: BuildOptions): Promise<BuildResult>
```

---

## Build Process Steps

### 1. Resolve Dependencies

```typescript
const MODULE_DEPS: Record<string, string[]> = {
  hyperdb: ['hypercore', 'hyperswarm'],
  hyperdrive: ['hypercore', 'hyperswarm'],
  pear: ['bare'],
  'expo-bare': ['bare'],
  qvac: [],
  wdk: [],
}

function resolveModules(selected: string[]): string[] {
  const resolved = new Set<string>()
  const queue = [...selected]

  while (queue.length > 0) {
    const mod = queue.pop()!
    if (resolved.has(mod)) continue
    resolved.add(mod)
    queue.push(...(MODULE_DEPS[mod] || []))
  }

  return Array.from(resolved)
}
```

### 2. Load Source Content

```typescript
interface Content {
  core: MarkdownFile[]
  modules: MarkdownFile[]
  template: MarkdownFile
  recipes: MarkdownFile[]
  skills: SkillFile[]
}

async function loadContent(
  template: string,
  modules: string[]
): Promise<Content> {
  const resolvedModules = resolveModules(modules)

  return {
    core: await loadGlob('src/core/*.md'),
    modules: await loadByIds('src/modules', resolvedModules),
    template: await loadFile(`src/templates/${template}.md`),
    recipes: await selectRecipes(resolvedModules),
    skills: await loadGlob('src/skills/*/SKILL.md'),
  }
}
```

### 3. Generate Tool-Specific Output

```typescript
async function buildAgentPack(options: BuildOptions): Promise<BuildResult> {
  if (options.tool === 'none') {
    return { filesWritten: [], warnings: [] }
  }

  const content = await loadContent(options.template, options.modules)

  switch (options.tool) {
    case 'claude':
      return generateClaude(content, options)
    case 'cursor':
      return generateCursor(content, options)
    case 'opencode':
      return generateOpenCode(content, options)
  }
}
```

---

## Claude Code Generator

### Output Files

```
project/
├── CLAUDE.md
├── .claude/
│   ├── settings.json
│   ├── rules/
│   │   └── p2p-patterns.md      # If has P2P modules
│   └── skills/
│       ├── add-hyperdb/SKILL.md
│       ├── add-p2p-sync/SKILL.md
│       └── ...
├── .mcp.json                     # Optional
└── .gitignore                    # Updated
```

### Generator Implementation

```typescript
async function generateClaude(
  content: Content,
  options: BuildOptions
): Promise<BuildResult> {
  const files: string[] = []

  // 1. Build CLAUDE.md
  const claudeMd = buildClaudeMd(content, options)
  await writeFile(join(options.outputDir, 'CLAUDE.md'), claudeMd)
  files.push('CLAUDE.md')

  // 2. Create .claude directory
  const claudeDir = join(options.outputDir, '.claude')
  await mkdir(claudeDir, { recursive: true })

  // 3. Write settings.json
  const settings = buildClaudeSettings(options)
  await writeFile(join(claudeDir, 'settings.json'), JSON.stringify(settings, null, 2))
  files.push('.claude/settings.json')

  // 4. Write path-scoped rules
  const pathRules = extractPathScopedContent(content)
  for (const rule of pathRules) {
    const rulePath = join(claudeDir, 'rules', `${rule.id}.md`)
    await writeFile(rulePath, buildPathRule(rule))
    files.push(`.claude/rules/${rule.id}.md`)
  }

  // 5. Copy skills
  for (const skill of content.skills) {
    const skillDir = join(claudeDir, 'skills', skill.name)
    await mkdir(skillDir, { recursive: true })
    await writeFile(join(skillDir, 'SKILL.md'), skill.content)
    files.push(`.claude/skills/${skill.name}/SKILL.md`)
  }

  // 6. Update .gitignore
  await appendGitignore(options.outputDir, [
    '.claude/settings.local.json',
  ])

  return { filesWritten: files, warnings: [] }
}

function buildClaudeSettings(options: BuildOptions): object {
  return {
    permissions: {
      allow: [
        'Bash(npm *)',
        'Bash(pnpm *)',
        'Bash(pear *)',
        'Bash(git add *)',
        'Bash(git commit *)',
      ],
      ask: [
        'Bash(git push *)',
      ],
      deny: [
        'Read(.env*)',
        'Edit(.env*)',
      ],
    },
    hooks: {
      PostToolUse: [
        {
          matcher: 'Edit|Write',
          hooks: [{
            type: 'command',
            command: 'npx prettier --write "$FILE" 2>/dev/null || true',
          }],
        },
      ],
    },
  }
}
```

---

## Cursor Generator

### Output Files

```
project/
├── .cursor/
│   ├── rules/
│   │   ├── project.mdc          # Always apply
│   │   ├── code-style.mdc
│   │   ├── p2p-patterns.mdc     # Glob-scoped
│   │   └── <module>.mdc         # Per selected module
│   └── mcp.json                  # Optional
├── .cursorignore
└── AGENTS.md                     # Optional simple reference
```

### Generator Implementation

```typescript
async function generateCursor(
  content: Content,
  options: BuildOptions
): Promise<BuildResult> {
  const files: string[] = []
  const rulesDir = join(options.outputDir, '.cursor', 'rules')
  await mkdir(rulesDir, { recursive: true })

  // 1. Build project.mdc (always apply)
  const projectMdc = buildProjectMdc(content, options)
  await writeFile(join(rulesDir, 'project.mdc'), projectMdc)
  files.push('.cursor/rules/project.mdc')

  // 2. Build code-style.mdc
  const styleMdc = buildCodeStyleMdc()
  await writeFile(join(rulesDir, 'code-style.mdc'), styleMdc)
  files.push('.cursor/rules/code-style.mdc')

  // 3. Build glob-scoped rules
  const pathRules = extractPathScopedContent(content)
  for (const rule of pathRules) {
    const mdcContent = buildCursorMdc(rule)
    await writeFile(join(rulesDir, `${rule.id}.mdc`), mdcContent)
    files.push(`.cursor/rules/${rule.id}.mdc`)
  }

  // 4. Build per-module rules (if substantial)
  for (const mod of content.modules) {
    if (mod.content.length > 500) {
      const mdcContent = buildModuleMdc(mod)
      await writeFile(join(rulesDir, `${mod.id}.mdc`), mdcContent)
      files.push(`.cursor/rules/${mod.id}.mdc`)
    }
  }

  // 5. Create .cursorignore
  await writeFile(join(options.outputDir, '.cursorignore'), CURSOR_IGNORE)
  files.push('.cursorignore')

  return { filesWritten: files, warnings: [] }
}

function buildProjectMdc(content: Content, options: BuildOptions): string {
  return `---
description: ${options.projectName} - Unstoppable Stack project
alwaysApply: true
---

# ${options.projectName}

${content.template.content}

## Tech Stack
${content.modules.map(m => `- **${m.name}**: ${m.description}`).join('\n')}

## Commands
- \`pnpm dev\` - Start development
- \`pnpm build\` - Build for production
- \`pnpm test\` - Run tests
${options.template === 'starter' || options.template === 'qvac-ai' ? '- `pear stage` - Stage Pear app' : ''}

## Key Patterns
${extractKeyPatterns(content.core)}
`
}

function buildCursorMdc(rule: PathRule): string {
  return `---
description: ${rule.description}
globs: ${JSON.stringify(rule.paths)}
---

${rule.content}
`
}

const CURSOR_IGNORE = `# Cursor ignore
node_modules/
dist/
.pear/
*.log
.env*
`
```

---

## OpenCode Generator

### Output Files

```
project/
├── opencode.json
├── .opencode/
│   ├── instructions.md
│   ├── agents/
│   │   └── p2p-expert.md        # If has P2P modules
│   └── skills/
│       ├── add-hyperdb/SKILL.md
│       ├── add-p2p-sync/SKILL.md
│       └── ...
└── .gitignore                    # Updated
```

### Generator Implementation

```typescript
async function generateOpenCode(
  content: Content,
  options: BuildOptions
): Promise<BuildResult> {
  const files: string[] = []
  const openCodeDir = join(options.outputDir, '.opencode')

  // 1. Build opencode.json
  const config = buildOpenCodeConfig(content, options)
  await writeFile(
    join(options.outputDir, 'opencode.json'),
    JSON.stringify(config, null, 2)
  )
  files.push('opencode.json')

  // 2. Create directories
  await mkdir(join(openCodeDir, 'agents'), { recursive: true })
  await mkdir(join(openCodeDir, 'skills'), { recursive: true })

  // 3. Build instructions.md
  const instructions = buildInstructions(content, options)
  await writeFile(join(openCodeDir, 'instructions.md'), instructions)
  files.push('.opencode/instructions.md')

  // 4. Build custom agents
  if (hasP2PModules(options.modules)) {
    const p2pAgent = buildP2PExpertAgent(content)
    await writeFile(join(openCodeDir, 'agents', 'p2p-expert.md'), p2pAgent)
    files.push('.opencode/agents/p2p-expert.md')
  }

  if (options.modules.includes('qvac')) {
    const qvacAgent = buildQvacExpertAgent(content)
    await writeFile(join(openCodeDir, 'agents', 'inference-expert.md'), qvacAgent)
    files.push('.opencode/agents/inference-expert.md')
  }

  // 5. Copy skills
  for (const skill of content.skills) {
    const skillDir = join(openCodeDir, 'skills', skill.name)
    await mkdir(skillDir, { recursive: true })
    await writeFile(join(skillDir, 'SKILL.md'), skill.content)
    files.push(`.opencode/skills/${skill.name}/SKILL.md`)
  }

  return { filesWritten: files, warnings: [] }
}

function buildOpenCodeConfig(content: Content, options: BuildOptions): object {
  const config: any = {
    $schema: 'https://opencode.ai/config.json',
    model: 'anthropic/claude-sonnet-4-5',
    instructions: '.opencode/instructions.md',
    default_agent: 'build',
    permission: {
      edit: 'allow',
      bash: {
        'npm *': 'allow',
        'pnpm *': 'allow',
        'pear *': 'allow',
        'git commit *': 'allow',
        'git push *': 'ask',
      },
      skill: { '*': 'allow' },
    },
    formatter: {
      '*.ts': 'npx prettier --write',
      '*.tsx': 'npx prettier --write',
      '*.js': 'npx prettier --write',
    },
  }

  // Add custom agents
  if (hasP2PModules(options.modules)) {
    config.agent = config.agent || {}
    config.agent['p2p-expert'] = {
      description: 'Expert in P2P patterns, Hypercore, HyperDB, Hyperswarm',
      mode: 'subagent',
      prompt: '.opencode/agents/p2p-expert.md',
    }
  }

  if (options.modules.includes('qvac')) {
    config.agent = config.agent || {}
    config.agent['inference-expert'] = {
      description: 'Expert in QVAC local AI inference',
      mode: 'subagent',
      prompt: '.opencode/agents/inference-expert.md',
    }
  }

  return config
}
```

---

## CLI Integration Point

```typescript
// packages/cli/src/scaffold.ts

import { buildAgentPack, type BuildOptions } from '@unstoppable/agent-pack'

interface ScaffoldOptions {
  projectName: string
  template: string
  modules: string[]
  assistant: 'claude' | 'cursor' | 'opencode' | 'none'
}

async function scaffold(options: ScaffoldOptions): Promise<void> {
  const projectDir = join(process.cwd(), options.projectName)

  // 1. Copy template files
  await copyTemplate(options.template, projectDir)

  // 2. Process package.json
  await processPackageJson(projectDir, options)

  // 3. Build agent pack
  const agentResult = await buildAgentPack({
    tool: options.assistant,
    template: options.template as any,
    modules: options.modules,
    outputDir: projectDir,
    projectName: options.projectName,
  })

  // 4. Install dependencies
  await installDependencies(projectDir)

  // 5. Print summary
  console.log(`
Created ${options.projectName}

${agentResult.filesWritten.length > 0 ? `
AI Assistant configured (${options.assistant}):
${agentResult.filesWritten.map(f => `  ✓ ${f}`).join('\n')}
` : ''}
Next steps:
  cd ${options.projectName}
  pnpm dev
`)
}
```

---

## Testing Strategy

```typescript
// packages/agent-pack/src/build/__tests__/build.test.ts

describe('buildAgentPack', () => {
  it('generates Claude Code config', async () => {
    const result = await buildAgentPack({
      tool: 'claude',
      template: 'starter',
      modules: ['hyperdb'],
      outputDir: tmpDir,
      projectName: 'test-app',
    })

    expect(result.filesWritten).toContain('CLAUDE.md')
    expect(result.filesWritten).toContain('.claude/settings.json')

    const claudeMd = await readFile(join(tmpDir, 'CLAUDE.md'), 'utf-8')
    expect(claudeMd).toContain('HyperDB')
    expect(claudeMd).toContain('Hypercore') // dependency
  })

  it('generates Cursor config', async () => {
    const result = await buildAgentPack({
      tool: 'cursor',
      template: 'starter',
      modules: ['hyperdb'],
      outputDir: tmpDir,
      projectName: 'test-app',
    })

    expect(result.filesWritten).toContain('.cursor/rules/project.mdc')

    const projectMdc = await readFile(
      join(tmpDir, '.cursor/rules/project.mdc'),
      'utf-8'
    )
    expect(projectMdc).toContain('alwaysApply: true')
  })

  it('generates OpenCode config', async () => {
    const result = await buildAgentPack({
      tool: 'opencode',
      template: 'starter',
      modules: ['hyperdb'],
      outputDir: tmpDir,
      projectName: 'test-app',
    })

    expect(result.filesWritten).toContain('opencode.json')
    expect(result.filesWritten).toContain('.opencode/instructions.md')

    const config = JSON.parse(
      await readFile(join(tmpDir, 'opencode.json'), 'utf-8')
    )
    expect(config.agent['p2p-expert']).toBeDefined()
  })

  it('skips agent pack when tool is none', async () => {
    const result = await buildAgentPack({
      tool: 'none',
      template: 'starter',
      modules: ['hyperdb'],
      outputDir: tmpDir,
      projectName: 'test-app',
    })

    expect(result.filesWritten).toHaveLength(0)
  })
})
```

---

## Package Structure

```
packages/agent-pack/
├── package.json
├── tsconfig.json
├── AGENT_PACK_SPEC.md
├── specs/                    # This specification
├── src/
│   ├── core/                # Canonical content
│   ├── modules/
│   ├── recipes/
│   ├── templates/
│   ├── skills/
│   └── build/               # Build system
│       ├── index.ts         # Main export
│       ├── types.ts
│       ├── content.ts       # Content loading
│       ├── claude.ts        # Claude generator
│       ├── cursor.ts        # Cursor generator
│       ├── opencode.ts      # OpenCode generator
│       └── __tests__/
└── dist/                    # Compiled output
```

### Package.json

```json
{
  "name": "@unstoppable/agent-pack",
  "version": "0.1.0",
  "exports": {
    ".": "./dist/build/index.js"
  },
  "scripts": {
    "build": "tsup src/build/index.ts --format esm,cjs --dts",
    "test": "vitest"
  },
  "dependencies": {
    "gray-matter": "^4.0.3",
    "glob": "^10.0.0"
  }
}
```
