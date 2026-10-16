# Agent Pack Specification

## Overview

The Agent Pack provides AI coding assistants with the knowledge to build apps on the Unstoppable Stack. It's designed to be **portable** across Claude Code, Cursor, and OpenCode.

## Architecture

The agent pack is structured as a **Cursor plugin** (the most structured format) while remaining portable to Claude Code and OpenCode. The `.cursor-plugin/plugin.json` manifest maps content to Cursor's component types.

```
agent-pack/
├── .cursor-plugin/
│   └── plugin.json          # Cursor plugin manifest
├── AGENT_PACK_SPEC.md       # This file
├── README.md                # Plugin documentation
├── src/                     # Canonical source
│   ├── core/                # Always-on rules (.mdc)
│   │   ├── architecture.mdc
│   │   ├── principles.mdc
│   │   ├── cheatsheet.mdc
│   │   ├── verified-versions.mdc
│   │   ├── patterns.mdc
│   │   ├── design-guide.mdc
│   │   ├── production-readiness.mdc
│   │   └── scenarios.mdc
│   ├── modules/             # Per-module rules (.mdc, agent-decided)
│   │   ├── hyperswarm.mdc
│   │   ├── qvac.mdc
│   │   ├── pear.mdc
│   │   └── ...
│   ├── recipes/             # Pattern rules (.mdc, agent-decided)
│   │   ├── p2p-rpc.mdc
│   │   ├── local-inference.mdc
│   │   ├── qvac-tool-calling.mdc
│   │   └── ...
│   ├── skills/              # Guided workflows (SKILL.md + resources/)
│   │   ├── local-inference/
│   │   ├── pear-desktop-app/
│   │   ├── add-p2p-sync/
│   │   └── ...
│   ├── hooks/               # Legacy skill-rules.json
│   └── components/          # Reusable TypeScript code for scaffolding
│       ├── ai/
│       ├── p2p/
│       ├── data/
│       └── wallet/
├── agents/                  # Custom agent configurations
│   └── unstoppable-dev.md
├── commands/                # Agent-executable commands
│   ├── scaffold-p2p-app.md
│   ├── add-qvac.md
│   └── add-p2p-sync.md
├── hooks/
│   └── hooks.json           # Cursor plugin hook definitions
└── scripts/                 # Build and utility scripts
```

---

## Source Format

### Rules (.mdc files)

Rules in `src/core/`, `src/modules/`, and `src/recipes/` use Cursor-compatible YAML frontmatter:

```markdown
---
description: HyperDB: P2P key-value database with schema, indexes, and multi-writer support
alwaysApply: false
---

# HyperDB

## What It Does
P2P key-value database built on Hypercore...
```

### Rule Frontmatter Fields

| Field | Required | Description |
|-------|----------|-------------|
| `description` | Yes | Brief description (used by Cursor for agent-decided activation) |
| `alwaysApply` | Yes | `true` for core rules, `false` for contextual ones |
| `globs` | No | File patterns for automatic activation (e.g., `"**/*.ts"`) |

### Skills (SKILL.md files)

Skills in `src/skills/*/SKILL.md` use skill-specific frontmatter:

```markdown
---
name: local-inference
description: Add local AI inference using QVAC SDK with streaming token output
---

# Local AI Inference
...
```

### Agents and Commands

Agents (`agents/*.md`) and commands (`commands/*.md`) use name/description frontmatter:

```markdown
---
name: unstoppable-dev
description: Specialized agent for building P2P, local-first applications
---
```

---

## Target Formats

### Claude Code

**Output:** `CLAUDE.md` in project root + optional `.claude/` folder

```
project/
├── CLAUDE.md              # Main instructions
└── .claude/
    └── docs/              # Extended docs (if large)
        ├── modules/
        └── recipes/
```

**CLAUDE.md Structure:**
```markdown
# Project Name

## Overview
[From template context]

## Architecture
[From core/architecture.md]

## Stack Modules
[Concatenated from relevant modules/*.md]

## Recipes
[Concatenated from relevant recipes/*.md]

## Coding Guidelines
[From core/principles.md + core/patterns.md]
```

**Build rules:**
- Concatenate all relevant markdown into single CLAUDE.md
- If > 50KB, split into `.claude/docs/` and reference from main file
- Include only modules selected during CLI scaffold

---

### Cursor (Plugin)

**Primary distribution**: Cursor Marketplace plugin (this repo IS the plugin).

Users install the plugin from the marketplace, which provides all rules, skills, agents, commands, and hooks automatically. No build step needed for Cursor — the `.cursor-plugin/plugin.json` manifest handles discovery.

**Secondary distribution**: CLI scaffolding copies selected content into the project.

```
project/
└── .cursor/
    └── rules/             # Selected rules copied by CLI
        ├── principles.mdc
        ├── verified-versions.mdc
        └── [module-specific rules]
```

---

### OpenCode

**Output:** `opencode.json` + `skills/` folder

```
project/
├── opencode.json          # Agent configuration
└── .opencode/
    └── skills/
        ├── add-p2p-sync.md
        ├── add-inference.md
        └── explain-architecture.md
```

