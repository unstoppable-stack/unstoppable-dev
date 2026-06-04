---
name: research-capture-component
description: Use when capturing battle-tested code into reusable components under packages/agent-pack/src/components.
---

# Capture Component

## When To Use

Use after an app build produces working code that solves a reusable problem, such as reconnection, schema setup, model management, or context overflow.

## Steps

### Identify The Pattern

- What problem does it solve?
- Which category does it belong to: `p2p/`, `data/`, `ai/`, or `wallet/`?
- Is it new or an update to an existing component?

### Extract And Generalize

- Remove app-specific logic.
- Keep the common pattern.
- Add `CUSTOMIZE:` comments where developers should adapt behavior.
- Add JSDoc explaining what it handles and why.
- Add proper TypeScript types.

### Write The Component

Save to `packages/agent-pack/src/components/<category>/<name>.ts`.

Conventions:

- Top-of-file JSDoc.
- Export named classes or functions, not default exports.
- Handle common failures.
- Include cleanup via `destroy()` or equivalent when resources are opened.

### Update Skill And Maps

- Update the relevant skill to reference the component.
- If needed, update `COMPONENT_MODULE_MAP` in `packages/cli/src/scaffold.ts`.
- Sync to `packages/cli/agent-pack-src/`.

## Existing Components

- `components/p2p/swarm-manager.ts`
- `components/p2p/replication.ts`
- `components/data/corestore-manager.ts`
- `components/data/db-setup.ts`
- `components/ai/model-manager.ts`
- `components/ai/chat-session.ts`
- `components/ai/tool-runner.ts`
- `components/wallet/wallet-setup.ts`

## Checklist

- Based on working code from a real app build.
- App-specific logic removed.
- `CUSTOMIZE:` comments added.
- Error handling included.
- Cleanup included.
- Public API avoids `any`.
