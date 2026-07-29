import { sendToWorker, onWorkerMessage, workerReady } from './bridge.js'
import ui from 'pear-electron'

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

document.getElementById('app').innerHTML = `
  <div class="layout">
    <header class="hdr">
      <div class="hdr-main">
        <h1 class="title">Personal Node</h1>
        <p class="subtitle" id="node-status">⏳ Starting...</p>
        <div class="hdr-key" id="node-key" title="Copy this Personal Node's technical device ID">
          <span class="hdr-key-label">device ID:</span>
          <span class="hdr-key-value" id="node-key-value">…</span>
        </div>
      </div>
      <div class="services" id="services"></div>
      <div class="header-actions">
        <button class="btn-ghost" id="help-btn" title="Show the welcome guide">?</button>
      </div>
    </header>
    <main class="content">
      <nav class="tabs" aria-label="Dashboard sections">
        <button class="tab active" data-tab="overview">Home</button>
        <button class="tab" data-tab="storage">Storage</button>
        <button class="tab" data-tab="ai">AI</button>
        <button class="tab" data-tab="config">Advanced</button>
      </nav>

      <section class="tab-panel" id="tab-overview">
        <section class="card" id="summary-card">
          <h2 class="card-title">Protection status</h2>
          <div class="grid" id="summary-grid">
            <div class="metric"><span class="metric-label">Protected apps</span><span class="metric-value" id="m-apps">–</span></div>
            <div class="metric"><span class="metric-label">Data sources</span><span class="metric-value" id="m-cores">–</span></div>
            <div class="metric"><span class="metric-label">File libraries</span><span class="metric-value" id="m-drives">–</span></div>
            <div class="metric"><span class="metric-label">Connections</span><span class="metric-value" id="m-peers">–</span></div>
            <div class="metric"><span class="metric-label">Protected data</span><span class="metric-value" id="m-storage" title="Data currently held by this Personal Node.">–</span></div>
          </div>
        </section>
        <section class="card">
          <h2 class="card-title">Protected apps</h2>
          <div id="apps-list" class="apps"></div>
        </section>
      </section>

      <section class="tab-panel" id="tab-storage" hidden>
        <section class="card">
          <h2 class="card-title">Storage</h2>
          <p class="dim">Data held on this computer for each connected app.</p>
          <div class="grid storage-grid">
            <div class="metric"><span class="metric-label">Total</span><span class="metric-value" id="storage-total">–</span></div>
            <div class="metric"><span class="metric-label">App data</span><span class="metric-value" id="storage-cores">–</span></div>
            <div class="metric"><span class="metric-label">Files</span><span class="metric-value" id="storage-drives">–</span></div>
          </div>
          <div id="storage-apps" class="apps storage-apps"></div>
        </section>
      </section>

      <section class="tab-panel" id="tab-ai" hidden>
        <section class="card">
          <h2 class="card-title">AI on this computer</h2>
          <p class="dim">Let approved apps request private inference from this Personal Node. Prompts stay on the machines participating in the request.</p>
          <div class="ai-panel">
            <div>
              <div class="ai-state" id="ai-state">AI status unknown</div>
              <div class="dim" id="ai-detail">Waiting for daemon status…</div>
            </div>
            <button class="btn-ghost btn-ghost-neutral" id="ai-toggle" data-action="enable-ai" title="Turn AI for approved apps on or off.">Turn on AI (demo)</button>
          </div>
          <div class="ai-controls">
            <label class="field">Mode
              <select id="ai-mode">
                <option value="mock">Developer demo</option>
                <option value="qvac">Local QVAC model</option>
              </select>
            </label>
            <label class="field">QVAC model source
              <input id="ai-model" placeholder="preset, path, or URL">
            </label>
          </div>
        </section>
      </section>

      <section class="tab-panel" id="tab-config" hidden>
        <section class="card">
          <h2 class="card-title">Advanced settings</h2>
          <dl class="config-list">
            <dt>Status</dt><dd id="config-status">Starting…</dd>
            <dt>Node key</dt><dd class="mono mono-wrap" id="config-node-key">–</dd>
            <dt>Storage path</dt><dd class="mono mono-wrap" id="config-storage-path">–</dd>
            <dt>Services</dt><dd id="config-services">–</dd>
          </dl>
          <form class="config-form" id="config-form">
            <h3 class="section-title">Startup settings</h3>
            <p class="dim">Saved to this node's storage. AI changes also apply to the live provider after Save.</p>
            <label class="field-check"><input type="checkbox" id="cfg-ai-enabled"> Start with AI enabled</label>
            <label class="field">Startup AI mode
              <select id="cfg-ai-mode">
                <option value="mock">Developer demo</option>
                <option value="qvac">Local QVAC model</option>
              </select>
            </label>
            <label class="field">Startup QVAC model source
              <input id="cfg-ai-model" placeholder="preset, path, or URL">
            </label>
            <label class="field">Global storage quota (bytes)
              <input id="cfg-storage-global" type="number" min="0" placeholder="unlimited">
            </label>
            <label class="field">Per-app storage quota (bytes)
              <input id="cfg-storage-app" type="number" min="0" placeholder="unlimited">
            </label>
            <label class="field-check"><input type="checkbox" id="cfg-pair-approval"> Require app approval</label>
            <label class="field-check"><input type="checkbox" id="cfg-pair-auto-local"> Auto-approve local apps</label>
            <label class="field-check"><input type="checkbox" id="cfg-notifications-pair"> Notify for pair requests</label>
            <label class="field-check"><input type="checkbox" id="cfg-notifications-sound"> Play sound for pair requests</label>
            <label class="field-check"><input type="checkbox" id="cfg-notifications-restore"> Restore window for pair requests</label>
            <div class="config-actions">
              <button class="btn-ghost btn-ghost-neutral" id="notifications-permission" type="button">Enable desktop notifications</button>
              <span class="dim" id="notifications-status">Notifications unavailable</span>
            </div>
            <label class="field-check"><input type="checkbox" id="cfg-ui-welcome"> Show welcome guide</label>
            <div class="config-actions">
              <button class="btn btn-approve" id="config-save" type="submit">Save config</button>
              <button class="btn btn-approve-once" id="config-refresh" type="button">Refresh</button>
              <span class="dim" id="config-message"></span>
            </div>
          </form>
          <div class="config-form">
            <h3 class="section-title">Export settings</h3>
            <p class="dim">Exports settings, trust decisions, and the app list as JSON. It does not export app data or files.</p>
            <label class="field">Export file
              <input id="backup-path" placeholder="/tmp/unstoppable-node.uns">
            </label>
            <div class="config-actions">
              <button class="btn btn-approve-once" id="backup-export" type="button">Export settings</button>
              <button class="btn btn-deny" id="backup-import" type="button">Import settings</button>
              <span class="dim" id="backup-message"></span>
            </div>
          </div>
        </section>
        <section class="card" id="trust-card" hidden>
          <h2 class="card-title">Denied Keys</h2>
          <p class="dim">Keys the node has been told to reject. Click "Forget" to allow them to request approval again.</p>
          <div id="denied-list" class="apps"></div>
        </section>
        <section class="card">
          <h2 class="card-title">Event Log</h2>
          <div class="log-controls">
            <label class="field">Show
              <select id="log-filter">
                <option value="all">all</option>
                <option value="ok">ok</option>
                <option value="info">info</option>
                <option value="err">errors</option>
                <option value="dim">debug</option>
              </select>
            </label>
            <button class="btn-ghost btn-ghost-neutral" id="log-clear" type="button">Clear</button>
          </div>
          <div id="log" class="log"></div>
        </section>
      </section>
    </main>
  </div>
  <div class="modal-backdrop" id="approval-modal" hidden>
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="approval-title">
      <h2 class="modal-title" id="approval-title">Allow this app?</h2>
      <p class="modal-text">This app wants to use your Personal Node for data protection or AI.</p>
      <dl class="modal-info">
        <dt>App</dt><dd id="modal-app-name">–</dd>
        <dt>App ID</dt><dd id="modal-app-id" class="mono">–</dd>
        <dt>Device</dt><dd id="modal-device-name">–</dd>
        <dt>Public key</dt><dd id="modal-app-key" class="mono mono-wrap">–</dd>
        <dt>Access requested</dt><dd id="modal-capabilities">–</dd>
      </dl>
      <p class="modal-warn">Only allow an app you recognize. You can pause protection, remove the app, or change its AI access later.</p>
      <div class="modal-actions">
        <button class="btn btn-deny" id="modal-deny">Don't allow</button>
        <button class="btn btn-approve-once" id="modal-approve-once">Allow once</button>
        <button class="btn btn-approve" id="modal-approve">Always allow</button>
      </div>
      <p class="modal-pending dim" id="modal-pending-count" hidden></p>
    </div>
  </div>

  <div class="modal-backdrop" id="welcome-modal" hidden>
    <div class="modal modal-wide">
      <h2 class="modal-title">Welcome to your Personal Node</h2>
      <p class="modal-text">This app keeps approved app data available on your computer and can provide private AI when you enable it.</p>
      <ul class="welcome-list">
        <li><strong>Data protection</strong> runs in the background while this app is open.</li>
        <li><strong>Private AI</strong> is optional and must be enabled before approved apps can use it.</li>
        <li><strong>You stay in control</strong> — new apps ask permission before using this computer.</li>
        <li><strong>Advanced controls</strong> let you inspect data, pause replication, set limits, and view technical details.</li>
      </ul>
      <p class="modal-text dim">You can re-open this guide from the ? button. Data moves only between peers you connect; no central cloud account is required.</p>
      <div class="modal-actions">
        <button class="btn btn-approve" id="welcome-dismiss">Got it</button>
      </div>
    </div>
  </div>

  <div class="modal-backdrop" id="peek-modal" hidden>
    <div class="modal modal-wide">
      <h2 class="modal-title" id="peek-title">Peek data</h2>
      <p class="modal-text dim">A live, read-only view of the data this app is protecting on this computer.</p>
      <div class="peek-tabs" id="peek-tabs"></div>
      <div class="peek-body" id="peek-body"><p class="dim">Loading…</p></div>
      <div class="modal-actions">
        <button class="btn btn-approve-once" id="peek-refresh">Refresh</button>
        <button class="btn btn-deny" id="peek-close">Close</button>
      </div>
    </div>
  </div>

  <div class="modal-backdrop" id="import-modal" hidden>
    <div class="modal modal-wide">
      <h2 class="modal-title">Import Personal Node settings</h2>
      <p class="modal-text dim">Review this settings file before importing. It contains configuration, trust decisions, and app records.</p>
      <dl class="modal-info">
        <dt>Path</dt><dd id="import-path" class="mono mono-wrap">–</dd>
        <dt>Exported</dt><dd id="import-exported-at">–</dd>
        <dt>Apps</dt><dd id="import-app-count">–</dd>
        <dt>Trust</dt><dd id="import-trust-count">–</dd>
        <dt>Config</dt><dd id="import-config-state">–</dd>
      </dl>
      <div id="import-app-list" class="apps"></div>
      <p class="modal-warn">Existing apps with the same IDs will be overwritten. This JSON file does not restore protected app data or files.</p>
      <div class="modal-actions">
        <button class="btn btn-deny" id="import-cancel">Cancel</button>
        <button class="btn btn-approve" id="import-confirm">Import</button>
      </div>
    </div>
  </div>
`

