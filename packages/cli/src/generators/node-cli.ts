import { manifest } from '../compatibility/index.js'
import { dependenciesFor, profileFor, projectFiles } from '../compatibility/index.js'
import type { GeneratedFile, GeneratorOptions } from './types.js'
import {
  has, tsconfig, gitignore, readme, planningReadme,
  DEFAULT_LLM_CONST, DEFAULT_LLM_LABEL, DEFAULT_LLM_SIZE_MB, DEFAULT_CTX_SIZE,
  llmModelConfig, MULTI_WRITER_DEPS, schemaBuilder, multiWriterStoreSource,
} from './common.js'

/**
 * Node CLI generator.
 *
 * Base infrastructure (always included):
 *   - Hyperswarm + Corestore (P2P networking)
 *   - Hyperbee (local KV storage)
 *
 * Optional features:
 *   - local-ai  → QVAC SDK (with QVAC_MOCK=1 env var support)
 *   - wallet    → WDK stub
 *   - node-sync → register cores with the Personal Node alpha for
 *                 replication via @unstoppable-stack/node-core
 */
export function generateNodeCli(opts: GeneratorOptions): GeneratedFile[] {
  const files: GeneratedFile[] = [
    tsconfig(),
    gitignore(),
    readme(opts),
    planningReadme(),
    ...projectFiles(opts),
    packageJson(opts),
    entryPoint(opts),
    swarmManager(),
  ]

  // multi-writer REPLACES the single-writer Hyperbee KV rather than sitting
  // beside it — two competing stores in one scaffold is just confusing.
  if (has(opts, 'multi-writer')) {
    files.push(schemaBuilder(), multiWriterStore())
  } else {
    files.push(storageManager())
  }

  if (has(opts, 'local-ai')) files.push(aiManager())
  if (has(opts, 'wallet')) files.push(walletStub())
  if (has(opts, 'node-sync')) files.push(nodeSyncManager(opts))
  if (has(opts, 'node-host')) files.push(nodeHostManager(opts))

  files.push(typeDeclarations(opts))

  return files
}

function packageJson(opts: GeneratorOptions): GeneratedFile {
  const profile = profileFor(opts.platform)
  const deps = dependenciesFor(opts)
  const devDeps = profile.devDependencies

  return {
    path: 'package.json',
    content: JSON.stringify(
      {
        name: opts.projectName,
        version: '0.1.0',
        private: true,
        type: 'module',
        engines: profile.engines,
        scripts: {
          ...(has(opts, 'multi-writer')
            ? {
                'build:schema': 'node schema/build.js',
                // The generated spec/ is required at import time, so build it
                // as part of install rather than making `npm run dev` fail.
                postinstall: 'npm run build:schema',
              }
            : {}),
          dev: 'tsx watch src/index.ts',
          build: 'tsc',
          start: 'node dist/index.js',
        },
        dependencies: deps,
        devDependencies: devDeps,
      },
      null,
      2,
    ),
  }
}

function entryPoint(opts: GeneratorOptions): GeneratedFile {
  const multiWriter = has(opts, 'multi-writer')

  const imports: string[] = [
    `import Corestore from 'corestore'`,
    `import { createSwarm } from './swarm-manager.js'`,
    multiWriter
      ? `import { createStore } from './multi-writer-store.js'`
      : `import { createStorage } from './storage-manager.js'`,
  ]

  const initCalls: string[] = [
    `const store = new Corestore('./storage')`,
    `const swarm = createSwarm(store)`,
    `console.log('P2P swarm started')`,
  ]

  const cleanupCalls: string[] = [`await swarm.destroy()`]

  if (multiWriter) {
    // BOOTSTRAP_KEY empty => create a new database. Set it to another
    // device's key to join that device's mesh instead.
    initCalls.push(
      `const db = await createStore(store, './storage', process.env.BOOTSTRAP_KEY || null)`,
      `console.log('Multi-writer store ready')`,
      `console.log('  database key:', db.key)`,
      `console.log('  this writer :', db.writerKey)`,
      `console.log('  writable    :', db.writable)`,
      `if (!db.writable) console.log('  -> ask a peer to run db.addWriter(<this writer key>)')`,
    )
    cleanupCalls.push(`await db.close()`)
  } else {
    initCalls.push(
      `const db = await createStorage(store)`,
      `console.log('Storage ready')`,
    )
  }

  if (has(opts, 'local-ai')) {
    imports.push(`import { setupAI } from './ai-manager.js'`)
    initCalls.push(`const ai = await setupAI()`)
    initCalls.push(`console.log('AI ready')`)
    cleanupCalls.push(`await ai.cleanup()`)
  }

  if (has(opts, 'wallet')) {
    imports.push(`import { setupWallet } from './wallet.js'`)
    initCalls.push(`const wallet = await setupWallet()`)
    initCalls.push(`console.log('Wallet ready (stub)')`)
  }

  if (has(opts, 'node-sync')) {
    imports.push(`import { setupNodeSync } from './node-sync.js'`)
    // Run in background so a missing/offline Node doesn't block startup.
    // The helper logs its own progress and reconnection hints.
    initCalls.push(`const nodeSync = setupNodeSync({ db })`)
    cleanupCalls.push(`await nodeSync.close()`)
  }

  return {
    path: 'src/index.ts',
    content: `${imports.join('\n')}

async function main() {
  console.log('Starting ${opts.projectName}...')

${initCalls.map((c) => '  ' + c).join('\n')}

  console.log('${opts.projectName} is running. Press Ctrl+C to exit.')

  process.on('SIGINT', async () => {
    console.log('\\nShutting down...')
${cleanupCalls.map((c) => '    ' + c).join('\n')}
    process.exit(0)
  })
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
`,
  }
}

