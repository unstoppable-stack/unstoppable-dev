---
name: scaffold-project
description: Create new apps with `us scaffold app` — all platforms and features.
when_to_use: User wants to create, bootstrap, or set up a new app or project. ALWAYS scaffold before writing application code.
paths: ["package.json"]
version: "2026-04-14"
---

# Scaffold Project

**Always use the `us` CLI to create new apps.** Do not manually create project files, package.json, or build configs — the scaffold handles all of that with battle-tested, validated configurations.

## When to Use

- **Every time** the user wants a new app, component, or project
- When the user says "create", "new app", "new project", "bootstrap", "set up"
- Before writing any application code — scaffold first, then customize

## Quick Reference

```bash
# Interactive project setup (creates workspace + AI agent config)
us init <project-name>

# Scaffold a specific app (non-interactive, for AI agents)
us scaffold app -p <platform> -n <name> -f <features> -o <path>

# Overwrite existing directory
us scaffold app -p <platform> -n <name> -o <path> --force

# Check environment
us doctor
```

## Platforms

| Platform | Description | Use When |
|----------|-------------|----------|
| `expo-mobile` | iOS/Android with Expo + optional Bare worklet | Mobile app, needs native builds |
| `pear-desktop` | Pear Desktop with worker bridge + HTML/JS UI | Desktop P2P app with GUI |
| `node-cli` | Node.js CLI with TypeScript | Backend tool, bot, daemon |

## Features

P2P networking (Hyperswarm + Corestore) and KV storage (Hyperbee) are **always
included** — every Unstoppable app needs them, so they are not flags. The
optional features are:

| Feature | Description | Platforms |
|---------|-------------|-----------|
| `local-ai` | QVAC SDK for local inference + streaming chat UI | All |
| `wallet` | WDK wallet integration (stub — not yet validated) | pear-desktop, node-cli |
| `node-sync` | Register cores with the Unstoppable Node for replication + backup | All |

Multi-writer sync (Autobee) is not a scaffold flag — add it afterwards with the
`add-multi-writer-sync` skill.

## Examples

```bash
# Mobile chat app with local AI
us scaffold app -p expo-mobile -n my-chat -f local-ai

# Desktop app with AI and node sync
us scaffold app -p pear-desktop -n my-sync -f local-ai,node-sync

# Node.js CLI with AI
us scaffold app -p node-cli -n my-tool -f local-ai

# Minimal mobile app (no features — just the shell)
us scaffold app -p expo-mobile -n my-app
```

## What Gets Generated (and why you should not do it manually)

### expo-mobile

The scaffold produces a **fully buildable** Expo project. Feature combinations (bare, `local-ai`, `node-sync`, and their combos) have been validated to:
- `npm install` without errors
- `expo prebuild` succeeds
- iOS build (xcodebuild) succeeds
- Android build (gradle) succeeds
- Metro JS bundle compiles (`expo export`)

Generated files:
- `package.json` — correct dependency versions, `postinstall` automation, `overrides`
- `app.json` — Expo config with native plugins and memory entitlement
- `metro.config.js` — native module mocking for P2P libraries
- `plugins/` — Android NDK version and architecture config plugins
- `app/` — Expo Router layout + home screen with feature diagnostics
- `bare/index.js` — RPC worklet entry (when P2P is selected)
- `mocks/empty.js` — empty module for Metro resolution

### pear-desktop

Generated files:
- `package.json` — `pear` config block (`pre`, `routes`, `unrouted`), `pear-electron`/`pear-bridge`/`pear-run` deps
- `index.html` — web entry with `<pear-ctrl>` native window controls and title bar
- `index.js` — Pear native entry using `pear-electron` + `pear-bridge` (ESM, runs in Bare)
- `worker.js` — P2P, storage, and/or AI initialization (ESM imports, `Pear.worker.pipe()`)
- `app/bridge.js` — renderer-side worker client using `pear-run` (spawns worker, NDJSON pipe)
- `app/index.js` — status display UI (imports from bridge)

**Important:** Pear Desktop apps must NOT be npm/pnpm workspace members. Bare runtime
resolves modules relative to the project directory. If dependencies are hoisted to a
monorepo root, the app will crash with `MODULE_NOT_FOUND` for every dependency and the
`pear-electron/pre` script will timeout. Each Pear app needs its own `node_modules/`.

### node-cli

Generated files:
- `package.json` — with `@types/node`, tsx, TypeScript
- `tsconfig.json` — strict mode, ES2022 target
- `src/index.ts` — entry with graceful startup/shutdown
- `src/types.d.ts` — module declarations for untyped P2P libraries
- Feature managers as needed (`swarm-manager.ts`, `storage-manager.ts`, `ai-manager.ts`)

## After Scaffolding

```bash
cd <project-name>
npm install          # installs deps + runs postinstall (prebuild, bare-pack)
npm run ios          # expo-mobile: build and run on simulator
npm run dev          # node-cli or pear-desktop: start dev mode
```

Then start implementing app-specific logic on top of the scaffolded code.

## Validated Dependency Versions

These versions are battle-tested and validated through automated research.
The Expo / Bare entries form a **coupled set** — bumping any single one risks
breaking the worklet bundle pipeline. See `core/verified-versions.mdc` →
"Mobile (Expo + Bare)" for the full table and the rule for moving them
together.

