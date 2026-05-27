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
        <div class="hdr-key" id="node-key" title="Click to copy node public key">
          <span class="hdr-key-label">node:</span>
          <span class="hdr-key-value" id="node-key-value">…</span>
        </div>
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
      <section class="card" id="trust-card" hidden>
        <h2 class="card-title">Denied Keys</h2>
        <p class="dim">Keys the node has been told to reject. Click "Forget" to allow them to request approval again.</p>
        <div id="denied-list" class="apps"></div>
      </section>
      <section class="card">
        <h2 class="card-title">Event Log</h2>
        <div id="log" class="log"></div>
      </section>
    </main>
  </div>
  <div class="modal-backdrop" id="approval-modal" hidden>
    <div class="modal">
      <h2 class="modal-title">Pair request</h2>
      <p class="modal-text">An app wants to pair with this node and replicate data through it.</p>
      <dl class="modal-info">
        <dt>App</dt><dd id="modal-app-name">–</dd>
        <dt>App ID</dt><dd id="modal-app-id" class="mono">–</dd>
        <dt>Public key</dt><dd id="modal-app-key" class="mono mono-wrap">–</dd>
      </dl>
      <p class="modal-warn">Only approve apps you launched yourself. Approving means this node will replicate the app's data and (if enabled) serve AI inference for it.</p>
      <div class="modal-actions">
        <button class="btn btn-deny" id="modal-deny">Deny &amp; remember</button>
        <button class="btn btn-approve-once" id="modal-approve-once">Approve once</button>
        <button class="btn btn-approve" id="modal-approve">Approve &amp; remember</button>
      </div>
      <p class="modal-pending dim" id="modal-pending-count" hidden></p>
    </div>
  </div>
