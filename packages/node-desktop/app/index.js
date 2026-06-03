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
      <div class="header-actions">
        <button class="btn-ghost" id="help-btn" title="Show the welcome guide">?</button>
      </div>
    </header>
    <main class="content">
      <nav class="tabs" aria-label="Dashboard sections">
        <button class="tab active" data-tab="overview">Overview</button>
        <button class="tab" data-tab="storage">Storage</button>
        <button class="tab" data-tab="ai">AI</button>
        <button class="tab" data-tab="config">Config</button>
      </nav>

      <section class="tab-panel" id="tab-overview">
        <section class="card" id="summary-card">
          <h2 class="card-title">Summary</h2>
          <div class="grid" id="summary-grid">
            <div class="metric"><span class="metric-label">Apps</span><span class="metric-value" id="m-apps">–</span></div>
            <div class="metric"><span class="metric-label">Cores</span><span class="metric-value" id="m-cores">–</span></div>
            <div class="metric"><span class="metric-label">Drives</span><span class="metric-value" id="m-drives">–</span></div>
            <div class="metric"><span class="metric-label">Peers</span><span class="metric-value" id="m-peers">–</span></div>
            <div class="metric"><span class="metric-label">Storage</span><span class="metric-value" id="m-storage" title="Sum of replicated core + drive byteLength. Click 'Recalc' for actual disk size.">–</span></div>
          </div>
        </section>
        <section class="card">
          <h2 class="card-title">Paired Apps</h2>
          <div id="apps-list" class="apps"></div>
        </section>
      </section>

      <section class="tab-panel" id="tab-storage" hidden>
        <section class="card">
          <h2 class="card-title">Storage</h2>
          <p class="dim">Replicated bytes by app. Updated with every daemon status snapshot.</p>
          <div class="grid storage-grid">
            <div class="metric"><span class="metric-label">Total</span><span class="metric-value" id="storage-total">–</span></div>
            <div class="metric"><span class="metric-label">Core bytes</span><span class="metric-value" id="storage-cores">–</span></div>
            <div class="metric"><span class="metric-label">Drive bytes</span><span class="metric-value" id="storage-drives">–</span></div>
          </div>
          <div id="storage-apps" class="apps storage-apps"></div>
        </section>
      </section>

      <section class="tab-panel" id="tab-ai" hidden>
        <section class="card">
          <h2 class="card-title">AI Provider</h2>
          <p class="dim">Enable delegated inference on this node. Mock mode is instant and safe for demos.</p>
          <div class="ai-panel">
            <div>
              <div class="ai-state" id="ai-state">AI status unknown</div>
              <div class="dim" id="ai-detail">Waiting for daemon status…</div>
            </div>
            <button class="btn-ghost btn-ghost-neutral" id="ai-toggle" data-action="enable-ai" title="Toggle the on-node AI provider. Use mock for quick demos.">Enable AI (mock)</button>
          </div>
          <div class="ai-controls">
            <label class="field">Mode
              <select id="ai-mode">
                <option value="mock">mock</option>
                <option value="qvac">qvac</option>
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
          <h2 class="card-title">Config</h2>
          <dl class="config-list">
            <dt>Status</dt><dd id="config-status">Starting…</dd>
            <dt>Node key</dt><dd class="mono mono-wrap" id="config-node-key">–</dd>
            <dt>Storage path</dt><dd class="mono mono-wrap" id="config-storage-path">–</dd>
            <dt>Services</dt><dd id="config-services">–</dd>
          </dl>
          <form class="config-form" id="config-form">
            <h3 class="section-title">Editable Settings</h3>
            <label class="field-check"><input type="checkbox" id="cfg-ai-enabled"> Enable AI by default</label>
            <label class="field">AI mode
              <select id="cfg-ai-mode">
                <option value="mock">mock</option>
                <option value="qvac">qvac</option>
              </select>
            </label>
            <label class="field">QVAC model source
              <input id="cfg-ai-model" placeholder="preset, path, or URL">
            </label>
            <label class="field">Global storage quota (bytes)
              <input id="cfg-storage-global" type="number" min="0" placeholder="unlimited">
            </label>
            <label class="field">Per-app storage quota (bytes)
              <input id="cfg-storage-app" type="number" min="0" placeholder="unlimited">
            </label>
            <label class="field-check"><input type="checkbox" id="cfg-pair-approval"> Require pair approval</label>
            <label class="field-check"><input type="checkbox" id="cfg-pair-auto-local"> Auto-approve local apps</label>
            <label class="field-check"><input type="checkbox" id="cfg-notifications-pair"> Notify for pair requests</label>
            <label class="field-check"><input type="checkbox" id="cfg-ui-welcome"> Show welcome guide</label>
            <div class="config-actions">
              <button class="btn btn-approve" id="config-save" type="submit">Save config</button>
              <button class="btn btn-approve-once" id="config-refresh" type="button">Refresh</button>
              <span class="dim" id="config-message"></span>
            </div>
          </form>
          <div class="config-form">
            <h3 class="section-title">Backup</h3>
            <p class="dim">Exports config, trust decisions, and paired-app registry as JSON. Full encrypted Corestore archives are planned later.</p>
            <label class="field">Backup path
              <input id="backup-path" placeholder="/tmp/unstoppable-node.uns">
            </label>
            <div class="config-actions">
              <button class="btn btn-approve-once" id="backup-export" type="button">Export</button>
              <button class="btn btn-deny" id="backup-import" type="button">Import</button>
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
          <div id="log" class="log"></div>
        </section>
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
        <dt>Device</dt><dd id="modal-device-name">–</dd>
        <dt>Public key</dt><dd id="modal-app-key" class="mono mono-wrap">–</dd>
        <dt>Requests</dt><dd id="modal-capabilities">–</dd>
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

  <div class="modal-backdrop" id="welcome-modal" hidden>
    <div class="modal modal-wide">
      <h2 class="modal-title">Welcome to Unstoppable Node</h2>
      <p class="modal-text">This window keeps a P2P data hub running on your machine. Apps you launch with <code>us init</code> will pair with it automatically.</p>
      <ul class="welcome-list">
        <li><strong>Data + files</strong> always available — your cores and drives replicate in the background while this window is open.</li>
        <li><strong>AI</strong> is opt-in. Click <em>Enable AI</em> in the header (mock is fine for demos), or run with <code>--ai</code> for QVAC.</li>
        <li><strong>Trust gate</strong> — every first-time pair request shows up as a modal. Approve it once, or remember the decision.</li>
        <li><strong>Peek + pause</strong> — every paired app gets a row with a "Peek data" and Pause/Resume button so you can poke without leaving the dashboard.</li>
      </ul>
      <p class="modal-text dim">You can re-open this any time from the header. Nothing is sent off your machine.</p>
      <div class="modal-actions">
        <button class="btn btn-approve" id="welcome-dismiss">Got it</button>
      </div>
    </div>
  </div>

  <div class="modal-backdrop" id="peek-modal" hidden>
    <div class="modal modal-wide">
      <h2 class="modal-title" id="peek-title">Peek data</h2>
      <p class="modal-text dim">A live, read-only view of the data this app is replicating through the node.</p>
      <div class="peek-tabs" id="peek-tabs"></div>
      <div class="peek-body" id="peek-body"><p class="dim">Loading…</p></div>
      <div class="modal-actions">
        <button class="btn btn-approve-once" id="peek-refresh">Refresh</button>
        <button class="btn btn-deny" id="peek-close">Close</button>
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
      pushLog(`Exported node backup to ${msg.path}`, 'ok')
      break
    case 'export-error':
      setText('backup-message', msg.error || 'Export failed')
      pushLog(`Export error: ${msg.error}`, 'err')
      break
    case 'import-result':
      setText('backup-message', `Imported ${msg.apps} app(s)`)
      pushLog(`Imported node backup from ${msg.path}`, 'ok')
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
wireBackupControls()
wirePeekModal()
wireWelcomeModal()

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
  el.innerHTML = Object.entries(services)
    .map(([name, on]) => `<span class="pill ${on ? 'pill-on' : 'pill-off'}">${on ? '+' : '-'}${name}</span>`)
    .join('')
  renderAiToggle(services)
  setText('config-services', Object.entries(services).map(([k, v]) => `${v ? '+' : '-'}${k}`).join(' '))
}