| Package | Version | Notes |
|---------|---------|-------|
| `bare-pack` | `^2.2.1` | Bundler (2.x). Matches `@qvac/sdk@0.15`'s internal `bare-pack@^2.0.1`. 2.x uses `--host <triple>` (the `--target` flag was removed in `2.0.0`); the generated `build:bare` script uses `--host`. |
| `expo` | `~54.0.33` | Expo SDK 54. Pairs with `react-native@0.81.x`. **Kept on 54** — the QVAC bump does not require Expo 55/56 (RN 0.83/0.85), a separate migration. |
| `expo-build-properties` | `~1.0.9` | Matches SDK 54. **Must be in dependencies**, not just `app.json` plugins. |
| `expo-router` | `~6.0.23` | Matches SDK 54. |
| `expo-file-system` | `^19.0.15` | Matches SDK 54. Also the optional peer of `@qvac/sdk` for model caching. |
| `expo-device` | `~8.0.10` | Matches SDK 54. Used to detect simulator vs physical device for QVAC. |
| `react-native` | `0.81.5` (exact) | Exact pin — Expo SDK 54 ships this. |
| `react` | `19.1.0` (exact) | Exact pin — Expo SDK 54 ships this. |
| `react-native-bare-kit` | `0.15.0` (exact) | Exact-pinned to match the SDK generation. `@qvac/sdk@0.15` declares it as an optional `*` peer; caret ranges silently install pre-1.0 minors and break the QVAC mobile worker bundle. |
| `bare-fs` | resolved transitively | **No override** on 2.x — resolves to satisfy `@qvac/sdk@0.15`'s `bare-fs@^4.5.1` (currently `4.7.4`). |
| `@qvac/sdk` | `^0.15.0` | Local AI inference. |
| `@qvac/cli` | `^0.8.1` | Optional devDep for QVAC mobile bundling. No longer a declared peer of `@qvac/sdk@0.15` — installs cleanly. |
| `zod` | `^4.3.0` | Required by `@qvac/sdk@0.10+` — install v4.3+ explicitly when using tool calling. |
| `bare-rpc` | `^1.1.0` | P2P RPC. |
| `hyperswarm` | `^4.17.0` | P2P networking. |
| `autobee` | `1.0.10` (pin exact) | Multi-writer convergent Hyperbee. Experimental upstream. |

## Known Issues (from research)

1. **`bare-pack` 2.x uses `--host`, not `--target`** — the `--target` flag was removed in `2.0.0`. The generated `build:bare` script uses `--host <triple>` (same triple values). `@qvac/sdk@0.15` depends on `bare-pack@^2.0.1` internally, so app and SDK share one `bare-pack`. ⚠️ This 2.x migration has passed dependency resolution but **not** a full native e2e build — validate on simulator + device before shipping.
2. **`react-native-bare-kit` caret ranges are dangerous** — pin exact (`0.15.0`, no caret). Pre-1.0 minors break the QVAC mobile worker bundle with cryptic native errors. Track it to the release contemporaneous with the installed `@qvac/sdk` (0.15 declares it only as an optional `*` peer, so the pin is ours to maintain).
3. **Expo SDK upgrades are all-or-nothing** — Expo SDK pins one specific `react-native` major. Mixing SDK 54 with RN 0.85 (SDK 56's RN) is not supported. Bump the whole Mobile table together or not at all. We stay on SDK 54; the QVAC 0.15 bump does not require moving off it.
4. **`expo-build-properties` must be a dependency** — listing it only in `app.json` plugins without installing it causes prebuild to fail.
5. **`@qvac/cli` installs cleanly on SDK 0.15** — `@qvac/sdk@0.15` no longer declares `@qvac/cli` as a peer, so no `--legacy-peer-deps` workaround is needed. Use the latest line (`^0.8.1`).
6. **QVAC expo plugin needs local `@qvac/cli`** — without it, npx downloads a mismatched version that can't bundle.
7. **Untyped P2P modules** — `hyperswarm`, `corestore`, `hypercore-crypto`, `hyperbee`, `autobee` have no TypeScript types. The scaffold generates `src/types.d.ts` with module declarations.

## Discovery Commands

```bash
us scaffold list-platforms   # JSON array of available platforms
us scaffold list-features    # JSON array of features with platform compatibility
```

## Critical Rules

1. **Always scaffold before coding** — do not manually create package.json, metro.config.js, app.json, or native plugins
2. **Verify the JSON output** — scaffold outputs `{ "success": true, ... }`. Check this before proceeding.
3. **Run `npm install` immediately** — the postinstall script handles prebuild and bare-pack
4. **Do not modify generated plugins** — `withAndroidNdkVersion.js` and `withAndroidArchitecture.js` are validated
5. **Do not change dependency versions** without checking the validated versions table above. The Mobile (Expo + Bare) entries are a **coupled set** — `bare-pack`, `expo`, `react-native`, `react-native-bare-kit`, and every `expo-*` package must move together against a re-validated bundle pipeline. Never bump one in isolation.
6. **Use `--force` when re-scaffolding** — if the directory already exists
7. **Customize after scaffolding** — add screens, features, and logic on top of the generated base
