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
  { name: 'local-ai', features: ['local-ai'] },
  { name: 'wallet', features: ['wallet'] },
  { name: 'local-ai+wallet', features: ['local-ai', 'wallet'] },
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

      it(`${combo.name}: includes base P2P + KV deps (always-on)`, () => {
        const files = fileMap(make(combo.features))
        const pkg = JSON.parse(files['package.json'])
        expect(pkg.dependencies.hyperswarm).toBeDefined()
        expect(pkg.dependencies.corestore).toBeDefined()
        expect(pkg.dependencies.hyperbee).toBeDefined()
        expect(pkg.dependencies['hypercore-crypto']).toBeDefined()
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

      it(`${combo.name}: always imports base P2P + KV modules`, () => {
        const worker = fileMap(make(combo.features))['worker.js']
        expect(worker).toContain("import Corestore from 'corestore'")
        expect(worker).toContain("import Hyperswarm from 'hyperswarm'")
        expect(worker).toContain("import Hyperbee from 'hyperbee'")
        expect(worker).toContain("import crypto from 'hypercore-crypto'")
      })
    }

    it('local-ai: lazy-imports @qvac/sdk (ESM) and supports QVAC_MOCK', () => {
      const worker = fileMap(make(['local-ai']))['worker.js']
      // The SDK must NOT be imported at module scope: a static import runs
      // native-module resolution when worker.js loads, so an SDK failure
      // kills the worker before it can report anything on its pipe — taking
      // P2P and KV storage down with it. It is imported inside 'load-ai'.
      expect(worker).toContain("await import('@qvac/sdk')")
      expect(worker).not.toContain("require('@qvac/sdk')")
      expect(worker).not.toMatch(/^import .* from '@qvac\/sdk'$/m)
      expect(worker).toContain('QVAC_MOCK')
      expect(worker).toContain('MOCK_AI')
      expect(worker).toContain("'mock-model'")
    })

    it('local-ai: disables reasoning via reasoning_budget, not prompt hacks', () => {
      const worker = fileMap(make(['local-ai']))['worker.js']
      expect(worker).toContain('reasoning_budget: 0')
      expect(worker).toContain('n_discarded')
      // The old approach — '/no_think' in the system prompt plus a manual
      // <think> stripping state machine over the token stream.
      expect(worker).not.toContain('/no_think')
      expect(worker).not.toContain('<think>')
    })

    it('bare variant: does NOT import @qvac/sdk', () => {
      const worker = fileMap(make([]))['worker.js']
      expect(worker).not.toContain('@qvac/sdk')
    })

    it('uses Pear.worker.pipe() for communication', () => {
      const files = fileMap(make())
      expect(files['worker.js']).toContain('Pear.worker.pipe()')
    })

    it('sends workerReady before slow init', () => {
      const worker = fileMap(make())['worker.js']
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
      expect(files['app/index.js']).not.toContain(
        "window.addEventListener('worker-message'",
      )
    })

    it('does NOT use window.sendToWorker', () => {
      const files = fileMap(make())
      expect(files['app/index.js']).not.toContain('window.sendToWorker')
    })

    it('includes project name', () => {
      const files = fileMap(make())
      expect(files['app/index.js']).toContain('test-app')
    })

    it('always renders base P2P + KV sections (no feature flags)', () => {
      const app = fileMap(make())['app/index.js']
      expect(app).toContain('data-testid="p2p-section"')
      expect(app).toContain('data-testid="kv-section"')
      expect(app).toContain('data-testid="kv-save-btn"')
      expect(app).toContain('data-testid="kv-fetch-btn"')
    })
  })

  describe('feature-specific behaviour', () => {
    it('local-ai: includes @qvac/sdk and AI section', () => {
      const files = fileMap(make(['local-ai']))
      const pkg = JSON.parse(files['package.json'])
      expect(pkg.dependencies['@qvac/sdk']).toBeDefined()
      expect(files['app/index.js']).toContain('data-testid="ai-section"')
      expect(files['app/index.js']).toContain('data-testid="load-ai-btn"')
      expect(files['app/index.js']).toContain('data-testid="chat-input"')
      expect(files['app/index.js']).toContain('data-testid="chat-send-btn"')
    })

    it('wallet: includes wallet section stub', () => {
      const files = fileMap(make(['wallet']))
      expect(files['app/index.js']).toContain('data-testid="wallet-section"')
      expect(files['worker.js']).toContain("service: 'wallet'")
    })

    it('bare variant: only has pear + base P2P/KV deps, no @qvac/sdk', () => {
      const pkg = JSON.parse(fileMap(make([]))['package.json'])
      const depKeys = Object.keys(pkg.dependencies)
      expect(depKeys).toEqual(
        expect.arrayContaining([
          'pear-electron',
          'pear-bridge',
          'pear-run',
          'bare-rpc',
          'hyperswarm',
          'corestore',
          'hyperbee',
        ]),
      )
      expect(depKeys).not.toContain('@qvac/sdk')
      expect(depKeys).not.toContain('autobase')
    })

    it('no variant pulls autobase (flag removed)', () => {
      for (const combo of ALL_COMBOS) {
        const pkg = JSON.parse(fileMap(make(combo.features))['package.json'])
        expect(pkg.dependencies.autobase).toBeUndefined()
      }
    })
  })

  describe('node-sync feature', () => {
    it('adds @unstoppable-stack/node-client dependency', () => {
      const files = fileMap(make(['node-sync']))
      const pkg = JSON.parse(files['package.json'])
      expect(pkg.dependencies['@unstoppable-stack/node-client']).toBeDefined()
    })

    it('wires connectToNode into the worker after db.ready()', () => {
      const worker = fileMap(make(['node-sync']))['worker.js']
      expect(worker).toContain("from '@unstoppable-stack/node-client'")
      expect(worker).toContain('connectToNode(')
      expect(worker).toContain("service: 'node-sync'")
      expect(worker).toContain('main-db')
      // Must fall back gracefully when the node is unavailable
      expect(worker).toContain('unavailable')
    })

    it('adds node-sync UI section + message handler', () => {
      const app = fileMap(make(['node-sync']))['app/index.js']
      expect(app).toContain('data-testid="node-sync-section"')
      expect(app).toContain('node-sync-status')
      expect(app).toContain("msg.service === 'node-sync'")
    })

    it('closes the client on shutdown', () => {
      const worker = fileMap(make(['node-sync']))['worker.js']
      expect(worker).toContain('nodeClient.close()')
    })

    it('bare variant does not include node-client', () => {
      const files = fileMap(make([]))
      const pkg = JSON.parse(files['package.json'])
      expect(pkg.dependencies['@unstoppable-stack/node-client']).toBeUndefined()
      expect(files['worker.js']).not.toContain('@unstoppable-stack/node-client')
    })
  })

  describe('multi-writer feature', () => {
    it('emits the schema builder and a plain-ESM store beside worker.js', () => {
      const files = fileMap(make(['multi-writer']))
      expect(files['schema/build.js']).toBeDefined()
      // .js, not .ts — the Pear worker is plain ESM with no build step.
      expect(files['multi-writer-store.js']).toBeDefined()
      expect(files['multi-writer-store.ts']).toBeUndefined()
    })

    it('worker imports the store instead of Hyperbee', () => {
      const worker = fileMap(make(['multi-writer']))['worker.js']
      expect(worker).toContain("import { createStore } from './multi-writer-store.js'")
      expect(worker).not.toContain("import Hyperbee from 'hyperbee'")
    })

    it('swarm hands connections to Autobee, not Corestore', () => {
      const worker = fileMap(make(['multi-writer']))['worker.js']
      // Autobee's replicate adds its wakeup session on top of store
      // replication; store.replicate alone loses writer wakeup.
      expect(worker).toContain('db.autobee.replicate(conn)')
    })

    it('exposes mesh info and writer promotion over the pipe', () => {
      const worker = fileMap(make(['multi-writer']))['worker.js']
      expect(worker).toContain("case 'mesh-info'")
      expect(worker).toContain("case 'add-writer'")
      expect(worker).toContain('db.addWriter(msg.writerKey)')
    })

    it('surfaces both keys separately in the UI', () => {
      const app = fileMap(make(['multi-writer']))['app/index.js']
      expect(app).toContain('data-testid="mesh-db-key"')
      expect(app).toContain('data-testid="mesh-writer-key"')
      expect(app).toContain('data-testid="mesh-add-writer-btn"')
    })

    it('unroutes the store and schema so the worker can load them', () => {
      const pkg = JSON.parse(fileMap(make(['multi-writer']))['package.json'])
      expect(pkg.pear.unrouted).toContain('/worker.js')
      expect(pkg.pear.unrouted).toContain('/multi-writer-store.js')
      expect(pkg.pear.unrouted).toContain('/schema')
    })

    it('builds the spec on install and closes the store on shutdown', () => {
      const files = fileMap(make(['multi-writer']))
      const pkg = JSON.parse(files['package.json'])
      expect(pkg.scripts.postinstall).toBe('npm run build:schema')
      expect(files['worker.js']).toContain('await db.close()')
    })

    it('bare variant keeps the single-writer Hyperbee path', () => {
      const files = fileMap(make([]))
      expect(files['schema/build.js']).toBeUndefined()
      expect(files['multi-writer-store.js']).toBeUndefined()
      expect(files['worker.js']).toContain("import Hyperbee from 'hyperbee'")
    })
  })
})