`

injectStyles()

// ---------------------------------------------------------------------------
// State + wire up
// ---------------------------------------------------------------------------

let lastStatus = null
let nodePublicKey = null

// Queue of pair requests. Only the head request is shown in the
// modal; subsequent requests stack and are revealed one at a time
// after the user decides on the current one.
const approvalQueue = []
let approvalCurrent = null

onWorkerMessage((msg) => {
  switch (msg.type) {
    case 'ready':
      setText('node-status', '✅ Node is running')
      renderServices(msg.services || {})
      if (msg.publicKey) setNodePublicKey(msg.publicKey)
      if (msg.trust) renderTrust(msg.trust)
      pushLog(`Node ready (topic ${short(msg.topic)})`, 'ok')
      break
    case 'status':
      lastStatus = msg
      renderSummary(msg)
      renderApps(msg)
      if (msg.trust) renderTrust(msg.trust)
      break
    case 'paired':
      pushLog(`Paired with ${msg.appName} (${msg.appId})`, 'ok')
      break
    case 'pairRequest':
      // Logged but the modal is driven by `pairAwaitingApproval`,
      // which only fires for keys we haven't decided on yet.
      pushLog(`Pair request from ${msg.appName || msg.appId}`, 'info')
      break
    case 'pairAwaitingApproval':
      enqueueApproval(msg)
      break
    case 'pairAutoDecided':
      pushLog(`Auto-${msg.decision === 'approve' ? 'approved' : 'denied'} ${msg.appName || msg.appId}`, msg.decision === 'approve' ? 'ok' : 'info')
      break
    case 'pairDecisionRecorded':
      pushLog(`Decision: ${msg.decision} for ${msg.appName || msg.appId}`, msg.decision.startsWith('approve') ? 'ok' : 'info')
      break
    case 'pairDenied':
      pushLog(`Pairing denied: ${msg.appName || msg.appId} (${msg.reason || 'denied'})`, 'info')
      break
    case 'pairRevoked':
      pushLog(`Revoked trust for ${msg.appName || short(msg.publicKey)}`, 'info')
      break
    case 'pairForgotten':
      pushLog(`Forgot decision for ${short(msg.publicKey)}`, 'dim')
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

wireApprovalModal()

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
  const approved = status.trust?.approved || {}

  if (apps.length === 0) {
    el.innerHTML = '<p class="dim">No apps paired yet. Start one with `us init` and it will appear here.</p>'
    return
  }
  el.innerHTML = apps.map((app) => {
    const cores = (status.cores || []).filter((c) => c.appId === app.appId)
    const drives = (status.drives || []).filter((d) => d.appId === app.appId)
    const totalEntries = cores.reduce((s, c) => s + (c.length || 0), 0)
    const totalPeers = cores.reduce((s, c) => s + (c.peers || 0), 0)
    const trusted = !!approved[app.publicKey]
    const trustBadge = trusted
      ? '<span class="badge badge-ok" title="Approved by user">trusted</span>'
      : '<span class="badge badge-warn" title="Approved by daemon (no user gate set)">untrusted</span>'
    return `
      <div class="app-row" data-app-id="${escape(app.appId)}">
        <div class="app-info">
          <div class="app-name">${escape(app.appName || app.appId)} ${trustBadge}</div>
          <div class="app-meta">
            <span>${cores.length} cores</span>
            <span>${drives.length} drives</span>
            <span>${totalEntries} entries</span>
            <span>${totalPeers} peers</span>
            <span class="mono dim" title="${escape(app.publicKey || '')}">key ${short(app.publicKey)}</span>
          </div>
        </div>
        <button class="btn-ghost" data-unpair="${escape(app.appId)}" data-pubkey="${escape(app.publicKey || '')}">Unpair &amp; revoke</button>
      </div>
    `
  }).join('')

  el.querySelectorAll('[data-unpair]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const appId = btn.getAttribute('data-unpair')
      const publicKey = btn.getAttribute('data-pubkey') || null
      if (!appId) return
      if (!confirm(`Unpair ${appId}? Its data will stop replicating and this key will be denied on future pair attempts.`)) return
      sendToWorker({ type: 'unpair', appId, publicKey })
    })
  })
}

function renderTrust (trust) {
  const card = document.getElementById('trust-card')
  const list = document.getElementById('denied-list')
  const denied = trust?.denied || {}
  const entries = Object.entries(denied)
  if (entries.length === 0) {
    card.hidden = true
    list.innerHTML = ''
    return
  }
  card.hidden = false
  list.innerHTML = entries.map(([publicKey, entry]) => `
    <div class="app-row">
      <div class="app-info">
        <div class="app-name">${escape(entry.appName || entry.appId || 'unknown')}</div>
        <div class="app-meta">
          <span class="mono dim" title="${escape(publicKey)}">${short(publicKey)}</span>
          <span>${escape(entry.reason || 'denied')}</span>
          <span>${entry.deniedAt ? new Date(entry.deniedAt).toLocaleString() : ''}</span>
        </div>
      </div>
      <button class="btn-ghost btn-ghost-neutral" data-forget="${escape(publicKey)}">Forget</button>
    </div>
  `).join('')

  list.querySelectorAll('[data-forget]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const publicKey = btn.getAttribute('data-forget')
      if (!publicKey) return
      if (!confirm('Forget this denial? The key will be allowed to request approval again.')) return
      sendToWorker({ type: 'forget-trust', publicKey })
    })
  })
}

function setNodePublicKey (key) {
  nodePublicKey = key
  setText('node-key-value', short(key))
  const el = document.getElementById('node-key')
  if (el && !el._wired) {
    el._wired = true
    el.addEventListener('click', () => {
      if (!nodePublicKey) return
      const ta = document.createElement('textarea')
      ta.value = nodePublicKey
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      try { document.execCommand('copy') } catch {}
      document.body.removeChild(ta)
      pushLog('Copied node public key to clipboard', 'dim')
    })
  }
}

function enqueueApproval (req) {
  approvalQueue.push(req)
  if (!approvalCurrent) showNextApproval()
  else updatePendingCount()
}

function showNextApproval () {
  approvalCurrent = approvalQueue.shift() || null
  const modal = document.getElementById('approval-modal')
  if (!approvalCurrent) {
    modal.hidden = true
    return
  }
  setText('modal-app-name', approvalCurrent.appName || '(unnamed)')
  setText('modal-app-id', approvalCurrent.appId || '–')
  setText('modal-app-key', approvalCurrent.publicKey || '–')
  modal.hidden = false
  updatePendingCount()
}

function updatePendingCount () {
  const el = document.getElementById('modal-pending-count')
  if (!el) return
  if (approvalQueue.length === 0) {
    el.hidden = true
    return
  }
  el.hidden = false
  const n = approvalQueue.length
  el.textContent = `${n} more pending after this one.`
}

function wireApprovalModal () {
  const onApprove = (remember) => () => {
    if (!approvalCurrent) return
    sendToWorker({ type: 'pair-approve', publicKey: approvalCurrent.publicKey, remember })
    showNextApproval()
  }
  const onDeny = () => {
    if (!approvalCurrent) return
    sendToWorker({ type: 'pair-deny', publicKey: approvalCurrent.publicKey, remember: true, reason: 'denied by user' })
    showNextApproval()
  }
  document.getElementById('modal-approve').addEventListener('click', onApprove(true))
  document.getElementById('modal-approve-once').addEventListener('click', onApprove(false))
  document.getElementById('modal-deny').addEventListener('click', onDeny)
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

    .hdr-key {
      margin-top: 4px;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 0.72rem;
      cursor: pointer;
      color: #8b949e;
      user-select: none;
    }
    .hdr-key:hover { color: #58a6ff; }
    .hdr-key-label { color: #6e7681; }
    .hdr-key-value { font-family: 'SFMono-Regular', monospace; }

    .badge {
      display: inline-block;
      font-size: 0.65rem;
      font-weight: 600;
      padding: 2px 6px;
      border-radius: 4px;
      margin-left: 6px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .badge-ok { background: rgba(63, 185, 80, 0.15); color: #3fb950; }
    .badge-warn { background: rgba(187, 128, 9, 0.18); color: #d29922; }

    .mono { font-family: 'SFMono-Regular', monospace; }
    .mono-wrap { word-break: break-all; }

    .btn-ghost-neutral { color: #d2a8ff; }
    .btn-ghost-neutral:hover { border-color: #d2a8ff; }

    .modal-backdrop[hidden] { display: none; }
    .modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.65);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 9999;
    }
    .modal {
      background: #161b22;
      border: 1px solid #30363d;
      border-radius: 12px;
      padding: 22px 24px;
      max-width: 520px;
      width: calc(100% - 48px);
      box-shadow: 0 24px 60px rgba(0, 0, 0, 0.5);
    }
    .modal-title { font-size: 1.05rem; font-weight: 700; color: #e6edf3; margin-bottom: 4px; }
    .modal-text { font-size: 0.85rem; color: #8b949e; margin-bottom: 14px; }
    .modal-info {
      display: grid;
      grid-template-columns: 90px 1fr;
      row-gap: 6px;
      column-gap: 12px;
      font-size: 0.82rem;
      margin-bottom: 14px;
    }
    .modal-info dt { color: #6e7681; }
    .modal-info dd { color: #e6edf3; margin: 0; }
    .modal-warn {
      font-size: 0.8rem;
      color: #d29922;
      background: rgba(187, 128, 9, 0.1);
      border: 1px solid rgba(187, 128, 9, 0.4);
      padding: 8px 10px;
      border-radius: 6px;
      margin-bottom: 14px;
    }
    .modal-actions {
      display: flex;
      gap: 8px;
      justify-content: flex-end;
      flex-wrap: wrap;
    }
    .btn {
      padding: 8px 14px;
      border-radius: 6px;
      border: 1px solid #30363d;
      background: #21262d;
      color: #e6edf3;
      cursor: pointer;
      font-size: 0.85rem;
    }
    .btn:hover { border-color: #58a6ff; }
    .btn-deny { color: #f85149; }
    .btn-deny:hover { border-color: #f85149; background: rgba(248, 81, 73, 0.08); }
    .btn-approve-once { color: #d2a8ff; }
    .btn-approve {
      background: #238636; border-color: #2ea043; color: #fff;
    }
    .btn-approve:hover { background: #2ea043; border-color: #3fb950; }
    .modal-pending { margin-top: 10px; text-align: right; }
  `
  document.head.appendChild(style)
}
