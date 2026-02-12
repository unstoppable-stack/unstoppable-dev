# Agent Pack Architecture (Tooling)

**Goal:** Evolve the agent pack from flat content to a smart skill system
with progressive disclosure, auto-activation, and multi-tool researcher.

**Current state:** Skills exist with SKILL.md + resources. CLI builders generate
output for all three tools. Researcher is OpenCode-only. No auto-activation.

**Key files:**
- `packages/cli/src/agent-pack/index.ts` — Builders
- `packages/agent-pack/src/hooks/skill-rules.json` — Auto-activation rules
- `project-planning/Agent Pack & Researcher Improvements.md` — Full planning doc

---

## What's Working

- 10 skills with thin SKILL.md + resources/ (progressive disclosure)
- CLI builders for Claude (skills + hooks), Cursor (.mdc + globs), OpenCode (skills + agents)
- Researcher agent (OpenCode-only) with write-module, write-recipe, verify skills

---

## Next Up

| # | Task | Details | Effort |
|---|------|---------|--------|
| 1 | **Keyword-rich descriptions in Cursor `.mdc` output** | Quick win: better auto-triggering in `buildCursor()` | Small |
| 2 | **Verify PostToolUse hook works end-to-end** | Already in Claude builder — test with a real scaffold | Small |
| 3 | **Implement `skill-rules.json` auto-activation** | Map keywords/files → skills for Claude | Medium |
| 4 | **Verify CLAUDE.md output <= 8KB** | Check size, trim if needed | Small |
| 5 | **Make researcher multi-tool** | Add `research/CLAUDE.md` + `research/.cursor/rules/` | Medium |

---

## Blocked / Dependencies

- Auto-activation hooks require skills to be stable first
- Feedback loop depends on test harness for generated configs

---

## Recently Completed

| Date | Task |
|------|------|
| 2026-02-06 | Planning doc with community patterns research |
| 2026-02 | Progressive disclosure architecture |
| 2026-02 | Builders output skills for all three tools |
