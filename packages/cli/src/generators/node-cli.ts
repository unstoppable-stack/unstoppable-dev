import type { GeneratedFile, GeneratorOptions } from './types.js'
import { has, tsconfig, gitignore, readme, planningReadme } from './common.js'

export function generateNodeCli(opts: GeneratorOptions): GeneratedFile[] {
  const files: GeneratedFile[] = [
    tsconfig(),
    gitignore(),
    readme(opts),
    planningReadme(),
    packageJson(opts),
    entryPoint(opts),
  ]

  if (has(opts, 'p2p')) files.push(swarmManager())
  if (has(opts, 'kv-storage')) files.push(storageManager())
  if (has(opts, 'qvac')) files.push(aiManager())
  if (has(opts, 'autobase')) files.push(autobaseManager())

  const untypedModules = collectUntypedModules(opts)
  if (untypedModules.length > 0) files.push(typeDeclarations(untypedModules))

  return files
}

function packageJson(opts: GeneratorOptions): GeneratedFile {
  const deps: Record<string, string> = {}
  const devDeps: Record<string, string> = {
    '@types/node': '^20.0.0',
    typescript: '^5.0.0',
    tsx: '^4.0.0',
  }

  if (has(opts, 'p2p')) {
    Object.assign(deps, {
      hyperswarm: '^4.16.0',
      corestore: '^7.6.0',
      b4a: '^1.7.3',
      'hypercore-crypto': '^3.4.0',
    })
  }

  if (has(opts, 'kv-storage')) {
    Object.assign(deps, {
      hyperbee: '^2.22.0',
      corestore: '^7.6.0',
    })
  }

  if (has(opts, 'qvac')) {
    Object.assign(deps, { '@qvac/sdk': '^0.8.0' })
  }

  if (has(opts, 'autobase')) {
    Object.assign(deps, {
      autobase: '^7.27.0',
      corestore: '^7.6.0',
      hyperswarm: '^4.16.0',
      hyperbee: '^2.22.0',
    })
  }

  return {
    path: 'package.json',
    content: JSON.stringify({
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
    }, null, 2),
  }
}

function entryPoint(opts: GeneratorOptions): GeneratedFile {
  const imports: string[] = []
  const initCalls: string[] = []
  const cleanupCalls: string[] = []

  if (has(opts, 'p2p') || has(opts, 'kv-storage') || has(opts, 'autobase')) {
    imports.push(`import Corestore from 'corestore'`)
    initCalls.push(`const store = new Corestore('./storage')`)
  }

  if (has(opts, 'p2p')) {
    imports.push(`import Hyperswarm from 'hyperswarm'`)
    imports.push(`import { createSwarm } from './swarm-manager.js'`)
    initCalls.push(`const swarm = createSwarm(store)`)
    initCalls.push(`console.log('P2P swarm started')`)
    cleanupCalls.push(`await swarm.destroy()`)
  }

  if (has(opts, 'kv-storage')) {
    imports.push(`import { createStorage } from './storage-manager.js'`)
    initCalls.push(`const db = await createStorage(store)`)
    initCalls.push(`console.log('Storage ready')`)
  }

  if (has(opts, 'qvac')) {
    imports.push(`import { setupAI } from './ai-manager.js'`)
    initCalls.push(`const ai = await setupAI()`)
    initCalls.push(`console.log('AI ready')`)
    cleanupCalls.push(`await ai.cleanup()`)
  }

  if (has(opts, 'autobase')) {
    imports.push(`import { createAutobase } from './autobase-manager.js'`)
    initCalls.push(`const base = await createAutobase(store)`)
    initCalls.push(`console.log('Autobase key:', base.key.toString('hex'))`)
    cleanupCalls.push(`await base.close()`)
  }

  return {
    path: 'src/index.ts',
    content: `${imports.join('\n')}

async function main() {
  console.log('Starting ${opts.projectName}...')

${initCalls.map(c => '  ' + c).join('\n')}

  console.log('${opts.projectName} is running. Press Ctrl+C to exit.')

  process.on('SIGINT', async () => {
    console.log('\\nShutting down...')
${cleanupCalls.map(c => '    ' + c).join('\n')}
    process.exit(0)
  })
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
`
  }
}

function swarmManager(): GeneratedFile {
  return {
    path: 'src/swarm-manager.ts',
    content: `import Hyperswarm from 'hyperswarm'
import Corestore from 'corestore'
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
`
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
`
  }
}

function aiManager(): GeneratedFile {
  return {
    path: 'src/ai-manager.ts',
    content: `import {
  loadModel,
  completion,
  unloadModel,
  LLAMA_3_2_1B_INST_Q4_0,
} from '@qvac/sdk'

let modelId: string | null = null

export async function setupAI() {
  console.log('Loading AI model...')
  modelId = await loadModel({
    modelSrc: LLAMA_3_2_1B_INST_Q4_0,
    modelType: 'llm',
    onProgress: (progress: any) => {
      if (progress.percentage) {
        process.stdout.write(\`\\rDownloading model: \${Math.round(progress.percentage)}%\`)
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
      if (modelId) {
        await unloadModel({ modelId })
        modelId = null
      }
    },
  }
}
`
  }
}

const UNTYPED_MODULES: Record<string, string[]> = {
  p2p: ['hyperswarm', 'corestore', 'hypercore-crypto'],
  'kv-storage': ['hyperbee', 'corestore'],
  autobase: ['autobase', 'corestore', 'hyperbee', 'hyperswarm'],
}

function collectUntypedModules(opts: GeneratorOptions): string[] {
  const modules = new Set<string>()
  for (const feature of opts.features) {
    for (const mod of UNTYPED_MODULES[feature] ?? []) {
      modules.add(mod)
    }
  }
  return [...modules]
}

function typeDeclarations(modules: string[]): GeneratedFile {
  const decls = modules.map((m) => `declare module '${m}'`).join('\n')
  return { path: 'src/types.d.ts', content: decls + '\n' }
}

function autobaseManager(): GeneratedFile {
  return {
    path: 'src/autobase-manager.ts',
    content: `import Autobase from 'autobase'
import Hyperbee from 'hyperbee'

export async function createAutobase(store: any, bootstrapKey?: Buffer) {
  const base = new Autobase(store, bootstrapKey || null, {
    open(store: any) {
      return new Hyperbee(store.get('view'), {
        keyEncoding: 'utf-8',
        valueEncoding: 'json',
        extension: false,
      })
    },

    async apply(nodes: any[], view: any, host: any) {
      for (const node of nodes) {
        if (node.value === null) continue
        const op = JSON.parse(node.value.toString())

        switch (op.type) {
          case 'add-writer':
            await host.addWriter(Buffer.from(op.key, 'hex'), { indexer: !!op.indexer })
            break
          case 'put':
            await view.put(op.key, op.value)
            break
          case 'del':
            await view.del(op.key)
            break
        }
      }
    },

    ackInterval: 5000,
    ackThreshold: 0,
  })

  await base.ready()
  return base
}
`
  }
}
