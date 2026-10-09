---
name: setup-mobile-app
description: Build and debug an experimental Expo app with a Bare worklet and optional QVAC.
when_to_use: User is customizing an Expo mobile app with Bare worklet backend, or debugging mobile build/runtime issues.
paths: ["app.json", "app/**", "bare/**", "qvac.config.json"]
version: "2026-10-09"
---

# Setup Mobile App (Expo + Bare)

Mobile is a deferred source target, excluded from the core public preview. Use the full internal CLI build; the published minimal CLI only offers Pear Desktop. Build/install, simulator UI and physical-device AI are separate acceptance levels.

## Scaffold from source

From the repository:

```bash
cd packages/cli
npm install
npm run build:full
node dist/us.js scaffold app -p expo-mobile -n my-mobile-app -f local-ai
```

Use Node >=22.17, Xcode for iOS, and Android Studio/NDK for Android. A native development build is required; Expo Go cannot host BareKit or the SDK worker.

The compatibility candidate is Expo ~54.0.33, React Native 0.81.5, React/React DOM 19.1.0, Bare kit exactly 0.15.6, bare-pack ^2.2.1 and optional QVAC SDK exactly 0.21.0. Kit 0.15.6 embeds Bare 1.33.4; kit 0.15.0 embeds 1.29.4. Validate the entire addon graph when changing these. See `core/verified-versions.mdc` and `modules/expo-bare.mdc`.

## Runtime boundaries

- React Native owns screens and calls the SDK's Expo client.
- The custom `bare/index.js` worklet owns Hyperbee storage and any P2P logic you add. It is always present in the scaffold. Worker readiness alone does not prove peer discovery or replication.
- Worklet IPC plus bare-rpc connects the UI and custom worklet.
- QVAC's Expo client starts a separate SDK worker. Do not import the SDK in the custom P2P worklet.
- SDK imports in React Native must be static so Metro can select the Expo export condition.

## What the scaffold provides

- Native module mocks in Metro, parameterized Android plugins and memory entitlements.
- `build:bare` for the custom worklet, using full host triples and `--linked`.
- Explicit `prebuild`, `prestart`, `preios` and `preandroid` hooks. There is no native-build postinstall: dependency installation succeeds separately from native tooling.
- For local AI, `qvac.config.json` selects only `@qvac/sdk/llamacpp-completion/plugin`.
- The SDK Expo plugin uses `installMissingPrebuilds: true`, generates and verifies the mobile SDK bundle, and installs required published native platform packages. Commit the generated app's lockfile after prebuild so those packages remain reproducible.

Do not recreate these files manually or add broad dependency overrides/legacy-peer flags to hide resolution failures.

## Build and verify

```bash
cd my-mobile-app
npm install
npm run prebuild
npm run ios
```

`npm run prebuild` bundles the custom worklet and runs Expo prebuild. The SDK plugin owns its worker bundle and manifest-aware native linking. Do not manually replace its linkers or merge old SDK manifests without first diagnosing the exact missing addon.

Inspect the generated native projects and linker output. A successful npm install proves neither native linking nor runtime startup. Test KV write/read and restart through the UI to exercise the real custom worklet boundary.

From `packages/cli`, use:

```bash
QVAC_MOCK=1 npm run test:e2e:mobile -- --level 5 --variant local-ai
npm run test:e2e:mobile -- --level 5 --variant bare
```

The mock path tests UI wiring and storage, not native model inference. With mock disabled, the app refuses model load on a simulator; QVAC documents physical devices for mobile inference. Device validation is opt-in against an already installed native build:

```bash
npm run test:e2e:mobile -- --variant local-ai --skip-build --device DEVICE_UDID
```

Never claim mobile AI support from a simulator or mock result. Record OS, architecture, package versions, source commit, logs and screenshots. Keep Android and physical-device checks pending until performed.

## QVAC API

Use `ctx_size` and `reasoning_budget: 0` in modelConfig. QVAC 0.21 rejects `n_discarded`; bound history in the app and handle overflow explicitly. Consume `completion(...).events`, append `contentDelta.text`, and surface terminal completion errors. A cancellation or unload must stop native work before a new request uses the model.

## pnpm and debugging

The scaffold uses npm. With pnpm, verify that every traced addon is resolvable from the project and use the SDK's current plugin/linker rather than copying fixes for legacy isolated layouts. Reproduce an issue with a fresh scaffold before changing the generator. Retain the first native or Metro error; installation-only and mock-only passes must stay labelled.

For additional examples see `recipes/qvac-mobile-expo.mdc`, `modules/qvac.mdc`, and the current `reference-apps/qvac-app` code. Older workbench examples can target removed SDK APIs.
