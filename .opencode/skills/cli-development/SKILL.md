---
name: cli-development
description: Use when changing the us CLI in packages/cli, scaffolders, doctor checks, research commands, or assistant generation.
---

# CLI Development

## Commands

- `us init [project-name]`: interactive project setup.
- `us scaffold app -p <platform> -n <name> [-f features]`: scaffold an app.
- `us scaffold list-platforms`: list platforms.
- `us scaffold list-features`: list features.
- `us doctor [-p platform]`: environment checks.
- `us research run|list|status|scaffold-test`: research workflows.

## Key Files

- `packages/cli/src/us.ts`
- `packages/cli/src/commands/init.ts`
- `packages/cli/src/commands/scaffold.ts`
- `packages/cli/src/commands/doctor.ts`
- `packages/cli/src/commands/research.ts`
- `packages/cli/src/constants.ts`
- `packages/cli/src/scaffold.ts`
- `packages/cli/src/agent-pack/index.ts`
- `packages/cli/agent-pack-src/`

## Build And Test

```bash
cd packages/cli
npx tsup src/us.ts --format esm
npm install -g .
us init
us doctor
```

Never validate user-facing CLI changes by running `node dist/us.js`; rebuild, install globally, and test `us`.

## Adding Skills

1. Create `packages/agent-pack/src/skills/<skill-name>/SKILL.md`.
2. Add deep content under `resources/` when needed.
3. Update skill-module mapping in `packages/cli/src/agent-pack/index.ts` if needed.
4. Update `skill-rules.json` keywords.
5. Sync `packages/agent-pack/src/` to `packages/cli/agent-pack-src/`.
6. Rebuild the CLI.
