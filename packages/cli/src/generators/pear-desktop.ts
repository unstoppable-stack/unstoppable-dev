import type { GeneratedFile, GeneratorOptions } from './types.js'
import { has, gitignore, readme, planningReadme } from './common.js'

export function generatePearDesktop(opts: GeneratorOptions): GeneratedFile[] {
  const files: GeneratedFile[] = [
    gitignore(),
    readme(opts),
    planningReadme(),
    packageJson(opts),
    indexHtml(opts),
    indexJs(),
    workerJs(opts),
    appBridgeJs(),
    appComponent(opts),
  ]

  return files
}

function packageJson(opts: GeneratorOptions): GeneratedFile {
  const deps: Record<string, string> = {
    'pear-electron': '^1.7.0',
    'pear-bridge': '^1.2.4',
    'pear-run': '^1.0.7',
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

  const unrouted = ['/worker.js']

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
        pre: 'pear-electron/pre',
        routes: '.',
        unrouted,
        gui: { backgroundColor: '#1a1a2e', height: 720, width: 1100 },
      },
      scripts: {
        dev: 'pear run -d .',
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
    #bar {
      -webkit-app-region: drag;
      height: 24px;
      position: fixed;
      top: 0; left: 0; right: 0;
      z-index: 9999;
    }
    #bar button, #bar input, #bar a { -webkit-app-region: no-drag; }
    pear-ctrl[data-platform="darwin"] {
      margin-top: 6px;
      margin-left: 8px;
    }
    #app { height: 100vh; padding-top: 24px; display: flex; flex-direction: column; }
  </style>
</head>
<body>
  <div id="bar"><pear-ctrl></pear-ctrl></div>
  <div id="app"></div>
  <script type="module" src="./app/index.js"></script>
</body>
</html>
`
  }
}

function indexJs(): GeneratedFile {
  return {
    path: 'index.js',
    content: `import Runtime from 'pear-electron'
import Bridge from 'pear-bridge'

const bridge = new Bridge({ waypoint: '/index.html' })
await bridge.ready()

const runtime = new Runtime()
const pipe = await runtime.start({ bridge })
pipe.on('close', () => Pear.exit())

Pear.teardown(() => pipe.destroy())
`
  }
}

function workerJs(opts: GeneratorOptions): GeneratedFile {
  const imports: string[] = []
  const initCode: string[] = []
  const commandHandlers: string[] = []
  const cleanupCode: string[] = []

  if (has(opts, 'p2p') || has(opts, 'kv-storage') || has(opts, 'autobase')) {
    imports.push(`import Corestore from 'corestore'`)
    initCode.push(`  const store = new Corestore(storagePath)`)
  }

  if (has(opts, 'p2p')) {
    imports.push(`import Hyperswarm from 'hyperswarm'`)
    imports.push(`import crypto from 'hypercore-crypto'`)
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
    imports.push(`import Hyperbee from 'hyperbee'`)
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
    imports.push(`import { loadModel, completion, unloadModel, LLAMA_3_2_1B_INST_Q4_0 } from '@qvac/sdk'`)
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
    content: `import run from 'pear-run'

const workerPath = Pear.key
  ? \`\${Pear.config.applink || ''}/worker.js\`
  : \`\${Pear.config.dir || ''}/worker.js\`

const pipe = run(workerPath, [])

const handlers = new Set()
let messageBuffer = ''

pipe.on('data', (data) => {
  messageBuffer += Buffer.from(data).toString()
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
  pipe.write(JSON.stringify(msg) + '\\n')
}

export function onWorkerMessage(handler) {
  handlers.add(handler)
  return () => handlers.delete(handler)
}

export function destroyWorker() {
  try {
    sendToWorker({ type: 'shutdown' })
    setTimeout(() => { try { pipe.destroy() } catch {} }, 500)
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
})
`
  }
}

