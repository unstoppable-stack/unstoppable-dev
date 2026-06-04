---
name: research-feedback-fixer
description: Use when receiving batch app-build feedback or error reports that should become agent-pack doc, recipe, or skill fixes.
---

# Feedback Fixer

## Workflow

### Parse And Triage

- Extract each issue as a concrete task.
- Identify affected modules, recipes, skills, or core docs.
- Mark severity as blocking or improvement.

### Verify Against Sources

Prefer local source code and reference apps:

- `sandbox/coffee-assistant/`
- `sandbox/coffee-assistant-ui/`
- `sandbox/slack-p2p-copy/`
- `reference-apps/qvac-workbench-desktop/`
- `reference-apps/qvac-workbench-mobile/`
- `reference-apps/qvac-health/`

If information is missing, add a clear `> **Note**:` instead of guessing.

### Update Agent Pack

- Edit files directly in `packages/agent-pack/src/`.
- Follow `research-writing-guide` templates.
- Update code snippets to match actual signatures.
- Add troubleshooting entries for repeated failures.

### Sync To CLI

```bash
cp -r packages/agent-pack/src/* packages/cli/agent-pack-src/
```

## Rules

- Do not invent APIs.
- Search for all dependent snippets before changing a breaking pattern.
- Keep fixes concise and grounded in verified behavior.

## Triage Template

```markdown
| # | Issue | Severity | Module | File to Fix |
|---|-------|----------|--------|-------------|
| 1 | [summary] | blocking/improvement | [module] | [path] |
```
