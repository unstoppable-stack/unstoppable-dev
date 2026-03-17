---
name: setup-mobile-app
description: Scaffold an Expo mobile app with Bare runtime worklet for P2P
  and AI capabilities. Use when the user wants a mobile app (iOS/Android)
  with local AI inference or P2P networking via react-native-bare-kit.
---

# Setup Mobile App (Expo + Bare)

> **Preferred**: Run `us create -p expo-mobile -n <name> -f <features>` first.
> This skill documents the details if you need to customize beyond what the scaffold provides.

## When to Use
- User wants to build a mobile app (iOS or Android)
- User mentions "mobile", "React Native", "Expo", "iOS", "Android"
- User needs P2P or local AI on mobile

## Prerequisites
- Node.js 20+
- Expo CLI (`npx expo`) — Expo SDK 54+
- Xcode (for iOS) or Android Studio (for Android)
- A native dev build is **required** — Expo Go cannot host BareKit or QVAC

## Before You Start (Checklist)

Run through this before writing any code:

1. **Decide the app type** — QVAC-only, P2P-only, or P2P+AI combined?
2. Verify the actual `react-native-bare-kit` API from the installed package exports
3. P2P apps need a **Bare worklet**; QVAC-only apps do NOT need one
4. Decide whether routing is needed for v1 (if not, skip expo-router)
5. Plan a `postinstall` script to automate bare-pack + prebuild
6. Decide the absolute app storage path strategy before adding Hypercore/HyperDB/QVAC
7. Check if your package manager needs special handling (pnpm needs `.npmrc` + custom linker)
8. Separate "simulator unsupported for QVAC inference" from "simulator unsupported for Bare worklets"

## Architecture Overview

Mobile apps use React Native for the UI. If P2P or local storage is needed,
a **Bare worklet** runs alongside. Communication happens through
`react-native-bare-kit`'s IPC bridge. QVAC inference always runs in the
Expo/React Native runtime — NOT in the Bare worklet.

```
┌── Expo / React Native (UI) ──┐      ┌── Bare Worklet (optional) ──┐
│  Navigation, components        │ IPC  │  P2P (hyperswarm)            │
│  QVAC inference (if needed)    │◄───►│  Storage (hyperbee)          │
│  RPC client                    │      │  RPC server                  │
└────────────────────────────────┘      └──────────────────────────────┘
```

> **IMPORTANT**: `@qvac/sdk` runs in the **Expo/React Native** runtime, NOT inside
> the Bare worklet. See "QVAC + Bare Worklet Architecture" section below.

### File Structure

```
my-mobile-app/
├── app/                      # App screens (Expo Router)
│   ├── _layout.tsx           # Root layout
│   └── index.tsx             # Main screen
├── bare/                     # Bare worklet source files (P2P apps only)
│   └── index.js              # Worklet entry point
├── plugins/                  # Custom Expo config plugins (parameterized)
│   ├── withAndroidNdkVersion.js
│   └── withAndroidArchitecture.js
├── mocks/
│   └── empty.js              # Empty module for Metro native module mocking
├── metro.config.js           # Metro bundler config (with native module mocks)
├── app.json                  # Expo config with plugins
├── package.json              # With postinstall automation
└── .npmrc                    # Only if using pnpm
```

## Steps

### Step 1: Create Expo Project

```bash
npx create-expo-app my-mobile-app --template blank-typescript
cd my-mobile-app
```

### Step 2: Install Core Dependencies

For **QVAC-only** apps (no custom Bare worklet):
```bash
npm i @qvac/sdk expo-file-system expo-device react-native-bare-kit@0.11.5
npx expo install expo-build-properties
```

For **P2P apps** (with Bare worklet):
```bash
npm i react-native-bare-kit@0.11.5 bare-rpc@1.1.0 expo-file-system
npm i -D bare-pack@1.5.1
npx expo install expo-build-properties
```

For **P2P + AI combined**:
```bash
npm i react-native-bare-kit@0.11.5 bare-rpc@1.1.0 @qvac/sdk expo-file-system expo-device
npm i -D bare-pack@1.5.1
npx expo install expo-build-properties
```

### Step 3: Configure `app.json`