injectStyles()

// ---------------------------------------------------------------------------
// State + wire up
// ---------------------------------------------------------------------------

let lastStatus = null
let nodePublicKey = null
let currentConfig = null
const logEntries = loadLogEntries()
let logFilter = 'all'
let pendingImportPath = null

// Queue of pair requests. Only the head request is shown in the
// modal; subsequent requests stack and are revealed one at a time
// after the user decides on the current one.
const approvalQueue = []
let approvalCurrent = null

onWorkerMessage((msg) => {
  switch (msg.type) {
    case 'ready':
      setText('node-status', '✅ Node is running')
      setText('config-status', 'Node is running')
      renderServices(msg.services || {})
      if (msg.publicKey) setNodePublicKey(msg.publicKey)
      if (msg.config) renderConfigForm(msg.config)
      if (msg.trust) renderTrust(msg.trust)
      pushLog(`Node ready (topic ${short(msg.topic)})`, 'ok')
      break
    case 'status':
      lastStatus = msg
      renderSummary(msg)
      renderApps(msg)
      renderStorage(msg)
      renderAiPanel(msg)
      renderConfig(msg)
      if (msg.trust) renderTrust(msg.trust)
      break
    case 'config':
      renderConfigForm(msg.config)
      setText('config-message', 'Config saved')
      pushLog('Config updated', 'ok')
      break
    case 'config-error':
      setText('config-message', msg.error || 'Config update failed')
      pushLog(`Config error: ${msg.error}`, 'err')
      break
    case 'export-result':
      setText('backup-message', `Exported ${msg.apps} app(s)`)
      pushLog(`Exported Personal Node settings to ${msg.path}`, 'ok')
      break
    case 'export-error':
      setText('backup-message', msg.error || 'Export failed')
      pushLog(`Export error: ${msg.error}`, 'err')
      break
    case 'import-result':
      setText('backup-message', `Imported ${msg.apps} app(s)`)
      closeImportModal()
      pushLog(`Imported Personal Node settings from ${msg.path}`, 'ok')
      break
    case 'import-preview':
      showImportPreview(msg.path, msg.preview)
      break
    case 'import-error':
      setText('backup-message', msg.error || 'Import failed')
      pushLog(`Import error: ${msg.error}`, 'err')
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
      notifyPairRequest(msg)
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
    case 'pairPromoted':
      pushLog(`Promoted ${msg.appName || msg.appId} to trusted`, 'ok')
      break
    case 'servicesChanged':
      renderServices(msg.services || {})
      renderAiPanel({ ...(lastStatus || {}), services: msg.services || {} })
      pushLog(`Services updated: ${Object.entries(msg.services || {}).filter(([, v]) => v).map(([k]) => k).join(', ') || '(none)'}`, 'ok')
      break
    case 'appPaused':
      pushLog(`Paused replication for ${msg.appId} (${msg.touched} units${msg.reason ? `, ${msg.reason}` : ''})`, 'dim')
      break
    case 'quotaExceeded':
      pushLog(`Quota exceeded for ${msg.appId}: ${formatBytes(msg.used)} used (${msg.reason})`, 'err')
      break
    case 'appQuotaChanged':
      pushLog(`Updated quota for ${msg.appId}: ${msg.quotaBytes === null ? 'unlimited/default' : formatBytes(msg.quotaBytes)}`, 'ok')
      break
    case 'appResumed':
      pushLog(`Resumed replication for ${msg.appId} (${msg.touched} units)`, 'ok')
      break
    case 'peek-core-result':
    case 'peek-drive-result': {
      const handler = peekState.pendingRequests.get(msg.requestId)
      if (handler) {
        peekState.pendingRequests.delete(msg.requestId)
        handler(msg.result, msg.type === 'peek-drive-result' ? 'drive' : 'core')
      }
      break
    }
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
      setText('config-status', 'Node failed to start')
      pushLog(`Fatal: ${msg.error}`, 'err')
      break
  }
})

