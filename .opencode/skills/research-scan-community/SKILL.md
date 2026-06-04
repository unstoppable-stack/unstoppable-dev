---
name: research-scan-community
description: Use when scanning community repos for new Claude, Cursor, OpenCode, or general agent configuration patterns.
---

# Scan Community Patterns

## When To Use

Use periodically or when asked to "scan community for new patterns".

## Repositories To Check

- Claude Code: `awesome-claude-code`, `ChrisWiles/claude-code-showcase`, `diet103/claude-code-infrastructure-showcase`.
- OpenCode: `awesome-opencode`, `zenobi-us/opencode-skillful`, `malhashemi/opencode-skills`.
- Cursor: community rule collections and Cursor forum best practices.
- General: `neurofoo/agent-skills` marketplace patterns.

## What To Look For

- Hook patterns.
- Skill architecture.
- Distribution and update flows.
- Memory/context management.
- Multi-agent orchestration.
- Cursor glob and description best practices.
- OpenCode skill, agent, permission, and plugin patterns.

## Evaluation Criteria

- Do we already have this pattern?
- Is it better than our current pattern?
- Would it reduce app-building errors?
- Would it improve token efficiency?
- What is the implementation effort?

## Output

Write findings to `packages/agent-pack/src/core/community-scan-YYYY-MM.md` with sources checked, patterns found, recommendations, and action items.
