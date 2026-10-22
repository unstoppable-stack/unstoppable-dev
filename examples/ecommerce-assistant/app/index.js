import { setupNavigation } from './shell.js'
import { products, money } from '../catalog.js'
import { sendToWorker, onWorkerMessage, workerReady } from './bridge.js'

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

document.getElementById('app').innerHTML = `
  <div class="layout">
    <header class="app-header"><span class="brand-mark" aria-hidden="true">u//</span><span class="app-title">Local Goods</span><span class="app-subtitle">/ Demo store</span><p class="mono" id="worker-status" role="status">Worker starting…</p></header>
    <div class="workspace">
      <aside class="sidebar"><p class="eyebrow">Store workspace</p><nav aria-label="Store sections"><a class="nav-link" href="#catalog-section"><span class="nav-symbol" aria-hidden="true">▦</span>Catalog</a><a class="nav-link" href="#kv-section"><span class="nav-symbol" aria-hidden="true">▤</span>Cart & orders</a><a class="nav-link" href="#ai-section"><span class="nav-symbol" aria-hidden="true">⊞</span>Local assistant</a><a class="nav-link" href="#p2p-section"><span class="nav-symbol" aria-hidden="true">◇</span>Peer sharing</a></nav><div class="sidebar-footer"><p class="eyebrow">Local demo</p><p>No payments or fulfillment. Catalog and orders stay usable offline.</p></div></aside>
      <main class="content commerce-content"><div class="page-heading"><p class="eyebrow">Unstoppable / Demo store</p><h1>Local Goods</h1><p>Browse products, save demo orders, and use optional local AI.</p></div>
      <section id="catalog-section" class="card catalog-section">
        <p class="eyebrow">THE EVERYDAY COLLECTION</p>
        <h2 class="card-title">Product catalog</h2>
        <p class="card-hint">Browse offline, build a cart, and save a demo order locally.</p>
        <label for="catalog-search">Find a product</label>
        <input id="catalog-search" class="inp" type="search" placeholder="Search products or categories" />
        <div id="catalog" class="product-grid"></div>
      </section>
      <section data-testid="kv-section" class="card">
        <h2 class="card-title">Your cart</h2>
        <div id="cart-items" aria-live="polite"></div>
        <p id="cart-total" class="cart-total">Total $0.00 USD</p>
        <p class="card-hint">Demo checkout only. No payment, shipping, tax calculation, or fulfillment.</p>
        <label for="kv-key">Order reference</label>
        <input id="kv-key" class="inp" placeholder="For example order-001" data-testid="kv-key-input" />
        <div class="row gap-8">
          <button id="kv-save" class="btn" data-testid="kv-save-btn" disabled>Save demo order</button>
          <button id="kv-fetch" class="btn btn-outline" data-testid="kv-fetch-btn">Look up order</button>
        </div>
        <p id="kv-result" class="result" style="display:none" role="status" data-testid="kv-result"></p>
      </section>
      <section data-testid="ai-section" class="card">
        <h2 class="card-title">Shopping assistant</h2>
        <p class="card-hint">Qwen 3.5 0.8B · ~532 MB download on first run, cached after. A validation Mac used ~1.4–1.5 GiB for the warm app process tree; your usage may vary.</p>
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
            <p class="chat-hint">Ask about the products in this catalog.</p>
          </div>
          <div class="row gap-8">
            <input aria-label="Message the shopping assistant" id="chat-input" class="inp" style="flex:1;margin-bottom:0" placeholder="What would you recommend for a commute under $80?" data-testid="chat-input" />
            <button aria-label="Send message" id="chat-send" class="btn btn-send" data-testid="chat-send-btn">→</button>
            <button id="chat-stop" class="btn" style="display:none" data-testid="chat-stop-btn">Stop</button>
          </div>
        </div>
      </section>
      <section data-testid="p2p-section" class="card">
        <h2 class="card-title">Share with a trusted peer</h2>
        <p class="card-hint">Invite one trusted device to look up demo receipts by reference. Invitations expire in 15 minutes; the paired device keeps read access. Your cart stays on this device. Recipients can keep receipts.</p>
        <button id="share-orders" class="btn">Create read invitation</button>
        <p id="sharing-key" class="mono" style="overflow-wrap:anywhere"></p>
        <label for="peer-key">Peer invitation</label>
        <input id="peer-key" class="inp" placeholder="Trusted peer's invitation code" />
        <label for="peer-order-name">Peer order reference</label>
        <input id="peer-order-name" class="inp" placeholder="For example order-001" />
        <button id="fetch-peer-order" class="btn btn-outline">Fetch peer order</button>
        <p id="peer-order-result" class="result" role="status"></p>
        <p class="mono" id="p2p-status">⏳ Starting...</p>
      </section>
    </main>
    </div>
  </div>
`

setupNavigation()

document.getElementById('share-orders').addEventListener('click', () => sendToWorker({ type: 'share-orders' }))
document.getElementById('fetch-peer-order').addEventListener('click', () => {
  document.getElementById('fetch-peer-order').disabled = true
  setText('peer-order-result', 'Connecting to peer…')
  sendToWorker({ type: 'fetch-peer-order', peerKey: document.getElementById('peer-key').value.trim(), orderName: document.getElementById('peer-order-name').value.trim() })
})

