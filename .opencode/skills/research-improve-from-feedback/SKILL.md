---
name: research-improve-from-feedback
description: Use when a user reports a specific error, missing pattern, or unexpected behavior while building with the agent pack.
---

# Improve Agent Pack From Feedback

## Steps

1. Parse the error.
2. Find relevant documentation.
3. Identify the documentation gap.
4. Fix the documentation.
5. Sync to the CLI bundle.
6. Report root cause, files updated, and verification.

## Parse The Error

Identify:

- Modules involved, such as HyperDB, QVAC, Hyperswarm, or Pear.
- What the user was doing.
- Exact error message or unexpected behavior.
- Which AI tool was used: Claude, Cursor, OpenCode, Codex, or unknown.

## Find Relevant Docs

- `packages/agent-pack/src/modules/<module>.mdc`
- `packages/agent-pack/src/recipes/<recipe>.mdc`
- `packages/agent-pack/src/skills/<skill>/SKILL.md`
- `packages/agent-pack/src/skills/<skill>/resources/`

## Fix Rules

- Edit `packages/agent-pack/src/` directly.
- Add gotchas to Pitfalls sections.
- Add troubleshooting entries with symptoms and solution.
- Verify against source code or reference apps.
- Sync with `cp -r packages/agent-pack/src/* packages/cli/agent-pack-src/`.

## Report Template

```markdown
## Feedback Fix Report
**Issue**: [summary]
**Root cause**: [what was wrong/missing]
**Files updated**: [list]
**Verification**: [what was checked]
```
