import { sendToWorker, onWorkerMessage, workerReady } from './bridge.js'

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

document.getElementById('app').innerHTML = `
  <div class="layout">
    <header class="app-header">
      <h1 class="app-title">coffee-assistant</h1>
      <p class="app-subtitle">Coffee notes · local storage and local AI</p>
      <p class="mono" id="worker-status">⏳ Worker starting...</p>
    </header>
    <main class="content">
      <section data-testid="p2p-section" class="card">
        <h2 class="card-title">Share coffee orders with a trusted peer</h2>
        <p class="card-hint">Sharing exposes all saved orders to anyone who knows this key. Downloaded copies can remain on the recipient's device. Only share it with trusted people.</p>
        <button id="share-orders" class="btn">Share my orders</button>
        <p id="sharing-key" class="mono" style="overflow-wrap:anywhere"></p>
        <input id="peer-key" class="inp" placeholder="Trusted peer's sharing key" />
        <input id="peer-order-name" class="inp" placeholder="Order name (for example morning)" />
        <button id="fetch-peer-order" class="btn btn-outline">Fetch peer order</button>
        <p id="peer-order-result" class="result"></p>
        <p class="mono" id="p2p-status">⏳ Starting...</p>
      </section>
      <section data-testid="kv-section" class="card">
        <h2 class="card-title">Saved coffee orders</h2>
        <input id="kv-key" class="inp" placeholder="Order name (for example morning)" data-testid="kv-key-input" />
        <input id="kv-value" class="inp" placeholder="Order (for example one oat latte)" data-testid="kv-value-input" />
        <div class="row gap-8">
          <button id="kv-save" class="btn" data-testid="kv-save-btn">Save</button>
          <button id="kv-fetch" class="btn btn-outline" data-testid="kv-fetch-btn">Fetch</button>
        </div>
        <p id="kv-result" class="result" style="display:none" data-testid="kv-result"></p>
      </section>
      <section data-testid="ai-section" class="card">
        <h2 class="card-title">Coffee Assistant</h2>
        <p class="card-hint">Qwen 3.5 0.8B · ~532 MB download on first run, cached after. A validation Mac used ~1.4–1.5 GiB for the warm app process tree; your usage may vary.</p>
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
            <input id="chat-input" class="inp" style="flex:1;margin-bottom:0" placeholder="Suggest a coffee for someone who likes mild flavors" data-testid="chat-input" />
            <button id="chat-send" class="btn btn-send" data-testid="chat-send-btn">→</button>
            <button id="chat-stop" class="btn" style="display:none" data-testid="chat-stop-btn">Stop</button>
          </div>
        </div>
      </section>
      <section data-testid="docs-section" class="card">
        <h2 class="card-title">Resources</h2>
        <a href="https://unstoppable-stack.dev" class="link" target="_blank">Docs — unstoppable-stack.dev</a>
        <a href="https://github.com/holepunchto" class="link" target="_blank">Holepunch on GitHub</a>
      </section>
    </main>
  </div>
`

injectStyles()

document.getElementById('share-orders').addEventListener('click', () => sendToWorker({ type: 'share-orders' }))
document.getElementById('fetch-peer-order').addEventListener('click', () => {
  document.getElementById('fetch-peer-order').disabled = true
  setText('peer-order-result', 'Connecting to peer…')
  sendToWorker({ type: 'fetch-peer-order', peerKey: document.getElementById('peer-key').value.trim(), orderName: document.getElementById('peer-order-name').value.trim() })
})

// ---------------------------------------------------------------------------
// Feature wiring (runs after DOM is built above)
// ---------------------------------------------------------------------------

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
  })

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
  }

// ---------------------------------------------------------------------------
// Worker message handler
// ---------------------------------------------------------------------------

onWorkerMessage((msg) => {
    if (msg.type === 'orders-shared') { setText('sharing-key', msg.key); setText('p2p-status', 'Announcing sharing key…') }
    if (msg.type === 'sharing-ready') { document.getElementById('sharing-key').dataset.ready = 'true'; setText('p2p-status', 'Sharing announced — awaiting a peer') }
    if (msg.type === 'peer-count') setText('p2p-status', msg.count + ' connected peer(s)')
    if (msg.type === 'peer-error' || msg.type === 'peer-order') {
      document.getElementById('fetch-peer-order').disabled = false
      setText('peer-order-result', msg.type === 'peer-error' ? msg.error : msg.value === null ? 'Peer order not found' : msg.key + ' → ' + JSON.stringify(msg.value))
    }

    if (msg.type === 'init-complete') {
      setText('worker-status', '✅ Ready')
    }

    if (msg.type === 'status' && msg.service === 'p2p') {
      setText('p2p-status', msg.status === 'ready' ? '✅ Networking initialized — no peer connection verified' : '❌ ' + msg.status)
    }

    if (msg.type === 'db-put-ok') {
      showResult('kv-result', 'Saved "' + msg.key + '"')
    }
    if (msg.type === 'db-get-ok') {
      const val = msg.value
      showResult('kv-result', val !== null ? '"' + msg.key + '" → ' + JSON.stringify(val) : '"' + msg.key + '" not found')
    }

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
    }
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
  style.textContent = `
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
  `
  document.head.appendChild(style)
}