function swarmManager(): GeneratedFile {
  return {
    path: 'src/swarm-manager.ts',
    content: `import Hyperswarm from 'hyperswarm'
import crypto from 'hypercore-crypto'

export function createSwarm(store: any) {
  const swarm = new Hyperswarm()

  swarm.on('connection', (conn: any, info: any) => {
    console.log('Peer connected:', info.publicKey.toString('hex').slice(0, 8))
    store.replicate(conn)
    conn.on('error', (err: Error) => console.error('Connection error:', err.message))
    conn.on('close', () => console.log('Peer disconnected'))
  })

  return swarm
}

export function joinTopic(swarm: any, topicName: string) {
  const topic = crypto.discoveryKey(Buffer.from(topicName))
  const discovery = swarm.join(topic, { server: true, client: true })
  return discovery
}
`,
  }
}

function storageManager(): GeneratedFile {
  return {
    path: 'src/storage-manager.ts',
    content: `import Hyperbee from 'hyperbee'

export async function createStorage(store: any) {
  const core = store.get({ name: 'main-db' })
  const db = new Hyperbee(core, {
    keyEncoding: 'utf-8',
    valueEncoding: 'json',
  })
  await db.ready()
  return db
}
`,
  }
}

function multiWriterStore(): GeneratedFile {
  return {
    path: 'src/multi-writer-store.ts',
    content: multiWriterStoreSource('../schema/spec', true),
  }
}

function aiManager(): GeneratedFile {
  return {
    path: 'src/ai-manager.ts',
    content: `import { createAISession, createNodeAdapter, createMockAdapter } from '../.unstoppable/runtime-ai/index.js'

const ai = createAISession({
  adapter: process.env.QVAC_MOCK === '1' ? createMockAdapter() : createNodeAdapter(),
  byteBudget: ${Math.floor(DEFAULT_CTX_SIZE / 2)},
})
let requestId = 0

export async function setupAI() {
  if (ai.mock) console.log('AI mock mode enabled — skipping model load')
  await ai.load({
    modelConstant: '${DEFAULT_LLM_CONST}',
          modelChecksum: '${manifest.model.sha256Checksum}',
    modelType: 'llm',
    modelConfig: ${llmModelConfig('    ')},
    onProgress: (p: any) => console.log('Model download:', p.percentage),
  })
  return {
    async chat(message: string) {
      const id = ++requestId
      return { tokenStream: () => ai.stream([{ role: 'user', content: message }], { requestId: id }) }
    },
    abort: () => ai.cancel(),
    cleanup: () => ai.close(),
    session: ai,
  }
}
`,
  }
}

function nodeSyncManager(opts: GeneratorOptions): GeneratedFile {
  return {
    path: 'src/node-sync.ts',
    content: `/**
 * Personal Node alpha sync.
 *
 * Registers this app's Hyperbee with a compatible Personal Node alpha for
 * replication. Registration is not proof of a verified copy or a complete
 * backup. The app keeps working normally when the deferred Node is unavailable.
 *
 * To add more resources later, add them to the manifest below — it describes
 * the complete set, so anything omitted stops replicating.
 */
import { createNode } from '@unstoppable-stack/node-core'

interface NodeSyncOpts {
  db: any // Hyperbee — we just need its \`core.key\` to register for replication
}

export function setupNodeSync({ db }: NodeSyncOpts) {
  let node: any = null
  let peer: any = null
  let closed = false

  async function connect() {
    try {
      node = createNode({
        storage: './.unstoppable-app-node',
        profile: { appId: '${opts.projectName}', appName: '${opts.projectName}' },
        capabilities: [],
        reconnect: true,
      })
      await node.ready()

      node.on('reconnecting', () => console.log('Node connection lost; retrying...'))
      node.on('reconnected', () => console.log('Reconnected to Unstoppable Node'))

      // Find the Personal Node on this machine. After the first pairing its
      // key is remembered and reconnects go direct.
      peer = await node.discover({ timeout: 5_000 })

      await peer.call('sync', 'manifest.replace', {
        manifest: {
          schemaVersion: 1,
          resources: [
            {
              id: 'main-db',
              kind: 'hyperbee',
              key: Buffer.from(db.core.key).toString('hex'),
              name: 'Main DB',
              protection: { mode: 'mirror' },
            },
          ],
        },
      })
      console.log('Registered with Personal Node — copy verification pending')
    } catch (err: any) {
      console.log(\`No Unstoppable Node found (\${err.message})\`)
      console.log('Personal Node alpha is deferred from the core preview; continuing locally')
    }
  }

  // Fire-and-forget — app doesn't block on this
  connect()

  return {
    async close() {
      closed = true
      if (node) await node.close()
    },
  }
}
`,
  }
}

