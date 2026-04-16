import { describe, it, expect } from 'vitest'
import { generatePearDesktop } from '../generators/pear-desktop.js'
import type { GeneratorOptions, Feature } from '../generators/types.js'

function make(features: Feature[] = []): GeneratorOptions {
  return { projectName: 'test-app', platform: 'pear-desktop', features }
}

function fileMap(opts: GeneratorOptions) {
  const files = generatePearDesktop(opts)
  return Object.fromEntries(files.map((f) => [f.path, f.content]))
}

const ALL_COMBOS: { name: string; features: Feature[] }[] = [
  { name: 'bare', features: [] },
  { name: 'p2p', features: ['p2p'] },
  { name: 'qvac', features: ['qvac'] },
  { name: 'kv-storage', features: ['kv-storage'] },
  { name: 'autobase', features: ['autobase'] },
  { name: 'p2p+qvac', features: ['p2p', 'qvac'] },
  { name: 'p2p+kv', features: ['p2p', 'kv-storage'] },
  { name: 'p2p+kv+qvac+autobase', features: ['p2p', 'kv-storage', 'qvac', 'autobase'] },
]

describe('pear-desktop generator', () => {
  describe('generates valid file sets', () => {
    for (const combo of ALL_COMBOS) {
      it(`${combo.name}: produces all required files`, () => {
        const files = fileMap(make(combo.features))
        expect(files['package.json']).toBeDefined()
        expect(files['index.html']).toBeDefined()
        expect(files['index.js']).toBeDefined()
        expect(files['worker.js']).toBeDefined()
        expect(files['app/bridge.js']).toBeDefined()
        expect(files['app/index.js']).toBeDefined()
      })

      it(`${combo.name}: no duplicate file paths`, () => {
        const allFiles = generatePearDesktop(make(combo.features))
        const paths = allFiles.map((f) => f.path)
        expect(new Set(paths).size).toBe(paths.length)
      })
    }
  })

  describe('package.json structure', () => {
    for (const combo of ALL_COMBOS) {
      it(`${combo.name}: valid JSON with required fields`, () => {
        const files = fileMap(make(combo.features))
        const pkg = JSON.parse(files['package.json'])
        expect(pkg.name).toBe('test-app')
        expect(pkg.type).toBe('module')
        expect(pkg.scripts).toBeDefined()
        expect(pkg.dependencies).toBeDefined()
      })

      it(`${combo.name}: has pear config with pre, routes, unrouted`, () => {
        const files = fileMap(make(combo.features))
        const pkg = JSON.parse(files['package.json'])
        expect(pkg.pear).toBeDefined()
        expect(pkg.pear.type).toBe('desktop')
        expect(pkg.pear.pre).toBe('pear-electron/pre')
        expect(pkg.pear.routes).toBe('.')
        expect(pkg.pear.unrouted).toBeInstanceOf(Array)
        expect(pkg.pear.unrouted.length).toBeGreaterThan(0)
        expect(pkg.pear.gui).toBeDefined()
      })

      it(`${combo.name}: includes pear-electron, pear-bridge, pear-run deps`, () => {
        const files = fileMap(make(combo.features))
        const pkg = JSON.parse(files['package.json'])
        expect(pkg.dependencies['pear-electron']).toBeDefined()
        expect(pkg.dependencies['pear-bridge']).toBeDefined()
        expect(pkg.dependencies['pear-run']).toBeDefined()
      })

      it(`${combo.name}: dev script uses -d flag (not --dev)`, () => {
        const files = fileMap(make(combo.features))
        const pkg = JSON.parse(files['package.json'])
        expect(pkg.scripts.dev).toContain('-d')
        expect(pkg.scripts.dev).not.toContain('--dev')
      })
    }
  })

  describe('index.js uses pear-electron + pear-bridge (not Pear.worker.run)', () => {
    it('imports pear-electron and pear-bridge', () => {
      const files = fileMap(make())
      const indexJs = files['index.js']
      expect(indexJs).toContain("import Runtime from 'pear-electron'")
      expect(indexJs).toContain("import Bridge from 'pear-bridge'")
    })

    it('does NOT use Pear.worker.run', () => {
      const files = fileMap(make())
      expect(files['index.js']).not.toContain('Pear.worker.run')
    })

    it('does NOT reference window', () => {
      const files = fileMap(make())
      expect(files['index.js']).not.toContain('window')
    })

    it('creates bridge with waypoint to index.html', () => {
      const files = fileMap(make())
      expect(files['index.js']).toContain("new Bridge({ waypoint: '/index.html' })")
    })

    it('sets up teardown', () => {
      const files = fileMap(make())
      expect(files['index.js']).toContain('Pear.teardown')
    })
  })

  describe('worker.js uses ESM imports (not CJS require)', () => {
    for (const combo of ALL_COMBOS) {
      it(`${combo.name}: no require() calls`, () => {
        const files = fileMap(make(combo.features))
        expect(files['worker.js']).not.toContain('require(')
      })
    }

    it('p2p: uses ESM import for Hyperswarm and Corestore', () => {
      const files = fileMap(make(['p2p']))
      expect(files['worker.js']).toContain("import Corestore from 'corestore'")
      expect(files['worker.js']).toContain("import Hyperswarm from 'hyperswarm'")
      expect(files['worker.js']).toContain("import crypto from 'hypercore-crypto'")
    })

    it('kv-storage: uses ESM import for Hyperbee', () => {
      const files = fileMap(make(['kv-storage']))
      expect(files['worker.js']).toContain("import Hyperbee from 'hyperbee'")
      expect(files['worker.js']).toContain("import Corestore from 'corestore'")
    })

    it('qvac: uses ESM import for @qvac/sdk', () => {
      const files = fileMap(make(['qvac']))
      expect(files['worker.js']).toContain("from '@qvac/sdk'")
      expect(files['worker.js']).not.toContain("require('@qvac/sdk')")
    })

    it('uses Pear.worker.pipe() for communication', () => {
      const files = fileMap(make())
      expect(files['worker.js']).toContain('Pear.worker.pipe()')
    })

    it('sends workerReady before slow init', () => {
      const files = fileMap(make(['p2p']))
      const worker = files['worker.js']
      const readyIndex = worker.indexOf("send({ type: 'workerReady' })")
      expect(readyIndex).toBeGreaterThan(-1)
      const initIndex = worker.indexOf('async function init()')
      expect(readyIndex).toBeLessThan(initIndex)
    })
  })

  describe('app/bridge.js uses pear-run', () => {
    it('imports pear-run', () => {
      const files = fileMap(make())
      expect(files['app/bridge.js']).toContain("import run from 'pear-run'")
    })

    it('does NOT use Pear.worker.run', () => {
      const files = fileMap(make())
      expect(files['app/bridge.js']).not.toContain('Pear.worker.run')
    })

    it('exports sendToWorker and onWorkerMessage', () => {
      const bridge = fileMap(make())['app/bridge.js']
      expect(bridge).toContain('export function sendToWorker')
      expect(bridge).toContain('export function onWorkerMessage')
    })

    it('exports workerReady promise', () => {
      const bridge = fileMap(make())['app/bridge.js']
      expect(bridge).toContain('export const workerReady')
    })

    it('exports destroyWorker', () => {
      const bridge = fileMap(make())['app/bridge.js']
      expect(bridge).toContain('export function destroyWorker')
    })
  })

  describe('index.html has pear-ctrl', () => {
    it('includes <pear-ctrl> element', () => {
      const files = fileMap(make())
      expect(files['index.html']).toContain('<pear-ctrl>')
    })

    it('has draggable title bar', () => {
      const files = fileMap(make())
      expect(files['index.html']).toContain('-webkit-app-region: drag')
    })

    it('loads app/index.js', () => {
      const files = fileMap(make())
      expect(files['index.html']).toContain('src="./app/index.js"')
    })
  })

  describe('app/index.js imports from bridge', () => {
    it('imports from bridge.js', () => {
      const files = fileMap(make())
      expect(files['app/index.js']).toContain("from './bridge.js'")
    })

    it('does NOT use window.addEventListener for worker messages', () => {
      const files = fileMap(make())
      expect(files['app/index.js']).not.toContain("window.addEventListener('worker-message'")
    })

    it('does NOT use window.sendToWorker', () => {
      const files = fileMap(make())
      expect(files['app/index.js']).not.toContain('window.sendToWorker')
    })

    it('includes project name', () => {
      const files = fileMap(make())
      expect(files['app/index.js']).toContain('test-app')
    })
  })

  describe('feature-specific dependencies', () => {
    it('p2p: includes hyperswarm, corestore, hypercore-crypto', () => {
      const pkg = JSON.parse(fileMap(make(['p2p']))['package.json'])
      expect(pkg.dependencies.hyperswarm).toBeDefined()
      expect(pkg.dependencies.corestore).toBeDefined()
      expect(pkg.dependencies['hypercore-crypto']).toBeDefined()
    })

    it('kv-storage: includes hyperbee, corestore', () => {
      const pkg = JSON.parse(fileMap(make(['kv-storage']))['package.json'])
      expect(pkg.dependencies.hyperbee).toBeDefined()
      expect(pkg.dependencies.corestore).toBeDefined()
    })

    it('qvac: includes @qvac/sdk', () => {
      const pkg = JSON.parse(fileMap(make(['qvac']))['package.json'])
      expect(pkg.dependencies['@qvac/sdk']).toBeDefined()
    })

    it('autobase: includes autobase, corestore, hyperswarm, hyperbee', () => {
      const pkg = JSON.parse(fileMap(make(['autobase']))['package.json'])
      expect(pkg.dependencies.autobase).toBeDefined()
      expect(pkg.dependencies.corestore).toBeDefined()
      expect(pkg.dependencies.hyperswarm).toBeDefined()
      expect(pkg.dependencies.hyperbee).toBeDefined()
    })

    it('bare: only has pear-electron, pear-bridge, pear-run, bare-rpc', () => {
      const pkg = JSON.parse(fileMap(make([]))['package.json'])
      const depKeys = Object.keys(pkg.dependencies)
      expect(depKeys).toEqual(
        expect.arrayContaining(['pear-electron', 'pear-bridge', 'pear-run', 'bare-rpc']),
      )
      expect(depKeys).not.toContain('hyperswarm')
      expect(depKeys).not.toContain('@qvac/sdk')
      expect(depKeys).not.toContain('autobase')
    })
  })
})