// ---------------------------------------------------------------------------
// Feature wiring (runs after DOM is built above)
// ---------------------------------------------------------------------------

  let cart = []
  let cartBusy = true
  function renderCatalog() {
    const query = document.getElementById('catalog-search').value.toLowerCase()
    const list = document.getElementById('catalog')
    list.replaceChildren()
    for (const product of products.filter(p => (p.name + ' ' + p.category).toLowerCase().includes(query))) {
      const card = document.createElement('article')
      card.className = 'product'
      // Catalog content is static and app-owned; user/peer data is rendered with textContent.
      card.innerHTML = `<div class="product-art" aria-hidden="true">${product.symbol}</div><p class="eyebrow">${product.category}</p><h3>${product.name}</h3><p>${product.description}</p><div class="product-bottom"><strong>${money(product.price)}</strong><button class="btn" data-add="${product.id}" aria-label="Add ${product.name} to cart">Add to cart</button></div>`
      card.querySelector('button').disabled = cartBusy
      card.querySelector('button').addEventListener('click', () => {
        const next = cart.map(item => ({ ...item }))
        const existing = next.find(item => item.productId === product.id)
        if (existing) existing.quantity++
        else next.push({ productId: product.id, quantity: 1 })
        updateCart(next)
      })
      list.appendChild(card)
    }
    if (!list.children.length) list.textContent = 'No matching products.'
  }
  function updateCart(next) {
    setCommerceBusy(true)
    sendToWorker({ type: 'cart-set', cart: next })
  }
  function setCommerceBusy(busy) {
    cartBusy = busy
    document.querySelectorAll('[data-add], #cart-items button').forEach(button => { button.disabled = busy })
    document.getElementById('kv-save').disabled = busy || !cart.length
  }
  document.getElementById('catalog-search').addEventListener('input', renderCatalog)
  renderCatalog()
  document.getElementById('kv-save').addEventListener('click', () => {
    setCommerceBusy(true)
    sendToWorker({ type: 'checkout', orderName: document.getElementById('kv-key').value.trim() })
  })
  document.getElementById('kv-fetch').addEventListener('click', () => {
    const key = document.getElementById('kv-key').value.trim()
    if (key) sendToWorker({ type: 'db-get', key })
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
    if (msg.type === 'orders-shared') { setText('sharing-key', msg.key); setText('p2p-status', 'Invitation created') }
    if (msg.type === 'sharing-ready') { document.getElementById('sharing-key').dataset.ready = 'true'; setText('p2p-status', 'Invitation ready — awaiting a peer') }
    if (msg.type === 'peer-count') setText('p2p-status', msg.count + ' connected peer(s)')
    if (msg.type === 'peer-error' || msg.type === 'peer-order') {
      document.getElementById('fetch-peer-order').disabled = false
      setText('peer-order-result', msg.type === 'peer-error' ? msg.error : msg.value === null ? 'Peer order not found' : msg.key + ' → ' + JSON.stringify(msg.value))
    }

    if (msg.type === 'cart') {
      cart = msg.cart
      const list = document.getElementById('cart-items')
      list.replaceChildren()
      if (!msg.items.length) list.textContent = 'Your cart is empty. Find something you like above.'
      for (const item of msg.items) {
        const row = document.createElement('div')
        row.className = 'cart-row'
        const label = document.createElement('span')
        label.textContent = item.name + ' × ' + item.quantity + ' · ' + money(item.subtotal)
        row.appendChild(label)
        for (const [text, delta] of [['−', -1], ['+', 1], ['Remove', -item.quantity]]) {
          const button = document.createElement('button')
          button.className = 'btn btn-outline'
          button.textContent = text
          button.setAttribute('aria-label', text === 'Remove' ? 'Remove ' + item.name : (delta > 0 ? 'Increase ' : 'Decrease ') + item.name + ' quantity')
          button.addEventListener('click', () => updateCart(cart.map(entry => entry.productId === item.productId ? { ...entry, quantity: entry.quantity + delta } : entry).filter(entry => entry.quantity > 0)))
          row.appendChild(button)
        }
        list.appendChild(row)
      }
      setText('cart-total', 'Total ' + money(msg.total) + ' USD')
      setCommerceBusy(false)
    }
    if (msg.type === 'commerce-error') {
      setCommerceBusy(false)
      showResult('kv-result', msg.error)
    }
    if (msg.type === 'order-saved') {
      showResult('kv-result', 'Saved demo order ' + msg.order.id + ' · ' + money(msg.order.total) + ' USD · No payment or fulfillment')
    }
    if (msg.type === 'init-complete') {
      sendToWorker({ type: 'cart-get' })
      setText('worker-status', 'Ready')
    }

    if (msg.type === 'status' && msg.service === 'p2p') {
      setText('p2p-status', msg.status === 'ready' ? '✅ Networking initialized — no peer connection verified' : '❌ ' + msg.status)
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
