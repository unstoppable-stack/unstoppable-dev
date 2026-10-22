import { desktopUiFiles } from './ui.js'
import { sharedDataFiles } from './shared-data.js'
import { manifest } from '../compatibility/index.js'
import { dependenciesFor, profileFor, projectFiles } from '../compatibility/index.js'
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
    ...projectFiles(opts),
    ...sharedDataFiles(opts),
    packageJson(opts),
    indexHtml(opts),
    ...desktopUiFiles(),
    electronMainJs(opts),
    electronPreloadCjs(),
    workerJs(opts),
    appBridgeJs(),
    appComponent(opts),
  ]


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
  const profile = profileFor(opts.platform)
  const deps = dependenciesFor(opts)

  return {
    path: 'package.json',
    content: JSON.stringify({
      name: opts.projectName,
      version: '0.1.0',
      private: true,
      type: 'module',
      main: 'electron/main.js',
      engines: profile.engines,
      // Valid development-only link so pear-runtime can initialize before
      // the developer creates their own release line with `pear touch`.
      upgrade: 'pear://qxenz5wmspmryjc13m9yzsqj1conqotn8fb4ocbufwtz9mtbqq5o',
      scripts: {
        'share-data': 'node examples/share-data.mjs',
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
      devDependencies: profile.devDependencies,
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
  <link rel="stylesheet" href="./app/styles.css">
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
    backgroundColor: '#11171b',
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
    imports.push(`import { createNode } from '@unstoppable-stack/p2p'`)
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
    imports.push(`import { createAISession, createBareAdapter, createMockAdapter } from './.unstoppable/runtime-ai/index.js'`)
    moduleState.push(`const MOCK_AI = (typeof globalThis.Bare !== 'undefined' && globalThis.Bare.env?.QVAC_MOCK === '1') ||
  (typeof globalThis.process !== 'undefined' && globalThis.process.env?.QVAC_MOCK === '1')`)
    moduleState.push(`const ai = createAISession({ adapter: MOCK_AI ? createMockAdapter() : createBareAdapter(), byteBudget: ${Math.floor(DEFAULT_CTX_SIZE / 2)} })`)
    moduleState.push(`let activeChatRequestId = null`)
    initCode.push(`  send({ type: 'status', service: 'ai', status: 'idle', mock: MOCK_AI })`)
    cleanupCode.unshift(`  activeChatRequestId = null
  try { await ai.close() } catch (err) {
    send({ type: 'error', service: 'ai', code: err.code, error: err.message })
  }`)
    commandHandlers.push(`
    case 'load-ai': {
      send({ type: 'status', service: 'ai', status: 'loading', mock: ai.mock })
      try {
        const modelId = await ai.load({
          modelSrc: msg.modelSrc,
          modelConstant: '${DEFAULT_LLM_CONST}',
          modelChecksum: '${manifest.model.sha256Checksum}',
          modelType: 'llm',
          modelConfig: ${llmModelConfig('          ')},
          onProgress: (p) => send({ type: 'model-progress', ...p }),
        })
        send({ type: 'status', service: 'ai', status: 'ready', modelId, mock: ai.mock })
      } catch (err) {
        send({ type: 'status', service: 'ai', status: 'error', code: err.code, error: err.message })
      }
      break
    }
    case 'chat': {
      const requestId = msg.requestId
      if (activeChatRequestId !== null) { send({ type: 'chat-error', requestId, error: 'Another response is already running.' }); break }
      activeChatRequestId = requestId
      try {
        for await (const token of ai.stream(msg.history, {
          requestId,
          onTrim: () => send({ type: 'chat-context', requestId }),
        })) {
          if (activeChatRequestId === requestId) send({ type: 'chat-token', requestId, token })
        }
        if (activeChatRequestId === requestId) send({ type: 'chat-done', requestId })
      } catch (err) {
        if (activeChatRequestId === requestId) send({ type: 'chat-error', requestId, code: err.code, error: err.message })
      } finally {
        if (activeChatRequestId === requestId) activeChatRequestId = null
      }
      break
    }
    case 'cancel-chat': {
      const requestId = msg.requestId
      if (activeChatRequestId === requestId) activeChatRequestId = null
      try {
        await ai.cancel(requestId)
        send({ type: 'chat-cancelled', requestId })
      } catch (err) {
        send({ type: 'chat-error', requestId, code: err.code, error: 'Cancellation failed: ' + err.message })
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
        <p class="mono" style="color:var(--muted);margin-top:8px">Database key (share to let a device join):</p>
        <p class="mono" id="mesh-db-key" data-testid="mesh-db-key" style="word-break:break-all">—</p>
        <p class="mono" style="color:var(--muted);margin-top:8px">This device's writer key (give to a peer to be promoted):</p>
        <p class="mono" id="mesh-writer-key" data-testid="mesh-writer-key" style="word-break:break-all">—</p>
        <input id="mesh-add-writer" class="inp" placeholder="Peer's writer key" data-testid="mesh-add-writer-input" />
        <button id="mesh-add-btn" class="btn" data-testid="mesh-add-writer-btn">Add Writer</button>
      </section>`)
  }

  sectionHtml.push(`
      <section data-testid="kv-section" class="card">
        <h2 class="card-title">${has(opts, 'multi-writer') ? 'Shared Data' : 'KV Storage'}</h2>
        <input id="kv-key" aria-label="Data key" class="inp" placeholder="Key" data-testid="kv-key-input" />
        <input id="kv-value" aria-label="Data value" class="inp" placeholder="Value" data-testid="kv-value-input" />
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
        <p class="mono" style="color:var(--muted);margin-top:8px">WDK integration coming soon</p>
      </section>`)
  }

  if (hasNodeSync) {
    sectionHtml.push(`
      <section data-testid="node-sync-section" class="card">
        <h2 class="card-title">Node Replication</h2>
        <p class="mono" id="node-sync-status">⏳ Looking for your Personal Node…</p>
        <p class="mono" style="color:var(--muted);margin-top:8px" id="node-sync-hint">The Personal Node alpha is deferred from the core preview and is not required for local use.</p>
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
          <div style="color:var(--red);margin-bottom:8px">❌ <span id="ai-error-msg">Failed to load model</span></div>
          <button id="ai-retry" class="btn">Retry</button>
        </div>
        <div id="ai-chat" style="display:none">
          <div id="chat-messages" class="chat-list" data-testid="chat-messages">
            <p class="chat-hint">Ask me anything…</p>
          </div>
          <div class="row gap-8">
            <input id="chat-input" aria-label="Message the assistant" class="inp" style="flex:1;margin-bottom:0" placeholder="Type a message..." data-testid="chat-input" />
            <button id="chat-send" aria-label="Send message" class="btn btn-send" data-testid="chat-send-btn">→</button>
            <button id="chat-stop" class="btn" style="display:none" data-testid="chat-stop-btn">Stop</button>
          </div>
        </div>
      </section>`)
  }

  const docsSection = `
      <section data-testid="docs-section" class="card">
        <h2 class="card-title">Resources</h2>
        <a href="https://unstoppable-stack.dev" class="link" target="_blank">Docs — unstoppable-stack.dev</a>
        <a href="https://github.com/holepunchto" class="link" target="_blank">Holepunch on GitHub</a>
      </section>`

  sectionHtml.push(docsSection)

  const navItems = [
    ['p2p', 'Network', '◇'], ['kv', 'App data', '▤'], ['mesh', 'Shared writers', '⋈'],
    ['ai', 'Local AI', '⊞'], ['wallet', 'Wallet (experimental)', '◈'],
    ['node-sync', 'Node sync (alpha)', '⇄'], ['docs', 'Resources', '↗'],
  ].filter(([id]) => sectionHtml.some(html => html.includes(`data-testid="${id}-section"`)))
  const navigation = navItems.map(([id, label, symbol]) => `<a class="nav-link" href="#${id}-section"><span class="nav-symbol" aria-hidden="true">${symbol}</span>${label}</a>`).join('')

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
      setText('worker-status', 'Ready')
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
import { setupNavigation } from './shell.js'

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

document.getElementById('app').innerHTML = \`
  <div class="layout">
    <header class="app-header">
      <span class="brand-mark" aria-hidden="true">u//</span><span class="app-title">${opts.projectName}</span>
      <span class="app-subtitle">/ Unstoppable app</span><p class="mono" id="worker-status" role="status">Worker starting…</p>
    </header>
    <div class="workspace">
      <aside class="sidebar"><p class="eyebrow">Workspace</p><nav aria-label="App sections">${navigation}</nav><div class="sidebar-footer"><p class="eyebrow">Runs on your hardware</p><p>Local data first. Networking enables sharing.</p></div></aside>
      <main class="content"><div class="page-heading"><p class="eyebrow">Unstoppable / Desktop</p><h1>${opts.projectName}</h1><p>Your app, running on this computer.</p></div>${sectionHtml.join('')}
      </main>
    </div>
  </div>
\`

setupNavigation()

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
  setText('worker-status', 'Worker unavailable')
  const error = document.createElement('p')
  error.className = 'card error'
  error.setAttribute('role', 'alert')
  error.textContent = 'Worker failed: ' + err.message
  document.querySelector('main').prepend(error)
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

`,
  }
}
