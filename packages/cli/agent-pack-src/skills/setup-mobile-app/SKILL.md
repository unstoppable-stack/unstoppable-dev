---
name: setup-mobile-app
description: Scaffold an Expo mobile app with Bare runtime worklet for P2P
  and AI capabilities. Use when the user wants a mobile app (iOS/Android)
  with local AI inference or P2P networking via react-native-bare-kit.
---

# Setup Mobile App (Expo + Bare)

## When to Use
- User wants to build a mobile app (iOS or Android)
- User mentions "mobile", "React Native", "Expo", "iOS", "Android"
- User needs P2P or local AI on mobile

## Prerequisites
- Node.js 20+
- Expo CLI (`npx expo`) — Expo SDK 54+
- Xcode (for iOS) or Android Studio (for Android)
- Physical device required (QVAC needs real hardware for inference)

## Architecture Overview

Mobile apps use React Native for the UI and a **Bare worklet** for the P2P/AI
backend. Communication between React Native and Bare happens through
`react-native-bare-kit`'s IPC bridge.

```
┌── React Native (UI) ──────┐      ┌── Bare Worklet ─────────────┐
│  Expo / React Native       │ IPC  │  P2P (hyperswarm)            │
│  Navigation, components    │◄───►│  Storage (hyperbee)          │
│  RPC bridge                │      │  AI (@qvac/sdk)              │
└────────────────────────────┘      └──────────────────────────────┘
```

This is conceptually similar to Pear Desktop's renderer/worker split, but
uses `react-native-bare-kit` instead of `pear-run`.

### File Structure

```
my-mobile-app/
├── app/                      # Expo Router pages
│   ├── _layout.tsx
│   └── index.tsx
├── bare/                     # Bare worklet source files
│   └── index.js              # Bare worklet entry point
├── plugins/                  # Custom Expo config plugins
│   ├── withAndroidNdkVersion.js
│   └── withAndroidArchitecture.js
├── metro.config.js           # Metro bundler config (QVAC asset types)
├── app.json                  # Expo config with QVAC + build plugins
├── package.json
└── README.md
```

## Steps

1. **Create Expo project**:
   ```bash
   npx create-expo-app my-mobile-app --template blank-typescript
   cd my-mobile-app
   ```

2. **Install QVAC SDK and mobile dependencies**:
   ```bash
   npm i @qvac/sdk expo-file-system
   npm i react-native-bare-kit@0.11.5
   npm i -D bare-pack@1.5.1
   npx expo install expo-build-properties
   ```

3. **Configure `app.json`** — add the QVAC plugin, build properties, and
   custom plugins:
   ```json
   {
     "expo": {
       "plugins": [
         "@qvac/sdk/expo-plugin",
         [
           "expo-build-properties",
           {
             "android": {
               "minSdkVersion": 29,
               "enableProguardInReleaseBuilds": true,
               "enableShrinkResourcesInReleaseBuilds": true,
               "ndkVersion": "29.0.14206865"
             }
           }
         ],
         "./plugins/withAndroidNdkVersion.js",
         "./plugins/withAndroidArchitecture.js"
       ]
     }
   }
   ```

   > **Critical**: `@qvac/sdk/expo-plugin` is required for QVAC to work on
   > mobile. It configures native build settings the SDK needs.

