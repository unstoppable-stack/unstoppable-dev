---
name: research-test-agent-pack
description: Use after changing agent-pack content or the builder to verify generated Claude, Cursor, and OpenCode outputs.
---

# Test Agent Pack Output

## Steps

### Build The CLI

```bash
cd packages/cli
npx tsup src/index.ts --format esm --dts
```

### Scaffold Test Projects

```bash
cd /tmp
node <project-root>/packages/cli/dist/index.js test-claude-app -a claude -m "hyperdb,qvac" --no-install
node <project-root>/packages/cli/dist/index.js test-cursor-app -a cursor -m "hyperdb,qvac" --no-install
node <project-root>/packages/cli/dist/index.js test-opencode-app -a opencode -m "hyperdb,qvac" --no-install
```

### Verify Claude Output

- `CLAUDE.md` exists and is <=8KB.
- `.claude/settings.json` is valid JSON.
- `.claude/skills/` contains valid `SKILL.md` files.
- Skill resources are present.

### Verify Cursor Output

- `.cursor/rules/project.mdc` has `alwaysApply: true`.
- `.cursorignore` exists.
- All `.mdc` files have valid frontmatter.
- Glob-scoped rules have valid `globs` arrays.

### Verify OpenCode Output

- `opencode.json` is valid JSON.
- `.opencode/instructions.md` exists and is <=8KB.
- `.opencode/skills/` contains `SKILL.md` files.
- OpenCode config uses valid schema fields.

### Sync

```bash
cp -r packages/agent-pack/src/* packages/cli/agent-pack-src/
```

### Clean Up

```bash
rm -rf /tmp/test-claude-app /tmp/test-cursor-app /tmp/test-opencode-app
```