```json
{
  "expo": {
    "newArchEnabled": true,
    "plugins": [
      "expo-router",
      [
        "expo-build-properties",
        {
          "android": {
            "minSdkVersion": 29,
            "enableProguardInReleaseBuilds": true,
            "enableShrinkResourcesInReleaseBuilds": true
          }
        }
      ],
      ["./plugins/withAndroidNdkVersion.js", "29.0.14206865"],
      ["./plugins/withAndroidArchitecture.js", ["arm64-v8a"]]
    ],
    "ios": {
      "entitlements": {
        "com.apple.developer.kernel.increased-memory-limit": true
      }
    }
  }
}
```

Add `"@qvac/sdk/expo-plugin"` to plugins ONLY when using QVAC. Place it
before `expo-build-properties`.

### Step 4: Create Parameterized Expo Plugins

These plugins accept configuration values from `app.json` — do NOT hardcode
values. Both reference apps (`qvac-workbench-mobile`, `qvac-health`) use
this pattern.

`plugins/withAndroidNdkVersion.js`:
```js
const { withProjectBuildGradle } = require('@expo/config-plugins')

module.exports = function withAndroidNdkVersion(config, ndkVersion) {
  if (!ndkVersion) {
    console.warn('[withAndroidNdkVersion] No NDK version provided, skipping')
    return config
  }

  return withProjectBuildGradle(config, (config) => {
    let buildGradle = config.modResults.contents

    const extBlock = `\next {\n    ndkVersion = "${ndkVersion}"\n}\n\n`

    if (buildGradle.includes('ext {') && buildGradle.includes('ndkVersion')) {
      buildGradle = buildGradle.replace(
        /ndkVersion\s*=\s*["'][^"']*["']/,
        `ndkVersion = "${ndkVersion}"`
      )
    } else if (buildGradle.includes('ext {')) {
      buildGradle = buildGradle.replace(
        /ext\s*\{/,
        `ext {\n    ndkVersion = "${ndkVersion}"`
      )
    } else {
      buildGradle = buildGradle.replace(
        /apply plugin: "expo-root-project"/,
        `${extBlock}apply plugin: "expo-root-project"`
      )
    }

    config.modResults.contents = buildGradle
    console.log(`[withAndroidNdkVersion] Set NDK version to ${ndkVersion}`)
    return config
  })
}
```

`plugins/withAndroidArchitecture.js`:
```js
const { withGradleProperties, withAppBuildGradle } = require('@expo/config-plugins')

module.exports = function withAndroidArchitecture(config, architectures = ['arm64-v8a']) {
  config = withGradleProperties(config, (config) => {
    const architectureString = architectures.join(',')
    const propIndex = config.modResults.findIndex(
      (item) => item.type === 'property' && item.key === 'reactNativeArchitectures'
    )

    if (propIndex >= 0) {
      config.modResults[propIndex].value = architectureString
    } else {
      config.modResults.push({
        type: 'property',
        key: 'reactNativeArchitectures',
        value: architectureString,
      })
    }
    return config
  })

  config = withAppBuildGradle(config, (config) => {
    let buildGradle = config.modResults.contents
    const abiFiltersArray = architectures.map((arch) => `"${arch}"`).join(', ')
    const ndkBlock = `\n        ndk {\n            abiFilters ${abiFiltersArray}\n        }`

    if (!buildGradle.includes('ndk {')) {
      const buildConfigRegex =
        /(buildConfigField\s+"String",\s+"REACT_NATIVE_RELEASE_LEVEL"[^\n]*\n)/
      if (buildConfigRegex.test(buildGradle)) {
        buildGradle = buildGradle.replace(buildConfigRegex, `$1${ndkBlock}\n`)
      }
    } else {
      const ndkRegex = /ndk\s*\{[^}]*\}/s
      const newNdkBlock = `ndk {\n            abiFilters ${abiFiltersArray}\n        }`
      buildGradle = buildGradle.replace(ndkRegex, newNdkBlock)
    }

    config.modResults.contents = buildGradle
    return config
  })

  return config
}
```

> **Key difference from the old version**: `withAndroidArchitecture` now
> modifies BOTH `gradle.properties` (via `withGradleProperties`) AND
> `app/build.gradle` (via `withAppBuildGradle`). This matches both reference
> apps and prevents architecture mismatches.

### Step 5: Configure Metro with Native Module Mocking

Native Node.js modules (used by P2P libraries) cannot run inside React
Native's JavaScript engine. They must be mocked in Metro so the bundler
doesn't crash when it encounters them.

Create `mocks/empty.js`:
```js
module.exports = {}
```

`metro.config.js`:
```js
const { getDefaultConfig } = require('expo/metro-config')
const path = require('path')

const config = getDefaultConfig(__dirname)

config.resolver.unstable_enablePackageExports = true

const emptyModule = require.resolve('./mocks/empty.js')
const nativeModuleMocks = [
  'sodium-native',
  'sodium-universal',
  'corestore',
  'hypercore',
  'hyperbee',
  'hyperswarm',
  'autobase',
  'bare-fs',
  'bare-path',
  'bare-os',
]

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (nativeModuleMocks.includes(moduleName)) {
    return { filePath: emptyModule, type: 'sourceFile' }
  }
  return context.resolveRequest(context, moduleName, platform)
}

config.resolver.assetExts = [
  ...config.resolver.assetExts,
  'bundle',
  'bin',
  'model',
  'onnx',
]

module.exports = config
```

> **Why mock these modules?** When your app imports modules that also
> `require('sodium-native')` or `require('hyperswarm')`, Metro will try to
> resolve them. These native Node.js modules only work in the Bare runtime,
> not React Native. The workbench reference app mocks all of these.

### Step 6: Create the Bare Worklet (P2P apps only)

Skip this step if building a QVAC-only app.

`bare/index.js`:
```js
const RPC = require('bare-rpc')
const { IPC } = BareKit

const rpc = new RPC(IPC, async (request) => {
  try {
    const params = request.data?.length > 0
      ? JSON.parse(request.data.toString())
      : {}
    let response

    if (request.command === 1) {
      response = { ok: true, echo: params }
    } else {
      response = { error: `Unknown command: ${request.command}` }
    }

    request.reply(JSON.stringify(response))
  } catch (error) {
    request.reply(JSON.stringify({
      error: error instanceof Error ? error.message : 'Unknown error'
    }))
  }
})
```

> **Alternative**: For apps with many commands, consider using `HRPC`
> (from `hyperschema`) for typed, named commands instead of raw numeric IDs.
> The `qvac-health` reference app uses this pattern for its backup worklet.

### Step 7: Set Up Build Automation

The goal is: `npm install && expo run:ios` should just work. Reference apps
achieve this with `postinstall` scripts.

**For P2P apps** (with Bare worklet), add to `package.json`:
```json
{
  "scripts": {
    "start": "expo start",
    "build:bare": "npx bare-pack --target ios-arm64 --target ios-arm64-simulator --target ios-x64-simulator --target android-arm64 --linked --out bare/app.bundle.js bare/index.js",
    "postinstall": "npm run build:bare && npx expo prebuild",
    "ios": "expo run:ios",
    "ios:clean": "rm -rf ios android && npm run postinstall && expo run:ios",
    "android": "expo run:android"
  }
}
```

**For QVAC-only apps** (no custom worklet):
```json
{
  "scripts": {
    "start": "expo start",
    "postinstall": "npx expo prebuild",
    "ios": "expo run:ios",
    "ios:clean": "rm -rf ios android && npm run postinstall && expo run:ios",
    "android": "expo run:android"
  }
}
```

> The `postinstall` script ensures that after `npm install`, the native
> projects are generated and ready. This is the pattern used by the
> `qvac-health` reference app.

**Add `overrides` for common dependency conflicts**:
```json
{
  "overrides": {
    "bare-fs": "4.5.1"
  }
}
```

### Step 8: Use from React Native

```tsx
import { useEffect, useRef, useState } from 'react'
import { Button, Text, View, TurboModuleRegistry, NativeModules } from 'react-native'

function hasBareKitNativeModule(): boolean {
  return !!(TurboModuleRegistry.get('BareKit') || NativeModules.BareKit)
}

export default function Home() {
  if (!hasBareKitNativeModule()) {
    return (
      <View>
        <Text>BareKit requires a native dev build.</Text>
        <Text>Run: npx expo prebuild && npx expo run:ios</Text>
      </View>
    )
  }
  return <BareEnabledHome />
}

function BareEnabledHome() {
  const [status, setStatus] = useState('loading...')

  useEffect(() => {
    let worklet: any
    ;(async () => {
      const { Worklet } = require('react-native-bare-kit')
      const RPC = require('bare-rpc')
      const source = require('../bare/app.bundle.js')

      worklet = new Worklet()
      await worklet.start('/app.bundle', source)

      const rpc = new RPC(worklet.IPC)
      const response = await rpc.request(1, JSON.stringify({ ping: true }))
      setStatus(JSON.parse(response.toString()).ok ? 'Bare is running' : 'Error')
    })()
    return () => { worklet?.terminate() }
  }, [])

  return <View><Text>{status}</Text></View>
}
```

> **CRITICAL**: `Worklet.start()` expects source text or bytes, NOT a Metro
> asset ID (number). The bundle must be imported as a JS module that resolves
> to source text. If you get `source must be a string or typed array`, you're
> passing a Metro asset ID.

### Step 9: Build and Run

```bash
npm install
npm run ios     # or: npm run android
```

That's it. The `postinstall` script handles bare-pack, prebuild, and addon
linking automatically.

For a clean rebuild after changing `app.json` plugins or native config:
```bash
npm run ios:clean
```

---

## Build Order (What `postinstall` Automates)

If you need to run steps manually (debugging, CI), this is the required order:

1. `npm install`
2. `build:bare` — generate the Bare worklet bundle (P2P apps only)
3. `expo prebuild` — generate native iOS/Android projects
4. `expo run:ios` or `expo run:android` — build and launch

**Validate in this order:**
1. App shell renders (no crash)
2. Bare worklet starts (no TurboModule error) — P2P apps only
3. RPC round-trip succeeds — P2P apps only
4. QVAC model loads and generates tokens — AI apps only
5. Storage writes succeed
6. App restart restores persisted state

## pnpm-Specific Setup

If using pnpm (common in monorepos), additional configuration is needed.
**Neither reference app uses pnpm** — they use npm or bun. Consider these
alternatives first.

If you must use pnpm:

### `.npmrc`

`bare-pack` and QVAC worker generation may fail to resolve transitive
dependencies under pnpm's strict layout:

```
public-hoist-pattern=*
```

### Local Entrypoint

`expo/AppEntry` and `expo-router/entry` can fail under pnpm workspace
resolution. Create a local `index.js`:

```js
import { registerRootComponent } from 'expo'
import App from './app/index'

registerRootComponent(App)
```

Update `package.json`: `{ "main": "index.js" }`

### Custom Addon Linker

The built-in `react-native-bare-kit` linker resolves the app root from the
pnpm package store, not from your actual project. Create
`scripts/link-bare-addons.mjs`:

```js
import path from 'node:path'
import fs from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const bareKitEntryPath = require.resolve('react-native-bare-kit')
const appRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)), '..'
)
const bareKitRoot = path.dirname(bareKitEntryPath)
const linkModulePath = require.resolve('bare-link', { paths: [bareKitRoot] })
const { default: link } = await import(linkModulePath)

await generateAddons({
  label: 'ios',
  target: ['ios-arm64', 'ios-arm64-simulator', 'ios-x64-simulator'],
  out: path.join(bareKitRoot, 'ios', 'addons'),
})

await generateAddons({
  label: 'android',
  target: ['android-arm64', 'android-arm', 'android-ia32', 'android-x64'],
  out: path.join(bareKitRoot, 'android', 'src', 'main', 'addons'),
})

async function generateAddons({ label, target, out }) {
  let count = 0
  for await (const resource of link(appRoot, { target, out })) {
    console.log(`[link-bare-addons] ${label}: ${resource}`)
    count += 1
  }
  console.log(`[link-bare-addons] ${label}: generated ${count} resources`)
}
```

Update `postinstall` to include the linker:
```json
"postinstall": "npm run build:bare && node ./scripts/link-bare-addons.mjs && npx expo prebuild && node ./scripts/link-bare-addons.mjs"
```

> **Why link addons twice?** `expo prebuild` may regenerate native projects
> and overwrite addon artifacts. Running the linker before AND after prebuild
> ensures addons survive the regeneration.

## Storage Paths on Mobile

**Never use relative paths** like `./storage` in the Bare worklet. On mobile,
the worklet's working directory is not a writable app location.

Resolve an absolute documents directory in React Native and pass it to the
worklet:

```tsx
import { Paths, Directory } from 'expo-file-system'

function getStorageDirectory(): string {
  const docsDir = Paths.document
  const appDir = new Directory(docsDir, 'my-app-storage')
  appDir.create()
  return appDir.uri.replace('file://', '')
}
```

Pass this path to the worklet via RPC at startup. All Hypercore, HyperDB,
and Hyperbee storage paths should be derived from this base directory.

## Simulator vs Device Guidance

Do NOT treat "simulator" as blanket unsupported. The rules are:

| Feature | iOS Simulator | Android Emulator | Physical Device |
|---------|--------------|-----------------|----------------|
| Bare worklets | Works (if addons linked correctly) | Works | Works |
| P2P (Hyperswarm) | Works | Works | Works |
| Storage (Hyperbee) | Works | Works | Works |
| QVAC inference | Not supported (no GPU/NPU) | Not supported | Required |

**If the simulator crashes**, first check:
1. Are native projects fresh? (`npx expo prebuild --clean`)
2. Are linked addons generated? (`react-native-bare-kit/ios/addons/`)
3. Is Metro config mocking native modules? (check `metro.config.js`)

Do NOT conclude "simulator is unsupported" from one crash. Compare your setup
to the reference app first.

---

## QVAC + Bare Worklet Architecture

> This section applies when building a mobile app that has BOTH a custom Bare
> worklet (for P2P/storage) AND QVAC local AI inference.

### The Runtime Split

This is the single most important architectural decision:

- **Bare worklet** owns: P2P transport, storage, message replication
- **Expo/React Native** owns: QVAC inference, model loading, assistant UX

**Do NOT import `@qvac/sdk` into the Bare worklet.** That was the wrong runtime
in battle testing. It creates:
- excessive `bare-pack` traversal of the QVAC SDK dependency surface
- worse pnpm resolution failures
- unrelated transitive packages breaking the bundle
- the chat worklet becoming responsible for AI runtime concerns

### QVAC Installation

```bash
npm i @qvac/sdk expo-file-system expo-device
```

Add to `app.json` plugins (before `expo-build-properties`):
```json
"@qvac/sdk/expo-plugin"
```

### Static Imports (Required)

For the main QVAC inference path, use **static imports**:

```ts
import {
  LLAMA_3_2_1B_INST_Q4_0,
  completion,
  loadModel,
  unloadModel,
  deleteCache,
} from '@qvac/sdk'
```

**Do NOT use `import('@qvac/sdk')`** (dynamic import) for the main inference
flow. In Expo + Metro + Hermes, the lazy import path can fail with
`identifier expected in declaration`. The reference workbench uses static
imports for its main inference path.

### Combined Addon Manifest (pnpm only)

When using pnpm, the addon linking must produce one combined inventory that
includes both Bare addons (bare-type, sodium-native, etc.) and QVAC addons
(@qvac/llm-llamacpp, etc.). Standard npm/bun setups handle this automatically.

### QVAC Validation Order

1. `npm install` succeeds
2. `expo prebuild` succeeds
3. App boots
4. Bare worklet starts (if using one)
5. `@qvac/sdk` import succeeds (check with diagnostics)
6. Model download starts
7. Model loads
8. Completion generates tokens
9. Assistant reply appears in chat

### Diagnostics First

Before changing prompts, models, CPU/GPU flags, or retry logic, add in-app
diagnostics that report:

- Config initialization status
- SDK import success/failure
- Model load progress and result
- Completion start/stream/end
- Any error with the exact failure boundary

This is a **required workflow**, not an optional tip. The biggest debugging
loops in battle testing happened because the failure boundary was unknown.

---

## Mobile-Specific Constraints

- **Model sizes matter more** — mobile RAM is limited. Use `LLAMA_3_2_1B_INST_Q4_0` (~1GB) or smaller
- **Bare suspend/resume** — the worklet pauses when the app backgrounds. Handle reconnection on resume.
- **NAT traversal** — mobile networks have stricter NAT. Hyperswarm handles this but connections may be slower.
- **Bundle size** — `bare-pack` creates platform-specific bundles. Keep Bare worklet dependencies minimal.
- **Android APK size** — use the architecture plugin to restrict to `arm64-v8a` only

## Critical Rules

1. **Do NOT start with Expo Router** unless the app actually needs multi-screen navigation
2. **Do NOT prototype BareKit flows in Expo Go** — use native dev builds from the start
3. **Do NOT trust unverified `useBareKit` examples** — verify against installed package exports
4. **Do NOT pass Metro asset IDs to `Worklet.start()`** — pass source text/bytes
5. **Do NOT let `expo prebuild` run before `build:bare`** — the worklet bundle must exist first
6. **Do NOT import `@qvac/sdk` into the Bare worklet** — run QVAC in Expo/RN runtime
7. **Do NOT debug QVAC by tuning prompts/models first** — add diagnostics, then fix
8. **Do NOT use relative storage paths** in mobile Bare backends
9. **Do NOT hardcode values in Expo plugins** — accept params from `app.json`
10. **Do NOT skip Metro native module mocking** — P2P imports in the RN bundle will crash without mocks
11. **Do NOT assume pnpm works out of the box** — reference apps use npm or bun

## Validation

Run these checks in order after completing the setup:

1. `npm install` completes without errors
2. `postinstall` builds bare bundle and runs prebuild successfully
3. `expo run:ios` (or `run:android`) launches the app
4. App shell renders (no crash, no TurboModule error)
5. Bare worklet starts and RPC round-trip succeeds (P2P apps)
6. QVAC model loads and generates tokens (AI apps)
7. Storage writes succeed and persist across restarts
8. P2P peer discovery works between two devices (P2P apps)
9. Clean rebuild works: `npm run ios:clean`

## Troubleshooting

### `isEdgeToEdge is not a function`
Router/native-stack startup mismatch. For single-screen v1 apps, remove Expo
Router and use a plain Expo root component.

### `TurboModuleRegistry ... 'BareKit' could not be found`
Running in Expo Go or using a stale native build. BareKit requires:
- `npx expo prebuild`
- `npx expo run:ios` (or `run:android`)

### `useBareKit is not a function`
Wrong API for `react-native-bare-kit@0.11.5`. Use `Worklet` + `IPC` + `bare-rpc`.

### `source must be a string or typed array`
Metro returned an asset ID (number) instead of bundle source text. Import the
bundle as a JS module and pass the source string to `worklet.start()`.

### `Cannot resolve module 'sodium-native'` (or any native Node.js module)
Metro is trying to bundle a native Node.js module for React Native. Add it
to `nativeModuleMocks` in `metro.config.js`. The workbench reference app
mocks: sodium-native, sodium-universal, corestore, hypercore, hyperbee,
hyperswarm, autobase, bare-fs, bare-path, bare-os.

### `ADDON_NOT_FOUND ... sodium-native` (or any addon)
Linked Bare addons were not generated or not included in the native build.
1. Run `npx expo prebuild --clean`
2. Check `react-native-bare-kit/ios/addons/` exists
3. Rebuild: `npm run ios:clean`

### `ENOENT ... stat "storage"`
The Bare worklet is using a relative path. Pass an absolute documents directory
from React Native via RPC.

### `MODULE_NOT_FOUND: Cannot find module '@qvac/infer-base'`
pnpm worker-bundling visibility issue. Add `public-hoist-pattern=*` to `.npmrc`.
Do NOT chase each missing module individually.

### `Unable to resolve "expo-device"`
The QVAC SDK version requires `expo-device`. Install it:
`npx expo install expo-device`

### `identifier expected in declaration` (QVAC)
Dynamic import of `@qvac/sdk` failed. Switch the main inference path to
static imports. Compare to the reference workbench pattern.

### Dependency version conflicts at install time
Add `overrides` (npm) or `resolutions` (yarn) in `package.json`:
```json
{ "overrides": { "bare-fs": "4.5.1" } }
```
Both reference apps use this pattern for conflicting transitive dependencies.

## Reference Apps

- `reference-apps/qvac-workbench-mobile/` — QVAC-only mobile app. Uses `expo-router/entry`,
  no custom Bare worklet. Mocks native modules in Metro. Parameterized plugins. Simple scripts.
- `reference-apps/qvac-health/` — Full P2P + AI app with multiple Bare worklets (backup, RAG,
  OCR, delegated inference). Uses `postinstall` to automate everything. Uses `bun`.

> **Status**: Updated 2026-03-07. Rewritten based on analysis of both reference
> apps (`qvac-workbench-mobile` and `qvac-health`). Plugin implementations,
> Metro config, build automation, and architecture patterns are all aligned
> with production reference code.
