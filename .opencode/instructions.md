# Unstoppable Stack OpenCode Instructions

Use these instructions alongside `CLAUDE.md`. They mirror the project-level Cursor rules in `.cursor/rules/` for OpenCode sessions.

## Project Context

The Unstoppable Stack is a monorepo for building local-first, P2P applications with local AI and crypto payments.

Core modules:
- Pear and Bare for desktop/runtime.
- Hyperswarm, HyperDHT, Hypercore, HyperDB, Hyperdrive, Hyperbee, Corestore, and Autobase for P2P/data.
- QVAC SDK for local AI inference.
- WDK Wallet for crypto payments.
- Expo Bare for mobile.

## Repository Map

- `packages/website/`: Next.js website.
- `packages/cli/`: `us` CLI, scaffolding, doctor, research tooling.
- `packages/agent-pack/`: canonical agent-pack source and specs.
- `packages/cli/agent-pack-src/`: CLI-bundled copy of agent-pack content.
- `docs/`: extended module and recipe docs.
- `reference-apps/`: upstream submodules used as ground truth.
- `research/`: fetched docs and examples.
- `sandbox/`: gitignored battle-tested apps and CLI test builds.
- `planning/`: roadmap, status, features, and presentations.

## Project Tracker

Before substantial work, consult `planning/status/README.md` and the relevant status folder.

Use these priority signals:
- Mobile support with Expo Bare.
- Node Phase 1.
- QVAC capabilities.
- P2P advanced modules.
- Website.
- Agent-pack tooling.
- WDK payments.

After completing tracked work, update planning files only when a task was actually completed or the user asks for planning updates.

## Coding Guidelines

- Use TypeScript wherever applicable.
- Use pnpm workspaces and Turborepo conventions.
- Prefer ESLint, Prettier, and Vitest.
- Follow conventional commits when committing is explicitly requested.
- Keep apps local-first and functional offline.
- Prefer recipes and battle-tested patterns over raw API explanations.

P2P rules:
- Always handle peer disconnection gracefully.
- Use Hyperswarm topics for discoverability.
- Replicate Hypercores before reading remote data.
- Always await `db.ready()` or `core.ready()` before operations.
- Do not store large blobs in HyperDB; use Hyperdrive.
- Do not hardcode discovery keys.
- Close swarms, cores, databases, and model sessions on cleanup.

## OpenCode Agents

Use the project agents when the task matches their domain:
- `@project-planner`: planning/status work and roadmap updates.
- `@cli-developer`: `packages/cli/**`, scaffolding, doctor, research command, or generated assistant configs.
- `@agent-pack-researcher`: `packages/agent-pack/**`, `packages/cli/agent-pack-src/**`, module docs, recipes, skills, and reusable components.

## OpenCode Skills

Skills in `.opencode/skills/` mirror the Cursor workflow rules. Load them when their description matches the user request or edited files:
- `agent-pack-workflow`: agent-pack editing, source-of-truth, CLI sync, size budgets.
- `cli-development`: `us` CLI implementation and testing workflow.
- `research-writing-guide`: module and recipe documentation templates.
- `research-verify`: audit agent-pack quality and accuracy.
- `research-test-agent-pack`: verify generated Claude, Cursor, and OpenCode outputs.
- `research-feedback-fixer`: triage batch app-build feedback into doc fixes.
- `research-improve-from-feedback`: fix docs from a reported build error or missing pattern.
- `research-capture-component`: capture battle-tested code into reusable components.
- `research-scan-community`: scan external agent-config community patterns.

## Agent Pack Workflow

All canonical agent-pack content is edited directly in `packages/agent-pack/src/`. After edits, sync to the CLI bundle:

```bash
cp -r packages/agent-pack/src/* packages/cli/agent-pack-src/
```

Do not edit only `packages/cli/agent-pack-src/` unless intentionally fixing the bundled copy as part of a sync.

## Documentation Hygiene

When changing public behavior, CLI commands, scaffolded output, package APIs, setup flows, agent-pack capabilities, or user-facing product status, check whether docs need updates.

Docs to consider:
- `packages/website/src/lib/docs.ts` for website documentation content.
- `packages/website/src/app/getting-started/` for the getting started flow.
- `packages/website/src/app/roadmap/` for roadmap and status claims.
- `planning/status/` for project tracker updates.
- `packages/agent-pack/src/` for assistant-facing implementation guidance.
- `packages/cli/agent-pack-src/` for the CLI-bundled agent-pack copy.

If docs are affected, update them in the same change. If docs are intentionally deferred, mention that in the final response with the reason.

## CLI Testing

When testing CLI changes, use the real global command path:

```bash
cd packages/cli
npx tsup src/us.ts --format esm
npm install -g .
us init
us doctor
```

Do not run the CLI directly via `node dist/us.js` when validating user-facing behavior.