function renderAiToggle (services) {
  const btn = document.getElementById('ai-toggle')
  if (!btn) return
  const on = !!services?.ai
  const mode = getValue('ai-mode') || currentConfig?.ai?.mode || 'mock'
  btn.textContent = on ? 'Disable AI' : `Enable AI (${mode})`
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
    el.innerHTML = '<p class="dim">No paired apps yet.</p>'
    return
  }
  el.innerHTML = apps.map((app) => `
    ${(() => {
      const q = quota.perApp?.[app.appId]
      const quotaBadge = q?.exceeded ? '<span class="badge badge-warn">quota</span>' : ''
      const quotaText = q?.limit !== null && q?.limit !== undefined ? ` / ${formatBytes(q.limit)}` : ''
      return `
    <div class="app-row">
      <div class="app-info">
        <div class="app-name">${escape(app.appName || app.appId)} ${quotaBadge}</div>
        <div class="app-meta"><span class="mono">${escape(app.appId)}</span></div>
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
    setText('ai-detail', 'Apps that require AI will fail fast until you enable the provider.')
  } else if (ai?.mock) {
    setText('ai-detail', `Mock provider ready${ai.modelId ? ` (${ai.modelId})` : ''}.`)
  } else {
    setText('ai-detail', ai?.modelId ? `QVAC model: ${ai.modelId}` : 'QVAC provider enabled.')
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
  setChecked('cfg-ui-welcome', config.ui?.showWelcome !== false)
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
  const parts = []
  for (const [name, methods] of Object.entries(capabilities)) {
    const list = Array.isArray(methods) ? methods : []
    if (list.length === 0) continue
    parts.push(`${name}:${list.join(',')}`)
  }
  return parts.join(' | ')
}

