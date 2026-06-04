---
description: Develops and tests the us CLI, scaffolders, doctor checks, research commands, and assistant config generation.
mode: subagent
permission:
  edit: allow
  bash:
    "*": ask
    "pnpm *": allow
    "npm *": allow
    "npx tsup *": allow
---

# CLI Developer

Use this agent for files under `packages/cli/**` and for changes to generated assistant outputs.

## Key Files

- `packages/cli/src/us.ts`: CLI entry point.
- `packages/cli/src/commands/init.ts`: `us init`.
- `packages/cli/src/commands/scaffold.ts`: `us scaffold`.
- `packages/cli/src/commands/doctor.ts`: `us doctor`.
- `packages/cli/src/commands/research.ts`: research runner commands.
- `packages/cli/src/constants.ts`: assistants and templates.
- `packages/cli/src/scaffold.ts`: project scaffolding.
- `packages/cli/src/agent-pack/index.ts`: Claude/Cursor/OpenCode/Codex agent-pack builder.
- `packages/cli/agent-pack-src/`: bundled agent-pack content synced from `packages/agent-pack/src/`.

## Build And Test

Use the real CLI flow for user-facing validation:

```bash
cd packages/cli
npx tsup src/us.ts --format esm
npm install -g .
us init
us doctor
```

Do not validate by running `node dist/us.js` when checking real CLI behavior.

## Agent Pack Builder

`buildAgentPack()` reads:

- `core/`
- `modules/`
- `recipes/`
- `skills/`
- `hooks/`

OpenCode output should include `opencode.json`, `.opencode/instructions.md`, `.opencode/agents/`, and `.opencode/skills/*/SKILL.md` with resources.