wireApprovalModal()
wireTabs()
wireAiToggle()
wireConfigForm()
wireNotificationControls()
wireBackupControls()
wireLogControls()
wireImportModal()
wirePeekModal()
wireWelcomeModal()
setupTray()
renderLog()

const peekState = {
  appId: null,
  targets: [],
  activeIndex: 0,
  pendingRequests: new Map()
}
let peekRequestSeq = 0

workerReady.catch((err) => {
  setText('node-status', '❌ Worker failed to start')
  pushLog(`Worker error: ${err.message}`, 'err')
})

// ---------------------------------------------------------------------------
// Renderers
// ---------------------------------------------------------------------------

function renderServices (services) {
  const el = document.getElementById('services')
  const labels = {
    p2p: ['Network ready', 'Network offline'],
    storage: ['Storage ready', 'Storage unavailable'],
    ai: ['AI ready', 'AI off']
  }
  el.innerHTML = Object.entries(services)
    .map(([name, on]) => `<span class="pill ${on ? 'pill-on' : 'pill-off'}">${escape(labels[name]?.[on ? 0 : 1] || name)}</span>`)
    .join('')
  renderAiToggle(services)
  setText('config-services', Object.entries(services).map(([k, v]) => `${v ? '+' : '-'}${k}`).join(' '))
}

function renderAiToggle (services) {
  const btn = document.getElementById('ai-toggle')
  if (!btn) return
  const on = !!services?.ai
  const mode = getValue('ai-mode') || currentConfig?.ai?.mode || 'mock'
  btn.textContent = on ? 'Turn off AI' : `Turn on AI${mode === 'mock' ? ' (demo)' : ''}`
  btn.dataset.action = on ? 'disable-ai' : 'enable-ai'
}

function renderSummary (status) {
  setText('m-apps', String(status.apps?.length ?? 0))
  setText('m-cores', String(status.cores?.length ?? 0))
  setText('m-drives', String(status.drives?.length ?? 0))
  setText('m-peers', String(status.connectedPeers ?? 0))
  const bytes = status.storage?.total ?? 0
  setText('m-storage', formatBytes(bytes))
}

function renderStorage (status) {
  const storage = status.storage || {}
  setText('storage-total', formatBytes(storage.total || 0))
  setText('storage-cores', formatBytes(storage.totalCores || 0))
  setText('storage-drives', formatBytes(storage.totalDrives || 0))
  const el = document.getElementById('storage-apps')
  if (!el) return
  const apps = status.apps || []
  const perApp = storage.perApp || {}
  const quota = storage.quotas || {}
  if (quota.global?.limit !== null && quota.global?.limit !== undefined) {
    setText('storage-total', `${formatBytes(storage.total || 0)} / ${formatBytes(quota.global.limit)}${quota.global.exceeded ? ' over quota' : ''}`)
  }
  if (apps.length === 0) {
    el.innerHTML = '<p class="dim">No protected apps yet.</p>'
    return
  }
  el.innerHTML = apps.map((app) => `
    ${(() => {
      const q = quota.perApp?.[app.appId]
      const quotaBadge = q?.exceeded ? '<span class="badge badge-warn">over quota</span>' : ''
      const quotaText = q?.limit !== null && q?.limit !== undefined ? ` / ${formatBytes(q.limit)}` : ''
      return `
    <div class="app-row">
      <div class="app-info">
        <div class="app-name">${escape(app.appName || app.appId)} ${quotaBadge}</div>
        <div class="app-meta"><span>${escape(app.deviceName || 'This app')}</span></div>
      </div>
      <div class="storage-value">${formatBytes(perApp[app.appId] || 0)}${quotaText}</div>
    </div>
      `
    })()}
  `).join('')
}

function renderAiPanel (status) {
  const services = status.services || {}
  const ai = status.ai || null
  const on = !!services.ai
  setText('ai-state', on ? 'AI is enabled' : 'AI is disabled')
  if (!on) {
    setText('ai-detail', 'Approved apps cannot run inference here until you turn AI on.')
  } else if (ai?.mock) {
    setText('ai-detail', 'Developer demo mode is ready. Responses are simulated, not generated by a model.')
  } else {
    setText('ai-detail', ai?.modelId ? `Local model ready: ${ai.modelId}` : 'Local AI is ready.')
  }
  renderAiToggle(services)
}

function renderConfig (status) {
  setText('config-status', 'Node is running')
  if (nodePublicKey) setText('config-node-key', nodePublicKey)
  setText('config-storage-path', status.storagePath || '–')
  renderServices(status.services || {})
}