function renderApps (status) {
  const el = document.getElementById('apps-list')
  const apps = status.apps || []
  const approved = status.trust?.approved || {}
  const perApp = status.storage?.perApp || {}

  if (apps.length === 0) {
    el.innerHTML = '<p class="dim">No apps paired yet. Start one with `us init` and it will appear here.</p>'
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
      ? '<span class="badge badge-ok" title="Approved by user via the pair-request modal">trusted</span>'
      : '<span class="badge badge-neutral" title="Paired before the trust gate ran. Not a security problem — click Promote to mark it user-approved.">auto-paired</span>'
    const promoteBtn = trusted
      ? ''
      : `<button class="btn-ghost btn-ghost-neutral" data-promote="${escape(app.appId)}" data-pubkey="${escape(app.publicKey || '')}" data-appname="${escape(app.appName || '')}">Promote</button>`
    const pauseLabel = allPaused ? 'Resume' : 'Pause'
    const pauseAction = allPaused ? 'resume-app' : 'pause-app'
    const pauseBtn = appUnits.length > 0
      ? `<button class="btn-ghost" data-pause-action="${pauseAction}" data-app-id="${escape(app.appId)}" title="Toggle replication for this app's cores/drives">${pauseLabel}</button>`
      : ''
    const peekTargets = [
      ...cores.map((c) => ({ kind: 'core', key: c.key, name: c.name, type: c.type })),
      ...drives.map((d) => ({ kind: 'drive', key: d.key, name: d.name }))
    ]
    const peekBtn = peekTargets.length > 0
      ? `<button class="btn-ghost" data-peek-app="${escape(app.appId)}" data-peek-targets='${escape(JSON.stringify(peekTargets))}'>Peek data</button>`
      : ''
    const quota = status.storage?.quotas?.perApp?.[app.appId]
    const quotaLabel = app.quotaBytes !== null && app.quotaBytes !== undefined
      ? formatBytes(app.quotaBytes)
      : (quota?.limit !== null && quota?.limit !== undefined ? `${formatBytes(quota.limit)} default` : 'unlimited')
    const quotaBtn = `<button class="btn-ghost btn-ghost-neutral" data-quota-app="${escape(app.appId)}" data-quota-current="${app.quotaBytes ?? ''}" title="Set this app's advisory quota in bytes">Quota: ${escape(quotaLabel)}</button>`
    const deviceLine = app.deviceName
      ? `<span title="Device">${escape(app.deviceName)}</span>`
      : ''
    const grantLine = formatCapabilitySummary(app.grants || app.requestedCapabilities)
    const grantsMeta = grantLine ? `<span title="Capability grants">${escape(grantLine)}</span>` : ''
    return `
      <div class="app-row" data-app-id="${escape(app.appId)}">
        <div class="app-info">
          <div class="app-name">${escape(app.appName || app.appId)} ${trustBadge}</div>
          <div class="app-meta">
            ${deviceLine}
            ${grantsMeta}
            <span>${cores.length} cores</span>
            <span>${drives.length} drives</span>
            <span>${totalEntries} entries</span>
            <span>${totalPeers} peers</span>
            <span title="Replicated bytes for this app">${formatBytes(appBytes)}</span>
            <span class="mono dim" title="${escape(app.publicKey || '')}">key ${short(app.publicKey)}</span>
          </div>
        </div>
        <div class="app-actions">
          ${peekBtn}
          ${pauseBtn}
          ${quotaBtn}
          ${promoteBtn}
          <button class="btn-ghost" data-unpair="${escape(app.appId)}" data-pubkey="${escape(app.publicKey || '')}">Unpair &amp; revoke</button>
        </div>
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
      const input = prompt('Set advisory quota in bytes. Leave blank to use the default/unlimited quota.', current)
      if (input === null) return
      const trimmed = input.trim()
      let quotaBytes = null
      if (trimmed) {
        quotaBytes = Number(trimmed)
        if (!Number.isSafeInteger(quotaBytes) || quotaBytes < 0) {
          alert('Quota must be a non-negative integer number of bytes, or blank for default/unlimited.')
          return
        }
      }
      sendToWorker({ type: 'set-app-quota', appId, quotaBytes })
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
  setText('modal-device-name', approvalCurrent.deviceName || '(not provided)')
  setText('modal-app-key', approvalCurrent.publicKey || '–')
  setText('modal-capabilities', formatCapabilitySummary(approvalCurrent.requestedCapabilities) || 'default data + storage')
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

function notifyPairRequest (req) {
  if (currentConfig?.notifications?.pairRequests === false) return
  if (!('Notification' in window)) return
  const body = `${req.appName || req.appId || 'An app'} wants to pair with this node.`
  if (Notification.permission === 'granted') {
    new Notification('Unstoppable Node pair request', { body })
    return
  }
  if (Notification.permission === 'default') {
    Notification.requestPermission().then((permission) => {
      if (permission === 'granted') new Notification('Unstoppable Node pair request', { body })
    }).catch(() => {})
  }
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
    if (!path) return setText('backup-message', 'Enter a backup path')
    setText('backup-message', 'Exporting…')
    sendToWorker({ type: 'export-state', path })
  })
  if (importBtn) importBtn.addEventListener('click', () => {
    const path = getValue('backup-path').trim()
    if (!path) return setText('backup-message', 'Enter a backup path')
    if (!confirm('Import this backup into the current node storage? Existing apps with the same IDs will be overwritten.')) return
    setText('backup-message', 'Importing…')
    sendToWorker({ type: 'import-state', path })
  })
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
      pairRequests: getChecked('cfg-notifications-pair')
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
