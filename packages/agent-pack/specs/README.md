# Agent Pack Tool Specifications

This folder contains detailed specifications for how the Unstoppable Stack agent pack integrates with different AI coding assistants.

## Overview

The agent pack provides AI assistants with knowledge about the Unstoppable Stack. Each tool (Claude Code, Cursor, OpenCode) has different capabilities and configuration formats. This spec defines:

1. **Tool Capabilities** - What each tool can do
2. **Output Formats** - How to generate tool-specific configurations
3. **Feature Mapping** - How our canonical format maps to each tool

## Documents

### Tool Capabilities
- [Claude Code](./tool-capabilities/claude-code.md) - CLAUDE.md, MCP, skills, hooks, settings
- [Cursor](./tool-capabilities/cursor.md) - Rules, .mdc format, commands
- [OpenCode](./tool-capabilities/opencode.md) - Agents, skills, permissions, config

### Integration
- [Unified Model](./unified-model.md) - Our canonical source format
- [CLI Integration](./cli-integration.md) - How the CLI uses this spec
- [Feature Matrix](./feature-matrix.md) - Side-by-side comparison

## Quick Reference

| Feature | Claude Code | Cursor | OpenCode |
|---------|-------------|--------|----------|
| **Project instructions** | `CLAUDE.md` | `.cursor/rules/*.mdc` | `opencode.json` + `instructions` |
| **Modular rules** | `.claude/rules/*.md` | `.cursor/rules/*.mdc` | `.opencode/agents/*.md` |
| **Skills/Commands** | `.claude/skills/*/SKILL.md` | Manual `@` reference | `.opencode/skills/*/SKILL.md` |
| **Hooks/Automation** | `hooks` in settings.json | N/A | N/A |
| **External tools** | MCP servers | MCP servers | MCP servers |
| **Permissions** | settings.json | N/A | `permission` in config |
| **Path-scoped rules** | YAML frontmatter `paths` | `globs` frontmatter | Agent tool restrictions |

## Design Principles

1. **Canonical Source** - All content lives in `src/` as markdown
2. **Build for Each Tool** - Transform to tool-specific format at scaffold time
3. **Leverage Tool Strengths** - Use each tool's unique features
4. **Graceful Degradation** - Core instructions work everywhere, advanced features where supported

## CLI Usage

```bash
# The CLI builds agent pack during scaffold
us init my-app --assistant claude

# Or manually generate for a tool
npx @unstoppable/agent-pack generate --tool cursor --modules hyperdb,qvac
```