function renderConfigForm (config) {
  if (!config) return
  currentConfig = config
  setChecked('cfg-ai-enabled', !!config.ai?.enabled)
  setValue('cfg-ai-mode', config.ai?.mode || 'mock')
  setValue('cfg-ai-model', config.ai?.modelSrc || '')
  setValue('ai-mode', config.ai?.mode || 'mock')
  setValue('ai-model', config.ai?.modelSrc || '')
  setValue('cfg-storage-global', config.storage?.globalQuotaBytes ?? '')
  setValue('cfg-storage-app', config.storage?.perAppQuotaBytes ?? '')
  setChecked('cfg-pair-approval', config.pairing?.requireApproval !== false)
  setChecked('cfg-pair-auto-local', !!config.pairing?.autoApproveLocal)
  setChecked('cfg-notifications-pair', config.notifications?.pairRequests !== false)
  setChecked('cfg-notifications-sound', !!config.notifications?.pairRequestSound)
  setChecked('cfg-notifications-restore', !!config.notifications?.pairRequestAutoRestore)
  setChecked('cfg-ui-welcome', config.ui?.showWelcome !== false)
  renderNotificationPermission()
  applyWelcomePreference(config)
}

// Formats bytes for the dashboard tiles. We never need more than one decimal
// in the UI; 4 GB is more meaningful than 4.2398 GB on a small status card.
function formatBytes (n) {
  if (!Number.isFinite(n) || n <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let i = 0
  let v = n
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++ }
  return `${v < 10 && i > 0 ? v.toFixed(1) : Math.round(v)} ${units[i]}`
}

function formatCapabilitySummary (capabilities) {
  if (!capabilities || typeof capabilities !== 'object') return ''
  const labels = {
    'resources:register': 'protect its app data',
    'resources:status': 'view its own protection status',
    'resources:peek': 'inspect its own protected data',
    'storage:usage': 'view its own storage use',
    'ai:completion.stream': 'use AI on this computer'
  }
  const parts = []
  for (const [name, methods] of Object.entries(capabilities)) {
    const list = Array.isArray(methods) ? methods : []
    for (const method of list) parts.push(labels[`${name}:${method}`] || `${name}: ${method}`)
  }
  return parts.join(', ')
}