function nodeHostManager(opts: GeneratorOptions): GeneratedFile {
  return {
    path: 'src/node-host.ts',
    content: `/**
 * Node host — makes this app a node other apps can pair with.
 *
 * A capability pack is a plain object. Unary methods are async functions;
 * streaming methods are async generators. That difference is the whole of the
 * distinction — cancellation, backpressure and multiplexing come from the bus.
 *
 * Run this app, print the pairing code, then from the other app:
 *
 *   const peer = await node.pair(code)
 *   const { items } = await peer.api.${opts.projectName.replace(/[^a-z0-9-]/gi, '-').toLowerCase()}.list({})
 */
import { createNode } from '@unstoppable-stack/node-core'

const CAPABILITY = '${opts.projectName.replace(/[^a-z0-9-]/gi, '-').toLowerCase()}'

interface NodeHostOpts {
  db: any // Hyperbee — whatever this app already stores
}

export async function startNodeHost({ db }: NodeHostOpts) {
  const node = createNode({
    storage: './.unstoppable-app-node',
    profile: { appId: '${opts.projectName}', appName: '${opts.projectName}' },
    capabilities: [
      {
        name: CAPABILITY,
        version: 1,
        methods: {
          // Unary: resolves once with a value.
          async list(params: any) {
            const items: any[] = []
            const limit = params?.limit ?? 50
            for await (const entry of db.createReadStream({ limit })) {
              items.push({ key: entry.key, value: entry.value })
            }
            return { items }
          },

          // Streaming: an async generator. ctx.signal aborts when the peer
          // disconnects, cancels, or stops iterating — check it in long loops.
          async *watch(params: any, ctx: any) {
            for await (const entry of db.createHistoryStream({ live: true })) {
              if (ctx.signal.aborted) return
              yield { key: entry.key, value: entry.value }
            }
          },
        },
        // Anything not listed here must be asked for explicitly at pair time.
        defaultGrants: ['list'],
      },
    ],
  })

  await node.ready()

  // Reachable by public key. Apps on this machine can also find the local
  // Personal Node; other devices need a pairing code.
  await node.listen()

  node.on('paired', ({ appName, publicKey }) => {
    console.log(\`Paired with \${appName || publicKey.slice(0, 12)}\`)
  })

  return {
    node,
    publicKey: node.publicKey,

    /** Mint a code to share with another device or app. */
    async invite(opts: { uses?: number; expiresIn?: number } = {}) {
      const invite = await node.createInvite({
        uses: opts.uses ?? 1,
        expiresIn: opts.expiresIn ?? 15 * 60_000,
      })
      console.log(\`Pairing code: \${invite.code}\`)
      return invite
    },

    async close() {
      await node.close()
    },
  }
}
`,
  }
}

function walletStub(): GeneratedFile {
  return {
    path: 'src/wallet.ts',
    content: `/**
 * Wallet integration — stub.
 *
 * The WDK SDK is not yet battle-tested as part of the Unstoppable Stack.
 * This file is a placeholder; see the \`add-wallet\` agent skill for
 * guided integration once WDK is ready.
 */
export async function setupWallet() {
  return {
    address: 'stub-address',
    async getBalance() {
      return 0
    },
  }
}
`,
  }
}

const UNTYPED_MODULES = [
  'hyperswarm',
  'corestore',
  'hyperbee',
  'hypercore-crypto',
  'b4a',
]

function typeDeclarations(opts: GeneratorOptions): GeneratedFile {
  const modules = [...UNTYPED_MODULES]
  if (has(opts, 'node-sync') || has(opts, 'node-host')) modules.push('@unstoppable-stack/node-core')
  if (has(opts, 'multi-writer')) {
    // The spec/ tree is generated JS with no .d.ts. Ambient declarations only
    // work for non-relative specifiers, so match the generated files with a
    // wildcard pattern rather than the literal relative paths.
    modules.push('autobee', 'hyperdb', '*/schema/spec/app/index.js', '*/schema/spec/local/index.js')
  }
  const decls = modules.map((m) => `declare module '${m}'`).join('\n')
  return { path: 'src/types.d.ts', content: decls + '\n' }
}
