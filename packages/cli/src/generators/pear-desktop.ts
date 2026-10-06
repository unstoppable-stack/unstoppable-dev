import { chatContextSource } from './chat-context.js'
import type { GeneratedFile, GeneratorOptions } from './types.js'
import {
  has, gitignore, readme, planningReadme,
  DEFAULT_LLM_CONST, DEFAULT_LLM_LABEL, DEFAULT_LLM_SIZE_MB, DEFAULT_CTX_SIZE,
  llmModelConfig, MULTI_WRITER_DEPS, schemaBuilder, multiWriterStoreSource,
} from './common.js'

export function generatePearDesktop(opts: GeneratorOptions): GeneratedFile[] {
  const files: GeneratedFile[] = [
    gitignore(),
    readme(opts),
    planningReadme(),
    packageJson(opts),
    indexHtml(opts),
    electronMainJs(opts),
    electronPreloadCjs(),
    workerJs(opts),
    appBridgeJs(),
    appComponent(opts),
  ]

  if (has(opts, 'local-ai')) files.push({ path: 'chat-context.js', content: chatContextSource })

  if (has(opts, 'multi-writer')) {
    files.push(schemaBuilder(), {
      // Sits next to worker.js at the project root — the Pear worker is plain
      // ESM, so this is .js not .ts.
      path: 'multi-writer-store.js',
      content: multiWriterStoreSource('./schema/spec', false),
    })
  }

  return files
}

