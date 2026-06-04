---
name: agent-pack-workflow
description: Use when editing packages/agent-pack, packages/cli/agent-pack-src, skills, hooks, modules, recipes, or generated assistant configs.
---

# Agent Pack Workflow

## Content Flow

```text
packages/agent-pack/src/          -> packages/cli/agent-pack-src/
(source of truth)                    (bundled with CLI)
```

## Rules

- Edit all canonical content directly in `packages/agent-pack/src/`.
- Sync changes to `packages/cli/agent-pack-src/` after edits.
- Do not treat `research/` as generated output; it is reference material.
- Preserve thin `SKILL.md` files and put deep details in `resources/`.

## Sync Command

```bash
cp -r packages/agent-pack/src/* packages/cli/agent-pack-src/
```

## Structure

- `core/`: principles, patterns, cheatsheet, architecture.
- `modules/`: per-module knowledge.
- `recipes/`: task-oriented implementation guides.
- `skills/`: thin `SKILL.md` plus `resources/`.
- `hooks/`: skill rules and formatting hooks.
- `components/`: reusable TypeScript components.

## Size Budgets

- `SKILL.md`: <=4KB.
- `core/*.md`: <=12KB.
- `modules/*.md`: <=8KB.
- `recipes/*.md`: <=15KB.

## Builder Output

- Claude Code: slim `CLAUDE.md`, `.claude/rules/`, `.claude/skills/`, hooks.
- Cursor: `.cursor/rules/*.mdc` with descriptions and globs.
- OpenCode: `.opencode/instructions.md`, `.opencode/skills/`, agents, config.
