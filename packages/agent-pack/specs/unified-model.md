# Unified Agent Pack Model

## Overview

The Unstoppable Stack agent pack uses a **canonical source format** that transforms into tool-specific outputs. This document defines that canonical format and how it maps to each tool.

## Design Principles

1. **Write Once** - All content authored in canonical format
2. **Build Many** - Transform to Claude/Cursor/OpenCode at scaffold time
3. **Leverage Strengths** - Use each tool's unique features
4. **Graceful Degradation** - Core content works everywhere

---

## Source Directory Structure

```
packages/agent-pack/src/
├── core/                    # Always included
│   ├── architecture.md      # Project structure, data flow
│   ├── principles.md        # Coding philosophy
│   └── patterns.md          # Common patterns
├── modules/                 # Per-module knowledge
│   ├── pear.md
│   ├── bare.md
│   ├── hypercore.md
│   ├── hyperdb.md
│   ├── hyperdrive.md
│   ├── hyperswarm.md
│   ├── qvac.md
│   └── wdk.md
├── recipes/                 # Task-oriented guides
│   ├── p2p-data-sync.md
│   ├── local-inference.md
│   ├── file-sharing.md
│   ├── secure-communication.md
│   └── wallet-integration.md
├── templates/               # Template-specific context
│   ├── starter.md
│   ├── p2p-sync.md
│   ├── qvac-ai.md
│   └── expo-mobile.md
└── skills/                  # Invokable skills (shared format)
    ├── add-hyperdb/
    │   └── SKILL.md
    ├── add-p2p-sync/
    │   └── SKILL.md
    └── explain-architecture/
        └── SKILL.md
```

---

## Canonical Frontmatter

All source files use consistent YAML frontmatter:

```yaml
---
id: hyperdb                    # Unique identifier
name: HyperDB                  # Display name
category: module               # core | module | recipe | template | skill
requires: [hypercore]          # Dependencies (module IDs)
tags: [database, p2p, sync]    # Searchable tags
priority: high                 # high | medium | low
paths:                         # Path-scoped (optional)
  - "src/data/**/*.ts"
  - "src/p2p/**/*.ts"
---
```

### Field Definitions

| Field | Required | Values | Purpose |
|-------|----------|--------|---------|
| `id` | Yes | string | Unique identifier |
| `name` | Yes | string | Human-readable name |
| `category` | Yes | enum | Content type |
| `requires` | No | string[] | Dependency module IDs |
| `tags` | No | string[] | Search/filter tags |
| `priority` | No | enum | Context budget priority |
| `paths` | No | glob[] | Path-scoped rules |

---

## Content Structure

### Modules (`src/modules/*.md`)

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
[1-2 sentence description]

## When To Use
- Bullet points of use cases
- When you need X
- When you want Y

## Quick Start
\`\`\`typescript
// Minimal working example
\`\`\`

## Key Concepts
[Core concepts to understand]

## Common Patterns
[Frequently used patterns with code]

## Gotchas
- Don't do X
- Watch out for Y
- Remember to Z
```

### Recipes (`src/recipes/*.md`)

```markdown
---
id: p2p-data-sync
name: P2P Data Synchronization
category: recipe
requires: [hyperdb, hyperswarm]
tags: [sync, replication, offline]
---

# P2P Data Synchronization

## Goal
[What this recipe achieves]

## Prerequisites
- Module X installed
- Basic understanding of Y

## Steps

### 1. Set Up Database
\`\`\`typescript
// Code
\`\`\`

### 2. Configure Replication
\`\`\`typescript
// Code
\`\`\`

### 3. Handle Sync Events
\`\`\`typescript
// Code
\`\`\`

## Complete Example
\`\`\`typescript
// Full working code
\`\`\`

## Troubleshooting
- If X happens, try Y
- Common error: Z
```

### Skills (`src/skills/<name>/SKILL.md`)

Skills use a format compatible with both Claude Code and OpenCode:

```markdown
---
name: add-hyperdb
description: Add HyperDB P2P database to a feature (min 20 chars)
allowed-tools: Read, Grep, Edit, Bash(npm *)
---

# Add HyperDB

## When to Use
[Conditions that trigger this skill]

## Steps
1. Step one
2. Step two
3. Step three

## Code Template
\`\`\`typescript
// Implementation code
\`\`\`

## Verification
- Check X works
- Verify Y happens
```

---

## Transformation Rules

### To Claude Code

