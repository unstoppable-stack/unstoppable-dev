import type { GeneratedFile, GeneratorOptions } from './types.js'
import { has, gitignore, readme, planningReadme } from './common.js'

export function generateExpoMobile(opts: GeneratorOptions): GeneratedFile[] {
  // Bare worklet is always required — P2P is always part of the base
  const files: GeneratedFile[] = [
    gitignore(),
    readme(opts),
    planningReadme(),
    packageJson(opts),
    appJson(opts),
    metroConfig(opts),
    emptyMock(),
    assetsKeep(),
    appLayout(opts),
    appIndex(opts),
    appNotFound(opts),
    pluginNdkVersion(),
    pluginArchitecture(),
    bareWorklet(opts),
    workletContext(opts),
  ]

  return files
}

function packageJson(opts: GeneratorOptions): GeneratedFile {
  // ====================================================================
  // MOBILE COUPLED VERSION SET — do NOT bump anything below in isolation.
  // ====================================================================
  // The Expo SDK, react-native, react-native-bare-kit, and bare-pack
  // versions below have been validated as one combination. Bumping any
  // single entry risks breaking the worklet bundling pipeline that the
  // scaffolded app depends on at build time.
  //
  // The ANCHOR is `bare-pack@^1.5.1` — the last release on the 1.x line.
  //   - `bare-pack@2.0.0` (Jan 2026) removed the `--target` CLI flag that
  //     the generated `build:bare` script invokes below. Switching to
  //     `2.x` requires reworking the bundler invocation in this file.
  //   - `bare-pack@2.x` also bumps `bare-module-traverse` from `~1.8.0`
  //     to `~2.0.0`, which has not been validated end-to-end against
  //     `@qvac/sdk@0.11`'s worker bundle.
  //
  // Coupling rules:
  //   - Expo SDK MAJOR pins react-native MAJOR (SDK 54 → RN 0.81;
  //     SDK 55 → RN 0.83; SDK 56 → RN 0.85). Never mix.
  //   - `react-native-bare-kit` is EXACT-pinned (no caret) because
  //     `@qvac/sdk` declares it as an exact peer (0.12.3 for SDK 0.11);
  //     caret ranges silently install pre-1.0 minors and break QVAC's
  //     mobile worker bundle with cryptic native errors.
  //   - When bumping ANY of these, bump ALL of them and re-run the full
  //     mobile e2e: `pnpm test:e2e:mobile` (level 4 simulator) +
  //     manual level 6 on a physical device.
  //
  // Authoritative table: `packages/agent-pack/src/core/verified-versions.mdc`
  // → "Mobile (Expo + Bare) — coupled set" section.
  // ====================================================================
  //
  // Bare worklet is always required (P2P is base infrastructure)
  const deps: Record<string, string> = {
    expo: '~54.0.33',
    'expo-build-properties': '~1.0.9',
    'expo-file-system': '^19.0.15',
    // Required transitively by `expo-router/build/views/Unmatched.js` — not
    // installed automatically by expo-router in bare (non-managed) apps.
    'expo-linking': '~8.0.11',
    'expo-router': '~6.0.23',
    'expo-splash-screen': '~31.0.10',
    'expo-status-bar': '~3.0.8',
    react: '19.1.0',
    'react-native': '0.81.5',
    'react-native-safe-area-context': '~5.6.0',
    'react-native-screens': '~4.16.0',
    'react-native-bare-kit': '0.12.3', // EXACT — see coupling rules above
    'bare-pack': '^1.5.1', // ANCHOR — see coupling rules above. Never 2.x.
    'bare-rpc': '^1.1.0',
    // Base P2P + KV infra — always required by bare/index.js worklet
    corestore: '^7.6.0',
    hyperbee: '^2.22.0',
  }

  const devDeps: Record<string, string> = {
    '@types/react': '~19.1.10',
    typescript: '~5.9.2',
  }

  const scripts: Record<string, string> = {
    start: 'expo start',
    ios: 'expo run:ios',
    'ios:clean': 'rm -rf ios android && npm run prebuild && expo run:ios',
    android: 'expo run:android',
    // Bundle the Bare worklet for each target. `bare-pack` traces imports at
    // build time, so every transitive module must be physically present
    // under node_modules before this runs. We intentionally keep this OUT
    // of `postinstall` — running it there couples `npm install` success to
    // the worklet's dep graph, and a single missing peer (of which QVAC has
    // many) breaks install for the whole project. Instead we hook it into
    // `prestart`, `preios`, and `preandroid` so it runs just-in-time.
    //
    // `--defer crypto` tells bare-pack to skip resolving Node's `crypto`
    // module at build time. The bare runtime remaps it to `bare-crypto` at
    // load time. Upstream @qvac/rag references `crypto` (not `bare-crypto`)
    // in some adapters — without `--defer`, bare-pack fails to trace them.
    //
    // The `--target` flag is **bare-pack 1.x only** — it was removed in
    // `bare-pack@2.0.0` (Jan 2026). This script invocation is the reason
    // the `bare-pack` dep above is pinned to `^1.5.1`. When bumping to
    // `bare-pack@2.x`, this entire script must be rewritten against the
    // 2.x CLI surface, and the whole Mobile coupled set (Expo SDK, RN,
    // react-native-bare-kit) must be re-validated end-to-end against it.
    'build:bare':
      'npx bare-pack --target ios-arm64 --target ios-arm64-simulator --target ios-x64-simulator --target android-arm64 --linked --defer crypto --out bare/app.bundle.js bare/index.js',
    prebuild: 'npm run build:bare && npx expo prebuild',
    prestart: 'npm run build:bare',
    preios: 'npm run build:bare',
    preandroid: 'npm run build:bare',
  }

  const overrides: Record<string, string> = {
    // Exact-pinned because newer `bare-fs` releases on Bare 4.7.x have
    // not been validated against the bundle pipeline anchored on
    // `bare-pack@1.5.1`. Part of the Mobile coupled set — see the
    // version table at the top of `packageJson()` and
    // `core/verified-versions.mdc` → "Mobile (Expo + Bare)".
    'bare-fs': '4.5.1',
  }

  if (has(opts, 'node-sync')) {
    // node-client + its transitive runtime deps. `hyperswarm` already enters
    // the graph via `local-ai` too, so guard so we don't double-declare.
    Object.assign(deps, {
      '@unstoppable-stack/node-client': '^0.4.0',
      hyperswarm: '^4.12.1',
      b4a: '^1.7.3',
      events: '^3.3.0',
    })
  }

  if (has(opts, 'local-ai')) {
    // Mirrors the official QVAC Expo tutorial dep surface
    // (https://docs.qvac.tether.io/sdk/tutorials/expo/) and the QVAC
    // reference mobile app (qvac-workbench-mobile). We deliberately do
    // NOT enumerate @qvac/sdk's 25+ peer deps (bare-buffer, bare-crypto,
    // hyperswarm, tar-stream, etc.) — modern npm resolves them
    // transitively. Listing them with our own version pins is what
    // forced previous scaffolds to require `npm install --legacy-peer-deps`,
    // because any pin range that didn't perfectly overlap with @qvac/sdk's
    // peer-dep range produced a hard ERESOLVE error.
    Object.assign(deps, {
      '@qvac/sdk': '^0.11.0',
      // Zod v4.3+ — @qvac/sdk@0.10 bumped its zod floor from ^4.0.17 to
      // ^4.3.0 because finetune schemas use z.union/z.nan combinations
      // only available in 4.3+. Pinning lower causes runtime
      // `z.xor is not a function` crashes when finetune schemas load.
      // 0.11 keeps the same zod floor.
      zod: '^4.3.0',
      // expo-file-system: where @qvac/sdk caches model files. Optional
      // peer of @qvac/sdk but always required in practice.
      'expo-file-system': '^19.0.15',
      // expo-device: used by our scaffold to detect simulator vs physical
      // device and refuse fast with a clear error (per QVAC docs:
      // "QVAC currently does not run on emulators").
      'expo-device': '~8.0.10',
    })
    // NOTE: @qvac/cli is intentionally NOT listed here. It's an optional
    // peer of @qvac/sdk used for two scenarios: (1) running an
    // OpenAI-compatible HTTP server (`qvac serve openai`), (2) bundling
    // a tree-shaken SDK worker (`qvac bundle sdk`). The default scaffold
    // doesn't need either — the @qvac/sdk Expo plugin handles bundling
    // automatically during `expo prebuild`.
    //
    // When you DO want it, install with:
    //   npm i -D '@qvac/cli@^0.5.0' --legacy-peer-deps
    // The --legacy-peer-deps is needed only because @qvac/sdk@0.11.0's
    // declared peer range (^0.4.0) hasn't caught up to the actual cli
    // release line (^0.5.0). Both versions are runtime-compatible with
    // @qvac/sdk@0.11 — no addon-side differences. 0.4.x is the first
    // CLI line that ships `qvac verify bundle`, which SDK 0.11 auto-runs
    // during Expo prebuild against the emitted worker.mobile.bundle.js
    // (failure preserves the last known-good artifact and aborts with
    // BundleVerificationFailedError, code 50609).
    // See the add-openai-server skill for the opt-in flow.
  }

  return {
    path: 'package.json',
    content: JSON.stringify(
      {
        name: opts.projectName,
        version: '0.1.0',
        private: true,
        main: 'expo-router/entry',
        scripts,
        dependencies: deps,
        devDependencies: devDeps,
        overrides,
      },
      null,
      2,
    ),
  }
}