function formatLastActivity (units) {
  const latest = units.reduce((value, unit) => {
    const source = unit.lastSync || unit.updatedAt || ''
    const timestamp = typeof source === 'number' ? source : Date.parse(source)
    return Number.isFinite(timestamp) ? Math.max(value, timestamp) : value
  }, 0)
  if (!latest) return 'waiting for first sync'
  const seconds = Math.max(0, Math.round((Date.now() - latest) / 1000))
  if (seconds < 60) return 'active just now'
  if (seconds < 3600) return `active ${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `active ${Math.floor(seconds / 3600)}h ago`
  return `active ${Math.floor(seconds / 86400)}d ago`
}

function parseByteAmount (value) {
  const match = String(value).trim().match(/^(\d+(?:\.\d+)?)\s*(b|kb|mb|gb|tb)?$/i)
  if (!match) return null
  const units = { b: 1, kb: 1024, mb: 1024 ** 2, gb: 1024 ** 3, tb: 1024 ** 4 }
  const amount = Number(match[1]) * units[(match[2] || 'b').toLowerCase()]
  return Number.isSafeInteger(amount) && amount >= 0 ? amount : null
}

function renderApps (status) {
  const el = document.getElementById('apps-list')
  const apps = status.apps || []
  const approved = status.trust?.approved || {}
  const perApp = status.storage?.perApp || {}

  if (apps.length === 0) {
    el.innerHTML = '<p class="dim">No protected apps yet. An app will appear here after you allow its first connection.</p>'
    return
  }
  el.innerHTML = apps.map((app) => {
    const cores = (status.cores || []).filter((c) => c.appId === app.appId)
    const drives = (status.drives || []).filter((d) => d.appId === app.appId)
    const totalEntries = cores.reduce((s, c) => s + (c.length || 0), 0)
    const totalPeers = cores.reduce((s, c) => s + (c.peers || 0), 0)
    const appBytes = perApp[app.appId] || 0
    const appUnits = [...cores, ...drives]
    const allPaused = appUnits.length > 0 && appUnits.every((u) => u.paused)
    const trusted = !!approved[app.publicKey]
    const trustBadge = trusted
      ? '<span class="badge badge-ok">allowed</span>'
      : '<span class="badge badge-neutral" title="This app was connected before remembered approvals were introduced.">review access</span>'
    const promoteBtn = trusted
      ? ''
      : `<button class="btn-ghost btn-ghost-neutral" data-promote="${escape(app.appId)}" data-pubkey="${escape(app.publicKey || '')}" data-appname="${escape(app.appName || '')}">Mark allowed</button>`
    const pauseLabel = allPaused ? 'Resume protection' : 'Pause protection'
    const pauseAction = allPaused ? 'resume-app' : 'pause-app'
    const pauseBtn = appUnits.length > 0
      ? `<button class="btn-ghost" data-pause-action="${pauseAction}" data-app-id="${escape(app.appId)}">${pauseLabel}</button>`
      : ''
    const peekTargets = [
      ...cores.map((c) => ({ kind: 'core', key: c.key, name: c.name, type: c.type })),
      ...drives.map((d) => ({ kind: 'drive', key: d.key, name: d.name }))
    ]
    const peekBtn = peekTargets.length > 0
      ? `<button class="btn-ghost btn-ghost-neutral" data-peek-app="${escape(app.appId)}" data-peek-targets='${escape(JSON.stringify(peekTargets))}'>Inspect data</button>`
      : ''
    const quota = status.storage?.quotas?.perApp?.[app.appId]
    const quotaLabel = app.quotaBytes !== null && app.quotaBytes !== undefined
      ? formatBytes(app.quotaBytes)
      : (quota?.limit !== null && quota?.limit !== undefined ? `${formatBytes(quota.limit)} default` : 'unlimited')
    const quotaBtn = `<button class="btn-ghost btn-ghost-neutral" data-quota-app="${escape(app.appId)}" data-quota-current="${app.quotaBytes ?? ''}">Storage limit: ${escape(quotaLabel)}</button>`
    const aiGranted = (app.grants?.ai || []).includes('completion.stream')
    const aiGrantBtn = app.grants
      ? `<button class="btn-ghost btn-ghost-neutral" data-ai-grant-app="${escape(app.appId)}" data-ai-granted="${aiGranted ? '1' : '0'}">${aiGranted ? 'Block AI' : 'Allow AI'}</button>`
      : ''
    const deviceLine = app.deviceName
      ? `<span title="Device">${escape(app.deviceName)}</span>`
      : ''
    const grantLine = formatCapabilitySummary(app.grants || app.requestedCapabilities)
    const grantsMeta = grantLine ? `<span>${escape(grantLine)}</span>` : ''
    const stateBadge = appUnits.length === 0
      ? '<span class="badge badge-neutral">connected</span>'
      : (allPaused
          ? '<span class="badge badge-warn">paused</span>'
          : '<span class="badge badge-ok">protected</span>')
    const activity = appUnits.length === 0 ? 'no data registered' : formatLastActivity(appUnits)
    return `
      <div class="app-row" data-app-id="${escape(app.appId)}">
        <div class="app-info">
          <div class="app-name">${escape(app.appName || app.appId)} ${stateBadge} ${trustBadge}</div>
          <div class="app-meta">
            ${deviceLine}
            <span>${cores.length} data source${cores.length === 1 ? '' : 's'}</span>
            <span>${drives.length} file librar${drives.length === 1 ? 'y' : 'ies'}</span>
            <span>${escape(activity)}</span>
            <span>${formatBytes(appBytes)}</span>
          </div>
          <details class="technical-details">
            <summary>Technical details</summary>
            <div class="app-meta">
              ${grantsMeta}
              <span>${totalEntries} entries</span>
              <span>${totalPeers} peer connections</span>
              <span class="mono dim" title="${escape(app.publicKey || '')}">key ${short(app.publicKey)}</span>
              <span class="mono dim">ID ${escape(app.appId)}</span>
            </div>
          </details>
        </div>
        <div class="app-actions">
          ${peekBtn}
          ${pauseBtn}
          ${quotaBtn}
          ${aiGrantBtn}
          ${promoteBtn}
          <button class="btn-ghost" data-unpair="${escape(app.appId)}" data-pubkey="${escape(app.publicKey || '')}">Remove app</button>
        </div>
      </div>
    `
  }).join('')

  el.querySelectorAll('[data-unpair]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const appId = btn.getAttribute('data-unpair')
      const publicKey = btn.getAttribute('data-pubkey') || null
      if (!appId) return
      if (!confirm(`Remove ${appId}? Protection will stop and future connections from this installation will be blocked. Existing replicated bytes remain on this computer until data cleanup is available.`)) return
      sendToWorker({ type: 'unpair', appId, publicKey })
    })
  })

  el.querySelectorAll('[data-promote]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const appId = btn.getAttribute('data-promote')
      const publicKey = btn.getAttribute('data-pubkey') || null
      const appName = btn.getAttribute('data-appname') || ''
      if (!publicKey) return
      sendToWorker({ type: 'promote-trust', appId, appName, publicKey })
    })
  })

  el.querySelectorAll('[data-quota-app]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const appId = btn.getAttribute('data-quota-app')
      if (!appId) return
      const current = btn.getAttribute('data-quota-current') || ''
      const input = prompt('Set a storage limit such as 500 MB or 5 GB. Leave blank to use the default/unlimited limit.', current)
      if (input === null) return
      const trimmed = input.trim()
      let quotaBytes = null
      if (trimmed) {
        quotaBytes = parseByteAmount(trimmed)
        if (quotaBytes === null) {
          alert('Use a value such as 500 MB or 5 GB, or leave it blank.')
          return
        }
      }
      sendToWorker({ type: 'set-app-quota', appId, quotaBytes })
    })
  })

  el.querySelectorAll('[data-ai-grant-app]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const appId = btn.getAttribute('data-ai-grant-app')
      const granted = btn.getAttribute('data-ai-granted') === '1'
      if (!appId) return
      sendToWorker({
        type: 'set-app-grant',
        appId,
        capability: 'ai',
        methods: granted ? [] : ['completion.stream']
      })
    })
  })

  el.querySelectorAll('[data-peek-app]').forEach((btn) => {
    btn.addEventListener('click', () => {
      let targets
      try { targets = JSON.parse(btn.getAttribute('data-peek-targets') || '[]') }
      catch { targets = [] }
      const appId = btn.getAttribute('data-peek-app')
      openPeekModal(appId, targets)
    })
  })

  el.querySelectorAll('[data-pause-action]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const appId = btn.getAttribute('data-app-id')
      const action = btn.getAttribute('data-pause-action')
      if (!appId || !action) return
      btn.disabled = true
      sendToWorker({ type: action, appId })
      setTimeout(() => { btn.disabled = false }, 1500)
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
  setText('config-node-key', key)
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

function wireTabs () {
  document.querySelectorAll('[data-tab]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const tab = btn.getAttribute('data-tab')
      document.querySelectorAll('[data-tab]').forEach((b) => b.classList.toggle('active', b === btn))
      document.querySelectorAll('.tab-panel').forEach((panel) => {
        panel.hidden = panel.id !== `tab-${tab}`
      })
    })
  })
}

function enqueueApproval (req) {
  approvalQueue.push(req)
  if (!approvalCurrent) showNextApproval()
  else updatePendingCount()
  updateApprovalBadge()
}

function showNextApproval () {
  approvalCurrent = approvalQueue.shift() || null
  const modal = document.getElementById('approval-modal')
  if (!approvalCurrent) {
    modal.hidden = true
    updateApprovalBadge()
    return
  }
  setText('modal-app-name', approvalCurrent.appName || '(unnamed)')
  setText('modal-app-id', approvalCurrent.appId || '–')
  setText('modal-device-name', approvalCurrent.deviceName || '(not provided)')
  setText('modal-app-key', approvalCurrent.publicKey || '–')
  setText('modal-capabilities', formatCapabilitySummary(approvalCurrent.requestedCapabilities) || 'protect its data and view its own status')
  modal.hidden = false
  document.getElementById('modal-deny')?.focus()
  updatePendingCount()
  updateApprovalBadge()
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

function openPeekModal (appId, targets) {
  peekState.appId = appId
  peekState.targets = Array.isArray(targets) ? targets : []
  peekState.activeIndex = 0
  document.getElementById('peek-title').textContent = `Peek data — ${appId}`
  renderPeekTabs()
  loadCurrentPeek()
  document.getElementById('peek-modal').hidden = false
}

function closePeekModal () {
  document.getElementById('peek-modal').hidden = true
  peekState.pendingRequests.clear()
}

function renderPeekTabs () {
  const tabs = document.getElementById('peek-tabs')
  tabs.innerHTML = peekState.targets.map((t, i) => `
    <button data-peek-tab="${i}" class="${i === peekState.activeIndex ? 'active' : ''}">
      ${escape(t.kind === 'drive' ? '📁 ' : '📦 ')}${escape(t.name || short(t.key))}
    </button>
  `).join('')
  tabs.querySelectorAll('[data-peek-tab]').forEach((btn) => {
    btn.addEventListener('click', () => {
      peekState.activeIndex = Number(btn.getAttribute('data-peek-tab'))
      renderPeekTabs()
      loadCurrentPeek()
    })
  })
}

function loadCurrentPeek () {
  const target = peekState.targets[peekState.activeIndex]
  const body = document.getElementById('peek-body')
  if (!target) {
    body.innerHTML = '<p class="dim">No data registered for this app.</p>'
    return
  }
  body.innerHTML = '<p class="dim">Loading…</p>'
  const requestId = `peek-${++peekRequestSeq}`
  peekState.pendingRequests.set(requestId, (result, kind) => renderPeekResult(target, result, kind))
  if (target.kind === 'drive') {
    sendToWorker({ type: 'peek-drive', requestId, key: target.key, limit: 50 })
  } else {
    sendToWorker({ type: 'peek-core', requestId, key: target.key, limit: 10 })
  }
}

function renderPeekResult (target, result, kind) {
  const body = document.getElementById('peek-body')
  if (!result) {
    body.innerHTML = `<p class="dim">Node isn't replicating this key yet (key=${escape(short(target.key))}).</p>`
    return
  }
  if (kind === 'drive') {
    if (result.error) {
      body.innerHTML = `<p class="dim">Error: ${escape(result.error)}</p>`
      return
    }
    if (result.entries.length === 0) {
      body.innerHTML = `<p class="dim">Drive is empty (version ${result.version}).</p>`
      return
    }
    body.innerHTML = `<p class="dim">${result.entries.length} entries (drive version ${result.version})</p>` +
      result.entries.map((e) => `
        <div class="peek-row">
          <span class="badge ${e.type === 'file' ? 'badge-ok' : 'badge-neutral'}">${escape(e.type)}</span>
          <span class="mono">${escape(e.key)}</span>
          ${e.size > 0 ? `<span class="dim">${formatBytes(e.size)}</span>` : ''}
        </div>
      `).join('')
    return
  }
  if (result.length === 0) {
    body.innerHTML = `<p class="dim">Core is empty (key=${escape(short(target.key))}).</p>`
    return
  }
  body.innerHTML = `<p class="dim">Last ${result.blocks.length} of ${result.length} blocks (${formatBytes(result.byteLength)})</p>` +
    result.blocks.map((b) => `
      <div class="peek-row">
        <span class="mono dim">#${b.seq}</span>
        <span class="dim">${b.length}B</span>
        <span>${escape(b.preview || '(binary)')}</span>
      </div>
    `).join('')
}