function packageJson(opts: GeneratorOptions): GeneratedFile {
  const deps: Record<string, string> = {
    'pear-runtime': '^1.3.1',
    'bare-rpc': '^1.3.8',
    hyperswarm: '^4.17.2',
    hyperdht: '^6.34.1',
    hypercore: '^11.37.2',
    corestore: '^7.13.0',
    hyperbee: '^2.27.3',
    b4a: '^1.8.0',
    'hypercore-crypto': '^3.7.0',
  }

  if (has(opts, 'local-ai')) {
    Object.assign(deps, { '@qvac/inference': '0.21.0', '@qvac/llm-llamacpp': '0.55.0', 'bare-process': '^4.5.1' })
  }

  if (has(opts, 'node-sync')) {
    Object.assign(deps, { '@unstoppable-stack/node-core': '^0.6.0-alpha.1' })
  }

  if (has(opts, 'multi-writer')) {
    Object.assign(deps, MULTI_WRITER_DEPS)
    delete deps.hyperbee
  }

  return {
    path: 'package.json',
    content: JSON.stringify({
      name: opts.projectName,
      version: '0.1.0',
      private: true,
      type: 'module',
      main: 'electron/main.js',
      engines: { node: '>=22.17.0' },
      // Valid development-only link so pear-runtime can initialize before
      // the developer creates their own release line with `pear touch`.
      upgrade: 'pear://qxenz5wmspmryjc13m9yzsqj1conqotn8fb4ocbufwtz9mtbqq5o',
      scripts: {
        ...(has(opts, 'multi-writer')
          ? {
              'build:schema': 'node schema/build.js',
              // schema/spec is imported at worker start, so generate it on
              // install rather than letting the Bare worker fail on a missing spec.
              postinstall: 'npm run build:schema',
            }
          : {}),
        dev: 'electron .',
        start: 'electron .',
      },
      dependencies: deps,
      devDependencies: { electron: '^44.5.1' },
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

function electronMainJs(opts: GeneratorOptions): GeneratedFile {
  return {
    path: 'electron/main.js',
    content: `import { app, BrowserWindow, ipcMain, shell } from 'electron'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import PearRuntime from 'pear-runtime'

const require = createRequire(import.meta.url)
const pkg = require('../package.json')

let mainWindow = null
let pear = null
let worker = null
let closing = false

function storageOverride() {
  const index = process.argv.indexOf('--storage')
  return index >= 0 ? process.argv[index + 1] : null
}

function getPear() {
  if (pear) return pear
  const customStorage = storageOverride()
  pear = new PearRuntime({
    name: pkg.name,
    version: pkg.version,
    upgrade: pkg.upgrade,
    dir: customStorage || join(app.getPath('userData'), 'pear'),
    app: app.isPackaged ? process.execPath : null,
    updates: app.isPackaged || process.argv.includes('--updates'),
  })
  pear.on('error', (err) => console.error('[pear-runtime]', err))
  return pear
}

async function startWorker() {
  if (worker) return true
  const runtime = getPear()
  await runtime.ready()
  worker = runtime.run(join(import.meta.dirname, '..', 'worker.js'), [runtime.storage])
  worker.on('data', (data) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('worker:message', data.toString())
    }
  })
  worker.stderr?.on('data', (data) => console.error('[worker]', data.toString().trimEnd()))
  worker.once('exit', (code) => {
    worker = null
    if (!closing && mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('worker:exit', code)
    }
  })
  return true
}

async function shutdown() {
  if (closing) return
  closing = true
  try { worker?.write(JSON.stringify({ type: 'shutdown' }) + '\\n') } catch {}
  const currentWorker = worker
  if (currentWorker) {
    await Promise.race([
      new Promise((resolve) => currentWorker.once('exit', resolve)),
      new Promise((resolve) => setTimeout(resolve, 1500)),
    ])
    try { currentWorker.kill() } catch {}
  }
  await pear?.close().catch(() => {})
}

function assertTrusted(event) {
  if (!mainWindow || mainWindow.isDestroyed() || event.sender !== mainWindow.webContents) {
    throw new Error('Untrusted renderer')
  }
}

ipcMain.handle('worker:start', (event) => {
  assertTrusted(event)
  return startWorker()
})
ipcMain.handle('worker:send', (event, message) => {
  assertTrusted(event)
  if (!worker) throw new Error('Worker is not running')
  if (!message || typeof message !== 'object' || Array.isArray(message)) {
    throw new Error('Worker message must be an object')
  }
  worker.write(JSON.stringify(message) + '\\n')
})

async function createWindow() {
  mainWindow = new BrowserWindow({
    title: '${opts.projectName}',
    backgroundColor: '#1a1a2e',
    width: 1100,
    height: 720,
    webPreferences: {
      preload: join(import.meta.dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) shell.openExternal(url)
    return { action: 'deny' }
  })
  await mainWindow.loadFile(join(import.meta.dirname, '..', 'index.html'))
  if (!app.isPackaged) mainWindow.webContents.openDevTools({ mode: 'detach' })
}

app.whenReady().then(createWindow)
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})
app.on('before-quit', (event) => {
  if (closing) return
  event.preventDefault()
  shutdown().finally(() => app.quit())
})
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
`
  }
}

function electronPreloadCjs(): GeneratedFile {
  return {
    path: 'electron/preload.cjs',
    content: `const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('unstoppable', {
  startWorker: () => ipcRenderer.invoke('worker:start'),
  sendToWorker: (message) => ipcRenderer.invoke('worker:send', message),
  onWorkerMessage: (listener) => {
    const wrapped = (_event, chunk) => listener(chunk)
    ipcRenderer.on('worker:message', wrapped)
    return () => ipcRenderer.removeListener('worker:message', wrapped)
  },
  onWorkerExit: (listener) => {
    const wrapped = (_event, code) => listener(code)
    ipcRenderer.on('worker:exit', wrapped)
    return () => ipcRenderer.removeListener('worker:exit', wrapped)
  },
})
`
  }
}

function workerJs(opts: GeneratorOptions): GeneratedFile {
  const multiWriter = has(opts, 'multi-writer')

  // Base (always-on) imports: P2P + KV storage
  const imports: string[] = [
    `import Corestore from 'corestore'`,
    `import Hyperswarm from 'hyperswarm'`,
    multiWriter
      ? `import { createStore } from './multi-writer-store.js'`
      : `import Hyperbee from 'hyperbee'`,
    `import crypto from 'hypercore-crypto'`,
  ]

  // Module-scope state — declared outside init() so handleCommand and cleanup
  // can reach them after init() completes.
  const moduleState: string[] = [
    `let store = null`,
    `let swarm = null`,
    `let db = null`,
  ]

  // Autobee brings its own replication (store replication plus a wakeup
  // session), so the swarm hands connections to it rather than to Corestore.
  const replicateLine = multiWriter
    ? `    if (db) db.autobee.replicate(conn)\n    else store.replicate(conn)`
    : `    store.replicate(conn)`

  const storageInit = multiWriter
    ? `
  // BOOTSTRAP_KEY joins an existing mesh; unset creates a new one.
  const bootstrapHex = (typeof globalThis.Bare !== 'undefined' && globalThis.Bare.env && globalThis.Bare.env.BOOTSTRAP_KEY) ||
    (typeof globalThis.process !== 'undefined' && globalThis.process.env && globalThis.process.env.BOOTSTRAP_KEY) || null
  db = await createStore(store, storagePath, bootstrapHex ? Buffer.from(bootstrapHex, 'hex') : null)
  send({
    type: 'status', service: 'storage', status: 'ready',
    dbKey: db.key, writerKey: db.writerKey, writable: db.writable,
  })`
    : `
  const core = store.get({ name: 'main-db' })
  db = new Hyperbee(core, { keyEncoding: 'utf-8', valueEncoding: 'json' })
  await db.ready()
  send({ type: 'status', service: 'storage', status: 'ready' })`

  const initCode: string[] = [
    `  store = new Corestore(storagePath)`,
    `
  swarm = new Hyperswarm()
  swarm.on('connection', (conn) => {
${replicateLine}
    conn.on('error', () => {})
  })
  send({ type: 'status', service: 'p2p', status: 'ready' })`,
    storageInit,
  ]

  const cleanupCode: string[] = [`  if (swarm) await swarm.destroy()`]
  cleanupCode.push(`  if (db) await db.close()`)
  if (!multiWriter) cleanupCode.push(`  if (store) await store.close()`)

  if (has(opts, 'node-sync')) {
    imports.push(`import { createNode } from '@unstoppable-stack/node-core'`)
    moduleState.push(`let appNode = null`)
    moduleState.push(`let nodePeer = null`)
    initCode.push(`
  send({ type: 'status', service: 'node-sync', status: 'searching' })
  try {
    appNode = createNode({
      storage: './.unstoppable-app-node',
      profile: { appId: '${opts.projectName}', appName: '${opts.projectName}' },
      capabilities: [],
      reconnect: true
    })
    await appNode.ready()

    appNode.on('peerDisconnected', () => {
      send({ type: 'status', service: 'node-sync', status: 'disconnected' })
    })
    appNode.on('reconnecting', () => {
      send({ type: 'status', service: 'node-sync', status: 'reconnecting' })
    })
    appNode.on('reconnected', () => {
      send({ type: 'status', service: 'node-sync', status: 'registered' })
    })
    appNode.on('reconnectFailed', () => {
      send({ type: 'status', service: 'node-sync', status: 'unavailable' })
    })

    // Find the Personal Node on this machine; its key is remembered after
    // the first pairing so reconnects go direct.
    nodePeer = await appNode.discover({ timeout: 5_000 })

    // The manifest is the complete set: anything omitted stops replicating.
    await nodePeer.call('sync', 'manifest.replace', {
      manifest: {
        schemaVersion: 1,
        resources: [{
          id: 'main-db',
          kind: 'hyperbee',
          key: Buffer.from(db.core.key).toString('hex'),
          name: 'Main DB',
          protection: { mode: 'mirror' }
        }]
      }
    })
    send({ type: 'status', service: 'node-sync', status: 'registered' })
  } catch (err) {
    send({ type: 'status', service: 'node-sync', status: 'unavailable', error: err.message })
  }
`)
    cleanupCode.push(`  if (appNode) await appNode.close()`)
  }

  const commandHandlers: string[] = [
    `
    case 'join-topic': {
      const topic = crypto.discoveryKey(Buffer.from(msg.topic))
      swarm.join(topic, { server: true, client: true })
      send({ type: 'joined', topic: msg.topic })
      break
    }`,
    multiWriter
      ? `
    case 'db-put': {
      await db.put(msg.key, msg.value)
      send({ type: 'db-put-ok', key: msg.key })
      break
    }
    case 'db-get': {
      const value = await db.get(msg.key)
      send({ type: 'db-get-ok', key: msg.key, value })
      break
    }
    case 'mesh-info': {
      send({ type: 'mesh-info-ok', dbKey: db.key, writerKey: db.writerKey, writable: db.writable })
      break
    }
    case 'add-writer': {
      // Pass the OTHER device's writerKey here, not its database key.
      await db.addWriter(msg.writerKey)
      send({ type: 'add-writer-ok', writerKey: msg.writerKey })
      break
    }`
      : `
    case 'db-put': {
      await db.put(msg.key, msg.value)
      send({ type: 'db-put-ok', key: msg.key })
      break
    }
    case 'db-get': {
      const entry = await db.get(msg.key)
      send({ type: 'db-get-ok', key: msg.key, value: entry?.value ?? null })
      break
    }`,
  ]

  if (has(opts, 'local-ai')) {
    // The SDK is NOT imported at module scope. A static import runs the
    // SDK's native-module resolution as a side effect of loading worker.js,
    // so any SDK problem kills the worker at import time — before it can
    // write anything on its pipe, which surfaces to the UI as a silent hang
    // with P2P and KV storage never coming up either. Loading it lazily in
    // the 'load-ai' handler keeps that failure scoped to the AI feature and
    // reportable over the pipe.
    imports.push(`import { streamChat } from './chat-context.js'`)
    moduleState.push(`let sdk = null`)
    moduleState.push(`let modelId = null`)
    moduleState.push(`let qvacPluginRegistered = false`)
    moduleState.push(`let activeChatRequestId = null`)
    moduleState.push(`const CTX_SIZE = ${DEFAULT_CTX_SIZE}`)
    moduleState.push(`let modelLoading = false`)
    // QVAC_MOCK is read at module load (not inside init) so handleCommand
    // can use it too. The worker runs in two different runtimes:
    //   * Node — when driven by scripts/tests via `node worker.js`
    //   * Bare — when hosted by pear-runtime
    // `process.env` only exists in Node; Bare exposes env through
    // `Bare.env`. Referencing an undefined `process` in Bare throws a
    // ReferenceError at import time, hard-failing the worker before it
    // can write anything on its pipe — so probe both safely.
    moduleState.push(
      `const MOCK_AI = (\n  (typeof globalThis.Bare !== 'undefined' && globalThis.Bare.env && globalThis.Bare.env.QVAC_MOCK === '1') ||\n  (typeof globalThis.process !== 'undefined' && globalThis.process.env && globalThis.process.env.QVAC_MOCK === '1')\n)`,
    )
    // Emit an initial "idle" status so the UI can render the Load button
    // instead of assuming the model is silently (de)loading on boot.
    initCode.push(`
  send({ type: 'status', service: 'ai', status: 'idle', mock: MOCK_AI })
  `)
    cleanupCode.push(`  if (activeChatRequestId !== null && modelId && modelId !== 'mock-model' && sdk) {
    activeChatRequestId = null
    await sdk.cancel({ operation: 'inference', modelId }).catch(() => {})
  }`)
    cleanupCode.push(`  if (modelId && modelId !== 'mock-model' && sdk) await sdk.unloadModel({ modelId })`)

    commandHandlers.push(`
    case 'load-ai': {
      if (modelId) { send({ type: 'status', service: 'ai', status: 'ready', modelId }); break }
      if (modelLoading) { send({ type: 'status', service: 'ai', status: 'loading' }); break }
      modelLoading = true
      if (MOCK_AI) {
        await new Promise((r) => setTimeout(r, 200))
        modelId = 'mock-model'
        modelLoading = false
        send({ type: 'status', service: 'ai', status: 'ready', modelId, mock: true })
        break
      }
      try {
        send({ type: 'status', service: 'ai', status: 'loading' })
        const { default: process } = await import('bare-process')
        globalThis.process = process
        const [loadedSdk, { llmPlugin }, { registerPlugin }] = await Promise.all([
          import('@qvac/inference'),
          import('@qvac/inference/llamacpp-completion/plugin'),
          import('@qvac/inference/plugins'),
        ])
        if (!qvacPluginRegistered) {
          registerPlugin(llmPlugin)
          qvacPluginRegistered = true
        }
        sdk = loadedSdk
        modelId = await sdk.loadModel({
          modelSrc: msg.modelSrc || sdk.${DEFAULT_LLM_CONST},
          modelType: 'llm',
          modelConfig: ${llmModelConfig('          ')},
          onProgress: (p) => send({ type: 'model-progress', ...p }),
        })
        send({ type: 'status', service: 'ai', status: 'ready', modelId })
      } catch (err) {
        send({ type: 'status', service: 'ai', status: 'error', error: String(err && err.message || err) })
      } finally {
        modelLoading = false
      }
      break
    }
    case 'chat': {
      const requestId = msg.requestId
      if (!modelId) { send({ type: 'chat-error', requestId, error: 'Model not loaded. Click Load Assistant first.' }); break }
      if (activeChatRequestId !== null) { send({ type: 'chat-error', requestId, error: 'Another response is already running.' }); break }
      activeChatRequestId = requestId
      if (MOCK_AI) {
        const last = msg.history[msg.history.length - 1]
        const reply = \`Mock: \${last?.content ?? '(empty)'}\`
        for (const ch of reply) {
          if (activeChatRequestId !== requestId) break
          send({ type: 'chat-token', requestId, token: ch })
          await new Promise((r) => setTimeout(r, 5))
        }
        if (activeChatRequestId === requestId) {
          activeChatRequestId = null
          send({ type: 'chat-done', requestId })
        }
        break
      }
      try {
        // Reasoning is disabled at load time via \`reasoning_budget: 0\`, so
        // tokens arrive as plain content — no reasoning-block filtering needed.
        const tokens = streamChat(sdk, modelId, msg.history, Math.floor(CTX_SIZE / 2), () =>
          send({ type: 'chat-context', requestId }))
        for await (const token of tokens) {
          if (activeChatRequestId !== requestId) break
          send({ type: 'chat-token', requestId, token })
        }
        if (activeChatRequestId === requestId) {
          activeChatRequestId = null
          send({ type: 'chat-done', requestId })
        }
      } catch (err) {
        if (activeChatRequestId === requestId) {
          activeChatRequestId = null
          send({ type: 'chat-error', requestId, error: String(err && err.message || err) })
        }
      }
      break
    }
    case 'cancel-chat': {
      const requestId = msg.requestId
      if (activeChatRequestId !== requestId) {
        send({ type: 'chat-cancelled', requestId })
        break
      }
      activeChatRequestId = null
      try {
        if (!MOCK_AI) await sdk.cancel({ operation: 'inference', modelId })
        send({ type: 'chat-cancelled', requestId })
      } catch (err) {
        send({ type: 'chat-error', requestId, error: \`Cancellation failed: \${String(err && err.message || err)}\` })
      }
      break
    }`)
  }

  if (has(opts, 'wallet')) {
    initCode.push(`
  // Wallet stub — WDK integration deferred. See 'add-wallet' skill.
  send({ type: 'status', service: 'wallet', status: 'ready', stub: true })`)

    commandHandlers.push(`
    case 'wallet-balance': {
      send({ type: 'wallet-balance-ok', balance: 0, stub: true })
      break
    }`)
  }

  return {
    path: 'worker.js',
    content: `/* global Bare */
${imports.join('\n')}

const pipe = Bare.IPC
const storagePath = Bare.argv[2]

// Module-scope state (populated during init, used by handleCommand + cleanup)
${moduleState.join('\n')}

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
  Bare.exit()
}

send({ type: 'workerReady' })
${initCode.length > 0 ? `
async function init() {
${initCode.join('\n')}
  send({ type: 'init-complete' })
}

init().catch((err) => send({ type: 'fatal', error: err.message }))` : `send({ type: 'init-complete' })`}
`
  }
}

function appBridgeJs(): GeneratedFile {
  return {
    path: 'app/bridge.js',
    content: `
const handlers = new Set()
let messageBuffer = ''

window.unstoppable.onWorkerMessage((data) => {
  messageBuffer += data
  const lines = messageBuffer.split('\\n')
  messageBuffer = lines.pop() || ''
  for (const line of lines) {
    if (!line.trim()) continue
    try {
      const msg = JSON.parse(line)
      for (const handler of handlers) handler(msg)
    } catch {}
  }
})

export function sendToWorker(msg) {
  return window.unstoppable.sendToWorker(msg)
}

export function onWorkerMessage(handler) {
  handlers.add(handler)
  return () => handlers.delete(handler)
}

export function destroyWorker() {
  try {
    sendToWorker({ type: 'shutdown' })
  } catch {}
  handlers.clear()
}

export const workerReady = new Promise((resolve, reject) => {
  const timeout = setTimeout(() => reject(new Error('Worker init timeout (30s)')), 30000)
  const unsub = onWorkerMessage((msg) => {
    if (msg.type === 'workerReady') {
      clearTimeout(timeout)
      unsub()
      resolve(msg)
    }
  })
  window.unstoppable.startWorker().catch((err) => {
    clearTimeout(timeout)
    unsub()
    reject(err)
  })
})
`
  }
}

function appComponent(opts: GeneratorOptions): GeneratedFile {
  const hasQvac = has(opts, 'local-ai')
  const hasWallet = has(opts, 'wallet')
  const hasNodeSync = has(opts, 'node-sync')

  // Build the sections HTML that gets injected at startup
  const sectionHtml: string[] = []

  // P2P section — always shown (base infrastructure)
  sectionHtml.push(`
      <section data-testid="p2p-section" class="card">
        <h2 class="card-title">P2P Network</h2>
        <p class="mono" id="p2p-status">⏳ Starting...</p>
      </section>`)

  // KV Storage section — always shown (base infrastructure)
  if (has(opts, 'multi-writer')) {
    sectionHtml.push(`
      <section data-testid="mesh-section" class="card">
        <h2 class="card-title">Multi-Writer Mesh</h2>
        <p class="card-hint">Every device reads and writes; writes converge on reconnect.</p>
        <p class="mono" id="mesh-status">⏳ Starting...</p>
        <p class="mono" style="color:#8b949e;margin-top:8px">Database key (share to let a device join):</p>
        <p class="mono" id="mesh-db-key" data-testid="mesh-db-key" style="word-break:break-all">—</p>
        <p class="mono" style="color:#8b949e;margin-top:8px">This device's writer key (give to a peer to be promoted):</p>
        <p class="mono" id="mesh-writer-key" data-testid="mesh-writer-key" style="word-break:break-all">—</p>
        <input id="mesh-add-writer" class="inp" placeholder="Peer's writer key" data-testid="mesh-add-writer-input" />
        <button id="mesh-add-btn" class="btn" data-testid="mesh-add-writer-btn">Add Writer</button>
      </section>`)
  }

  sectionHtml.push(`
      <section data-testid="kv-section" class="card">
        <h2 class="card-title">${has(opts, 'multi-writer') ? 'Shared Data' : 'KV Storage'}</h2>
        <input id="kv-key" class="inp" placeholder="Key" data-testid="kv-key-input" />
        <input id="kv-value" class="inp" placeholder="Value" data-testid="kv-value-input" />
        <div class="row gap-8">
          <button id="kv-save" class="btn" data-testid="kv-save-btn">Save</button>
          <button id="kv-fetch" class="btn btn-outline" data-testid="kv-fetch-btn">Fetch</button>
        </div>
        <p id="kv-result" class="result" style="display:none" data-testid="kv-result"></p>
      </section>`)

  if (hasWallet) {
    sectionHtml.push(`
      <section data-testid="wallet-section" class="card">
        <h2 class="card-title">Wallet</h2>
        <p class="mono" id="wallet-status">⏳ Starting...</p>
        <p class="mono" style="color:#8b949e;margin-top:8px">WDK integration coming soon</p>
      </section>`)
  }

  if (hasNodeSync) {
    sectionHtml.push(`
      <section data-testid="node-sync-section" class="card">
        <h2 class="card-title">Node Replication</h2>
        <p class="mono" id="node-sync-status">⏳ Looking for your Personal Node…</p>
        <p class="mono" style="color:#8b949e;margin-top:8px" id="node-sync-hint">The Personal Node alpha is deferred from the core preview and is not required for local use.</p>
      </section>`)
  }

  if (hasQvac) {
    sectionHtml.push(`
      <section data-testid="ai-section" class="card">
        <h2 class="card-title">AI Assistant</h2>
        <p class="card-hint">${DEFAULT_LLM_LABEL} · ~${DEFAULT_LLM_SIZE_MB} MB download on first run, cached after. A validation Mac used ~1.4–1.5 GiB for the warm app process tree; your usage may vary.</p>
        <div id="ai-idle">
          <button id="load-ai" class="btn" data-testid="load-ai-btn">Load Assistant</button>
        </div>
        <div id="ai-loading" style="display:none">
          <span class="mono" id="ai-loading-label">⏳ Loading model…</span>
        </div>
        <div id="ai-error" style="display:none">
          <div style="color:#f85149;margin-bottom:8px">❌ <span id="ai-error-msg">Failed to load model</span></div>
          <button id="ai-retry" class="btn">Retry</button>
        </div>
        <div id="ai-chat" style="display:none">
          <div id="chat-messages" class="chat-list" data-testid="chat-messages">
            <p class="chat-hint">Ask me anything…</p>
          </div>
          <div class="row gap-8">
            <input id="chat-input" class="inp" style="flex:1;margin-bottom:0" placeholder="Type a message..." data-testid="chat-input" />
            <button id="chat-send" class="btn btn-send" data-testid="chat-send-btn">→</button>
            <button id="chat-stop" class="btn" style="display:none" data-testid="chat-stop-btn">Stop</button>
          </div>
        </div>
      </section>`)
  }

  const docsSection = `
      <section data-testid="docs-section" class="card">
        <h2 class="card-title">Resources</h2>
        <a href="https://unstoppable.dev" class="link" target="_blank">Docs — unstoppable.dev</a>
        <a href="https://github.com/holepunchto" class="link" target="_blank">Holepunch on GitHub</a>
      </section>`

  sectionHtml.push(docsSection)

  // Build the JS event-handler block per feature
  const featureHandlers: string[] = []

  // KV Storage — always wired (base feature)
  featureHandlers.push(`
  // KV Storage — in-worker Hyperbee via bridge
  document.getElementById('kv-save').addEventListener('click', () => {
    const key = document.getElementById('kv-key').value.trim()
    const value = document.getElementById('kv-value').value
    if (!key) return
    sendToWorker({ type: 'db-put', key, value })
  })

  document.getElementById('kv-fetch').addEventListener('click', () => {
    const key = document.getElementById('kv-key').value.trim()
    if (!key) return
    sendToWorker({ type: 'db-get', key })
  })`)

  if (has(opts, 'multi-writer')) {
    featureHandlers.push(`
  // Multi-writer mesh
  document.getElementById('mesh-add-btn').addEventListener('click', () => {
    const writerKey = document.getElementById('mesh-add-writer').value.trim()
    if (!writerKey) return
    sendToWorker({ type: 'add-writer', writerKey })
    document.getElementById('mesh-add-writer').value = ''
  })`)
  }

  if (hasQvac) {
    featureHandlers.push(`
  // AI Assistant
  function requestLoad() {
    document.getElementById('ai-idle').style.display = 'none'
    document.getElementById('ai-error').style.display = 'none'
    document.getElementById('ai-loading').style.display = 'block'
    setText('ai-loading-label', '⏳ Preparing model…')
    sendToWorker({ type: 'load-ai' })
  }
  document.getElementById('load-ai').addEventListener('click', requestLoad)
  document.getElementById('ai-retry').addEventListener('click', requestLoad)

  document.getElementById('chat-send').addEventListener('click', sendChat)
  document.getElementById('chat-stop').addEventListener('click', () => {
    if (activeChatRequestId === null) return
    document.getElementById('chat-stop').disabled = true
    sendToWorker({ type: 'cancel-chat', requestId: activeChatRequestId })
  })
  document.getElementById('chat-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat() }
  })

  let chatHistory = []
  let streamingEl = null
  let chatSequence = 0
  let activeChatRequestId = null

  function setChatBusy(busy) {
    const input = document.getElementById('chat-input')
    input.disabled = busy
    document.getElementById('chat-send').disabled = busy
    document.getElementById('chat-stop').style.display = busy ? 'inline-block' : 'none'
    document.getElementById('chat-stop').disabled = false
    if (!busy) input.focus()
  }

  function sendChat() {
    const input = document.getElementById('chat-input')
    const text = input.value.trim()
    if (!text) return
    input.value = ''
    setChatBusy(true)

    chatHistory.push({ role: 'user', content: text })
    appendBubble('user', text)
    streamingEl = appendBubble('assistant', '')
    activeChatRequestId = ++chatSequence
    sendToWorker({ type: 'chat', requestId: activeChatRequestId, history: chatHistory })
  }

  function appendBubble(role, text) {
    const list = document.getElementById('chat-messages')
    const hint = list.querySelector('.chat-hint')
    if (hint) hint.remove()
    const div = document.createElement('div')
    div.className = 'bubble bubble-' + role
    div.textContent = text
    list.appendChild(div)
    list.scrollTop = list.scrollHeight
    return div
  }`)
  }

  // Build the onWorkerMessage handler cases
  const msgCases: string[] = [`
    if (msg.type === 'init-complete') {
      setText('worker-status', '✅ Ready')
    }`]

  // P2P status — always wired (base feature)
  msgCases.push(`
    if (msg.type === 'status' && msg.service === 'p2p') {
      setText('p2p-status', msg.status === 'ready' ? '✅ Networking initialized — no peer connection verified' : '❌ ' + msg.status)
    }`)

  // KV Storage result — always wired (base feature)
  msgCases.push(`
    if (msg.type === 'db-put-ok') {
      showResult('kv-result', 'Saved "' + msg.key + '"')
    }
    if (msg.type === 'db-get-ok') {
      const val = msg.value
      showResult('kv-result', val !== null ? '"' + msg.key + '" → ' + JSON.stringify(val) : '"' + msg.key + '" not found')
    }`)

  if (has(opts, 'multi-writer')) {
    msgCases.push(`
    if (msg.type === 'status' && msg.service === 'storage' && msg.dbKey) {
      setText('mesh-db-key', msg.dbKey)
      setText('mesh-writer-key', msg.writerKey)
      setText('mesh-status', msg.writable
        ? '✅ Writable — this device can write'
        : '⏳ Read-only — give your writer key to a peer so they can add you')
    }
    if (msg.type === 'mesh-info-ok') {
      setText('mesh-db-key', msg.dbKey)
      setText('mesh-writer-key', msg.writerKey)
      setText('mesh-status', msg.writable ? '✅ Writable' : '⏳ Read-only')
    }
    if (msg.type === 'add-writer-ok') {
      showResult('kv-result', 'Added writer ' + msg.writerKey.slice(0, 12) + '…')
    }`)
  }

  if (hasWallet) {
    msgCases.push(`
    if (msg.type === 'status' && msg.service === 'wallet') {
      setText('wallet-status', '✅ Ready (stub)')
    }`)
  }

  if (hasNodeSync) {
    msgCases.push(`
    if (msg.type === 'status' && msg.service === 'node-sync') {
      const hintEl = document.getElementById('node-sync-hint')
      if (msg.status === 'searching') setText('node-sync-status', '⏳ Looking for your Personal Node…')
      if (msg.status === 'registered') {
        setText('node-sync-status', 'Registered for replication — copy verification pending')
        if (hintEl) hintEl.style.display = 'none'
      }
      if (msg.status === 'disconnected' || msg.status === 'reconnecting') setText('node-sync-status', '⚠️ Replication paused — reconnecting…')
      if (msg.status === 'unavailable') {
        setText('node-sync-status', 'Device only — Personal Node not found')
        if (hintEl) hintEl.style.display = 'block'
      }
    }`)
  }

  if (hasQvac) {
    msgCases.push(`
    if (msg.type === 'status' && msg.service === 'ai' && msg.status === 'ready') {
      document.getElementById('ai-loading').style.display = 'none'
      document.getElementById('ai-error').style.display = 'none'
      document.getElementById('ai-chat').style.display = 'block'
      document.getElementById('chat-input').focus()
    }
    if (msg.type === 'status' && msg.service === 'ai' && msg.status === 'error') {
      document.getElementById('ai-loading').style.display = 'none'
      setText('ai-error-msg', msg.error || 'Failed to load model')
      document.getElementById('ai-error').style.display = 'block'
    }
    if (msg.type === 'model-progress') {
      // QVAC emits { phase, percentage?, downloaded?, total? }. Show a
      // useful label whatever shape arrives so the UI never looks frozen.
      let label = '⏳ ' + (msg.phase || 'Loading') + '…'
      if (typeof msg.percentage === 'number') {
        label = '⏳ ' + (msg.phase || 'Downloading') + ' ' + Math.round(msg.percentage) + '%'
      }
      setText('ai-loading-label', label)
    }
    if (msg.type === 'chat-token' && msg.requestId === activeChatRequestId && streamingEl) {
      streamingEl.textContent += msg.token
      document.getElementById('chat-messages').scrollTop = 9999
    }
    if (msg.type === 'chat-done' && msg.requestId === activeChatRequestId) {
      if (streamingEl) {
        chatHistory.push({ role: 'assistant', content: streamingEl.textContent })
        streamingEl = null
      }
      activeChatRequestId = null
      setChatBusy(false)
    }
    if (msg.type === 'chat-cancelled' && msg.requestId === activeChatRequestId) {
      if (streamingEl) {
        const partial = streamingEl.textContent.trim()
        streamingEl.textContent = partial ? partial + ' [stopped]' : 'Stopped.'
        chatHistory.push({ role: 'assistant', content: streamingEl.textContent })
        streamingEl = null
      }
      activeChatRequestId = null
      setChatBusy(false)
    }
    if (msg.type === 'chat-context' && msg.requestId === activeChatRequestId) {
      appendBubble('system', 'Earlier messages were omitted from model context to fit this request.')
    }
    if (msg.type === 'chat-error' && msg.requestId === activeChatRequestId) {
      if (chatHistory.at(-1)?.role === 'user') chatHistory.pop()
      if (streamingEl) { streamingEl.textContent = '❌ ' + (msg.error || 'chat failed'); streamingEl = null }
      activeChatRequestId = null
      setChatBusy(false)
    }`)
  }

  return {
    path: 'app/index.js',
    content: `import { sendToWorker, onWorkerMessage, workerReady } from './bridge.js'

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

document.getElementById('app').innerHTML = \`
  <div class="layout">
    <header class="app-header">
      <h1 class="app-title">${opts.projectName}</h1>
      <p class="app-subtitle">Unstoppable Stack · Pear Desktop</p>
      <p class="mono" id="worker-status">⏳ Worker starting...</p>
    </header>
    <main class="content">${sectionHtml.join('')}
    </main>
  </div>
\`

injectStyles()

// ---------------------------------------------------------------------------
// Feature wiring (runs after DOM is built above)
// ---------------------------------------------------------------------------
${featureHandlers.join('\n')}

// ---------------------------------------------------------------------------
// Worker message handler
// ---------------------------------------------------------------------------

onWorkerMessage((msg) => {
  ${msgCases.join('\n  ')}
})

workerReady.catch((err) => {
  document.getElementById('app').innerHTML =
    '<div style="padding:2rem;color:#f85149">Worker failed: ' + err.message + '</div>'
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setText(id, text) {
  const el = document.getElementById(id)
  if (el) el.textContent = text
}

function showResult(id, text) {
  const el = document.getElementById(id)
  if (!el) return
  el.textContent = text
  el.style.display = 'block'
}

function injectStyles() {
  const style = document.createElement('style')
  style.textContent = \`
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0d1117; color: #e6edf3; }
    .layout { display: flex; flex-direction: column; height: 100vh; overflow: hidden; }
    .app-header { padding: 1.5rem 1.5rem 1rem; border-bottom: 1px solid #30363d; flex-shrink: 0; }
    .app-title { font-size: 1.5rem; font-weight: 700; color: #58a6ff; margin-bottom: 2px; }
    .app-subtitle { font-size: 0.85rem; color: #8b949e; margin-bottom: 6px; }
    .content { flex: 1; overflow-y: auto; padding: 1.25rem; display: flex; flex-direction: column; gap: 1rem; }
    .card { background: #161b22; border: 1px solid #30363d; border-radius: 10px; padding: 1.25rem; }
    .card-title { font-size: 1rem; font-weight: 600; color: #e6edf3; margin-bottom: 0.75rem; }
    .card-hint { font-size: 0.8rem; color: #8b949e; margin: -0.5rem 0 0.75rem; }
    .mono { font-family: monospace; font-size: 0.85rem; color: #8b949e; }
    .row { display: flex; align-items: center; }
    .gap-8 { gap: 8px; }
    .inp { width: 100%; background: #0d1117; border: 1px solid #30363d; border-radius: 6px; padding: 8px 10px; color: #e6edf3; font-size: 0.875rem; margin-bottom: 8px; outline: none; }
    .inp:focus { border-color: #58a6ff; }
    .btn { background: #1f6feb; color: #fff; border: none; border-radius: 6px; padding: 8px 16px; font-size: 0.875rem; font-weight: 600; cursor: pointer; }
    .btn:hover { background: #388bfd; }
    .btn:disabled { opacity: 0.4; cursor: default; }
    .btn-outline { background: #21262d; border: 1px solid #30363d; }
    .btn-outline:hover { background: #30363d; }
    .btn-send { padding: 8px 14px; }
    .result { margin-top: 8px; font-family: monospace; font-size: 0.8rem; color: #3fb950; }
    .chat-list { max-height: 220px; overflow-y: auto; margin-bottom: 10px; display: flex; flex-direction: column; gap: 6px; }
    .chat-hint { color: #555; font-size: 0.875rem; font-style: italic; text-align: center; padding: 1rem; }
    .bubble { border-radius: 10px; padding: 8px 12px; max-width: 80%; font-size: 0.875rem; line-height: 1.4; white-space: pre-wrap; word-break: break-word; }
    .bubble-user { background: #1f6feb; align-self: flex-end; }
    .bubble-assistant { background: #21262d; border: 1px solid #30363d; align-self: flex-start; }
    .link { display: block; color: #58a6ff; font-size: 0.875rem; text-decoration: none; margin-bottom: 6px; }
    .link:hover { text-decoration: underline; }
  \`
  document.head.appendChild(style)
}
`,
  }
}