| Source | Output |
|--------|--------|
| `core/*.md` | Concatenated into `CLAUDE.md` |
| `modules/<selected>.md` | Concatenated into `CLAUDE.md` |
| `templates/<chosen>.md` | Header section of `CLAUDE.md` |
| `recipes/<relevant>.md` | `.claude/rules/` or appended |
| `skills/*/SKILL.md` | `.claude/skills/*/SKILL.md` (copy) |
| Path-scoped content | `.claude/rules/` with frontmatter |

**Additional Claude outputs:**
- `.claude/settings.json` - Permissions and hooks
- `.mcp.json` - MCP servers (if configured)

### To Cursor

| Source | Output |
|--------|--------|
| `core/*.md` | `project.mdc` (alwaysApply: true) |
| `modules/<selected>.md` | Individual `.mdc` files or merged |
| `templates/<chosen>.md` | Header of `project.mdc` |
| `recipes/<relevant>.md` | Individual `.mdc` files |
| `skills/*/SKILL.md` | `.mdc` files (manual @-invoke) |
| Path-scoped content | `.mdc` with `globs` frontmatter |

**Cursor frontmatter mapping:**
```yaml
# Source
paths: ["src/p2p/**/*.ts"]

# Becomes Cursor
globs: ["src/p2p/**/*.ts"]
```

### To OpenCode

| Source | Output |
|--------|--------|
| `core/*.md` | `.opencode/instructions.md` |
| `modules/<selected>.md` | Merged into `instructions.md` |
| `templates/<chosen>.md` | Header of `instructions.md` |
| `recipes/<relevant>.md` | `.opencode/skills/*/SKILL.md` |
| `skills/*/SKILL.md` | `.opencode/skills/*/SKILL.md` (copy) |
| Path-scoped content | Custom agent with tool restrictions |

**Additional OpenCode outputs:**
- `opencode.json` - Full configuration
- `.opencode/agents/*.md` - Custom agents

---

## Content Selection Logic

### Module Dependencies

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
  for (const mod of selected) {
    resolved.add(mod)
    for (const dep of MODULE_DEPS[mod] || []) {
      resolved.add(dep)
    }
  }
  return Array.from(resolved)
}
```

### Recipe Selection

Recipes are included if their `requires` dependencies are satisfied:

```typescript
function selectRecipes(modules: string[]): Recipe[] {
  return allRecipes.filter(recipe =>
    recipe.requires.every(req => modules.includes(req))
  )
}
```

### Priority Budgeting

When content exceeds size limits:
1. Always include `core/*`
2. Include `priority: high` content
3. Include selected `modules`
4. Include matching `recipes` up to budget
5. Move overflow to linked files

---

## Size Guidelines

| Tool | Recommended Max | Strategy |
|------|-----------------|----------|
| Claude Code | 50KB | Split to `.claude/docs/` |
| Cursor | 20KB | Split to multiple `.mdc` |
| OpenCode | 30KB | Split to skills |

---

## Shared Skill Format

Skills use a format compatible with both Claude Code and OpenCode:

```markdown
---
name: skill-name              # Required (both)
description: What it does     # Required (both, min 20 chars for OpenCode)
allowed-tools: Read, Edit     # Optional (both)
disable-model-invocation: true # Claude only
user-invocable: false          # Claude only
metadata:                      # OpenCode only
  version: "1.0"
---
```

The build process copies skills as-is to both tools, filtering tool-specific fields as needed.

---

## Example: Starter Template Build

**Input:**
- Template: `starter`
- Modules: `[pear, hyperdb]`
- Tool: `claude`

**Resolved modules:** `[pear, bare, hyperdb, hypercore, hyperswarm]`

**Selected recipes:** `[p2p-data-sync, offline-first-app]`

**Output structure:**
```
my-app/
├── CLAUDE.md                 # Merged: template + core + modules
├── .claude/
│   ├── settings.json        # Permissions
│   ├── rules/
│   │   └── p2p-patterns.md  # Path-scoped rules
│   └── skills/
│       ├── add-hyperdb/SKILL.md
│       ├── add-p2p-sync/SKILL.md
│       └── explain-architecture/SKILL.md
└── .gitignore               # Includes .claude/settings.local.json
```

---

## Versioning

Track versions for cache busting and compatibility:

```json
{
  "agentPackVersion": "1.0.0",
  "stackVersions": {
    "pear": "2.x",
    "hyperdb": "4.x",
    "qvac": "1.x"
  },
  "contentHash": "abc123"
}
```