function wirePeekModal () {
  const refresh = document.getElementById('peek-refresh')
  const close = document.getElementById('peek-close')
  if (refresh) refresh.addEventListener('click', loadCurrentPeek)
  if (close) close.addEventListener('click', closePeekModal)
}

// First-run welcome modal. Uses localStorage so subsequent launches skip the
// modal by default. The header `?` button always re-opens it.
const WELCOME_KEY = 'unstoppable-node-welcome-seen'

function showWelcome () {
  const m = document.getElementById('welcome-modal')
  if (m) m.hidden = false
}

function hideWelcome () {
  const m = document.getElementById('welcome-modal')
  if (m) m.hidden = true
  try { localStorage.setItem(WELCOME_KEY, '1') } catch {}
}

function wireWelcomeModal () {
  const dismiss = document.getElementById('welcome-dismiss')
  const help = document.getElementById('help-btn')
  if (dismiss) dismiss.addEventListener('click', hideWelcome)
  if (help) help.addEventListener('click', showWelcome)

  if (currentConfig && currentConfig.ui?.showWelcome === false) return
  let seen = false
  try { seen = localStorage.getItem(WELCOME_KEY) === '1' } catch {}
  if (!seen) showWelcome()
}

function applyWelcomePreference (config) {
  if (config.ui?.showWelcome === false) {
    hideWelcome()
    return
  }
  let seen = false
  try { seen = localStorage.getItem(WELCOME_KEY) === '1' } catch {}
  if (!seen) showWelcome()
}

async function setupTray () {
  try {
    if (!ui?.app?.tray) return
    const untray = await ui.app.tray({
      menu: {
        show: 'Show Personal Node',
        pauseAll: 'Pause all apps',
        resumeAll: 'Resume all apps',
        quit: 'Quit Personal Node'
      }
    }, async (key) => {
      if (key === 'click' || key === 'show') return showDashboardWindow()
      if (key === 'pauseAll') return pauseAllApps()
      if (key === 'resumeAll') return resumeAllApps()
      if (key === 'quit') sendToWorker({ type: 'shutdown' })
    })
    if (typeof Pear !== 'undefined' && Pear.teardown && typeof untray === 'function') {
      Pear.teardown(() => untray())
    }
    pushLog('System tray menu ready', 'dim')
  } catch (err) {
    pushLog(`System tray unavailable: ${err.message || err}`, 'dim')
  }
}

async function showDashboardWindow () {
  try {
    if (!ui?.app) return
    if (ui.app.show) await ui.app.show()
    if (ui.app.restore) await ui.app.restore()
    if (ui.app.focus) await ui.app.focus({ steal: true })
  } catch {}
}

function pauseAllApps () {
  const apps = lastStatus?.apps || []
  if (apps.length === 0) return pushLog('No paired apps to pause', 'dim')
  for (const app of apps) sendToWorker({ type: 'pause-app', appId: app.appId })
  pushLog(`Pause requested for ${apps.length} app(s) from tray`, 'info')
}

function resumeAllApps () {
  const apps = lastStatus?.apps || []
  if (apps.length === 0) return pushLog('No paired apps to resume', 'dim')
  for (const app of apps) sendToWorker({ type: 'resume-app', appId: app.appId })
  pushLog(`Resume requested for ${apps.length} app(s) from tray`, 'info')
}

function updateApprovalBadge () {
  if (!ui?.app?.badge) return
  const pending = (approvalCurrent ? 1 : 0) + approvalQueue.length
  ui.app.badge(pending > 0 ? pending : 0).catch(() => {})
}

function notifyPairRequest (req) {
  if (currentConfig?.notifications?.pairRequests === false) return
  if (currentConfig?.notifications?.pairRequestSound) playPairRequestSound()
  if (currentConfig?.notifications?.pairRequestAutoRestore) restoreForPairRequest()
  if (!('Notification' in window)) return
  const body = `${req.appName || req.appId || 'An app'} wants to use your Personal Node.`
  if (Notification.permission === 'granted') {
    new Notification('Personal Node app request', { body })
    return
  }
  if (Notification.permission === 'default') {
    Notification.requestPermission().then((permission) => {
      renderNotificationPermission()
      if (permission === 'granted') new Notification('Personal Node app request', { body })
    }).catch(() => {})
  }
}

async function restoreForPairRequest () {
  try {
    if (!ui?.app) return
    if (ui.app.show) await ui.app.show()
    if (ui.app.isMinimized && await ui.app.isMinimized()) {
      if (ui.app.restore) await ui.app.restore()
    }
    if (ui.app.focus) await ui.app.focus({ steal: false })
  } catch {}
}

function playPairRequestSound () {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext
    if (!AudioContext) return
    const ctx = new AudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.value = 880
    gain.gain.setValueAtTime(0.0001, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.08, ctx.currentTime + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.18)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 0.2)
    setTimeout(() => ctx.close().catch(() => {}), 250)
  } catch {}
}