function appJson(opts: GeneratorOptions): GeneratedFile {
  const plugins: any[] = [
    'expo-router',
    [
      'expo-build-properties',
      {
        android: {
          minSdkVersion: 29,
          enableProguardInReleaseBuilds: true,
          enableShrinkResourcesInReleaseBuilds: true,
        },
      },
    ],
    ['./plugins/withAndroidNdkVersion.js', '29.0.14206865'],
    ['./plugins/withAndroidArchitecture.js', ['arm64-v8a']],
  ]

  if (has(opts, 'local-ai')) {
    plugins.unshift('@qvac/sdk/expo-plugin')
  }

  return {
    path: 'app.json',
    content: JSON.stringify(
      {
        expo: {
          name: opts.projectName,
          slug: opts.projectName,
          version: '1.0.0',
          orientation: 'portrait',
          icon: './assets/icon.png',
          scheme: opts.projectName,
          newArchEnabled: true,
          plugins,
          ios: {
            bundleIdentifier: `com.unstoppable.${opts.projectName.replace(/-/g, '')}`,
            entitlements: {
              'com.apple.developer.kernel.increased-memory-limit': true,
            },
          },
          android: {
            package: `com.unstoppable.${opts.projectName.replace(/-/g, '')}`,
            adaptiveIcon: {
              foregroundImage: './assets/icon.png',
              backgroundColor: '#0a1628',
            },
            edgeToEdgeEnabled: true,
          },
        },
      },
      null,
      2,
    ),
  }
}

