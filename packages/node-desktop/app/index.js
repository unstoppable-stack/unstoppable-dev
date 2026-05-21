import { sendToWorker, onWorkerMessage, workerReady } from './bridge.js'

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

document.getElementById('app').innerHTML = `
  <div class="layout">
    <header class="hdr">
      <div class="hdr-main">
        <h1 class="title">Unstoppable Node</h1>
        <p class="subtitle" id="node-status">⏳ Starting...</p>
      </div>
      <div class="services" id="services"></div>
    </header>
    <main class="content">
      <section class="card" id="summary-card">
        <h2 class="card-title">Summary</h2>
        <div class="grid" id="summary-grid">
          <div class="metric"><span class="metric-label">Apps</span><span class="metric-value" id="m-apps">–</span></div>
          <div class="metric"><span class="metric-label">Cores</span><span class="metric-value" id="m-cores">–</span></div>
          <div class="metric"><span class="metric-label">Drives</span><span class="metric-value" id="m-drives">–</span></div>
          <div class="metric"><span class="metric-label">Peers</span><span class="metric-value" id="m-peers">–</span></div>
        </div>
      </section>
      <section class="card">
        <h2 class="card-title">Paired Apps</h2>
        <div id="apps-list" class="apps"></div>
      </section>
      <section class="card">
        <h2 class="card-title">Event Log</h2>
        <div id="log" class="log"></div>
      </section>
    </main>
  </div>
`

injectStyles()

// ---------------------------------------------------------------------------
// State + wire up
// ---------------------------------------------------------------------------

let lastStatus = null

onWorkerMessage((msg) => {
  switch (msg.type) {
    case 'ready':
      setText('node-status', '✅ Node is running')
      renderServices(msg.services || {})
      pushLog(`Node ready (topic ${short(msg.topic)})`, 'ok')
      break
    case 'status':
      lastStatus = msg
      renderSummary(msg)
      renderApps(msg)
      break
    case 'paired':
      pushLog(`Paired with ${msg.appName} (${msg.appId})`, 'ok')
      break
    case 'pairRequest':
      pushLog(`Pair request from ${msg.appName || msg.appId}`, 'info')
      break
    case 'appRegistered':
      pushLog(`${msg.appId}: ${msg.coreCount} core(s), ${msg.driveCount} drive(s)`, 'info')
      break
    case 'peerConnected':
      pushLog(`Peer connected: ${short(msg.publicKey)}`, 'dim')
      break
    case 'peerDisconnected':
      pushLog(`Peer disconnected: ${short(msg.publicKey)}`, 'dim')
      break
    case 'aiReady':
      pushLog(`AI provider ready${msg.mock ? ' (mock)' : ''}`, 'ok')
      if (lastStatus) {
        lastStatus.services = { ...(lastStatus.services || {}), ai: true }
        renderServices(lastStatus.services)
      }
      break
    case 'aiError':
      pushLog(`AI error (${msg.phase}): ${msg.error}`, 'err')
      break
    case 'aiProgress':
      if (typeof msg.percentage === 'number') {
        setText('node-status', `⏳ Downloading AI model: ${Math.round(msg.percentage)}%`)
      }
      break
    case 'inference':
      pushLog(`Served inference${msg.appId ? ` to ${msg.appId}` : ''}`, 'dim')
      break
    case 'unpaired':
      pushLog(`Unpaired ${msg.appId}`, 'info')
      break
    case 'error':
      pushLog(`Error (${msg.type ?? 'unknown'}): ${msg.error}`, 'err')
      break
    case 'fatal':
      setText('node-status', '❌ Node failed to start')
      pushLog(`Fatal: ${msg.error}`, 'err')
      break
  }
})

workerReady.catch((err) => {
  setText('node-status', '❌ Worker failed to start')
  pushLog(`Worker error: ${err.message}`, 'err')
})

// ---------------------------------------------------------------------------
// Renderers
// ---------------------------------------------------------------------------

function renderServices (services) {
  const el = document.getElementById('services')
  el.innerHTML = Object.entries(services)
    .map(([name, on]) => `<span class="pill ${on ? 'pill-on' : 'pill-off'}">${on ? '+' : '-'}${name}</span>`)
    .join('')
}

function renderSummary (status) {
  setText('m-apps', String(status.apps?.length ?? 0))
  setText('m-cores', String(status.cores?.length ?? 0))
  setText('m-drives', String(status.drives?.length ?? 0))
  setText('m-peers', String(status.connectedPeers ?? 0))
}