function wireNotificationControls () {
  const btn = document.getElementById('notifications-permission')
  const pairToggle = document.getElementById('cfg-notifications-pair')
  if (pairToggle) pairToggle.addEventListener('change', renderNotificationPermission)
  if (!btn) return
  btn.addEventListener('click', async () => {
    if (!('Notification' in window)) return renderNotificationPermission()
    if (Notification.permission !== 'default') return renderNotificationPermission()
    btn.disabled = true
    setText('notifications-status', 'Requesting permission…')
    try {
      await Notification.requestPermission()
    } catch {}
    btn.disabled = false
    renderNotificationPermission()
  })
  renderNotificationPermission()
}

function renderNotificationPermission () {
  const btn = document.getElementById('notifications-permission')
  if (!btn) return
  if (!('Notification' in window)) {
    btn.disabled = true
    setText('notifications-status', 'Notifications are not supported here')
    return
  }
  const pairToggle = document.getElementById('cfg-notifications-pair')
  const enabled = pairToggle ? pairToggle.checked : currentConfig?.notifications?.pairRequests !== false
  if (!enabled) {
    btn.disabled = true
    setText('notifications-status', 'Pair-request notifications disabled in config')
    return
  }
  const permission = Notification.permission
  btn.disabled = permission !== 'default'
  btn.textContent = permission === 'default' ? 'Enable desktop notifications' : 'Desktop notifications'
  setText('notifications-status', permission === 'granted'
    ? 'Allowed for pair requests'
    : permission === 'denied'
      ? 'Blocked by system/browser settings'
      : 'Permission not requested')
}

function wireAiToggle () {
  const btn = document.getElementById('ai-toggle')
  const mode = document.getElementById('ai-mode')
  if (!btn) return
  if (mode) mode.addEventListener('change', () => renderAiToggle(lastStatus?.services || {}))
  btn.addEventListener('click', () => {
    const action = btn.dataset.action || 'enable-ai'
    btn.disabled = true
    btn.textContent = action === 'enable-ai' ? 'Enabling…' : 'Disabling…'
    if (action === 'enable-ai') {
      const mode = getValue('ai-mode') || 'mock'
      const modelSrc = getValue('ai-model').trim()
      if (mode === 'qvac' && !modelSrc) {
        btn.disabled = false
        renderAiToggle(lastStatus?.services || {})
        setText('ai-detail', 'Enter a QVAC model source before enabling QVAC mode.')
        return
      }
      sendToWorker({ type: 'enable-ai', mock: mode !== 'qvac', modelSrc: modelSrc || undefined })
    } else {
      sendToWorker({ type: 'disable-ai' })
    }
    // Re-enable after a short delay; the actual button text will be
    // corrected by the next `servicesChanged` / status snapshot.
    setTimeout(() => { btn.disabled = false }, 1500)
  })
}

function wireConfigForm () {
  const form = document.getElementById('config-form')
  const refresh = document.getElementById('config-refresh')
  if (!form) return
  form.addEventListener('submit', (event) => {
    event.preventDefault()
    try {
      const patch = collectConfigPatch()
      setText('config-message', 'Saving…')
      sendToWorker({ type: 'update-config', patch })
    } catch (err) {
      setText('config-message', err.message)
    }
  })
  if (refresh) refresh.addEventListener('click', () => {
    setText('config-message', 'Refreshing…')
    sendToWorker({ type: 'get-config' })
  })
  sendToWorker({ type: 'get-config' })
}

function wireBackupControls () {
  const exportBtn = document.getElementById('backup-export')
  const importBtn = document.getElementById('backup-import')
  if (exportBtn) exportBtn.addEventListener('click', () => {
    const path = getValue('backup-path').trim()
    if (!path) return setText('backup-message', 'Enter an export file path')
    setText('backup-message', 'Exporting…')
    sendToWorker({ type: 'export-state', path })
  })
  if (importBtn) importBtn.addEventListener('click', () => {
    const path = getValue('backup-path').trim()
    if (!path) return setText('backup-message', 'Enter a settings file path')
    setText('backup-message', 'Reading settings…')
    sendToWorker({ type: 'preview-import', path })
  })
}

function wireImportModal () {
  const cancel = document.getElementById('import-cancel')
  const confirm = document.getElementById('import-confirm')
  if (cancel) cancel.addEventListener('click', closeImportModal)
  if (confirm) confirm.addEventListener('click', () => {
    if (!pendingImportPath) return
    setText('backup-message', 'Importing…')
    sendToWorker({ type: 'import-state', path: pendingImportPath })
  })
}

function showImportPreview (path, preview) {
  pendingImportPath = path
  setText('backup-message', 'Ready to import')
  setText('import-path', path)
  setText('import-exported-at', preview.exportedAt || 'unknown')
  setText('import-app-count', String(preview.appCount || 0))
  setText('import-trust-count', `${preview.trustCounts?.approved || 0} approved, ${preview.trustCounts?.denied || 0} denied`)
  setText('import-config-state', preview.hasConfig ? 'included' : 'not included')
  const list = document.getElementById('import-app-list')
  if (list) {
    const apps = preview.apps || []
    list.innerHTML = apps.length === 0
      ? '<p class="dim">No app records in this settings file.</p>'
      : apps.map((app) => `<div class="app-row"><div class="app-info"><div class="app-name">${escape(app.appName || app.appId)}</div><div class="app-meta"><span class="mono">${escape(app.appId)}</span></div></div></div>`).join('')
  }
  document.getElementById('import-modal').hidden = false
}

function closeImportModal () {
  pendingImportPath = null
  const modal = document.getElementById('import-modal')
  if (modal) modal.hidden = true
}

function collectConfigPatch () {
  return {
    ai: {
      enabled: getChecked('cfg-ai-enabled'),
      mode: getValue('cfg-ai-mode') || 'mock',
      modelSrc: getValue('cfg-ai-model').trim()
    },
    storage: {
      globalQuotaBytes: parseOptionalBytes('cfg-storage-global'),
      perAppQuotaBytes: parseOptionalBytes('cfg-storage-app')
    },
    pairing: {
      requireApproval: getChecked('cfg-pair-approval'),
      autoApproveLocal: getChecked('cfg-pair-auto-local')
    },
    notifications: {
      pairRequests: getChecked('cfg-notifications-pair'),
      pairRequestSound: getChecked('cfg-notifications-sound'),
      pairRequestAutoRestore: getChecked('cfg-notifications-restore')
    },
    ui: {
      showWelcome: getChecked('cfg-ui-welcome')
    }
  }
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
  logEntries.push({ time: new Date().toLocaleTimeString(), text, kind })
  while (logEntries.length > 200) logEntries.shift()
  saveLogEntries()
  renderLog()
}