function metroConfig(opts: GeneratorOptions): GeneratedFile {
  const nativeMocks = [
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

  return {
    path: 'metro.config.js',
    content: `// Learn more https://docs.expo.dev/guides/customizing-metro/
const { getDefaultConfig } = require('expo/metro-config')
const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

// Ensure the Bare worklet bundle (\`bare/app.bundle.js\`) is fresh before
// Metro starts. The npm \`pre*\` hooks (\`prestart\`, \`preios\`, \`preandroid\`)
// only fire when launching via \`npm run …\`. When developers run
// \`npx expo start\` or \`expo start\` directly, those hooks are bypassed
// and Metro fails with \`Unable to resolve "../../bare/app.bundle.js"\`.
// Running bare-pack here makes every entry point safe.
const workletEntry = path.join(__dirname, 'bare/index.js')
const workletBundle = path.join(__dirname, 'bare/app.bundle.js')
function workletBundleStale() {
  if (!fs.existsSync(workletBundle)) return true
  try {
    return fs.statSync(workletBundle).mtimeMs < fs.statSync(workletEntry).mtimeMs
  } catch {
    return true
  }
}
if (workletBundleStale()) {
  console.log('[metro] Building Bare worklet bundle (bare/app.bundle.js)…')
  execSync('npm run build:bare', { stdio: 'inherit', cwd: __dirname })
}

const config = getDefaultConfig(__dirname)

// Mock native Node.js modules that can't run in React Native. These run
// only inside the Bare worklet (see \`bare/index.js\`) — when imported from
// shared modules that the RN side also pulls in, point them at an empty
// stub so Metro doesn't try to bundle native code.
//
// This list mirrors the QVAC reference mobile app
// (\`reference-apps/qvac-workbench-mobile/metro.config.js\`).
const emptyModule = require.resolve('./mocks/empty.js')
const nativeModuleMocks = ${JSON.stringify(nativeMocks, null, 2)}

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (nativeModuleMocks.includes(moduleName)) {
    return { filePath: emptyModule, type: 'sourceFile' }
  }
  return context.resolveRequest(context, moduleName, platform)
}

// Treat QVAC model artifacts (\`.bundle\`, \`.bin\`, \`.model\`, \`.onnx\`) as
// assets so Metro doesn't try to parse them as JS.
config.resolver.assetExts = [
  ...config.resolver.assetExts,
  'bundle', 'bin', 'model', 'onnx',
]

module.exports = config
`,
  }
}

function emptyMock(): GeneratedFile {
  return { path: 'mocks/empty.js', content: 'module.exports = {}\n' }
}

// Placeholder app icon. A 32x32 dark-blue PNG (~105 bytes). Generated once
// by hand — replace `assets/icon.png` with your real 1024x1024 icon when
// branding the app. Without an icon file, Expo's prebuild + Metro asset
// endpoint log `Asset not found: assets/icon.png` on every dev boot.
const PLACEHOLDER_ICON_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAMElEQVR42u3OIQEAAAgD' +
  'MDQByED/ghDjZmJ+1bOXVAICAgICAgICAgICAgICAunAA1fSHEzA5mfcAAAAAElFTkSuQmCC'

function assetsKeep(): GeneratedFile {
  return {
    path: 'assets/icon.png',
    content: PLACEHOLDER_ICON_BASE64,
    encoding: 'base64',
  }
}

function pluginNdkVersion(): GeneratedFile {
  return {
    path: 'plugins/withAndroidNdkVersion.js',
    content: `const { withProjectBuildGradle } = require('@expo/config-plugins')

module.exports = function withAndroidNdkVersion(config, ndkVersion) {
  if (!ndkVersion) {
    console.warn('[withAndroidNdkVersion] No NDK version provided, skipping')
    return config
  }

  return withProjectBuildGradle(config, (config) => {
    let buildGradle = config.modResults.contents
    const extBlock = \`\\next {\\n    ndkVersion = "\${ndkVersion}"\\n}\\n\\n\`

    if (buildGradle.includes('ext {') && buildGradle.includes('ndkVersion')) {
      buildGradle = buildGradle.replace(
        /ndkVersion\\s*=\\s*["'][^"']*["']/,
        \`ndkVersion = "\${ndkVersion}"\`
      )
    } else if (buildGradle.includes('ext {')) {
      buildGradle = buildGradle.replace(
        /ext\\s*\\{/,
        \`ext {\\n    ndkVersion = "\${ndkVersion}"\`
      )
    } else {
      buildGradle = buildGradle.replace(
        /apply plugin: "expo-root-project"/,
        \`\${extBlock}apply plugin: "expo-root-project"\`
      )
    }

    config.modResults.contents = buildGradle
    console.log(\`[withAndroidNdkVersion] Set NDK version to \${ndkVersion}\`)
    return config
  })
}
`,
  }
}

function pluginArchitecture(): GeneratedFile {
  return {
    path: 'plugins/withAndroidArchitecture.js',
    content: `const { withGradleProperties, withAppBuildGradle } = require('@expo/config-plugins')

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
    const abiFiltersArray = architectures.map((arch) => \`"\${arch}"\`).join(', ')
    const ndkBlock = \`\\n        ndk {\\n            abiFilters \${abiFiltersArray}\\n        }\`

    if (!buildGradle.includes('ndk {')) {
      const buildConfigRegex =
        /(buildConfigField\\s+"String",\\s+"REACT_NATIVE_RELEASE_LEVEL"[^\\n]*\\n)/
      if (buildConfigRegex.test(buildGradle)) {
        buildGradle = buildGradle.replace(buildConfigRegex, \`$1\${ndkBlock}\\n\`)
      }
    } else {
      const ndkRegex = /ndk\\s*\\{[^}]*\\}/s
      const newNdkBlock = \`ndk {\\n            abiFilters \${abiFiltersArray}\\n        }\`
      buildGradle = buildGradle.replace(ndkRegex, newNdkBlock)
    }

    config.modResults.contents = buildGradle
    return config
  })

  return config
}
`,
  }
}

function appLayout(_opts: GeneratorOptions): GeneratedFile {
  // Worklet is always required (P2P is base infrastructure)
  return {
    path: 'app/_layout.tsx',
    content: `import { Stack } from 'expo-router'
import { WorkletProvider } from '../src/contexts/WorkletContext'

export default function Layout() {
  return (
    <WorkletProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </WorkletProvider>
  )
}
`,
  }
}

// On iOS simulator, a fresh install of an Expo-bare app sometimes launches
// with the deep-link URL \`<scheme>:///\` which Expo Router can't match to
// \`app/index.tsx\` and falls back to its built-in "Unmatched Route" screen.
// This immediate redirect file keeps the user (and Maestro) on the happy
// path instead of needing a manual "Go back" tap in every flow.
function appNotFound(_opts: GeneratorOptions): GeneratedFile {
  return {
    path: 'app/+not-found.tsx',
    content: `import { Redirect } from 'expo-router'

export default function NotFound() {
  return <Redirect href="/" />
}
`,
  }
}

// ---------------------------------------------------------------------------
// Home screen — feature-specific sections with testIDs for E2E tests
// ---------------------------------------------------------------------------

function appIndex(opts: GeneratorOptions): GeneratedFile {
  const hasQvac = has(opts, 'local-ai')
  const hasWallet = has(opts, 'wallet')
  const hasNodeSync = has(opts, 'node-sync')

  // Build React Native import list
  // Base always needs TextInput (KV inputs) and worklet is always present
  const rnComponents = [
    'Text',
    'View',
    'StyleSheet',
    'SafeAreaView',
    'ScrollView',
    'TouchableOpacity',
    'Linking',
    'TextInput',
  ]
  if (hasQvac) {
    rnComponents.push('ActivityIndicator')
    rnComponents.push('Switch')
  }

  const reactImports = ['useState']
  if (hasNodeSync) reactImports.push('useEffect')
  if (hasQvac) reactImports.push('useRef')

  const topImports: string[] = [
    `import React, { ${reactImports.join(', ')} } from 'react'`,
    `import { ${rnComponents.join(', ')} } from 'react-native'`,
    `import { useWorklet } from '../src/contexts/WorkletContext'`,
  ]
  if (hasQvac) {
    // QVAC inference imports MUST live in the React Native runtime — the
    // @qvac/sdk package selects expo-rpc-client.js here and loads the
    // pre-bundled worker.mobile.bundle generated by the QVAC expo plugin
    // during prebuild. Importing @qvac/sdk inside the user Bare worklet
    // triggers MODULE_NOT_FOUND for dist/server/worker.js because the SDK's
    // bare-runtime path uses an obfuscated dynamic import that bare-pack
    // can't trace. See bareWorklet() comment for details.
    topImports.push(
      `import { downloadAsset, loadModel, completion, unloadModel, QWEN3_600M_INST_Q4, VERBOSITY } from '@qvac/sdk'`,
    )
    topImports.push(`import * as Device from 'expo-device'`)
  }

  // State hooks — base (P2P + KV) always active
  const hooks: string[] = [
    `const { ready, rpcRequest } = useWorklet()`,
    `const [kvKey, setKvKey] = useState('')`,
    `const [kvValue, setKvValue] = useState('')`,
    `const [kvResult, setKvResult] = useState<string | null>(null)`,
  ]

  if (hasNodeSync) {
    hooks.push(
      `const [nodeStatus, setNodeStatus] = useState<'idle' | 'searching' | 'connected' | 'disconnected' | 'unavailable'>('idle')`,
    )
  }

  if (hasQvac) {
    hooks.push(
      `const [aiStatus, setAiStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')`,
    )
    hooks.push(`const [aiError, setAiError] = useState<string | null>(null)`)
    hooks.push(`const [aiProgress, setAiProgress] = useState<string | null>(null)`)
    hooks.push(
      `const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([])`,
    )
    hooks.push(`const [chatInput, setChatInput] = useState('')`)
    hooks.push(`const [thinking, setThinking] = useState(false)`)
    // GPU is the QVAC-recommended default on real devices (Metal on iOS,
    // Vulkan on Android), ~5-10x faster than CPU. Users can flip to CPU
    // before loading for older hardware or to experiment on simulator.
    hooks.push(`const [aiDevice, setAiDevice] = useState<'gpu' | 'cpu'>('gpu')`)
    // modelId lives in a ref because we don't need re-renders when it
    // changes and we want to read it inside the async chat loop without
    // closing over a stale state value.
    hooks.push(`const modelIdRef = useRef<string | null>(null)`)
  }

  // Handler functions — base KV handlers go through the worklet via RPC
  // Worklet commands: 1=init, 2=load-model, 3=chat, 4=ping, 5=kv-put, 6=kv-get
  //
  // Both handlers always produce a visible result (success OR a specific error
  // message). A silent no-op is the single worst UX in a demo app and also
  // makes E2E failures mysterious — if the tap dropped because the worklet
  // errored, the user and the Maestro assertion both deserve to know why.
  const handlers: string[] = [
    `
  async function kvSave() {
    if (!kvKey.trim()) { setKvResult('Enter a key first'); return }
    if (!ready) { setKvResult('Worklet not ready'); return }
    try {
      const res = await rpcRequest(5, { key: kvKey, value: kvValue })
      if (res.ok) setKvResult('Saved "' + kvKey + '"')
      else setKvResult('Error: ' + (res.error ?? 'unknown'))
    } catch (e: any) {
      setKvResult('Exception: ' + (e?.message ?? String(e)))
    }
  }

  async function kvFetch() {
    if (!kvKey.trim()) { setKvResult('Enter a key first'); return }
    if (!ready) { setKvResult('Worklet not ready'); return }
    try {
      const res = await rpcRequest(6, { key: kvKey })
      if (res.ok) {
        setKvResult(res.value !== null ? '"' + kvKey + '" → ' + JSON.stringify(res.value) : '"' + kvKey + '" not found')
      } else {
        setKvResult('Error: ' + (res.error ?? 'unknown'))
      }
    } catch (e: any) {
      setKvResult('Exception: ' + (e?.message ?? String(e)))
    }
  }`,
  ]

  if (hasNodeSync) {
    // Automatically try to connect once the worklet is ready. Non-blocking —
    // a missing node keeps the app fully usable.
    handlers.push(`
  useEffect(() => {
    if (!ready) return
    let cancelled = false
    ;(async () => {
      setNodeStatus('searching')
      try {
        const res = await rpcRequest(7)
        if (cancelled) return
        if (res.ok) setNodeStatus(res.status === 'connected' ? 'connected' : (res.status ?? 'connected'))
        else setNodeStatus(res.status === 'unavailable' ? 'unavailable' : 'disconnected')
      } catch {
        if (!cancelled) setNodeStatus('unavailable')
      }
    })()
    return () => { cancelled = true }
  }, [ready])`)
  }

  if (hasQvac) {
    // QVAC SDK runs in the React Native runtime. expo-rpc-client.js loads
    // the prebuilt worker.mobile.bundle (generated by @qvac/sdk/expo-plugin
    // during prebuild) and starts its own internal Bare worker — separate
    // from our user-owned worklet.
    //
    // EXPO_PUBLIC_QVAC_MOCK=1 short-circuits both load and chat for tests
    // and simulator-only validation. Expo only inlines env vars prefixed
    // with EXPO_PUBLIC_ at bundle time; check it once at module scope.
    handlers.push(`
  const QVAC_MOCK = process.env.EXPO_PUBLIC_QVAC_MOCK === '1'

  async function loadAI() {
    setAiError(null)
    setAiProgress(null)
    setAiStatus('loading')
    if (QVAC_MOCK) {
      await new Promise((r) => setTimeout(r, 200))
      modelIdRef.current = 'mock-model'
      setAiStatus('ready')
      return
    }
    // Per QVAC docs: "QVAC currently does not run on emulators. You must
    // use a physical device." GPU mode reliably fails on simulator (Metal
    // / Vulkan unavailable), so block early with a clear message. CPU
    // mode is technically also unsupported by llamacpp on emulators, but
    // we let users try it — if it fails, the underlying QVAC error is
    // already surfaced via the catch block below.
    if (Device.isDevice === false && aiDevice === 'gpu') {
      setAiError(
        "GPU inference doesn't run on the iOS Simulator / Android Emulator. " +
        'Toggle Device → CPU below to try CPU mode (slower, may still ' +
        'fail on emulators per QVAC limits), or run on a physical device ' +
        'with: npx expo run:ios --device (or run:android --device). Or ' +
        'set EXPO_PUBLIC_QVAC_MOCK=1 to exercise the UI without inference.',
      )
      setAiStatus('error')
      return
    }
    try {
      // Two-phase load — split download and load progress so the UI can
      // show what's actually happening. This mirrors the official QVAC
      // Expo tutorial: downloadAsset first (model arrives over the
      // network or from Hyperdrive peers), then loadModel (mmap'd into
      // the GGUF engine).
      setAiProgress('Downloading model...')
      await downloadAsset({
        assetSrc: QWEN3_600M_INST_Q4,
        onProgress: (p: any) => {
          if (typeof p?.percentage === 'number') {
            setAiProgress('Downloading ' + Math.round(p.percentage) + '%')
          }
        },
      })
      setAiProgress('Loading model into memory...')
      const id = await loadModel({
        modelSrc: QWEN3_600M_INST_Q4,
        modelType: 'llm',
        modelConfig: {
          // Device choice is exposed to users via the GPU toggle in the
          // Assistant section. GPU = Metal/Vulkan (real devices, ~5-10x
          // faster). CPU = portable fallback (older hardware,
          // experimentation).
          device: aiDevice,
          ctx_size: 4096,
          system_prompt: 'You are a helpful assistant. /no_think',
          // VERBOSITY.ERROR keeps the JS console quiet — flip to .DEBUG
          // when chasing model-loading issues.
          verbosity: VERBOSITY.ERROR,
        },
        onProgress: (p: any) => {
          if (typeof p?.percentage === 'number') {
            setAiProgress('Loading ' + Math.round(p.percentage) + '%')
          }
        },
      })
      modelIdRef.current = id
      setAiStatus('ready')
      setAiProgress(null)
    } catch (e: any) {
      setAiError(e?.message ?? String(e))
      setAiStatus('error')
      setAiProgress(null)
    }
  }

  async function sendMessage() {
    const id = modelIdRef.current
    if (!chatInput.trim() || thinking || aiStatus !== 'ready' || !id) return
    const userMsg = { role: 'user' as const, content: chatInput.trim() }
    const next = [...messages, userMsg]
    const placeholder = { role: 'assistant' as const, content: '' }
    setChatInput('')
    setMessages([...next, placeholder])
    setThinking(true)

    try {
      if (QVAC_MOCK) {
        const reply = 'Mock: ' + userMsg.content
        for (let i = 1; i <= reply.length; i++) {
          await new Promise((r) => setTimeout(r, 5))
          setMessages([...next, { role: 'assistant', content: reply.slice(0, i) }])
        }
        return
      }
      const result = completion({
        modelId: id,
        history: next,
        stream: true,
      })
      // Strip Qwen 3 <think>...</think> blocks from the live token stream
      // so the chat bubble shows only the user-facing answer. We track
      // depth and carry partial tags across chunks. /no_think in the
      // system prompt usually suppresses them; this is a safety net.
      let inThink = false
      let carry = ''
      let visible = ''
      for await (const token of result.tokenStream) {
        carry += token
        let outChunk = ''
        while (carry.length) {
          if (!inThink) {
            const open = carry.indexOf('<think>')
            if (open === -1) {
              if (carry.length > 7) { outChunk += carry.slice(0, -7); carry = carry.slice(-7) }
              break
            }
            outChunk += carry.slice(0, open)
            carry = carry.slice(open + 7)
            inThink = true
          } else {
            const close = carry.indexOf('</think>')
            if (close === -1) {
              if (carry.length > 8) carry = carry.slice(-8)
              break
            }
            carry = carry.slice(close + 8)
            inThink = false
          }
        }
        if (outChunk) {
          visible += outChunk
          setMessages([...next, { role: 'assistant', content: visible }])
        }
      }
      if (!inThink && carry) {
        visible += carry
        setMessages([...next, { role: 'assistant', content: visible }])
      }
    } catch (e: any) {
      setMessages([...next, { role: 'assistant', content: '❌ ' + (e?.message ?? String(e)) }])
    } finally {
      setThinking(false)
    }
  }`)
  }

  // Build JSX sections — P2P + KV always shown (base infrastructure)
  const sections: string[] = []

  sections.push(`
        <View style={styles.section} testID="p2p-section">
          <Text style={styles.sectionTitle}>P2P Network</Text>
          <Text style={styles.mono}>
            Worklet: {ready ? '✅ Connected' : '⏳ Starting...'}
          </Text>
          {ready && <Text style={styles.mono}>Discovery active</Text>}
        </View>`)

  sections.push(`
        <View style={styles.section} testID="kv-section">
          <Text style={styles.sectionTitle}>KV Storage</Text>
          <TextInput
            style={styles.input}
            placeholder="Key"
            placeholderTextColor="#555"
            value={kvKey}
            onChangeText={setKvKey}
            testID="kv-key-input"
          />
          <TextInput
            style={styles.input}
            placeholder="Value"
            placeholderTextColor="#555"
            value={kvValue}
            onChangeText={setKvValue}
            testID="kv-value-input"
          />
          <View style={styles.row}>
            <TouchableOpacity style={styles.btn} onPress={kvSave} testID="kv-save-btn">
              <Text style={styles.btnText}>Save</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btn, styles.btnOutline]} onPress={kvFetch} testID="kv-fetch-btn">
              <Text style={styles.btnText}>Fetch</Text>
            </TouchableOpacity>
          </View>
          {kvResult !== null && (
            <Text style={styles.result} testID="kv-result">{kvResult}</Text>
          )}
        </View>`)

  if (hasWallet) {
    sections.push(`
        <View style={styles.section} testID="wallet-section">
          <Text style={styles.sectionTitle}>Wallet</Text>
          <Text style={styles.mono}>WDK integration coming soon</Text>
        </View>`)
  }

  if (hasNodeSync) {
    sections.push(`
        <View style={styles.section} testID="node-sync-section">
          <Text style={styles.sectionTitle}>Unstoppable Node</Text>
          <Text style={styles.mono} testID="node-sync-status">
            {nodeStatus === 'idle' && '⏳ Waiting for worklet...'}
            {nodeStatus === 'searching' && '⏳ Searching for local node...'}
            {nodeStatus === 'connected' && '✅ Connected — replicating to node'}
            {nodeStatus === 'disconnected' && '⚠️ Node disconnected'}
            {nodeStatus === 'unavailable' && '❌ No node found on local network'}
          </Text>
          {(nodeStatus === 'unavailable' || nodeStatus === 'idle') && (
            <Text style={[styles.mono, { marginTop: 4 }]}>
              Run <Text style={{ color: '#58a6ff' }}>npx unstoppable-node</Text> on a nearby machine
            </Text>
          )}
        </View>`)
  }

  if (hasQvac) {
    sections.push(`
        <View style={styles.section} testID="ai-section">
          <Text style={styles.sectionTitle}>AI Assistant</Text>
          <Text style={styles.hint}>
            Qwen 3 0.6B · ~400MB download on first run, cached after.{'\\n'}
            <Text style={{ color: '#f0883e' }}>Physical device required</Text>{' '}
            — QVAC inference does not run on the iOS Simulator or Android
            Emulator. Set{' '}
            <Text style={{ fontFamily: 'monospace' }}>EXPO_PUBLIC_QVAC_MOCK=1</Text>{' '}
            to test the UI without inference.
          </Text>
          {aiStatus === 'idle' && (
            <>
              <View style={styles.deviceRow} testID="ai-device-toggle">
                <View style={{ flex: 1 }}>
                  <Text style={styles.deviceLabel}>
                    Device: {aiDevice === 'gpu' ? 'GPU' : 'CPU'}
                  </Text>
                  <Text style={styles.deviceHint}>
                    {aiDevice === 'gpu'
                      ? 'Faster (Metal / Vulkan) · physical device only'
                      : 'Slower fallback · for older hardware or experimentation'}
                  </Text>
                </View>
                <Switch
                  value={aiDevice === 'gpu'}
                  onValueChange={(on) => setAiDevice(on ? 'gpu' : 'cpu')}
                  trackColor={{ false: '#3a3a3a', true: '#1f6feb' }}
                  thumbColor={aiDevice === 'gpu' ? '#58a6ff' : '#888'}
                  testID="ai-device-switch"
                  accessibilityLabel="Toggle GPU inference"
                />
              </View>
              <TouchableOpacity
                style={[styles.btn, styles.btnFull]}
                onPress={loadAI}
                testID="load-ai-btn"
                accessibilityLabel="Load Assistant"
              >
                <Text style={styles.btnText}>Load Assistant</Text>
              </TouchableOpacity>
            </>
          )}
          {aiStatus === 'loading' && (
            <View style={styles.row}>
              <ActivityIndicator color="#58a6ff" />
              <Text style={[styles.mono, { marginLeft: 8 }]}>
                {aiProgress ?? 'Loading model...'}
              </Text>
            </View>
          )}
          {aiStatus === 'error' && (
            <View>
              <Text style={styles.error} testID="ai-error-msg">❌ {aiError ?? 'Failed to load model'}</Text>
              <TouchableOpacity style={[styles.btn, styles.btnFull, { marginTop: 8 }]} onPress={loadAI} testID="ai-retry-btn">
                <Text style={styles.btnText}>Retry</Text>
              </TouchableOpacity>
            </View>
          )}
          {aiStatus === 'ready' && (
            <>
              <ScrollView style={styles.chatList} keyboardShouldPersistTaps="handled">
                {messages.length === 0 && (
                  <Text style={styles.chatHint}>Ask me anything...</Text>
                )}
                {messages
                  .filter((m) => m.content)
                  .map((msg, i) => (
                    <View
                      key={i}
                      style={[styles.bubble, msg.role === 'user' ? styles.bubbleUser : styles.bubbleBot]}
                      testID={\`chat-bubble-\${msg.role}\`}
                    >
                      <Text style={styles.bubbleText}>{msg.content}</Text>
                    </View>
                  ))}
                {thinking && (
                  <View style={[styles.bubble, styles.bubbleBot]}>
                    <ActivityIndicator size="small" color="#58a6ff" />
                  </View>
                )}
              </ScrollView>
              <View style={styles.row}>
                <TextInput
                  style={[styles.input, { flex: 1, marginBottom: 0 }]}
                  placeholder="Type a message..."
                  placeholderTextColor="#555"
                  value={chatInput}
                  onChangeText={setChatInput}
                  onSubmitEditing={sendMessage}
                  editable={!thinking}
                  returnKeyType="send"
                  testID="chat-input"
                />
                <TouchableOpacity
                  style={[
                    styles.btn,
                    styles.btnSend,
                    (thinking || !chatInput.trim()) && styles.btnDisabled,
                  ]}
                  onPress={sendMessage}
                  disabled={thinking || !chatInput.trim()}
                  testID="chat-send-btn"
                >
                  <Text style={styles.btnText}>→</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>`)
  }

  const docsSection = `
        <View style={styles.section} testID="docs-section">
          <Text style={styles.sectionTitle}>Resources</Text>
          <TouchableOpacity onPress={() => Linking.openURL('https://unstoppable.dev')}>
            <Text style={styles.link}>Docs — unstoppable.dev</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => Linking.openURL('https://github.com/holepunchto')}>
            <Text style={styles.link}>Holepunch on GitHub</Text>
          </TouchableOpacity>
        </View>`

  return {
    path: 'app/index.tsx',
    content: `${topImports.join('\n')}

export default function Home() {
  ${hooks.join('\n  ')}
  ${handlers.join('\n')}

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} testID="home-screen">
        <View style={styles.header} testID="app-header">
          <Text style={styles.title}>${opts.projectName}</Text>
          <Text style={styles.subtitle}>Unstoppable Stack · Expo Mobile</Text>
        </View>
        ${sections.join('\n        ')}
        ${docsSection}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d1117' },
  scroll: { padding: 20, paddingBottom: 40 },
  header: { marginBottom: 24 },
  title: { fontSize: 26, fontWeight: '700', color: '#58a6ff', marginBottom: 4 },
  subtitle: { fontSize: 14, color: '#8b949e', marginBottom: 4 },
  section: {
    backgroundColor: '#161b22',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#30363d',
  },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#e6edf3', marginBottom: 12 },
  mono: { fontSize: 13, color: '#8b949e', fontFamily: 'monospace', marginBottom: 4 },
  hint: { fontSize: 12, color: '#8b949e', marginBottom: 10, lineHeight: 16 },
  error: { fontSize: 13, color: '#f85149', lineHeight: 18 },
  input: {
    backgroundColor: '#0d1117',
    borderWidth: 1,
    borderColor: '#30363d',
    borderRadius: 8,
    padding: 10,
    color: '#e6edf3',
    marginBottom: 8,
    fontSize: 14,
  },
  row: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  btn: {
    flex: 1,
    backgroundColor: '#1f6feb',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  btnOutline: { backgroundColor: '#21262d', borderWidth: 1, borderColor: '#30363d' },
  btnFull: { flex: 0, paddingHorizontal: 24, alignSelf: 'flex-start' },
  btnSend: { flex: 0, paddingHorizontal: 16, paddingVertical: 10 },
  btnDisabled: { opacity: 0.4 },
  btnText: { color: '#ffffff', fontWeight: '600', fontSize: 14 },
  result: { marginTop: 8, fontSize: 13, color: '#3fb950', fontFamily: 'monospace' },
  chatList: { maxHeight: 220, marginBottom: 10 },
  chatHint: { color: '#555', fontSize: 14, fontStyle: 'italic', textAlign: 'center', padding: 16 },
  deviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
    marginBottom: 8,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#1f2937',
    gap: 8,
  },
  deviceLabel: { color: '#e6edf3', fontSize: 14, fontWeight: '600' },
  deviceHint: { color: '#7a8896', fontSize: 12, marginTop: 2 },
  bubble: { borderRadius: 10, padding: 10, marginBottom: 6, maxWidth: '85%' },
  bubbleUser: { backgroundColor: '#1f6feb', alignSelf: 'flex-end' },
  bubbleBot: {
    backgroundColor: '#21262d',
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#30363d',
  },
  bubbleText: { color: '#e6edf3', fontSize: 14 },
  link: { color: '#58a6ff', fontSize: 14, marginBottom: 8 },
})
`,
  }
}

// ---------------------------------------------------------------------------
// Bare worklet — owns P2P transport + Hyperbee KV
//
// IMPORTANT: We deliberately do NOT import `@qvac/sdk` here. The QVAC SDK,
// when loaded inside a Bare runtime, falls back to an obfuscated dynamic
// import of `../../server/worker.js` that bare-pack cannot statically trace
// (`MODULE_NOT_FOUND: Cannot find module '../../server/worker.js'` at
// runtime). The intended Expo path is to import `@qvac/sdk` from the React
// Native side — `expo-rpc-client.js` then loads the pre-bundled
// `@qvac/sdk/worker.mobile.bundle` (generated by `@qvac/sdk/expo-plugin`
// during `expo prebuild`) and spawns its own dedicated Bare worker for
// inference. Inference therefore lives in `app/index.tsx`, not here.
// ---------------------------------------------------------------------------

function bareWorklet(opts: GeneratorOptions): GeneratedFile {
  const hasNodeSync = has(opts, 'node-sync')

  // Imports — base always needs Corestore + Hyperbee (KV is always on)
  const imports: string[] = [
    `const RPC = require('bare-rpc')`,
    `const { IPC } = BareKit`,
    `const Corestore = require('corestore')`,
    `const Hyperbee = require('hyperbee')`,
  ]

  if (hasNodeSync) {
    // @unstoppable-stack/node-client is ESM-only; wrap the dynamic import lazily so
    // bare-pack still traces it but we control timing (node-client calls
    // Hyperswarm on construct — we want to defer until init() has given us
    // a Hyperbee to register).
    imports.push(
      `// node-client is ESM; bare supports dynamic import and the @unstoppable\n// scope resolves once '@unstoppable-stack/node-client' is installed.`,
    )
  }

  const stateVars: string[] = [
    `let storagePath = null`,
    `let store = null`,
    `let db = null`,
    `let mockMode = false`,
  ]
  if (hasNodeSync) {
    stateVars.push(`let nodeClient = null`)
    stateVars.push(`let nodeStatus = 'idle'`)
  }

  // Command cases
  // Commands:
  //   1: init({ storagePath, mock? }) — initialize storage and Hyperbee
  //   4: ping() → { ok, pong }
  //   5: kv-put({ key, value }) → { ok }
  //   6: kv-get({ key }) → { ok, value }
  //
  // NOTE: command IDs 2 and 3 used to handle QVAC `load-model` and `chat`
  // here, but `@qvac/sdk` doesn't actually work inside a Bare worklet on
  // Expo (its bare-runtime fallback does an obfuscated dynamic import that
  // bare-pack can't trace). Inference is now driven directly from React
  // Native via `@qvac/sdk` in `app/index.tsx`, which spawns its own
  // dedicated worker via `react-native-bare-kit` using the prebuilt
  // mobile bundle. The IDs are preserved as gaps to avoid breaking older
  // RN code that may still reference them.
  //
  // NOTE: every case body is wrapped in { } — mandatory when declaring
  // lexical bindings (`const`, `let`) inside a switch. Without braces, every
  // declaration ends up hoisted into the single shared switch block scope,
  // which trips TDZ errors and (on some bundlers) confuses the optimiser
  // enough to drop the surrounding await — symptom seen on iOS: `kv-put`
  // reply never lands on the React Native side even though the put itself
  // succeeded. Always use braces.
  const cases: string[] = [
    `case 1: { // init — set storage path, open Hyperbee
        storagePath = params.storagePath
        mockMode = params.mock === true
        store = new Corestore(storagePath)
        const core = store.get({ name: 'main-db' })
        db = new Hyperbee(core, { keyEncoding: 'utf-8', valueEncoding: 'json' })
        await db.ready()
        response = { ok: true, mock: mockMode }
        break
      }`,
  ]

  cases.push(`case 4: { // ping — check worklet is alive
        response = { ok: true, pong: true }
        break
      }`)

  cases.push(`case 5: { // kv-put
        if (!db) { response = { error: 'Storage not ready' }; break }
        await db.put(params.key, params.value)
        response = { ok: true }
        break
      }`)

  cases.push(`case 6: { // kv-get
        if (!db) { response = { error: 'Storage not ready' }; break }
        const entry = await db.get(params.key)
        response = { ok: true, value: entry?.value ?? null }
        break
      }`)

  if (hasNodeSync) {
    cases.push(`case 7: { // node-sync-connect — best-effort; non-blocking
        if (nodeClient) { response = { ok: true, status: nodeStatus, alreadyConnected: true }; break }
        if (!db) { response = { error: 'Storage not ready' }; break }
        nodeStatus = 'searching'
        try {
          const mod = await import('@unstoppable-stack/node-client')
          nodeClient = await mod.connectToNode({
            appId: '${opts.projectName}',
            appName: '${opts.projectName}',
            cores: [{ key: db.core.key, type: 'hyperbee', name: 'main-db' }],
            timeout: 5_000
          })
          nodeStatus = 'connected'
          nodeClient.on('disconnected', () => { nodeStatus = 'disconnected' })
          response = { ok: true, status: nodeStatus }
        } catch (err) {
          nodeStatus = 'unavailable'
          response = { ok: false, status: nodeStatus, error: err.message }
        }
        break
      }`)

    cases.push(`case 8: { // node-sync-status
        response = { ok: true, status: nodeStatus, connected: !!nodeClient }
        break
      }`)
  }

  return {
    path: 'bare/index.js',
    content: `// Bare worklet — runs in react-native-bare-kit, not in React Native context
// Commands:
//   1: init({ storagePath, mock? }) — initialize base services
//   4: ping() → { ok, pong }
//   5: kv-put({ key, value }) → { ok }
//   6: kv-get({ key }) → { ok, value }${hasNodeSync ? '\n//   7: node-sync-connect() → { ok, status }\n//   8: node-sync-status() → { ok, status, connected }' : ''}
//
// NOTE: QVAC inference is NOT in this worklet. @qvac/sdk runs from React
// Native (app/index.tsx) and spawns its own internal Bare worker via the
// QVAC expo-plugin's prebuilt mobile bundle. Loading @qvac/sdk in a
// user-owned Bare runtime triggers a MODULE_NOT_FOUND for the SDK's
// dynamic import of dist/server/worker.js that bare-pack can't trace.
${imports.join('\n')}

${stateVars.join('\n')}

const rpc = new RPC(IPC, async (request) => {
  try {
    const params = request.data?.length > 0
      ? JSON.parse(request.data.toString())
      : {}
    let response

    switch (request.command) {
      ${cases.join('\n      ')}
      default:
        response = { error: \`Unknown command: \${request.command}\` }
    }

    // Always pass 'utf8' — the client side does \`await req.reply('utf8')\`
    // so send/reply encodings must match. An implicit default (Buffer) leaks
    // through as a typed-array on the RN side and JSON.parse then throws
    // "Unexpected token o in JSON at position 1" (the 'o' of "[object ..."),
    // or — worse — the reply is queued but never delivered to the pending
    // promise, so the client await just hangs forever.
    request.reply(JSON.stringify(response), 'utf8')
  } catch (error) {
    request.reply(JSON.stringify({
      error: error instanceof Error ? error.message : 'Unknown error',
    }), 'utf8')
  }
})
`,
  }
}

// ---------------------------------------------------------------------------
// WorkletContext — generic RPC bridge between React Native and Bare worklet
// ---------------------------------------------------------------------------
//
// Important note on the bare-rpc API (easy to get wrong, hence this helper):
//
//   rpc.request(command)           → OutgoingRequest object, NOT a Promise
//   .send(data, 'utf8')            → actually transmits the payload
//   await .reply('utf8')           → awaits the response and decodes it
//
// `await rpc.request(cmd, data)` looks reasonable but does the wrong thing —
// it awaits the OutgoingRequest object itself, which resolves to the object,
// and then a subsequent `.toString()` yields `[object Object]` (not the
// response body). The tell-tale symptom is a `JSON.parse` error that says
// "Unexpected character: o" (the `o` in `[object Object]`). We use a tiny
// `rpcCall` helper everywhere in this scaffold so that shape is enforced.

function workletContext(opts: GeneratorOptions): GeneratedFile {
  const storageDirName = `${opts.projectName}-storage`
  return {
    path: 'src/contexts/WorkletContext.tsx',
    content: `import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react'
import { TurboModuleRegistry, NativeModules } from 'react-native'

interface WorkletContextValue {
  ready: boolean
  rpcRequest: (command: number, data?: any) => Promise<any>
  nativeAvailable: boolean
}

const WorkletContext = createContext<WorkletContextValue | null>(null)

function hasBareKitNativeModule(): boolean {
  return !!(TurboModuleRegistry.get('BareKit') || NativeModules.BareKit)
}

// Correct bare-rpc round-trip:
//   1. rpc.request(cmd) → OutgoingRequest
//   2. req.send(payload, 'utf8') to actually send
//   3. await req.reply('utf8') to await + decode the response as a string
// Then JSON.parse on the string. Passing 'utf8' to both send() and reply()
// keeps the wire format predictable and avoids Buffer/encoding surprises.
async function rpcCall(rpc: any, command: number, data?: any): Promise<any> {
  const req = rpc.request(command)
  req.send(data === undefined ? '' : JSON.stringify(data), 'utf8')
  const responseStr = await req.reply('utf8')
  return responseStr ? JSON.parse(responseStr) : {}
}

export function WorkletProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false)
  const [nativeAvailable] = useState(hasBareKitNativeModule)
  const workletRef = useRef<any>(null)
  const rpcRef = useRef<any>(null)

  useEffect(() => {
    if (!nativeAvailable) return
    let mounted = true

    async function init() {
      const { Worklet } = require('react-native-bare-kit')
      const RPC = require('bare-rpc')
      const { Paths, Directory } = require('expo-file-system')

      const appDir = new Directory(Paths.document, '${storageDirName}')
      if (!appDir.exists) appDir.create()
      const storagePath = appDir.uri.replace('file://', '')

      const worklet = new Worklet()
      const source = require('../../bare/app.bundle.js')
      await worklet.start('/app.bundle', source)
      workletRef.current = worklet

      const rpc = new RPC(worklet.IPC)
      rpcRef.current = rpc

      // QVAC_MOCK: Expo public env vars are injected at bundle time. Setting
      // EXPO_PUBLIC_QVAC_MOCK=1 enables mock mode in the worklet (skips model
      // loading, echoes input). Used by E2E tests.
      const mock = process.env.EXPO_PUBLIC_QVAC_MOCK === '1'
      await rpcCall(rpc, 1, { storagePath, mock })

      if (mounted) setReady(true)
    }

    init().catch((err) => console.error('Worklet init error:', err))

    return () => {
      mounted = false
      workletRef.current?.terminate()
    }
  }, [nativeAvailable])

  const rpcRequest = useCallback(async (command: number, data?: any) => {
    if (!rpcRef.current) throw new Error('Worklet not ready')
    return rpcCall(rpcRef.current, command, data)
  }, [])

  return (
    <WorkletContext.Provider value={{ ready, rpcRequest, nativeAvailable }}>
      {children}
    </WorkletContext.Provider>
  )
}

export function useWorklet() {
  const ctx = useContext(WorkletContext)
  if (!ctx) throw new Error('useWorklet must be used within WorkletProvider')
  return ctx
}
`,
  }
}
