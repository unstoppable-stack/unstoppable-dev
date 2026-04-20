import type { GeneratedFile, GeneratorOptions } from './types.js'
import { has, tsconfig, gitignore, readme, planningReadme } from './common.js'

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
 */
export function generateNodeCli(opts: GeneratorOptions): GeneratedFile[] {
  const files: GeneratedFile[] = [
    tsconfig(),
    gitignore(),
    readme(opts),
    planningReadme(),
    packageJson(opts),
    entryPoint(opts),
    swarmManager(),
    storageManager(),
  ]

  if (has(opts, 'local-ai')) files.push(aiManager())
  if (has(opts, 'wallet')) files.push(walletStub())

  files.push(typeDeclarations(opts))

  return files
}

function packageJson(opts: GeneratorOptions): GeneratedFile {
  const deps: Record<string, string> = {
    hyperswarm: '^4.16.0',
    corestore: '^7.6.0',
    hyperbee: '^2.22.0',
    b4a: '^1.7.3',
    'hypercore-crypto': '^3.4.0',
  }

  const devDeps: Record<string, string> = {
    '@types/node': '^20.0.0',
    typescript: '^5.0.0',
    tsx: '^4.0.0',
  }

  if (has(opts, 'local-ai')) {
    Object.assign(deps, { '@qvac/sdk': '^0.8.0' })
  }

  return {
    path: 'package.json',
    content: JSON.stringify(
      {
        name: opts.projectName,
        version: '0.1.0',
        private: true,
        type: 'module',
        scripts: {
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
  const imports: string[] = [
    `import Corestore from 'corestore'`,
    `import { createSwarm } from './swarm-manager.js'`,
    `import { createStorage } from './storage-manager.js'`,
  ]

  const initCalls: string[] = [
    `const store = new Corestore('./storage')`,
    `const swarm = createSwarm(store)`,
    `console.log('P2P swarm started')`,
    `const db = await createStorage(store)`,
    `console.log('Storage ready')`,
  ]

  const cleanupCalls: string[] = [`await swarm.destroy()`]

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

function aiManager(): GeneratedFile {
  return {
    path: 'src/ai-manager.ts',
    content: `/**
 * AI manager using QVAC SDK.
 *
 * Set QVAC_MOCK=1 in the environment to use a stub implementation that
 * echoes input back — useful for E2E tests where loading a real model
 * is impractical.
 */
import {
  loadModel,
  completion,
  unloadModel,
  LLAMA_3_2_1B_INST_Q4_0,
} from '@qvac/sdk'

const MOCK_MODE = process.env.QVAC_MOCK === '1'

let modelId: string | null = null

export async function setupAI() {
  if (MOCK_MODE) {
    console.log('AI mock mode enabled — skipping model load')
    modelId = 'mock-model'
    return {
      async chat(message: string) {
        return {
          async *tokenStream() {
            const reply = \`Mock: \${message}\`
            for (const ch of reply) {
              yield ch
              await new Promise((r) => setTimeout(r, 5))
            }
          },
        }
      },
      async cleanup() {
        modelId = null
      },
    }
  }

  console.log('Loading AI model...')
  modelId = await loadModel({
    modelSrc: LLAMA_3_2_1B_INST_Q4_0,
    modelType: 'llm',
    onProgress: (progress: any) => {
      if (progress.percentage) {
        process.stdout.write(
          \`\\rDownloading model: \${Math.round(progress.percentage)}%\`,
        )
      }
    },
  })
  console.log('\\nModel loaded:', modelId)

  return {
    async chat(message: string) {
      if (!modelId) throw new Error('Model not loaded')
      const result = completion({
        modelId,
        history: [{ role: 'user', content: message }],
        stream: true,
      })
      return result
    },

    async cleanup() {
      if (modelId && modelId !== 'mock-model') {
        await unloadModel({ modelId })
      }
      modelId = null
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

function typeDeclarations(_opts: GeneratorOptions): GeneratedFile {
  const decls = UNTYPED_MODULES.map((m) => `declare module '${m}'`).join('\n')
  return { path: 'src/types.d.ts', content: decls + '\n' }
}