**opencode.json Structure:**
```json
{
  "name": "unstoppable-stack",
  "version": "1.0.0",
  "description": "Unstoppable Stack project assistant",
  "agent": {
    "instructions": "You are helping build an Unstoppable Stack app...",
    "context": [
      ".opencode/skills/*.md"
    ]
  },
  "skills": [
    {
      "name": "add-p2p-sync",
      "description": "Add P2P data synchronization to the app",
      "file": ".opencode/skills/add-p2p-sync.md"
    }
  ]
}
```

**Skill File Format:**
```markdown
# Add P2P Sync

## Description
Adds HyperDB-based P2P data synchronization to your app.

## Steps
1. Install dependencies
2. Create data store
3. Set up replication
4. Add to app initialization

## Code
[Full implementation code]

## Verification
- Check that peers can discover each other
- Verify data syncs between devices
```

**Build rules:**
- Split into discrete skills (actionable tasks)
- Each skill is self-contained
- Include step-by-step instructions
- Skills map to recipes

---

## Build Process

### CLI Integration

The CLI runs the build during scaffold:

```typescript
// packages/cli/src/scaffold.ts
import { buildAgentPack } from '@unstoppable/agent-pack'

async function scaffold(options: ScaffoldOptions) {
  // ... scaffold template

  // Build agent pack for selected tool
  await buildAgentPack({
    tool: options.assistant,      // 'claude' | 'cursor' | 'opencode'
    template: options.template,   // 'starter' | 'qvac-ai' | etc
    modules: options.modules,     // ['hyperdb', 'qvac', ...]
    outputDir: projectPath,
  })
}
```

### Build Script

```typescript
// packages/agent-pack/build/index.ts
import { glob } from 'glob'
import matter from 'gray-matter'
import { marked } from 'marked'

interface BuildOptions {
  tool: 'claude' | 'cursor' | 'opencode'
  template: string
  modules: string[]
  outputDir: string
}

export async function buildAgentPack(options: BuildOptions) {
  // 1. Load core files (always included)
  const core = await loadCategory('core')

  // 2. Load selected modules
  const modules = await loadModules(options.modules)

  // 3. Load template-specific context
  const template = await loadTemplate(options.template)

  // 4. Load relevant recipes
  const recipes = await loadRecipesForModules(options.modules)

  // 5. Generate tool-specific output
  switch (options.tool) {
    case 'claude':
      await generateClaude({ core, modules, template, recipes }, options.outputDir)
      break
    case 'cursor':
      await generateCursor({ core, modules, template, recipes }, options.outputDir)
      break
    case 'opencode':
      await generateOpenCode({ core, modules, template, recipes }, options.outputDir)
      break
  }
}
```

---

## Content Guidelines

### Writing Style

1. **Be direct** - No fluff, get to the code
2. **Be practical** - Working examples over theory
3. **Be specific** - Reference actual APIs and patterns
4. **Be current** - Keep versions updated

### Code Examples

- Use TypeScript for all examples
- Include imports
- Keep examples minimal but complete
- Add comments for non-obvious parts

### Structure

Each document should have:
1. **What it is** (1-2 sentences)
2. **When to use it** (bullet points)
3. **Quick start** (minimal code)
4. **Details** (as needed)
5. **Gotchas** (common mistakes)

---

## Module Selection Logic

When the CLI asks for modules, this determines what gets included:

```typescript
const MODULE_DEPS: Record<string, string[]> = {
  'hyperdb': ['hypercore', 'hyperswarm'],
  'hyperdrive': ['hypercore', 'hyperswarm'],
  'qvac': [],
  'wdk': [],
  'pear': ['bare'],
  'expo-bare': ['bare'],
}

function resolveModules(selected: string[]): string[] {
  const resolved = new Set<string>()

  for (const mod of selected) {
    resolved.add(mod)
    for (const dep of MODULE_DEPS[mod] || []) {
      resolved.add(dep)
    }
  }

  return Array.from(resolved)
}
```

---

## Template Context

Each template adds specific context:

### Starter Template
```yaml
---
id: starter
name: Starter Template
modules: [pear, bare]
description: Basic Pear desktop app with P2P foundation
---
```

### QVAC AI Template
```yaml
---
id: qvac-ai
name: QVAC AI Template
modules: [pear, bare, qvac]
description: Local AI inference app with QVAC SDK
---
```

The template context tells the agent:
- What was scaffolded
- What modules are available
- Project structure
- Entry points

---

## Versioning

Agent pack versions track:
- Stack module versions (Pear, QVAC, etc.)
- Content updates (new recipes, fixes)
- Format changes

```json
{
  "agentPackVersion": "1.0.0",
  "stackVersions": {
    "pear": "2.x",
    "hyperdb": "4.x",
    "qvac": "1.x"
  }
}
```

---

## Distribution

### Via Cursor Marketplace (Primary for Cursor)
The agent pack is published as a Cursor plugin. Users install it from the marketplace and get all rules, skills, agents, and commands automatically.

### Via CLI (Primary for Claude/OpenCode)
Agent pack content is bundled with the CLI and generated during scaffold.

### Via npm (Secondary)
```bash
npm install @unstoppable/agent-pack
```

For manual setup or updates:
```bash
npx @unstoppable/agent-pack generate --tool claude --modules hyperdb,qvac
```

### Via Website (Future)
Download pre-built packs from unstoppable-stack.dev/agent-pack
