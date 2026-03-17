import type { GeneratedFile, GeneratorOptions } from './types.js'
import { has, gitignore, readme, planningReadme } from './common.js'

export function generatePearDesktop(opts: GeneratorOptions): GeneratedFile[] {
  const files: GeneratedFile[] = [
    gitignore(),
    readme(opts),
    planningReadme(),
    packageJson(opts),
    indexHtml(opts),
    indexJs(opts),
    workerJs(opts),
    appComponent(opts),
  ]

  return files
}

function packageJson(opts: GeneratorOptions): GeneratedFile {
  const deps: Record<string, string> = {
    'bare-rpc': '^1.1.0',
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
    Object.assign(deps, { '@qvac/sdk': '^0.7.0' })
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
      pear: {
        name: opts.projectName,
        type: 'desktop',
        gui: { backgroundColor: '#1a1a2e', height: 720, width: 1100 },
      },
      scripts: {
        dev: 'pear run --dev .',
        stage: 'pear stage .',
        release: 'pear release .',
      },
      dependencies: deps,
      devDependencies: {},
    }, null, 2),
  }
}

function indexHtml(opts: GeneratorOptions): GeneratedFile {
  return {
    path: 'index.html',
    content: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${opts.projectName}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #1a1a2e;
      color: #e6e6e6;
      height: 100vh;
      overflow: hidden;
    }
    #app { height: 100vh; display: flex; flex-direction: column; }
  </style>
</head>
<body>
  <div id="app"></div>
  <script type="module" src="./app/index.js"></script>
</body>
</html>
`
  }
}

function indexJs(opts: GeneratorOptions): GeneratedFile {
  return {
    path: 'index.js',
    content: `/* global Pear */

const pipe = Pear.worker.run('./worker.js')

pipe.on('data', (data) => {
  try {
    const msg = JSON.parse(data.toString())
    window.dispatchEvent(new CustomEvent('worker-message', { detail: msg }))
  } catch {}
})

window.sendToWorker = (msg) => {
  pipe.write(JSON.stringify(msg) + '\\n')
}

Pear.teardown(async () => {
  window.sendToWorker({ type: 'shutdown' })
})
`
  }
}

function workerJs(opts: GeneratorOptions): GeneratedFile {
  const imports: string[] = []
  const initCode: string[] = []
  const commandHandlers: string[] = []
  const cleanupCode: string[] = []

  if (has(opts, 'p2p') || has(opts, 'kv-storage') || has(opts, 'autobase')) {
    imports.push(`const Corestore = require('corestore')`)
    initCode.push(`const store = new Corestore(storagePath)`)
  }

  if (has(opts, 'p2p')) {
    imports.push(`const Hyperswarm = require('hyperswarm')`)
    imports.push(`const crypto = require('hypercore-crypto')`)
    initCode.push(`
  const swarm = new Hyperswarm()
  swarm.on('connection', (conn) => {
    store.replicate(conn)
    conn.on('error', () => {})
  })
  send({ type: 'status', service: 'p2p', status: 'ready' })`)
    cleanupCode.push(`  if (swarm) await swarm.destroy()`)

    commandHandlers.push(`
    case 'join-topic': {
      const topic = crypto.discoveryKey(Buffer.from(msg.topic))
      swarm.join(topic, { server: true, client: true })
      send({ type: 'joined', topic: msg.topic })
      break
    }`)
  }

  if (has(opts, 'kv-storage')) {
    imports.push(`const Hyperbee = require('hyperbee')`)
    initCode.push(`
  const core = store.get({ name: 'main-db' })
  const db = new Hyperbee(core, { keyEncoding: 'utf-8', valueEncoding: 'json' })
  await db.ready()
  send({ type: 'status', service: 'storage', status: 'ready' })`)

    commandHandlers.push(`
    case 'db-put': {
      await db.put(msg.key, msg.value)
      send({ type: 'db-put-ok', key: msg.key })
      break
    }
    case 'db-get': {
      const entry = await db.get(msg.key)
      send({ type: 'db-get-ok', key: msg.key, value: entry?.value ?? null })
      break
    }`)
  }

  if (has(opts, 'qvac')) {
    imports.push(`const { loadModel, completion, unloadModel, LLAMA_3_2_1B_INST_Q4_0 } = require('@qvac/sdk')`)
    initCode.push(`
  let modelId = null
  try {
    modelId = await loadModel({
      modelSrc: LLAMA_3_2_1B_INST_Q4_0,
      modelType: 'llm',
      onProgress: (p) => send({ type: 'model-progress', ...p }),
    })
    send({ type: 'status', service: 'ai', status: 'ready', modelId })
  } catch (err) {
    send({ type: 'status', service: 'ai', status: 'error', error: err.message })
  }`)
    cleanupCode.push(`  if (modelId) await unloadModel({ modelId })`)

    commandHandlers.push(`
    case 'chat': {
      if (!modelId) { send({ type: 'chat-error', error: 'Model not loaded' }); break }
      const result = completion({ modelId, history: msg.history, stream: true })
      for await (const token of result.tokenStream) {
        send({ type: 'chat-token', token })
      }
      send({ type: 'chat-done' })
      break
    }`)
  }

  return {
    path: 'worker.js',
    content: `/* global Pear */
${imports.join('\n')}

const pipe = Pear.worker.pipe()
const storagePath = Pear.config.storage

function send(msg) {
  pipe.write(JSON.stringify(msg) + '\\n')
}

let buffer = ''
pipe.on('data', (data) => {
  buffer += data.toString()
  const lines = buffer.split('\\n')
  buffer = lines.pop() || ''
  for (const line of lines) {
    if (!line.trim()) continue
    handleCommand(JSON.parse(line))
  }
})

async function handleCommand(msg) {
  switch (msg.type) {${commandHandlers.join('')}
    case 'shutdown':
      await cleanup()
      break
    default:
      send({ type: 'error', error: \`Unknown command: \${msg.type}\` })
  }
}

async function cleanup() {
${cleanupCode.join('\n')}
  Pear.exit()
}

async function main() {
  send({ type: 'worker-ready' })
${initCode.join('\n')}
  send({ type: 'init-complete' })
}

main().catch((err) => send({ type: 'fatal', error: err.message }))
`
  }
}

function appComponent(opts: GeneratorOptions): GeneratedFile {
  return {
    path: 'app/index.js',
    content: `const app = document.getElementById('app')

let status = { worker: false }

function render() {
  app.innerHTML = \`
    <div style="padding: 2rem;">
      <h1 style="color: #58a6ff; margin-bottom: 1rem;">${opts.projectName}</h1>
      <p style="color: #8b949e; margin-bottom: 2rem;">Unstoppable Stack — Pear Desktop</p>
      <div id="status" style="font-family: monospace; font-size: 0.9rem;">
        <p>Worker: \${status.worker ? '✅ Ready' : '⏳ Starting...'}</p>
      </div>
      <div id="content" style="margin-top: 2rem;"></div>
    </div>
  \`
}

window.addEventListener('worker-message', (e) => {
  const msg = e.detail
  if (msg.type === 'worker-ready') status.worker = true
  if (msg.type === 'init-complete') status.worker = true
  if (msg.type === 'status') {
    const el = document.getElementById('status')
    if (el) el.innerHTML += \`<p>\${msg.service}: \${msg.status === 'ready' ? '✅' : '❌'} \${msg.status}</p>\`
  }
  render()
})

render()
`
  }
}