4. **Create the custom Expo plugins**:

   `plugins/withAndroidNdkVersion.js` — ensures NDK 29 is set before Expo's
   gradle plugin runs:
   ```js
   const { withProjectBuildGradle } = require('expo/config-plugins')

   module.exports = function withAndroidNdkVersion(config) {
     return withProjectBuildGradle(config, (config) => {
       const contents = config.modResults.contents
       if (!contents.includes('ndkVersion')) {
         config.modResults.contents = contents.replace(
           /buildscript\s*\{/,
           `buildscript {\n    ext.ndkVersion = "29.0.14206865"`
         )
       }
       return config
     })
   }
   ```

   `plugins/withAndroidArchitecture.js` — restricts to arm64 only (smaller APK):
   ```js
   const { withAppBuildGradle } = require('expo/config-plugins')

   module.exports = function withAndroidArchitecture(config) {
     return withAppBuildGradle(config, (config) => {
       const contents = config.modResults.contents
       if (!contents.includes('abiFilters')) {
         config.modResults.contents = contents.replace(
           /defaultConfig\s*\{/,
           `defaultConfig {\n        ndk { abiFilters "arm64-v8a" }`
         )
       }
       return config
     })
   }
   ```

5. **Configure Metro** (`metro.config.js`) — add QVAC asset types and enable
   package exports:
   ```js
   const { getDefaultConfig } = require('expo/metro-config')

   const config = getDefaultConfig(__dirname)

   config.resolver.unstable_enablePackageExports = true

   config.resolver.assetExts = [
     ...config.resolver.assetExts,
     'bundle', // bare-pack output
     'model',  // QVAC model files
     'onnx',   // OCR/TTS ONNX models
     'so',     // native libraries
     'bin',    // binary model files
   ]

   module.exports = config
   ```

6. **Create the Bare backend** (`bare/index.js`):
   ```js
   const rpc = Bare.rpc

   rpc.on('request', async (req) => {
     const { method, params } = JSON.parse(req.data)

     if (method === 'ping') {
       req.reply(JSON.stringify({ ok: true }))
     }
   })
   ```

7. **Bundle the backend** for mobile targets:
   ```bash
   npx bare-pack --target ios-arm64 --target ios-arm64-simulator \
     --target android-arm64 --linked \
     --out app/app.bundle.mjs bare/index.js
   ```

   > Include simulator target for iOS development. Re-run after changing
   > backend code. Consider adding a `build:bare` script to `package.json`.

8. **Use from React Native** (`app/index.tsx`):
   ```tsx
   import { useBareKit } from 'react-native-bare-kit'

   export default function Home() {
     const bare = useBareKit({ source: require('./app.bundle.mjs') })

     const ping = async () => {
       const res = await bare.request(JSON.stringify({ method: 'ping' }))
       console.log('Response:', JSON.parse(res))
     }

     return <Button onPress={ping} title="Ping Bare" />
   }
   ```

9. **Prebuild and run on device**:
   ```bash
   npx expo prebuild
   npx expo run:ios --device    # or run:android --device
   ```

   > `expo prebuild` must run after changing `app.json` plugins or native
   > config. For iterative JS changes, `expo run` alone is sufficient.

## Recommended `package.json` Scripts

```json
{
  "scripts": {
    "build:bare": "bare-pack --target ios-arm64 --target ios-arm64-simulator --target android-arm64 --linked --out app/app.bundle.mjs bare/index.js",
    "build:bare:all": "npm run build:bare",
    "prebuild": "npx expo prebuild",
    "ios": "npm run build:bare && npx expo run:ios --device",
    "android": "npm run build:bare && npx expo run:android --device"
  }
}
```

## Mobile-Specific Constraints

- **QVAC requires physical device** — simulators don't have the GPU/NPU for inference
- **Model sizes matter more** — mobile RAM is limited. Use `QWEN3_0_6B_INST` (~0.5GB) or `LLAMA_3_2_1B_INST_Q4_0` (~1GB)
- **Bare suspend/resume** — the worklet pauses when the app backgrounds. Handle reconnection on resume.
- **NAT traversal** — mobile networks have stricter NAT. Hyperswarm handles this but connections may be slower.
- **Bundle size** — `bare-pack` creates platform-specific bundles. Keep dependencies minimal in the backend.
- **Android APK size** — use the architecture plugin to restrict to `arm64-v8a` only. Without it, APK includes all ABIs.

## Key Gotchas
- `@qvac/sdk/expo-plugin` must be in `app.json` plugins — without it, QVAC crashes on native init
- `expo-file-system` is a required peer dependency for `@qvac/sdk` on mobile
- `bare-pack` must be re-run after changing backend code
- `npx expo prebuild` must be re-run after changing `app.json` plugins
- The Bare worklet is a separate JS context — no shared memory with React Native
- Use JSON-RPC over the IPC bridge (same pattern as Pear worker bridge)
- iOS requires signing and provisioning for device testing
- Android requires NDK 29 — the custom plugin ensures this is set correctly
- Test on real devices early — simulator behavior differs significantly

## Reference Apps

- `reference-apps/qvac-health/` — Full mobile app with AI chat, OCR, BLE, multiple Bare worklets
- `reference-apps/qvac-workbench-mobile/` — Simpler mobile app, delegates P2P to workbench-core

> **Status**: Updated 2026-03-06 from reference apps (qvac-health, qvac-workbench-mobile)
> and official QVAC docs. The `@qvac/sdk/expo-plugin`, Android NDK/architecture
> plugins, and Metro config are validated from both reference apps. The Bare
> worklet IPC pattern is consistent but not yet battle-tested in our own project.
