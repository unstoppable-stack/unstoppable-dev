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
- Expo CLI (`npx expo`)
- Xcode (for iOS) or Android Studio (for Android)
- Physical device recommended (QVAC needs real hardware for inference)

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
├── backend/
│   └── index.js              # Bare worklet entry point
├── bare.config.js            # bare-pack configuration
├── app.json                  # Expo config
├── package.json
└── README.md
```

## Steps

1. **Create Expo project**:
   ```bash
   npx create-expo-app my-mobile-app
   cd my-mobile-app
   ```

2. **Install Bare Kit**:
   ```bash
   npx expo install react-native-bare-kit
   npm install bare-pack
   ```

3. **Create the Bare backend** (`backend/index.js`):
   ```js
   // This runs in the Bare worklet — P2P and AI modules work here
   const rpc = Bare.rpc

   rpc.on('request', async (req) => {
     const { method, params } = JSON.parse(req.data)

     if (method === 'ping') {
       req.reply(JSON.stringify({ ok: true }))
     }
   })
   ```

4. **Bundle the backend** for mobile targets:
   ```bash
   npx bare-pack --target ios --target android --linked \
     --out app/app.bundle.mjs backend/index.js
   ```

5. **Use from React Native** (`app/index.tsx`):
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

6. **Run on device**:
   ```bash
   npx expo run:ios    # or run:android
   ```

## Mobile-Specific Constraints

- **QVAC requires physical device** — simulators don't have the GPU/NPU for inference
- **Model sizes matter more** — mobile RAM is limited. Use `QWEN3_0_6B_INST` (~0.5GB) or `LLAMA_3_2_1B_INST_Q4_0` (~1GB)
- **Bare suspend/resume** — the worklet pauses when the app backgrounds. Handle reconnection on resume.
- **NAT traversal** — mobile networks have stricter NAT. Hyperswarm handles this but connections may be slower.
- **Bundle size** — `bare-pack` creates platform-specific bundles. Keep dependencies minimal in the backend.

## Key Gotchas
- `bare-pack` must be re-run after changing backend code
- The Bare worklet is a separate JS context — no shared memory with React Native
- Use JSON-RPC over the IPC bridge (same pattern as Pear worker bridge)
- iOS requires signing and provisioning for device testing
- Test on real devices early — simulator behavior differs significantly

> **Status**: This skill is based on QVAC reference apps and documentation.
> NOT yet battle-tested in a real project. The architecture pattern (UI +
> native worklet) mirrors the proven Pear Desktop pattern, but mobile-specific
> issues (bare-pack bundling, suspend/resume, NAT on cellular) are unvalidated.
> Reference material: `research/qvac-app-workbench-mobile-main/`,
> `research/qvac-health-dev/`.