function appComponent(opts: GeneratorOptions): GeneratedFile {
  const hasP2p = has(opts, 'p2p')
  const hasKv = has(opts, 'kv-storage')
  const hasQvac = has(opts, 'qvac')

  // Build the sections HTML that gets injected at startup
  const sectionHtml: string[] = []

  if (hasP2p) {
    sectionHtml.push(`
      <section data-testid="p2p-section" class="card">
        <h2 class="card-title">P2P Network</h2>
        <p class="mono" id="p2p-status">⏳ Starting...</p>
      </section>`)
  }

  if (hasKv) {
    sectionHtml.push(`
      <section data-testid="kv-section" class="card">
        <h2 class="card-title">KV Storage</h2>
        <input id="kv-key" class="inp" placeholder="Key" data-testid="kv-key-input" />
        <input id="kv-value" class="inp" placeholder="Value" data-testid="kv-value-input" />
        <div class="row gap-8">
          <button id="kv-save" class="btn" data-testid="kv-save-btn">Save</button>
          <button id="kv-fetch" class="btn btn-outline" data-testid="kv-fetch-btn">Fetch</button>
        </div>
        <p id="kv-result" class="result" style="display:none" data-testid="kv-result"></p>
      </section>`)
  }

  if (hasQvac) {
    sectionHtml.push(`
      <section data-testid="ai-section" class="card">
        <h2 class="card-title">AI Assistant</h2>
        <div id="ai-idle">
          <button id="load-ai" class="btn" data-testid="load-ai-btn">Load Assistant</button>
        </div>
        <div id="ai-loading" style="display:none">
          <span class="mono">⏳ Loading model...</span>
        </div>
        <div id="ai-error" style="display:none">
          <span style="color:#f85149">Failed to load model</span>
        </div>
        <div id="ai-chat" style="display:none">
          <div id="chat-messages" class="chat-list" data-testid="chat-messages">
            <p class="chat-hint">Ask me anything...</p>
          </div>
          <div class="row gap-8">
            <input id="chat-input" class="inp" style="flex:1;margin-bottom:0" placeholder="Type a message..." data-testid="chat-input" />
            <button id="chat-send" class="btn btn-send" data-testid="chat-send-btn">→</button>
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

  if (hasKv) {
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
  }

  if (hasQvac) {
    featureHandlers.push(`
  // AI Assistant
  document.getElementById('load-ai').addEventListener('click', () => {
    document.getElementById('ai-idle').style.display = 'none'
    document.getElementById('ai-loading').style.display = 'block'
    sendToWorker({ type: 'chat', history: [] }) // triggers model load via first chat
  })

  document.getElementById('chat-send').addEventListener('click', sendChat)
  document.getElementById('chat-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat() }
  })

  let chatHistory = []
  let streamingEl = null

  function sendChat() {
    const input = document.getElementById('chat-input')
    const text = input.value.trim()
    if (!text) return
    input.value = ''
    input.disabled = true
    document.getElementById('chat-send').disabled = true

    chatHistory.push({ role: 'user', content: text })
    appendBubble('user', text)
    streamingEl = appendBubble('assistant', '')
    sendToWorker({ type: 'chat', history: chatHistory })
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

  if (hasP2p) {
    msgCases.push(`
    if (msg.type === 'status' && msg.service === 'p2p') {
      setText('p2p-status', msg.status === 'ready' ? '✅ Connected — peers will join automatically' : '❌ ' + msg.status)
    }`)
  }

  if (hasKv) {
    msgCases.push(`
    if (msg.type === 'db-put-ok') {
      showResult('kv-result', 'Saved "' + msg.key + '"')
    }
    if (msg.type === 'db-get-ok') {
      const val = msg.value
      showResult('kv-result', val !== null ? '"' + msg.key + '" → ' + JSON.stringify(val) : '"' + msg.key + '" not found')
    }`)
  }

  if (hasQvac) {
    msgCases.push(`
    if (msg.type === 'status' && msg.service === 'ai' && msg.status === 'ready') {
      document.getElementById('ai-loading').style.display = 'none'
      document.getElementById('ai-chat').style.display = 'block'
    }
    if (msg.type === 'status' && msg.service === 'ai' && msg.status === 'error') {
      document.getElementById('ai-loading').style.display = 'none'
      document.getElementById('ai-error').style.display = 'block'
    }
    if (msg.type === 'chat-token' && streamingEl) {
      streamingEl.textContent += msg.token
      document.getElementById('chat-messages').scrollTop = 9999
    }
    if (msg.type === 'chat-done') {
      if (streamingEl) {
        chatHistory.push({ role: 'assistant', content: streamingEl.textContent })
        streamingEl = null
      }
      const inp = document.getElementById('chat-input')
      inp.disabled = false
      inp.focus()
      document.getElementById('chat-send').disabled = false
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

