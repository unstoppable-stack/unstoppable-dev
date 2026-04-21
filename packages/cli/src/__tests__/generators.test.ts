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
      expect(plugins).toContain('@qvac/sdk/expo-plugin')
    })

    it('index shows AI section with Load Assistant button', () => {
      const files = fileMap(make(['local-ai']))
      const index = files['app/index.tsx']
      expect(index).toContain('testID="ai-section"')
      expect(index).toContain('testID="load-ai-btn"')
      expect(index).toContain('testID="chat-input"')
      expect(index).toContain('testID="chat-send-btn"')
    })

    it('bare worklet supports mock mode for load-model and chat', () => {
      const files = fileMap(make(['local-ai']))
      const bare = files['bare/index.js']
      expect(bare).toContain('mockMode')
      expect(bare).toContain("modelId = 'mock-model'")
      expect(bare).toContain('Mock:')
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
    it('adds @unstoppable/node-client and hyperswarm deps', () => {
      const files = fileMap(make(['node-sync']))
      const pkg = JSON.parse(files['package.json'])
      expect(pkg.dependencies['@unstoppable/node-client']).toBeDefined()
      expect(pkg.dependencies.hyperswarm).toBeDefined()
    })

    it('bare worklet exposes node-sync commands 7 and 8', () => {
      const files = fileMap(make(['node-sync']))
      const bare = files['bare/index.js']
      expect(bare).toContain('case 7:')
      expect(bare).toContain('case 8:')
      expect(bare).toContain("import('@unstoppable/node-client')")
      expect(bare).toContain('connectToNode')
    })

    it('index shows node-sync section and auto-connects on ready', () => {
      const files = fileMap(make(['node-sync']))
      const index = files['app/index.tsx']
      expect(index).toContain('testID="node-sync-section"')
      expect(index).toContain('nodeStatus')
      expect(index).toContain('rpcRequest(7)')
      expect(index).toContain('useEffect')
    })

    it('bare variant does NOT include node-client', () => {
      const files = fileMap(make([]))
      const pkg = JSON.parse(files['package.json'])
      expect(pkg.dependencies['@unstoppable/node-client']).toBeUndefined()
      expect(files['bare/index.js']).not.toContain('@unstoppable/node-client')
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
