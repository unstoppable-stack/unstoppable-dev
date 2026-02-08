---
id: expo-bare
name: Expo Bare
category: module
requires: [bare]
tags: [mobile, react-native, p2p]
priority: medium
---

# Expo Bare (Bare on Mobile)

## Overview
Expo Bare refers to running Bare runtime inside a React Native/Expo app using `react-native-bare-kit` and `bare-pack` bundles. This lets mobile apps run P2P backends (Hypercore, Hyperswarm, QVAC) in a Bare worklet while the UI stays in React Native.

## Version Notes
- Verified in local sources: `react-native-bare-kit` ^0.11.5 (qvac-health-dev) and ^0.9.3 (qvac-app-workbench-mobile-main).
- Verified in local sources: `bare-pack` ^1.5.1 (qvac-health-dev).

## Installation
```bash
npm i react-native-bare-kit bare-pack
```

## Quick Start
```bash
git clone https://github.com/holepunchto/bare-expo.git my-bare-app
cd my-bare-app
npm i
```

```bash
# bundle Bare backend for iOS + Android
npx bare-pack --target ios --target android --linked --out app/app.bundle.mjs backend/backend.mjs
```

## Core Concepts
- Worklet: `react-native-bare-kit` runs a Bare thread inside RN.
- Bundling: `bare-pack` produces a single bundle with native addon references.
- RPC bridge: `bare-rpc` over the Worklet IPC stream connects UI and backend.

## API Reference
- `Worklet.start(path, bundle, args)` to launch Bare.
- `bare-pack --target ios --target android --linked` for mobile bundles.
- `bare-rpc` request/response over IPC.

## Integration with Other Modules
- Hyperswarm/Hypercore run inside the Bare worklet for P2P networking.
- QVAC uses Bare for inference on mobile via Expo (physical device required).
- WDK uses `react-native-bare-kit` for crypto/network modules.

## Common Patterns
```js
// UI side
import { Worklet } from "react-native-bare-kit"
import RPC from "bare-rpc"

const worklet = new Worklet()
worklet.start("/app.bundle", bundle, [documentDirectory])
const rpc = new RPC(worklet.IPC, onRequest)
```

```js
// Bare backend side
import RPC from "bare-rpc"
const { IPC } = BareKit
const rpc = new RPC(IPC, onRequest)
```

## Pitfalls & Gotchas
- Android requires minSdkVersion 29+ and NDK alignment (Expo build props).
- Bundle with `--linked` to use prelinked native addons on mobile.
- QVAC LLM inference does not run on emulators; use physical devices.

## Resources
- https://docs.pear.holepunch.to/guide/making-a-bare-mobile-app
- https://github.com/holepunchto/bare-expo
- https://docs.pear.holepunch.to/reference/bare-overview
