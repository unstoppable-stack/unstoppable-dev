import { describe, it, expect } from 'vitest'
import { spawnSync } from 'node:child_process'
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
        expect(files['electron/main.js']).toBeDefined()
        expect(files['electron/preload.cjs']).toBeDefined()
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

      it(`${combo.name}: uses an Electron entrypoint with a Pear OTA upgrade link`, () => {
        const files = fileMap(make(combo.features))
        const pkg = JSON.parse(files['package.json'])
        expect(pkg.main).toBe('electron/main.js')
        expect(pkg.upgrade).toMatch(/^pear:\/\//)
        expect(pkg.pear).toBeUndefined()
      })

      it(`${combo.name}: includes pear-runtime and Electron, without legacy runtime deps`, () => {
        const files = fileMap(make(combo.features))
        const pkg = JSON.parse(files['package.json'])
        expect(pkg.dependencies['pear-runtime']).toBeDefined()
        expect(pkg.devDependencies.electron).toBeDefined()
        expect(pkg.dependencies['pear-electron']).toBeUndefined()
        expect(pkg.dependencies['pear-bridge']).toBeUndefined()
        expect(pkg.dependencies['pear-run']).toBeUndefined()
      })

      it(`${combo.name}: includes base P2P + KV deps (always-on)`, () => {
        const files = fileMap(make(combo.features))
        const pkg = JSON.parse(files['package.json'])
        expect(pkg.dependencies.hyperswarm).toBeDefined()
        expect(pkg.dependencies.corestore).toBeDefined()
        expect(pkg.dependencies.hyperbee).toBeDefined()
        expect(pkg.dependencies['hypercore-crypto']).toBeDefined()
      })

      it(`${combo.name}: dev script launches Electron directly`, () => {
        const files = fileMap(make(combo.features))
        const pkg = JSON.parse(files['package.json'])
        expect(pkg.scripts.dev).toBe('electron .')
        expect(pkg.scripts.dev).not.toContain('pear run')
      })
    }
  })

  describe('generated documentation', () => {
    it('qualifies offline AI with the required initial model download', () => {
      const readme = fileMap(make(['local-ai']))['README.md']
      expect(readme).toContain('local inference after the initial model download')
      expect(readme).toContain('~532 MB')
      expect(readme).not.toContain('offline inference')
    })
  })

  describe('Electron main process embeds pear-runtime', () => {
    it('initializes the generated Node loader without Bare-only module metadata', () => {
      const main = fileMap(make(['local-ai']))['electron/main.js']
      const declaration = main.match(/^const require = .*$/m)?.[0]
      expect(declaration).toBeDefined()
      const result = spawnSync(process.execPath, ['--input-type=module', '--eval',
        `import { createRequire } from 'node:module';\n${declaration}\nrequire('node:assert').ok(typeof require === 'function')`,
      ], { encoding: 'utf8' })
      expect(result.stderr).toBe('')
      expect(result.status).toBe(0)
    })
    it('imports pear-runtime and launches the Bare worker', () => {
      const files = fileMap(make())
      const main = files['electron/main.js']
      expect(main).toContain("import PearRuntime from 'pear-runtime'")
      expect(main).toContain('runtime.run(')
    })

    it('does not use the removed global Pear API', () => {
      const files = fileMap(make())
      expect(files['electron/main.js']).not.toContain('Pear.worker')
      expect(files['electron/main.js']).not.toContain('Pear.teardown')
    })

    it('uses a sandboxed, context-isolated renderer', () => {
      const files = fileMap(make())
      expect(files['electron/main.js']).toContain('contextIsolation: true')
      expect(files['electron/main.js']).toContain('nodeIntegration: false')
      expect(files['electron/main.js']).toContain('sandbox: true')
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
      expect(worker).toContain("import('@qvac/inference')")
      expect(worker).toContain("import('@qvac/inference/llamacpp-completion/plugin')")
      expect(worker).toContain("import('@qvac/inference/plugins')")
      expect(worker).toContain('registerPlugin(llmPlugin)')
      expect(worker).toContain(`modelSrc: msg.modelSrc || sdk.`)
      expect(worker).toContain("sdk.cancel({ operation: 'inference', modelId })")
      expect(worker).toContain("case 'cancel-chat'")
      expect(worker).not.toContain("require('@qvac/sdk')")
      expect(worker).not.toMatch(/^import .* from '@qvac\/sdk'$/m)
      expect(worker).toContain('QVAC_MOCK')
      expect(worker).toContain('MOCK_AI')
      expect(worker).toContain("'mock-model'")
      const app = fileMap(make(['local-ai']))['app/index.js']
      expect(app).toContain('~532 MB download on first run')
      expect(app).toContain('~1.4–1.5 GiB')
      expect(app).toContain('data-testid="chat-stop-btn"')
      expect(app).toContain("type: 'cancel-chat'")
      expect(app).toContain('msg.requestId === activeChatRequestId')
    })

    it('local-ai: disables reasoning via reasoning_budget, not prompt hacks', () => {
      const worker = fileMap(make(['local-ai']))['worker.js']
      expect(worker).toContain('reasoning_budget: 0')
      expect(worker).not.toContain('n_discarded')
      expect(worker).toContain('streamChat')
      // The old approach — '/no_think' in the system prompt plus a manual
      // <think> stripping state machine over the token stream.
      expect(worker).not.toContain('/no_think')
      expect(worker).not.toContain('<think>')
    })

    it('bare variant: does NOT import @qvac/sdk', () => {
      const worker = fileMap(make([]))['worker.js']
      expect(worker).not.toContain('@qvac/sdk')
    })

    it('uses Bare.IPC for communication', () => {
      const files = fileMap(make())
      expect(files['worker.js']).toContain('Bare.IPC')
      expect(files['worker.js']).not.toContain('Pear.worker.pipe()')
    })

    it('sends workerReady before slow init', () => {
      const worker = fileMap(make())['worker.js']
      const readyIndex = worker.indexOf("send({ type: 'workerReady' })")
      expect(readyIndex).toBeGreaterThan(-1)
      const initIndex = worker.indexOf('async function init()')
      expect(readyIndex).toBeLessThan(initIndex)
    })
  })

  describe('renderer bridge uses the context-isolated preload API', () => {
    it('uses window.unstoppable', () => {
      const files = fileMap(make())
      expect(files['app/bridge.js']).toContain('window.unstoppable')
      expect(files['electron/preload.cjs']).toContain('contextBridge.exposeInMainWorld')
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

  describe('index.html uses the native Electron window frame', () => {
    it('does not include the legacy pear-ctrl element', () => {
      const files = fileMap(make())
      expect(files['index.html']).not.toContain('<pear-ctrl>')
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
      expect(pkg.dependencies['@qvac/inference']).toBe('0.21.0')
      expect(pkg.dependencies['@qvac/llm-llamacpp']).toBe('0.55.0')
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
          'pear-runtime',
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
    it('adds @unstoppable-stack/node-core dependency', () => {
      const files = fileMap(make(['node-sync']))
      const pkg = JSON.parse(files['package.json'])
      expect(pkg.dependencies['@unstoppable-stack/node-core']).toBeDefined()
    })

    it('wires node discovery into the worker after db.ready()', () => {
      const worker = fileMap(make(['node-sync']))['worker.js']
      expect(worker).toContain("from '@unstoppable-stack/node-core'")
      expect(worker).toContain('createNode(')
      expect(worker).toContain('discover(')
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
      expect(app).toContain('copy verification pending')
      expect(app).not.toContain('Protected — background replication is active')
    })

    it('closes the app node on shutdown', () => {
      const worker = fileMap(make(['node-sync']))['worker.js']
      expect(worker).toContain('appNode.close()')
    })

    it('bare variant does not include node-core', () => {
      const files = fileMap(make([]))
      const pkg = JSON.parse(files['package.json'])
      expect(pkg.dependencies['@unstoppable-stack/node-core']).toBeUndefined()
      expect(files['worker.js']).not.toContain('@unstoppable-stack/node-core')
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

    it('does not emit legacy pear routing configuration', () => {
      const pkg = JSON.parse(fileMap(make(['multi-writer']))['package.json'])
      expect(pkg.pear).toBeUndefined()
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