function renderLog () {
  const el = document.getElementById('log')
  if (!el) return
  el.innerHTML = ''
  for (const entry of logEntries) {
    if (logFilter !== 'all' && entry.kind !== logFilter) continue
    const line = document.createElement('div')
    line.className = `log-line log-${entry.kind}`
    line.textContent = `[${entry.time}] ${entry.text}`
    el.appendChild(line)
  }
  el.scrollTop = el.scrollHeight
}

function wireLogControls () {
  const filter = document.getElementById('log-filter')
  const clear = document.getElementById('log-clear')
  if (filter) filter.addEventListener('change', () => {
    logFilter = filter.value || 'all'
    renderLog()
  })
  if (clear) clear.addEventListener('click', () => {
    logEntries.length = 0
    saveLogEntries()
    renderLog()
  })
}

function loadLogEntries () {
  try {
    const parsed = JSON.parse(localStorage.getItem('unstoppable-node-event-log') || '[]')
    return Array.isArray(parsed) ? parsed.slice(-200) : []
  } catch {
    return []
  }
}

function saveLogEntries () {
  try { localStorage.setItem('unstoppable-node-event-log', JSON.stringify(logEntries.slice(-200))) } catch {}
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setText (id, text) {
  const el = document.getElementById(id)
  if (el) el.textContent = text
}

function setValue (id, value) {
  const el = document.getElementById(id)
  if (el) el.value = value
}

function getValue (id) {
  const el = document.getElementById(id)
  return el ? el.value : ''
}

function setChecked (id, value) {
  const el = document.getElementById(id)
  if (el) el.checked = !!value
}

function getChecked (id) {
  const el = document.getElementById(id)
  return !!el?.checked
}

function parseOptionalBytes (id) {
  const value = getValue(id).trim()
  if (!value) return null
  const parsed = Number(value)
  if (!Number.isSafeInteger(parsed) || parsed < 0) throw new Error(`${id} must be a non-negative integer`)
  return parsed
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
    .tabs {
      display: flex;
      gap: 8px;
      border-bottom: 1px solid #30363d;
      padding-bottom: 10px;
      position: sticky;
      top: 0;
      background: #0d1117;
      z-index: 2;
    }
    .tab {
      background: #161b22;
      border: 1px solid #30363d;
      border-radius: 999px;
      color: #8b949e;
      cursor: pointer;
      font-size: 0.85rem;
      padding: 7px 14px;
    }
    .tab:hover { border-color: #58a6ff; color: #c9d1d9; }
    .tab.active { background: rgba(56, 139, 253, 0.15); border-color: #58a6ff; color: #58a6ff; }
    .tab-panel[hidden] { display: none; }
    .tab-panel { display: flex; flex-direction: column; gap: 16px; }
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
      grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
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
    .storage-grid { grid-template-columns: repeat(3, 1fr); margin: 12px 0; }
    .storage-apps { margin-top: 12px; }
    .storage-value { color: #58a6ff; font-weight: 600; font-family: 'SFMono-Regular', monospace; }
    .ai-panel {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      background: #0d1117;
      border: 1px solid #30363d;
      border-radius: 8px;
      padding: 14px;
      margin-top: 12px;
    }
    .ai-state { color: #e6edf3; font-weight: 700; margin-bottom: 4px; }
    .ai-controls { margin-top: 12px; display: grid; grid-template-columns: 160px 1fr; gap: 10px; }
    .config-list {
      display: grid;
      grid-template-columns: 120px 1fr;
      gap: 8px 14px;
      margin: 0;
      font-size: 0.85rem;
    }
    .config-list dt { color: #6e7681; }
    .config-list dd { color: #e6edf3; margin: 0; }
    .config-form { margin-top: 16px; display: grid; gap: 10px; }
    .section-title { font-size: 0.85rem; color: #e6edf3; margin: 2px 0 4px; }
    .field { display: grid; gap: 4px; color: #8b949e; font-size: 0.8rem; }
    .field input, .field select {
      background: #0d1117;
      border: 1px solid #30363d;
      border-radius: 6px;
      color: #e6edf3;
      padding: 7px 9px;
    }
    .field-check { display: flex; align-items: center; gap: 8px; color: #c9d1d9; font-size: 0.85rem; }
    .config-actions { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-top: 4px; }

    .apps { display: flex; flex-direction: column; gap: 8px; }
    .app-row {
      display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap;
      padding: 10px 12px;
      background: #0d1117;
      border: 1px solid #30363d;
      border-radius: 8px;
    }
    .app-name { font-weight: 600; color: #e6edf3; }
    .app-meta {
      display: flex; gap: 10px; flex-wrap: wrap;
      margin-top: 2px;
      font-size: 0.75rem;
      color: #8b949e;
    }
    .app-info { min-width: min(100%, 320px); flex: 1; }
    .app-actions { display: flex; gap: 6px; flex-wrap: wrap; justify-content: flex-end; }
    .technical-details { margin-top: 7px; color: #8b949e; font-size: 0.75rem; }
    .technical-details summary { cursor: pointer; color: #58a6ff; }
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
    .log-controls { display: flex; align-items: end; justify-content: space-between; gap: 10px; margin-bottom: 8px; }
    .log-controls .field { min-width: 140px; }
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
    .badge-neutral { background: rgba(110, 118, 129, 0.25); color: #8b949e; }
    .app-actions { display: flex; gap: 6px; align-items: center; }
    .modal-wide { max-width: 720px; }
    .peek-tabs { display: flex; gap: 4px; flex-wrap: wrap; margin: 8px 0; }
    .peek-tabs button { background: transparent; border: 1px solid #30363d; color: #c9d1d9; padding: 4px 10px; border-radius: 6px; cursor: pointer; font-size: 12px; }
    .peek-tabs button.active { background: rgba(56, 139, 253, 0.15); border-color: #58a6ff; color: #58a6ff; }
    .peek-body { max-height: 360px; overflow: auto; background: #010409; border: 1px solid #30363d; border-radius: 6px; padding: 10px; font-family: ui-monospace, monospace; font-size: 12px; }
    .peek-row { padding: 4px 0; border-bottom: 1px dashed #21262d; }
    .peek-row:last-child { border-bottom: 0; }
    .header-actions { display: flex; gap: 6px; align-items: center; margin-left: auto; }
    .welcome-list { padding-left: 18px; margin: 6px 0 14px; color: #c9d1d9; line-height: 1.5; }
    .welcome-list li { margin: 6px 0; }
    .welcome-list code, .modal-text code { background: rgba(110, 118, 129, 0.2); padding: 1px 5px; border-radius: 3px; font-size: 12px; font-family: ui-monospace, monospace; }

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
