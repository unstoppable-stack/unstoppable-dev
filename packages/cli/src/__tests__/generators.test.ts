import { describe, it, expect } from 'vitest'
import { generateExpoMobile } from '../generators/expo-mobile.js'
import type { GeneratorOptions, Feature } from '../generators/types.js'

function make(features: Feature[] = []): GeneratorOptions {
  return { projectName: 'test-app', platform: 'expo-mobile', features }
}

function fileMap(opts: GeneratorOptions) {
  const files = generateExpoMobile(opts)
  return Object.fromEntries(files.map((f) => [f.path, f.content]))
}

describe('expo-mobile generator', () => {
  const ALL_COMBOS: { name: string; features: Feature[] }[] = [
    { name: 'bare', features: [] },
    { name: 'local-ai', features: ['local-ai'] },
  ]

  describe('generates valid file sets', () => {
    for (const combo of ALL_COMBOS) {
      it(`${combo.name}: produces required files`, () => {
        const files = fileMap(make(combo.features))
        expect(files['package.json']).toBeDefined()
        expect(files['app.json']).toBeDefined()
        expect(files['metro.config.js']).toBeDefined()
        expect(files['mocks/empty.js']).toBeDefined()
        expect(files['app/_layout.tsx']).toBeDefined()
        expect(files['app/index.tsx']).toBeDefined()
        expect(files['plugins/withAndroidNdkVersion.js']).toBeDefined()
        expect(files['plugins/withAndroidArchitecture.js']).toBeDefined()
      })

      it(`${combo.name}: always generates worklet files (P2P is base)`, () => {
        const files = fileMap(make(combo.features))
        expect(files['bare/index.js']).toBeDefined()
        expect(files['src/contexts/WorkletContext.tsx']).toBeDefined()
      })

      it(`${combo.name}: no duplicate file paths`, () => {
        const allFiles = generateExpoMobile(make(combo.features))
        const paths = allFiles.map((f) => f.path)
        expect(new Set(paths).size).toBe(paths.length)
      })

      it(`${combo.name}: package.json is valid JSON with required fields`, () => {
        const files = fileMap(make(combo.features))
        const pkg = JSON.parse(files['package.json'])
        expect(pkg.name).toBe('test-app')
        expect(pkg.scripts).toBeDefined()
        expect(pkg.scripts.prebuild).toBeDefined()
        expect(pkg.dependencies).toBeDefined()
      })

      it(`${combo.name}: package.json includes base P2P + worklet deps`, () => {
        const files = fileMap(make(combo.features))
        const pkg = JSON.parse(files['package.json'])
        expect(pkg.dependencies['react-native-bare-kit']).toBeDefined()
        expect(pkg.dependencies['bare-rpc']).toBeDefined()
        expect(pkg.dependencies['bare-pack']).toBeDefined()
        expect(pkg.scripts['build:bare']).toBeDefined()
        // bare-pack runs before `start`/`ios`/`android`, not at postinstall,
        // so `npm install` doesn't depend on the worklet's dep graph resolving.
        expect(pkg.scripts.prebuild).toContain('build:bare')
        expect(pkg.scripts.prestart).toContain('build:bare')
      })

      it(`${combo.name}: app.json has expo config`, () => {
        const files = fileMap(make(combo.features))
        const app = JSON.parse(files['app.json'])
        expect(app.expo).toBeDefined()
        expect(app.expo.plugins).toBeDefined()
        expect(app.expo.ios.entitlements).toBeDefined()
      })

      it(`${combo.name}: layout always wraps with WorkletProvider`, () => {
        const files = fileMap(make(combo.features))
        const layout = files['app/_layout.tsx']
        expect(layout).toContain('WorkletProvider')
        expect(layout).toContain("from '../src/contexts/WorkletContext'")
      })
    }
  })

  describe('base features (always present)', () => {
    it('index uses useWorklet hook', () => {
      const files = fileMap(make([]))
      const index = files['app/index.tsx']
      expect(index).toContain('useWorklet')
      expect(index).not.toContain("require('react-native-bare-kit')")
    })

    it('index shows P2P and KV sections without any feature flags', () => {
      const files = fileMap(make([]))
      const index = files['app/index.tsx']
      expect(index).toContain('testID="p2p-section"')
      expect(index).toContain('testID="kv-section"')
      expect(index).toContain('testID="kv-save-btn"')
      expect(index).toContain('testID="kv-fetch-btn"')
    })

    it('KV handlers go through the worklet via RPC', () => {
      const files = fileMap(make([]))
      const index = files['app/index.tsx']
      expect(index).toContain('rpcRequest(5,')
      expect(index).toContain('rpcRequest(6,')
    })

    it('WorkletContext guards Directory.create() with exists check', () => {
      const files = fileMap(make([]))
      const ctx = files['src/contexts/WorkletContext.tsx']
      expect(ctx).toContain('if (!appDir.exists)')
      expect(ctx).toContain('appDir.create()')

      const createIndex = ctx.indexOf('appDir.create()')
      const guardIndex = ctx.indexOf('if (!appDir.exists)')
      expect(guardIndex).toBeLessThan(createIndex)
    })

    it('WorkletContext passes mock flag via EXPO_PUBLIC_QVAC_MOCK env', () => {
      const files = fileMap(make([]))
      const ctx = files['src/contexts/WorkletContext.tsx']
      expect(ctx).toContain('EXPO_PUBLIC_QVAC_MOCK')
      expect(ctx).toContain('mock')
    })

    it('bare worklet supports base KV commands 5 and 6', () => {
      const files = fileMap(make([]))
      const bare = files['bare/index.js']
      expect(bare).toContain('case 5:')
      expect(bare).toContain('case 6:')
      expect(bare).toContain('Hyperbee')
      expect(bare).toContain('Corestore')
    })
  })

  describe('local-ai feature', () => {
    it('includes @qvac/sdk dependency', () => {
      const files = fileMap(make(['local-ai']))
      const pkg = JSON.parse(files['package.json'])
      expect(pkg.dependencies['@qvac/sdk']).toBeDefined()
      expect(pkg.dependencies['expo-device']).toBeDefined()
    })

    it('includes expo plugin in app.json', () => {
      const files = fileMap(make(['local-ai']))
      const app = JSON.parse(files['app.json'])
      const plugins = app.expo.plugins as any[]
      expect(plugins).toContainEqual(['@qvac/sdk/expo-plugin', { installMissingPrebuilds: true }])
    })

    it('index shows AI section with Load Assistant button', () => {
      const files = fileMap(make(['local-ai']))
      const index = files['app/index.tsx']
      expect(index).toContain('testID="ai-section"')
      expect(index).toContain('testID="load-ai-btn"')
      expect(index).toContain('testID="chat-input"')
      expect(index).toContain('testID="chat-send-btn"')
    })

    it('renders chat bubbles with role-scoped testIDs (so e2e can target assistant replies)', () => {
      // The CPU-mode simulator e2e (and the device e2e) wait for
      // `chat-bubble-assistant` to assert a real streamed reply landed.
      // The bubble must also be conditional on non-empty content,
      // otherwise the empty placeholder we push at send-time would
      // mount the testID before any tokens arrive — making the wait a
      // no-op that always passes. Both invariants are critical and
      // must be locked in.
      const files = fileMap(make(['local-ai']))
      const index = files['app/index.tsx']
      // testID must use the message role so we get
      // `chat-bubble-user` + `chat-bubble-assistant`.
      expect(index).toContain('testID={`chat-bubble-${msg.role}`}')
      // Empty messages (the streaming placeholder) must be filtered
      // out of the render so the testID only appears once content
      // has streamed in.
      expect(index).toContain('messages\n                  .filter((m) => m.content)')
    })

    it('does NOT import @qvac/sdk in the bare worklet', () => {
      // QVAC SDK's bare-runtime path uses an obfuscated dynamic import of
      // ../../server/worker.js that bare-pack cannot statically trace,
      // producing a runtime MODULE_NOT_FOUND. Inference must therefore live
      // in React Native (app/index.tsx) — see the architectural comment in
      // the bareWorklet() generator for full context.
      const files = fileMap(make(['local-ai']))
      const bare = files['bare/index.js']
      expect(bare).not.toContain("require('@qvac/sdk')")
      expect(bare).not.toContain('loadModel(')
      expect(bare).not.toContain('completion(')
    })

    it('imports @qvac/sdk in the React Native runtime instead', () => {
      const files = fileMap(make(['local-ai']))
      const index = files['app/index.tsx']
      expect(index).toContain("from '@qvac/sdk'")
      expect(index).toContain('loadModel(')
      expect(index).toContain('completion(')
      expect(index).toContain('QWEN3_5_0_8B_MULTIMODAL_Q4_K_M')
    })

    it('disables reasoning via reasoning_budget, not prompt hacks', () => {
      const index = fileMap(make(['local-ai']))['app/index.tsx']
      expect(index).toContain('reasoning_budget: 0')
      expect(index).not.toContain('n_discarded')
      expect(index).not.toContain('/no_think')
      expect(index).not.toContain('<think>')
    })

    it('react-native side supports EXPO_PUBLIC_QVAC_MOCK for tests', () => {
      const files = fileMap(make(['local-ai']))
      const index = files['app/index.tsx']
      expect(index).toContain('EXPO_PUBLIC_QVAC_MOCK')
      expect(index).toContain("'mock-model'")
      expect(index).toContain("'Mock: '")
    })

    it('rejects simulator inference before download with a clear, actionable error', () => {
      // Per QVAC docs: inference doesn't run on iOS Simulator / Android
      // Emulator. Both modes are unsupported, so we refuse
      // fast with an actionable message instead of letting llamacpp fail
      // with a confusing native error. CPU mode is still attempted (see
      // the toggle test below) so users can experiment.
      const files = fileMap(make(['local-ai']))
      const index = files['app/index.tsx']
      expect(index).toContain('Device.isDevice === false')
      expect(index).toContain('Local AI requires a physical device')
      expect(index).toContain('EXPO_PUBLIC_QVAC_MOCK=1')
    })

    it('README warns against Expo Go and points to npm run ios for native builds', () => {
      // Expo Go is a fixed shell that can't load BareKit / QVAC native
      // modules. The most common new-user pitfall is running
      // `npx expo start` and opening in Expo Go, getting a confusing
      // `TurboModuleRegistry.getEnforcing('BareKit')` error. README
      // must call this out unmistakably.
      const files = fileMap(make(['local-ai']))
      const readme = files['README.md']
      expect(readme).toContain('npm run ios')
      expect(readme).toContain('Why not Expo Go?')
      expect(readme).toContain("'BareKit'")
      expect(readme).toContain('--device')
    })

    it('exposes a GPU/CPU toggle so users can choose inference device', () => {
      // GPU and CPU remain selectable on physical devices.
      const files = fileMap(make(['local-ai']))
      const index = files['app/index.tsx']
      expect(index).toContain("useState<'gpu' | 'cpu'>('gpu')")
      expect(index).toContain('Switch')
      expect(index).toContain('testID="ai-device-switch"')
      expect(index).toContain('device: aiDevice')
      expect(index).toContain('if (Device.isDevice === false)')
    })

    it('auto-builds the Bare worklet bundle on metro start', () => {
      // npm `pre*` hooks (prestart/preios/preandroid) only fire on
      // `npm run …`. Direct invocations (`npx expo start`, `expo start`,
      // CI scripts) bypass them and bundling fails on the missing
      // bare/app.bundle.js. We invoke `bare-pack` from metro.config.js
      // itself so every entry point is safe.
      const files = fileMap(make(['local-ai']))
      const metro = files['metro.config.js']
      expect(metro).toContain('workletBundleStale')
      expect(metro).toContain('npm run build:bare')
      expect(metro).toContain('bare/app.bundle.js')
    })

    it('matches the QVAC reference app metro pattern (no package-exports overrides)', () => {
      // The QVAC reference mobile app
      // (`reference-apps/qvac-workbench-mobile/metro.config.js`) ships a
      // minimal config that only mocks native modules. Earlier versions
      // of the scaffold disabled `unstable_enablePackageExports` and
      // added subpath redirects — that fought Metro's resolver and broke
      // RN's haste map (Failed to get the SHA-1 errors). We now match
      // the reference pattern exactly.
      const files = fileMap(make(['local-ai']))
      const metro = files['metro.config.js']
      expect(metro).not.toContain('unstable_enablePackageExports')
      expect(metro).not.toContain('subpathRedirects')
      expect(metro).toContain('nativeModuleMocks.includes(moduleName)')
      expect(metro).toContain('"sodium-native"')
      expect(metro).toContain('"bare-fs"')
    })

    it('ships a placeholder icon at assets/icon.png so prebuild succeeds', () => {
      // Without an icon, Expo's prebuild + Metro asset endpoint log
      // `Asset not found: assets/icon.png` on every dev boot.
      const allFiles = generateExpoMobile(make(['local-ai']))
      const icon = allFiles.find((f) => f.path === 'assets/icon.png')
      expect(icon).toBeDefined()
      expect(icon!.encoding).toBe('base64')
      expect(icon!.content.length).toBeGreaterThan(50)
    })

    it('references assets/icon.png from app.json (ios + android adaptive)', () => {
      const files = fileMap(make(['local-ai']))
      const appJson = JSON.parse(files['app.json'])
      expect(appJson.expo.icon).toBe('./assets/icon.png')
      expect(appJson.expo.android.adaptiveIcon.foregroundImage).toBe('./assets/icon.png')
    })

    it('uses the two-phase downloadAsset + loadModel pattern from QVAC docs', () => {
      const files = fileMap(make(['local-ai']))
      const index = files['app/index.tsx']
      expect(index).toContain('downloadAsset(')
      expect(index).toContain('loadModel(')
      expect(index).toContain('VERBOSITY.ERROR')
    })
  })

  describe('bare variant (no optional features)', () => {
    it('does NOT include QVAC sdk', () => {
      const files = fileMap(make([]))
      const pkg = JSON.parse(files['package.json'])
      expect(pkg.dependencies['@qvac/sdk']).toBeUndefined()
    })

    it('does NOT show AI section', () => {
      const files = fileMap(make([]))
      const index = files['app/index.tsx']
      expect(index).not.toContain('testID="ai-section"')
    })
  })

  describe('node-sync feature', () => {
    it('adds @unstoppable-stack/p2p and hyperswarm deps', () => {
      const files = fileMap(make(['node-sync']))
      const pkg = JSON.parse(files['package.json'])
      expect(pkg.dependencies['@unstoppable-stack/p2p']).toBeDefined()
      expect(pkg.dependencies.hyperswarm).toBeDefined()
    })

    it('bare worklet exposes node-sync commands 7 and 8', () => {
      const files = fileMap(make(['node-sync']))
      const bare = files['bare/index.js']
      expect(bare).toContain('case 7:')
      expect(bare).toContain('case 8:')
      expect(bare).toContain("import('@unstoppable-stack/p2p')")
      expect(bare).toContain('createNode(')
      expect(bare).toContain('discover(')
    })

    it('index shows node-sync section and auto-connects on ready', () => {
      const files = fileMap(make(['node-sync']))
      const index = files['app/index.tsx']
      expect(index).toContain('testID="node-sync-section"')
      expect(index).toContain('nodeStatus')
      expect(index).toContain('rpcRequest(7)')
      expect(index).toContain('useEffect')
      expect(index).toContain('copy verification pending')
      expect(index).not.toContain('Protected — background replication is active')
    })

    it('bare variant does NOT include P2P runtime', () => {
      const files = fileMap(make([]))
      const pkg = JSON.parse(files['package.json'])
      expect(pkg.dependencies['@unstoppable-stack/p2p']).toBeUndefined()
      expect(files['bare/index.js']).not.toContain('@unstoppable-stack/p2p')
      expect(files['app/index.tsx']).not.toContain('testID="node-sync-section"')
    })
  })

  describe('storage directory naming', () => {
    it('uses project name in storage directory', () => {
      const files = fileMap(make([]))
      const ctx = files['src/contexts/WorkletContext.tsx']
      expect(ctx).toContain("'test-app-storage'")
    })

    it('different project names produce different storage dirs', () => {
      const a = generateExpoMobile({ projectName: 'alpha', platform: 'expo-mobile', features: [] })
      const b = generateExpoMobile({ projectName: 'beta', platform: 'expo-mobile', features: [] })
      const ctxA = a.find((f) => f.path.includes('WorkletContext'))!.content
      const ctxB = b.find((f) => f.path.includes('WorkletContext'))!.content
      expect(ctxA).toContain("'alpha-storage'")
      expect(ctxB).toContain("'beta-storage'")
    })
  })
})
