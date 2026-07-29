import { describe, it, expect } from 'vitest'
import { generateNodeCli } from '../generators/node-cli.js'
import type { GeneratorOptions, Feature } from '../generators/types.js'

function make(features: Feature[] = []): GeneratorOptions {
  return { projectName: 'test-cli', platform: 'node-cli', features }
}

function fileMap(opts: GeneratorOptions) {
  const files = generateNodeCli(opts)
  return Object.fromEntries(files.map((f) => [f.path, f.content]))
}

const ALL_COMBOS: { name: string; features: Feature[] }[] = [
  { name: 'bare', features: [] },
  { name: 'local-ai', features: ['local-ai'] },
  { name: 'wallet', features: ['wallet'] },
  { name: 'local-ai+wallet', features: ['local-ai', 'wallet'] },
]

describe('node-cli generator', () => {
  describe('generates valid file sets', () => {
    for (const combo of ALL_COMBOS) {
      it(`${combo.name}: produces required files`, () => {
        const files = fileMap(make(combo.features))
        expect(files['package.json']).toBeDefined()
        expect(files['tsconfig.json']).toBeDefined()
        expect(files['src/index.ts']).toBeDefined()
        expect(files['src/swarm-manager.ts']).toBeDefined()
        expect(files['src/storage-manager.ts']).toBeDefined()
        expect(files['src/types.d.ts']).toBeDefined()
      })

      it(`${combo.name}: no duplicate file paths`, () => {
        const all = generateNodeCli(make(combo.features))
        const paths = all.map((f) => f.path)
        expect(new Set(paths).size).toBe(paths.length)
      })

      it(`${combo.name}: package.json includes base P2P + KV deps`, () => {
        const pkg = JSON.parse(fileMap(make(combo.features))['package.json'])
        expect(pkg.dependencies.hyperswarm).toBeDefined()
        expect(pkg.dependencies.corestore).toBeDefined()
        expect(pkg.dependencies.hyperbee).toBeDefined()
      })

      it(`${combo.name}: entry point initializes swarm + storage`, () => {
        const entry = fileMap(make(combo.features))['src/index.ts']
        expect(entry).toContain("import Corestore from 'corestore'")
        expect(entry).toContain('createSwarm')
        expect(entry).toContain('createStorage')
        expect(entry).toContain('SIGINT')
      })
    }
  })

  describe('local-ai feature', () => {
    it('includes @qvac/sdk dependency', () => {
      const pkg = JSON.parse(fileMap(make(['local-ai']))['package.json'])
      expect(pkg.dependencies['@qvac/sdk']).toBeDefined()
    })

    it('generates ai-manager.ts with QVAC_MOCK support', () => {
      const files = fileMap(make(['local-ai']))
      const ai = files['src/ai-manager.ts']
      expect(ai).toBeDefined()
      expect(ai).toContain('QVAC_MOCK')
      expect(ai).toContain('MOCK_MODE')
      expect(ai).toContain('Mock:')
    })

    it('entry point imports setupAI', () => {
      const entry = fileMap(make(['local-ai']))['src/index.ts']
      expect(entry).toContain('setupAI')
      expect(entry).toContain('ai.cleanup()')
    })

    it('bare variant does NOT include ai-manager.ts', () => {
      const files = fileMap(make([]))
      expect(files['src/ai-manager.ts']).toBeUndefined()
    })
  })

  describe('wallet feature', () => {
    it('generates wallet stub file', () => {
      const files = fileMap(make(['wallet']))
      expect(files['src/wallet.ts']).toBeDefined()
      expect(files['src/wallet.ts']).toContain('stub')
    })

    it('bare variant does NOT include wallet', () => {
      const files = fileMap(make([]))
      expect(files['src/wallet.ts']).toBeUndefined()
    })
  })

  describe('node-sync feature', () => {
    it('generates node-sync.ts that calls connectToNode', () => {
      const files = fileMap(make(['node-sync']))
      const sync = files['src/node-sync.ts']
      expect(sync).toBeDefined()
      expect(sync).toContain("from '@unstoppable-stack/node-client'")
      expect(sync).toContain('connectToNode')
      expect(sync).toContain('db.core.key')
    })

    it('includes @unstoppable-stack/node-client dependency', () => {
      const pkg = JSON.parse(fileMap(make(['node-sync']))['package.json'])
      expect(pkg.dependencies['@unstoppable-stack/node-client']).toBeDefined()
    })

    it('entry point imports setupNodeSync', () => {
      const entry = fileMap(make(['node-sync']))['src/index.ts']
      expect(entry).toContain('setupNodeSync')
      expect(entry).toContain('nodeSync.close()')
    })

    it('type declarations include @unstoppable-stack/node-client', () => {
      const decls = fileMap(make(['node-sync']))['src/types.d.ts']
      expect(decls).toContain("declare module '@unstoppable-stack/node-client'")
    })

    it('README explains how to run unstoppable-node', () => {
      const readme = fileMap(make(['node-sync']))['README.md']
      expect(readme).toContain('npx unstoppable-node')
      expect(readme).toContain('Node Sync')
    })

    it('bare variant does NOT include node-sync.ts', () => {
      const files = fileMap(make([]))
      expect(files['src/node-sync.ts']).toBeUndefined()
    })
  })

  describe('no autobase anywhere (superseded by autobee)', () => {
    for (const combo of ALL_COMBOS) {
      it(`${combo.name}: no autobase dep or file`, () => {
        const files = fileMap(make(combo.features))
        const pkg = JSON.parse(files['package.json'])
        expect(pkg.dependencies.autobase).toBeUndefined()
        expect(files['src/autobase-manager.ts']).toBeUndefined()
      })
    }
  })

  describe('multi-writer feature', () => {
    it('emits the schema builder and store, and drops the single-writer KV', () => {
      const files = fileMap(make(['multi-writer']))
      expect(files['schema/build.js']).toBeDefined()
      expect(files['src/multi-writer-store.ts']).toBeDefined()
      // multi-writer REPLACES the Hyperbee KV rather than coexisting with it.
      expect(files['src/storage-manager.ts']).toBeUndefined()
    })

    it('bare variant has neither', () => {
      const files = fileMap(make([]))
      expect(files['schema/build.js']).toBeUndefined()
      expect(files['src/multi-writer-store.ts']).toBeUndefined()
      expect(files['src/storage-manager.ts']).toBeDefined()
    })

    it('pins autobee exactly (upstream is experimental)', () => {
      const pkg = JSON.parse(fileMap(make(['multi-writer']))['package.json'])
      expect(pkg.dependencies.autobee).toBe('1.0.10')
      expect(pkg.dependencies.hyperdb).toBeDefined()
      expect(pkg.dependencies.hyperschema).toBeDefined()
      // Autobee brings hyperbee2 itself; the v1 Hyperbee dep is dropped.
      expect(pkg.dependencies.hyperbee).toBeUndefined()
    })

    it('generates the spec on install — it is imported at startup', () => {
      const pkg = JSON.parse(fileMap(make(['multi-writer']))['package.json'])
      expect(pkg.scripts['build:schema']).toBe('node schema/build.js')
      expect(pkg.scripts.postinstall).toBe('npm run build:schema')
    })

    it('schema builder is ESM — the package is type:module', () => {
      const build = fileMap(make(['multi-writer']))['schema/build.js']
      expect(build).toContain("import Hyperschema from 'hyperschema'")
      expect(build).not.toContain("require('hyperschema')")
    })

    it('splits replicated @app from device-private @local', () => {
      const build = fileMap(make(['multi-writer']))['schema/build.js']
      expect(build).toContain("schema.namespace('app')")
      expect(build).toContain("schema.namespace('local')")
      expect(build).toContain("HyperDB.from(SCHEMA_DIR, LOCAL_DIR)")
    })

    it('store uses bee2 for the Autobee view and rocks for local', () => {
      const store = fileMap(make(['multi-writer']))['src/multi-writer-store.ts']
      expect(store).toContain('HyperDB.bee2(bee, AppSpec')
      expect(store).toContain('HyperDB.rocks(')
      // open() must stay synchronous — Autobee does not await it.
      expect(store).not.toMatch(/async function open/)
    })

    it('index queries use both range bounds, not equality shorthand', () => {
      const store = fileMap(make(['multi-writer']))['src/multi-writer-store.ts']
      // An equality shorthand silently matches every row instead of erroring.
      expect(store).toContain('gte: { authorId: author }, lte: { authorId: author }')
    })

    it('guards optional uints with || not ?? (they decode to 0)', () => {
      const store = fileMap(make(['multi-writer']))['src/multi-writer-store.ts']
      expect(store).toContain('(op.doc.updatedAt || 0)')
      expect(store).not.toContain('updatedAt ??')
    })

    it('declares the generated spec via wildcard (relative ambient fails)', () => {
      const decls = fileMap(make(['multi-writer']))['src/types.d.ts']
      expect(decls).toContain("declare module 'autobee'")
      expect(decls).toContain("declare module '*/schema/spec/app/index.js'")
    })
  })
})
