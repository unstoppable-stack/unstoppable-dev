# Unstoppable agent pack

The pack helps assistants discover, extend, diagnose and upgrade generated apps.
It ships to Claude, Cursor, OpenCode and Codex through thin tool wrappers and
on-demand skills. Detailed SDK APIs belong to upstream documentation and the
installed dependency types.

## Ownership

- `src/core/`: local-first policy, runtime boundaries and composition decisions.
- `src/modules/`: integration notes; QVAC’s session contract is generated from the runtime README.
- `src/skills/`: short workflows with task-specific resources. Advanced QVAC skills route to version-matched upstream docs.
- `src/recipes/`: composition patterns and operational invariants.
- `packages/runtime-ai/src/`: maintained desktop/Node AI lifecycle and native adapters.
- `packages/cli/src/compatibility/profiles.json`: dependency, model identity, maturity and validation profiles.

`us init` configures a workspace. `us scaffold app` creates executable targets
and records each one in `.unstoppable/project.json`. Generated desktop/Node AI
apps receive a versioned copy of the runtime; no unpublished package installation
is required. Apps own their UI, prompts, domain logic and schemas.

## Editing and validation

Edit maintained source, then run from the repository root:

```bash
node scripts/sync-stack-assets.mjs
node scripts/sync-stack-assets.mjs --check
node scripts/check-agent-pack.mjs
node --test packages/runtime-ai/test/*.test.js
```

The sync step generates runtime assets/compatibility guidance and the CLI’s
bundled pack from their canonical sources. CLI builds/prepack invoke it. CLI
tests check parity and emitted assistant resources. Do not edit generated copies
or maintain dependency tables by hand.

## Existing apps

Use `us compatibility list -o <workspace>` and `us compatibility check -o <app>`.
Checks are read-only and report runtime edits, dependency/profile differences
and exact lockfile pin mismatches. Apply explicit migrations that preserve app
edits; `--force` scaffolding is not an upgrade workflow.

Native runtime, cancellation/reuse and offline acceptance remain separate from
unit/mock checks. Expo remains a separate experimental implementation, wallets
are stubs, and Personal Node integration remains deferred.
