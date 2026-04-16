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
    { name: 'p2p', features: ['p2p'] },
    { name: 'qvac', features: ['qvac'] },
    { name: 'kv-storage', features: ['kv-storage'] },
    { name: 'p2p+qvac', features: ['p2p', 'qvac'] },
    { name: 'p2p+kv', features: ['p2p', 'kv-storage'] },
    { name: 'p2p+kv+qvac', features: ['p2p', 'kv-storage', 'qvac'] },
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
        expect(pkg.scripts.postinstall).toBeDefined()
        expect(pkg.dependencies).toBeDefined()
      })

      it(`${combo.name}: app.json has expo config`, () => {
        const files = fileMap(make(combo.features))
        const app = JSON.parse(files['app.json'])
        expect(app.expo).toBeDefined()
        expect(app.expo.plugins).toBeDefined()
        expect(app.expo.ios.entitlements).toBeDefined()
      })
    }
  })

  describe('P2P feature generates WorkletContext', () => {
    const P2P_COMBOS = ALL_COMBOS.filter((c) => c.features.includes('p2p'))
    const NON_P2P = ALL_COMBOS.filter((c) => !c.features.includes('p2p'))

    for (const combo of P2P_COMBOS) {
      it(`${combo.name}: generates WorkletContext.tsx`, () => {
        const files = fileMap(make(combo.features))
        expect(files['src/contexts/WorkletContext.tsx']).toBeDefined()
      })

      it(`${combo.name}: generates bare/index.js`, () => {
        const files = fileMap(make(combo.features))
        expect(files['bare/index.js']).toBeDefined()
      })

      it(`${combo.name}: WorkletContext guards Directory.create() with exists check`, () => {
        const files = fileMap(make(combo.features))
        const ctx = files['src/contexts/WorkletContext.tsx']
        expect(ctx).toContain('if (!appDir.exists)')
        expect(ctx).toContain('appDir.create()')

        const createIndex = ctx.indexOf('appDir.create()')
        const guardIndex = ctx.indexOf('if (!appDir.exists)')
        expect(guardIndex).toBeLessThan(createIndex)
      })

      it(`${combo.name}: WorkletContext exports WorkletProvider and useWorklet`, () => {
        const files = fileMap(make(combo.features))
        const ctx = files['src/contexts/WorkletContext.tsx']
        expect(ctx).toContain('export function WorkletProvider')
        expect(ctx).toContain('export function useWorklet')
      })

      it(`${combo.name}: layout wraps with WorkletProvider`, () => {
        const files = fileMap(make(combo.features))
        const layout = files['app/_layout.tsx']
        expect(layout).toContain('WorkletProvider')
        expect(layout).toContain("from '../src/contexts/WorkletContext'")
      })

      it(`${combo.name}: index uses useWorklet hook`, () => {
        const files = fileMap(make(combo.features))
        const index = files['app/index.tsx']
        expect(index).toContain('useWorklet')
        expect(index).not.toContain("require('react-native-bare-kit')")
      })

      it(`${combo.name}: package.json includes P2P dependencies`, () => {
        const files = fileMap(make(combo.features))
        const pkg = JSON.parse(files['package.json'])
        expect(pkg.dependencies['bare-rpc']).toBeDefined()
        expect(pkg.scripts['build:bare']).toBeDefined()
        expect(pkg.scripts.postinstall).toContain('build:bare')
      })
    }

    for (const combo of NON_P2P) {
      it(`${combo.name}: does NOT generate WorkletContext`, () => {
        const files = fileMap(make(combo.features))
        expect(files['src/contexts/WorkletContext.tsx']).toBeUndefined()
      })

      it(`${combo.name}: does NOT generate bare worklet`, () => {
        const files = fileMap(make(combo.features))
        expect(files['bare/index.js']).toBeUndefined()
      })

      it(`${combo.name}: layout does NOT use WorkletProvider`, () => {
        const files = fileMap(make(combo.features))
        expect(files['app/_layout.tsx']).not.toContain('WorkletProvider')
      })
    }
  })

  describe('QVAC feature', () => {
    it('includes @qvac/sdk dependency', () => {
      const files = fileMap(make(['qvac']))
      const pkg = JSON.parse(files['package.json'])
      expect(pkg.dependencies['@qvac/sdk']).toBeDefined()
      expect(pkg.dependencies['expo-device']).toBeDefined()
    })

    it('includes expo plugin in app.json', () => {
      const files = fileMap(make(['qvac']))
      const app = JSON.parse(files['app.json'])
      const plugins = app.expo.plugins as any[]
      expect(plugins).toContain('@qvac/sdk/expo-plugin')
    })

    it('index shows QVAC status', () => {
      const files = fileMap(make(['qvac']))
      expect(files['app/index.tsx']).toContain('qvacStatus')
    })
  })

  describe('storage directory naming', () => {
    it('uses project name in storage directory', () => {
      const files = fileMap(make(['p2p']))
      const ctx = files['src/contexts/WorkletContext.tsx']
      expect(ctx).toContain("'test-app-storage'")
    })

    it('different project names produce different storage dirs', () => {
      const a = generateExpoMobile({ projectName: 'alpha', platform: 'expo-mobile', features: ['p2p'] })
      const b = generateExpoMobile({ projectName: 'beta', platform: 'expo-mobile', features: ['p2p'] })
      const ctxA = a.find((f) => f.path.includes('WorkletContext'))!.content
      const ctxB = b.find((f) => f.path.includes('WorkletContext'))!.content
      expect(ctxA).toContain("'alpha-storage'")
      expect(ctxB).toContain("'beta-storage'")
    })
  })
})
