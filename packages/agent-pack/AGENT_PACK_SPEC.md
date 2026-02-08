# Agent Pack Specification

## Overview

The Agent Pack provides AI coding assistants with the knowledge to build apps on the Unstoppable Stack. It's designed to be **portable** across Claude Code, Cursor, and OpenCode.

## Architecture

```
agent-pack/
├── AGENT_PACK_SPEC.md      # This file
├── src/                     # Canonical source (markdown)
│   ├── core/               # Core instructions (always included)
│   │   ├── architecture.md
│   │   ├── principles.md
│   │   └── patterns.md
│   ├── modules/            # Per-module knowledge
│   │   ├── pear.md
│   │   ├── hyperdb.md
│   │   ├── qvac.md
│   │   └── ...
│   ├── recipes/            # Task-oriented guides
│   │   ├── p2p-sync.md
│   │   ├── local-inference.md
│   │   └── ...
│   └── templates/          # Template-specific context
│       ├── starter.md
│       ├── qvac-ai.md
│       └── ...
├── build/                  # Build script
│   └── index.ts
└── dist/                   # Generated outputs (gitignored)
    ├── claude/
    ├── cursor/
    └── opencode/
```

---

## Source Format

All source files use markdown with YAML frontmatter:

```markdown
---
id: hyperdb
name: HyperDB
category: module
requires: [hypercore, hyperswarm]
tags: [database, p2p, sync]
---

# HyperDB

## What It Does
P2P key-value database built on Hypercore...

## When To Use
- You need data sync between peers
- You want offline-first storage
- You need conflict resolution

## Quick Start
\`\`\`javascript
import HyperDB from 'hyperdb'
// ...
\`\`\`

## Key Concepts
...

## Common Patterns
...

## Gotchas
...
```

### Frontmatter Fields

| Field | Required | Description |
|-------|----------|-------------|
| `id` | Yes | Unique identifier |
| `name` | Yes | Display name |
| `category` | Yes | `core`, `module`, `recipe`, `template` |
| `requires` | No | Dependencies (other module IDs) |
| `tags` | No | Searchable tags |
| `priority` | No | `high`, `medium`, `low` (default: medium) |

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

### Cursor

**Output:** `.cursor/rules` file + `.cursorrules` (legacy)

```
project/
├── .cursorrules           # Legacy format (simple rules)
└── .cursor/
    └── rules              # New format (detailed)
```

**.cursor/rules Structure:**
```markdown
# Unstoppable Stack Project

## Project Context
This is a [template-name] project using the Unstoppable Stack.

## Tech Stack
- Pear Runtime for desktop P2P apps
- HyperDB for data synchronization
- [other selected modules]

## Code Patterns
[Key patterns from core/patterns.md]

## Do's and Don'ts
- DO: [extracted from gotchas]
- DON'T: [extracted from gotchas]

## File Structure
[Project structure explanation]
```

**Build rules:**
- More concise than Claude format
- Focus on rules and constraints
- Include code snippets inline
- Max ~20KB recommended

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

### Via CLI (Primary)
Agent pack is bundled with CLI and generated during scaffold.

### Via npm (Secondary)
```bash
npm install @unstoppable/agent-pack
```

For manual setup or updates:
```bash
npx @unstoppable/agent-pack generate --tool claude --modules hyperdb,qvac
```

### Via Website (Future)
Download pre-built packs from unstoppable.dev/agent-pack
