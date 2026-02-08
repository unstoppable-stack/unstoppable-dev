# Feature Matrix: Claude Code vs Cursor vs OpenCode

## Quick Comparison

| Capability | Claude Code | Cursor | OpenCode |
|------------|-------------|--------|----------|
| **Type** | CLI | IDE (VS Code) | CLI/TUI |
| **Open Source** | No | No | Yes |
| **Cost** | API usage | Subscription | API usage |

---

## Configuration Features

| Feature | Claude Code | Cursor | OpenCode |
|---------|-------------|--------|----------|
| **Project instructions** | `CLAUDE.md` | `.cursor/rules/*.mdc` | `instructions` in config |
| **Global instructions** | `~/.claude/CLAUDE.md` | Settings > Rules for AI | `~/.config/opencode/` |
| **Modular rules** | `.claude/rules/*.md` | Multiple `.mdc` files | Multiple agent/skill files |
| **Rule imports** | `@file.md` syntax | `@rulename` references | File path references |
| **Path-scoped rules** | YAML `paths:` | `globs:` frontmatter | Agent tool restrictions |
| **Config hierarchy** | 4 levels | 3 levels | 6 levels |

---

## Skills & Commands

| Feature | Claude Code | Cursor | OpenCode |
|---------|-------------|--------|----------|
| **Custom skills** | `.claude/skills/*/SKILL.md` | `.mdc` files | `.opencode/skills/*/SKILL.md` |
| **Skill invocation** | `/skill-name` | `@rulename` | `/skill-name` |
| **Auto-invocation** | By description | By globs/description | Agent skill tool |
| **Skill arguments** | `$ARGUMENTS`, `$1` | N/A | N/A |
| **Tool restrictions** | `allowed-tools` field | N/A | `allowed-tools` field |
| **Skill format** | Claude SKILL.md | MDC | Claude-compatible |

---

## Agents & Modes

| Feature | Claude Code | Cursor | OpenCode |
|---------|-------------|--------|----------|
| **Multiple agents** | Subagents via Task | Normal/Agent modes | Primary/Subagents |
| **Custom agents** | Limited | N/A | Full support |
| **Agent switching** | N/A | `Cmd+.` | `Tab` key |
| **Specialized agents** | Fork context | N/A | Custom agent files |
| **Read-only mode** | Skill restrictions | Normal mode | `plan` agent |

---

## Automation & Hooks

| Feature | Claude Code | Cursor | OpenCode |
|---------|-------------|--------|----------|
| **Lifecycle hooks** | Full support | N/A | N/A |
| **Pre-tool hooks** | Yes (can block) | N/A | N/A |
| **Post-tool hooks** | Yes | N/A | N/A |
| **Session hooks** | Start/End | N/A | N/A |
| **Auto-formatting** | Via hooks | Via IDE | `formatter` config |

---

## Permissions & Security

| Feature | Claude Code | Cursor | OpenCode |
|---------|-------------|--------|----------|
| **Permission system** | Full (allow/ask/deny) | N/A | Full (allow/ask/deny) |
| **Bash restrictions** | Pattern matching | N/A | Glob patterns |
| **File restrictions** | By path | `.cursorignore` | By permission |
| **Tool restrictions** | Per-skill | N/A | Per-agent, per-skill |
| **Managed policies** | Enterprise | Enterprise | Remote config |

---

## External Tools (MCP)

| Feature | Claude Code | Cursor | OpenCode |
|---------|-------------|--------|----------|
| **MCP support** | Full | Full | Full |
| **Config location** | `.mcp.json` | `.cursor/mcp.json` | `mcp` in config |
| **Transport types** | HTTP, SSE, stdio | stdio | stdio |
| **Tool search** | Auto at 10% context | N/A | N/A |

---

## IDE Integration

| Feature | Claude Code | Cursor | OpenCode |
|---------|-------------|--------|----------|
| **Editor** | External (any) | Built-in (VS Code) | External (any) |
| **File navigation** | N/A | Full IDE | N/A |
| **Inline edits** | N/A | Yes | N/A |
| **Terminal** | Yes | Integrated | Yes (TUI) |
| **Multi-file edits** | Yes | Yes | Yes |

---

## What Each Tool Does Best

### Claude Code
- **Best for**: Power users who want maximum control
- **Unique strength**: Lifecycle hooks for automation
- **Key feature**: Skills with auto-invocation by description
- **Use when**: You need programmatic control over AI behavior

### Cursor
- **Best for**: Developers who prefer IDE integration
- **Unique strength**: Visual editing with inline AI
- **Key feature**: Glob-scoped rules for automatic context
- **Use when**: You want seamless IDE experience

### OpenCode
- **Best for**: Developers who prefer terminal and want customization
- **Unique strength**: Custom agents with different personalities
- **Key feature**: Switchable agents for different tasks
- **Use when**: You want open source and agent flexibility

---

## Recommended Features by Tool

### For Unstoppable Stack CLI to Generate

**Claude Code:**
- `CLAUDE.md` with full stack context
- `.claude/rules/` for path-scoped P2P rules
- `.claude/skills/` for all recipes as skills
- `.claude/settings.json` with permissions for pear/npm
- Hooks for auto-formatting and secret protection

**Cursor:**
- `.cursor/rules/project.mdc` (alwaysApply) for overview
- `.cursor/rules/p2p-patterns.mdc` (glob-scoped) for P2P code
- `.cursor/rules/<module>.mdc` for each selected module
- `.cursorignore` for node_modules, etc.
- Optional `AGENTS.md` for simple reference

**OpenCode:**
- `opencode.json` with model, permissions, formatter
- `.opencode/instructions.md` for full context
- `.opencode/agents/p2p-expert.md` for specialized help
- `.opencode/skills/` for all recipes as skills
- Permissions allowing pear/npm commands

---

## Feature Parity Strategy

| Our Feature | Claude | Cursor | OpenCode |
|-------------|--------|--------|----------|
| **Stack overview** | CLAUDE.md | project.mdc | instructions.md |
| **Module docs** | In CLAUDE.md | Separate .mdc | In instructions.md |
| **Path-scoped rules** | rules/ with paths | .mdc with globs | Agent restrictions |
| **Recipes as skills** | skills/ | .mdc (manual) | skills/ |
| **P2P expert** | Skill | Rule | Custom agent |
| **Auto-format** | Hook | IDE | Formatter config |
| **Secret protection** | Hook | N/A | Permission deny |
