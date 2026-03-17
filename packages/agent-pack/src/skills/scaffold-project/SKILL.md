# Scaffold Project

Use the `us` CLI to bootstrap a new Unstoppable Stack project with the correct structure, dependencies, and build configuration for a target platform.

## When to Use

- **Always** use this before manually creating project files for a new Unstoppable Stack app
- When the user asks to create a new P2P app, mobile app, desktop app, or CLI tool
- When starting any project that will use Hyperswarm, HyperDB, QVAC, or Autobase

## Command

```bash
us create \
  --platform <platform> \
  --name <project-name> \
  --features <feature1,feature2> \
  --output <path>
```

## Platforms

| Platform | Description |
|----------|-------------|
| `pear-desktop` | Pear Desktop app with worker bridge + HTML/JS UI |
| `expo-mobile` | iOS/Android with Expo, optional Bare worklet for P2P |
| `node-cli` | Node.js CLI tool with TypeScript |

## Features

| Feature | Description | Platforms |
|---------|-------------|-----------|
| `p2p` | Hyperswarm + Corestore | All |
| `kv-storage` | Hyperbee key-value database | All |
| `qvac` | QVAC SDK for local AI inference | All |
| `autobase` | Autobase multi-writer sync | pear-desktop, node-cli |

## Examples

### Mobile chat app with P2P and local AI

```bash
us create -p expo-mobile -n my-chat-app -f p2p,qvac
```

### Desktop P2P app with storage

```bash
us create -p pear-desktop -n my-sync-app -f p2p,kv-storage
```

### Node.js CLI with collaborative data

```bash
us create -p node-cli -n my-collab-tool -f p2p,autobase
```

### Minimal mobile app (QVAC only, no P2P)

```bash
us create -p expo-mobile -n my-ai-app -f qvac
```

## Output

The command outputs JSON with `success`, `projectPath`, `filesCreated`, and `nextSteps`. Parse this to confirm success.

## What Gets Generated

### expo-mobile
- `package.json` with correct dependencies, `postinstall` script, and `overrides`
- `app.json` with Expo config, native plugins, and memory entitlement
- `metro.config.js` with native module mocking
- `plugins/` with Android NDK and architecture config plugins
- `app/` with Expo Router layout and home screen with diagnostics
- `bare/index.js` with RPC worklet (when P2P is selected)
- `mocks/empty.js` for Metro native module resolution

### pear-desktop
- `package.json` with `pear` config block
- `index.html` + `index.js` with worker bridge (JSON over pipe)
- `worker.js` with P2P, storage, and/or AI initialization
- `app/index.js` with status UI

### node-cli
- `package.json` with tsx for development
- `tsconfig.json`
- `src/index.ts` with graceful startup/shutdown
- Feature managers (`swarm-manager.ts`, `storage-manager.ts`, `ai-manager.ts`, `autobase-manager.ts`)

## After Scaffolding

1. `cd <project-name> && npm install`
2. Run the generated app to verify everything builds
3. Then start implementing app-specific logic on top of the scaffolded code

## Discovery Commands

```bash
us list-platforms   # JSON array of platforms
us list-features    # JSON array of features with platform compatibility
```

## Critical Rules

1. **Always scaffold before coding** — never manually create the project structure
2. **Verify the output JSON** — check `success: true` before proceeding
3. **Run `npm install` immediately** — the generated code depends on the listed packages
4. **Don't modify generated plugins** — `withAndroidNdkVersion.js` and `withAndroidArchitecture.js` are battle-tested
5. **Add app logic on top** — the scaffold provides infrastructure, you add the features
