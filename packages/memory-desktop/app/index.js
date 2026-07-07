import { sendToWorker, onWorkerMessage } from './bridge.js'

document.getElementById('app').innerHTML = `
  <div class="layout">
    <header class="hdr">
      <div>
        <h1>Unstoppable Memory</h1>
        <p id="status" class="dim">Starting...</p>
      </div>
      <div class="pill-row">
        <span class="pill" id="sync-pill">sync: starting</span>
        <span class="pill" id="mcp-pill">mcp: starting</span>
      </div>
    </header>

    <main class="content">
      <section class="card">
        <h2>Save Memory</h2>
        <label>Project / container tag
          <input id="container" placeholder="project:unstoppable">
        </label>
        <label>Memory content
          <textarea id="content" placeholder="Remember that..."></textarea>
        </label>
        <button id="save">Save memory</button>
        <span id="save-status" class="dim"></span>
      </section>

      <section class="card">
        <h2>Recall</h2>
        <label>Search query
          <input id="query" placeholder="What should I remember?">
        </label>
        <button id="search">Search</button>
        <div id="results" class="results"></div>
      </section>

      <section class="grid">
        <div class="card">
          <h2>Profile</h2>
          <button id="refresh-profile">Refresh profile</button>
          <div id="profile" class="results"></div>
        </div>
        <div class="card">
          <h2>Projects</h2>
          <button id="refresh-projects">Refresh projects</button>
          <div id="projects" class="results"></div>
        </div>
      </section>

      <section class="card">
        <h2>MCP Setup</h2>
        <p class="dim">Use this local server from Cursor, Claude, Codex, or OpenCode.</p>
        <button id="copy-mcp">Show Cursor config</button>
        <pre id="mcp-config"></pre>
      </section>
    </main>
  </div>
`

injectStyles()

let currentMcpUrl = null

onWorkerMessage((msg) => {
  switch (msg.type) {
    case 'ready':
      setText('status', `Ready. Storage: ${msg.storagePath}`)
      renderMcp(msg.mcp)
      renderSync(msg.sync)
      break
    case 'status':
      renderMcp(msg.mcp)
      renderSync(msg.sync)
      renderProjects(msg.projects || [])
      break
    case 'memorySaved':
      setText('save-status', `Saved ${msg.result.memories.length} memory`)
      sendToWorker({ type: 'profile', containerTag: containerTag() })
      sendToWorker({ type: 'projects' })
      break
    case 'searchResult':
      renderResults(msg.results.results || [])
      break
    case 'profile':
      renderProfile(msg.profile)
      break
    case 'projects':
      renderProjects(msg.projects || [])
      break
    case 'mcpConfig':
      setText('mcp-config', JSON.stringify(msg.config, null, 2))
      break
    case 'error':
      setText('status', `Error: ${msg.error}`)
      break
  }
})

document.getElementById('save').addEventListener('click', () => {
  const content = value('content').trim()
  if (!content) return setText('save-status', 'Enter memory content first')
  setText('save-status', 'Saving...')
  sendToWorker({ type: 'memory-save', content, containerTag: containerTag() })
})

document.getElementById('search').addEventListener('click', () => {
  const query = value('query').trim()
  if (!query) return
  sendToWorker({ type: 'memory-search', query, containerTag: containerTag() })
})

document.getElementById('refresh-profile').addEventListener('click', () => {
  sendToWorker({ type: 'profile', containerTag: containerTag() })
})

document.getElementById('refresh-projects').addEventListener('click', () => {
  sendToWorker({ type: 'projects' })
})

document.getElementById('copy-mcp').addEventListener('click', () => {
  sendToWorker({ type: 'mcp-config', client: 'cursor' })
})

function containerTag () {
  return value('container').trim() || 'default'
}

function renderMcp (mcp) {
  currentMcpUrl = mcp?.url || currentMcpUrl
  setText('mcp-pill', currentMcpUrl ? `mcp: ${currentMcpUrl}` : 'mcp: offline')
}

function renderSync (sync) {
  setText('sync-pill', `sync: ${sync?.status || 'unknown'}`)
}

function renderResults (results) {
  const el = document.getElementById('results')
  el.innerHTML = results.length === 0
    ? '<p class="dim">No memories found.</p>'
    : results.map((result) => `<div class="item"><strong>${Math.round(result.similarity * 100)}%</strong> ${escape(result.memory || result.chunk || '')}</div>`).join('')
}

function renderProfile (profile) {
  const facts = [
    ...(profile?.static || []).map((text) => ['Stable', text]),
    ...(profile?.dynamic || []).map((text) => ['Recent', text])
  ]
  document.getElementById('profile').innerHTML = facts.length === 0
    ? '<p class="dim">No profile yet.</p>'
    : facts.map(([kind, text]) => `<div class="item"><strong>${kind}</strong> ${escape(text)}</div>`).join('')
}

function renderProjects (projects) {
  document.getElementById('projects').innerHTML = projects.length === 0
    ? '<p class="dim">No projects yet.</p>'
    : projects.map((project) => `<div class="item mono">${escape(project)}</div>`).join('')
}

function value (id) {
  return document.getElementById(id).value || ''
}

function setText (id, text) {
  const el = document.getElementById(id)
  if (el) el.textContent = text
}

function escape (s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[c])
}

function injectStyles () {
  const style = document.createElement('style')
  style.textContent = `
    body { margin: 0; background: #0d1117; color: #c9d1d9; font-family: Inter, system-ui, sans-serif; }
    .layout { min-height: 100vh; display: flex; flex-direction: column; }
    .hdr { display: flex; align-items: center; justify-content: space-between; padding: 18px 22px; border-bottom: 1px solid #30363d; }
    h1 { margin: 0; color: #58a6ff; font-size: 24px; }
    h2 { margin: 0 0 12px; font-size: 16px; color: #e6edf3; }
    .content { padding: 18px 22px; display: flex; flex-direction: column; gap: 16px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .card { background: #161b22; border: 1px solid #30363d; border-radius: 10px; padding: 16px; }
    label { display: grid; gap: 6px; margin-bottom: 10px; color: #8b949e; font-size: 13px; }
    input, textarea { background: #0d1117; border: 1px solid #30363d; border-radius: 6px; color: #e6edf3; padding: 9px; }
    textarea { min-height: 90px; resize: vertical; }
    button { background: #238636; border: 1px solid #2ea043; color: #fff; border-radius: 6px; padding: 8px 12px; cursor: pointer; }
    pre { background: #010409; border: 1px solid #30363d; border-radius: 8px; padding: 12px; overflow: auto; }
    .dim { color: #8b949e; font-size: 13px; }
    .pill-row { display: flex; gap: 8px; flex-wrap: wrap; justify-content: flex-end; }
    .pill { border: 1px solid #30363d; border-radius: 999px; padding: 4px 9px; color: #58a6ff; font-family: ui-monospace, monospace; font-size: 12px; }
    .results { display: grid; gap: 8px; }
    .item { background: #0d1117; border: 1px solid #30363d; border-radius: 7px; padding: 8px 10px; }
    .mono { font-family: ui-monospace, monospace; }
  `
  document.head.appendChild(style)
}

sendToWorker({ type: 'refresh-status' })