function renderApps (status) {
  const el = document.getElementById('apps-list')
  const apps = status.apps || []
  if (apps.length === 0) {
    el.innerHTML = '<p class="dim">No apps paired yet. Start one with `us init` and it will appear here.</p>'
    return
  }
  el.innerHTML = apps.map((app) => {
    const cores = (status.cores || []).filter((c) => c.appId === app.appId)
    const drives = (status.drives || []).filter((d) => d.appId === app.appId)
    const totalEntries = cores.reduce((s, c) => s + (c.length || 0), 0)
    const totalPeers = cores.reduce((s, c) => s + (c.peers || 0), 0)
    return `
      <div class="app-row" data-app-id="${escape(app.appId)}">
        <div class="app-info">
          <div class="app-name">${escape(app.appName || app.appId)}</div>
          <div class="app-meta">
            <span>${cores.length} cores</span>
            <span>${drives.length} drives</span>
            <span>${totalEntries} entries</span>
            <span>${totalPeers} peers</span>
          </div>
        </div>
        <button class="btn-ghost" data-unpair="${escape(app.appId)}">Unpair</button>
      </div>
    `
  }).join('')

  el.querySelectorAll('[data-unpair]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const appId = btn.getAttribute('data-unpair')
      if (!appId) return
      if (!confirm(`Unpair ${appId}? Its data will stop replicating on this node.`)) return
      sendToWorker({ type: 'unpair', appId })
    })
  })
}

// ---------------------------------------------------------------------------
// Log
// ---------------------------------------------------------------------------

function pushLog (text, kind = 'info') {
  const el = document.getElementById('log')
  const line = document.createElement('div')
  line.className = `log-line log-${kind}`
  const time = new Date().toLocaleTimeString()
  line.textContent = `[${time}] ${text}`
  el.appendChild(line)
  el.scrollTop = el.scrollHeight
  while (el.children.length > 200) el.removeChild(el.firstChild)
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setText (id, text) {
  const el = document.getElementById(id)
  if (el) el.textContent = text
}

function short (hex) {
  if (typeof hex !== 'string') return ''
  return hex.length > 16 ? `${hex.slice(0, 8)}…${hex.slice(-4)}` : hex
}

function escape (s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[c])
}

function injectStyles () {
  const style = document.createElement('style')
  style.textContent = `
    .layout { display: flex; flex-direction: column; height: 100vh; overflow: hidden; }
    .hdr {
      display: flex; align-items: center; justify-content: space-between;
      padding: 16px 20px 12px;
      border-bottom: 1px solid #30363d;
      flex-shrink: 0;
    }
    .hdr-main { display: flex; flex-direction: column; gap: 2px; }
    .title { font-size: 1.4rem; font-weight: 700; color: #58a6ff; }
    .subtitle { font-size: 0.85rem; color: #8b949e; }
    .services { display: flex; gap: 6px; flex-wrap: wrap; }
    .pill {
      display: inline-block;
      font-family: monospace;
      font-size: 0.75rem;
      padding: 3px 8px;
      border-radius: 999px;
      border: 1px solid #30363d;
    }
    .pill-on { color: #3fb950; border-color: #3fb950; }
    .pill-off { color: #484f58; }

    .content {
      flex: 1;
      overflow-y: auto;
      padding: 16px 20px 24px;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .card {
      background: #161b22;
      border: 1px solid #30363d;
      border-radius: 10px;
      padding: 16px 18px;
    }
    .card-title {
      font-size: 0.95rem;
      font-weight: 600;
      color: #e6edf3;
      margin-bottom: 12px;
    }

    .grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
    }
    .metric {
      background: #0d1117;
      border: 1px solid #30363d;
      border-radius: 8px;
      padding: 12px;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .metric-label { font-size: 0.75rem; color: #8b949e; }
    .metric-value { font-size: 1.3rem; font-weight: 600; color: #58a6ff; }

    .apps { display: flex; flex-direction: column; gap: 8px; }
    .app-row {
      display: flex; align-items: center; justify-content: space-between;
      padding: 10px 12px;
      background: #0d1117;
      border: 1px solid #30363d;
      border-radius: 8px;
    }
    .app-name { font-weight: 600; color: #e6edf3; }
    .app-meta {
      display: flex; gap: 10px;
      margin-top: 2px;
      font-size: 0.75rem;
      color: #8b949e;
    }
    .btn-ghost {
      background: transparent;
      color: #f85149;
      border: 1px solid #30363d;
      border-radius: 6px;
      padding: 6px 10px;
      cursor: pointer;
      font-size: 0.8rem;
    }
    .btn-ghost:hover { border-color: #f85149; }

    .log {
      height: 180px;
      overflow-y: auto;
      background: #0d1117;
      border: 1px solid #30363d;
      border-radius: 8px;
      padding: 8px;
      font-family: 'SFMono-Regular', monospace;
      font-size: 0.8rem;
      display: flex;
      flex-direction: column;
    }
    .log-line { padding: 2px 0; white-space: pre-wrap; word-break: break-word; }
    .log-ok { color: #3fb950; }
    .log-info { color: #d2a8ff; }
    .log-dim { color: #8b949e; }
    .log-err { color: #f85149; }

    .dim { color: #8b949e; font-size: 0.85rem; }
  `
  document.head.appendChild(style)
}
