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

| Feature | Description | Platforms |
|---------|-------------|-----------|
| `p2p` | Hyperswarm + Corestore networking | All |
| `kv-storage` | Hyperbee key-value database | All |
| `qvac` | QVAC SDK for local AI inference | All |
| `autobase` | Autobase multi-writer sync | pear-desktop, node-cli |

## Examples

```bash
# Mobile chat app with P2P and local AI
us scaffold app -p expo-mobile -n my-chat -f p2p,qvac

# Desktop P2P app with collaborative storage
us scaffold app -p pear-desktop -n my-sync -f p2p,kv-storage,autobase

# Node.js CLI with AI
us scaffold app -p node-cli -n my-tool -f qvac

# Minimal mobile app (no features — just the shell)
us scaffold app -p expo-mobile -n my-app
```

## What Gets Generated (and why you should not do it manually)

### expo-mobile

The scaffold produces a **fully buildable** Expo project. All 7 feature combinations (bare, p2p, qvac, kv-storage, p2p+qvac, p2p+kv-storage, p2p+kv-storage+qvac) have been validated to:
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
- Feature managers as needed (`swarm-manager.ts`, `storage-manager.ts`, `ai-manager.ts`, `autobase-manager.ts`)

## After Scaffolding

```bash
cd <project-name>
npm install          # installs deps + runs postinstall (prebuild, bare-pack)
npm run ios          # expo-mobile: build and run on simulator
npm run dev          # node-cli or pear-desktop: start dev mode
```

Then start implementing app-specific logic on top of the scaffolded code.

## Validated Dependency Versions

These versions are battle-tested and validated through automated research:

| Package | Version | Notes |
|---------|---------|-------|
| `expo` | `~54.0.33` | Expo SDK 54 |
| `expo-build-properties` | `~1.0.9` | **Must be in dependencies**, not just plugins |
| `react-native-bare-kit` | `0.11.5` | Pin exact — API changes between versions |
| `bare-pack` | `^1.5.1` | **Must be 1.x** — 2.x has breaking CLI flag changes |
| `@qvac/sdk` | `^0.11.0` | Local AI inference |
| `@qvac/cli` | `^0.5.0` | **Required as devDep for QVAC mobile** — auto-runs `qvac verify bundle` during Expo prebuild |
| `zod` | `^4.3.0` | Required by `@qvac/sdk@0.10+` — install v4.3+ explicitly when using tool calling |
| `bare-rpc` | `^1.1.0` | P2P RPC |
| `hyperswarm` | `^4.16.0` | P2P networking |
| `autobase` | `^7.27.0` | Multi-writer consensus |

## Known Issues (from research)

1. **`bare-pack@2.x` breaks mobile builds** — the `--target` CLI flag was removed in 2.x. Always use `^1.5.1`.
2. **`expo-build-properties` must be a dependency** — listing it only in `app.json` plugins without installing it causes prebuild to fail.
3. **`@qvac/cli` must be ≥ 0.4.0 for SDK 0.11** — `@qvac/sdk@0.11.x` declares `@qvac/cli@^0.4.0` as the peerOptional range. We use `^0.5.0` (latest line) which is runtime-compatible but requires `--legacy-peer-deps` because npm strict semver doesn't treat `0.5.x` as satisfying `^0.4.0`. Pin `^0.4.0` if you need clean peer resolution. Avoid older lines (`^0.1.2` / `^0.2.4`) — they predate `qvac verify bundle` which 0.11 auto-runs during Expo prebuild.
4. **QVAC expo plugin needs local `@qvac/cli`** — without it, npx downloads a mismatched version that can't bundle.
5. **Untyped P2P modules** — `hyperswarm`, `corestore`, `hypercore-crypto`, `hyperbee`, `autobase` have no TypeScript types. The scaffold generates `src/types.d.ts` with module declarations.

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
5. **Do not change dependency versions** without checking the validated versions table above
6. **Use `--force` when re-scaffolding** — if the directory already exists
7. **Customize after scaffolding** — add screens, features, and logic on top of the generated base
