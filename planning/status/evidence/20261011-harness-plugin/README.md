# Harness plugin prototype evidence — 11 October 2026

Implemented the local packaging portion of P0 and initial artifact validation from P1. Refreshed the packages against main at `07207c4`, after the maintained-runtime agent-pack refactor in PR #11. This is a development prototype; no plugin was published or installed/enabled globally. Existing unrelated working-tree changes were retained.

## Delivered

- Canonical `build-with-unstoppable` entry skill, also synchronized into the CLI-bundled agent pack.
- Deterministic Codex portable and Claude Code packages built from 16 selected source workflows plus three generated reference routers.
- Self-contained core/module/recipe resources and recursive skill resources; no dependency on a generated project's guidance directory, upstream submodules or local research folders.
- Local host catalogs, per-package source/output hashes, drift checking and installation documentation.
- Exclusion of historical root hooks, agents and commands from the new packages.

Generated artifacts are under `packages/agent-pack/dist/` and remain gitignored. The recorded source digest is `d2b1bea5b253e5a95daccd03d4d4214edfc4470f306f1c3715ccec1c6ed6d889`. Each host package has 93 files, including its inventory; the combined distribution has 188 files including catalogs. The entry skill is 4,048 bytes.

## Checks

| Check | Result | Scope |
| --- | --- | --- |
| Plugin artifact tests | 6 passed | Relocated local links, deterministic output, source preservation, drift/extra-file detection, recursive binary resources, symlink rejection, escaping links and catalog identities |
| Codex CLI 0.160.1 | Passed | Catalog discovery and `plugin/read` app-server parsing of all 19 namespaced skills from a temporary copied package |
| Claude Code 2.0.76 | Passed | Native plugin and marketplace manifest validation without warnings, from the copied package |
| CLI test suite | 277 passed, 14 skipped across 17 files | Existing project generation plus entry-skill sibling references, including a non-AI target |
| CLI TypeScript/build | Passed | `npm run typecheck` and `npm run build` |
| Generated asset check | Passed | Runtime and compatibility assets remain synchronized |
| Agent-pack parity | Passed | 106 canonical/bundled files match |
| Skill Creator validator | Passed | New source entry skill metadata/format |

[Host parser report](host-parsing.json) records exact versions and discovered skill names. Temporary filesystem paths in the report describe the test copy; those directories were removed after validation.

The native smoke used temporary state/log directories and no model turns. Codex app-server initialization was denied by the process sandbox, so the same bounded parser test ran outside it through automatic approval review. It did not add a global catalog, install a plugin, or alter enabled plugins. Native parsing is distinct from session activation and behavior. The locked graph was installed using local pnpm 11; its build-script approval policy prevented pnpm script execution, so package tests/typecheck/build ran through npm against that graph. CI continues to use the repository’s pnpm 9 setup.

## Remaining gates

P0's full exit is still pending: desktop/session activation and realistic model-driven entry workflows from empty, existing and nested multi-app directories have not been evaluated. The builder and reference checks do not establish automatic selection, app creation quality or native/offline behavior.

P1's shared assembly extraction from the CLI builder is also pending. The prototype reuses the same canonical content and sync pipeline, while retaining separate project-pack and plugin packaging adapters. CLI plugin mode/coexistence migration, fetched release installation, publication/pilot and Cursor/OpenCode adapters remain planned.

Next evaluation prompts should exercise a new desktop P2P coffee assistant, a selected existing app's model-load failure, and a two-app workspace where only one target needs a compatibility review. Keep app changes in temporary workspaces and evaluate observed target selection, resource access and contract use before claiming those gates passed.

## Reproduce

From the repository root:

```sh
node scripts/sync-stack-assets.mjs
node packages/agent-pack/scripts/build-plugin.mjs
node --test packages/agent-pack/scripts/build-plugin.test.mjs
node packages/agent-pack/scripts/build-plugin.mjs --check
node scripts/sync-stack-assets.mjs --check
node scripts/check-agent-pack.mjs
node packages/agent-pack/scripts/smoke-plugin-hosts.mjs
```

For CLI regression/type checks, from `packages/cli`:

```sh
npx vitest run src/__tests__
npx tsc --noEmit
```

CI now builds/checks/tests the plugin packages and uploads `harness-plugin-prototype` with hidden catalogs/manifests included.

See [local plugin setup](../../../../packages/agent-pack/PLUGIN.md) and [the implementation plan](../../../features/harness-plugin.md).
