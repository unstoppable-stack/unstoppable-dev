import { commands, escape, formatBytes, parseByteAmount } from './render.js'
import { simpleHomeModel } from './simple-model.js'
import { icon } from './icons.js'

export function createSimpleHome({ element, send, advanced, browse }) {
  let status = null, running = false, failure = null, pendingInvite = false, inviteId = null, limitKey = null
  let selectedKey = null, section = 'overview', lastAppsHtml = '', lastInspectorHtml = ''
  element.innerHTML = `
    <section class="simple-intro">
      <div><p class="eyebrow">Personal cloud / This computer</p><h1 id="simple-title">Your personal cloud</h1><p id="simple-description">Checking that your shared data is available.</p></div>
      <button class="btn btn-approve" id="simple-connect" type="button" disabled>${icon('plus')}Connect an app</button>
    </section>
    <section class="card" id="simple-pairing" hidden>
      <h3>Connect with a pairing code</h3>
      <p>Paste this code into the app you want to connect. It allows the app to copy its shared data here. Share it only with an app you trust.</p>
      <label class="field">Pairing code<input id="simple-code" readonly spellcheck="false" aria-describedby="simple-code-help"></label>
      <p class="dim" id="simple-code-help">One use. Expires in 15 minutes. Connecting does not allow AI access.</p>
    </section>
    <p id="simple-message" role="status"></p>
    <div class="simple-overview">
      <section class="metric"><h3 class="metric-label">Sync status</h3><p class="metric-value" id="simple-sync">Checking…</p><p class="dim" id="simple-sync-detail"></p></section>
      <section class="metric"><h3 class="metric-label">Paired apps</h3><p class="metric-value" id="simple-count">–</p><p class="dim" id="simple-connections"></p></section>
      <section class="metric"><h3 class="metric-label">Stored on this computer</h3><p class="metric-value" id="simple-storage">–</p><p class="dim">Copied app data. Disk use may be higher.</p></section>
    </div>
    <div class="simple-workspace">
      <div class="simple-list-column">
        <section aria-labelledby="simple-apps-title"><div class="section-heading"><h2 id="simple-apps-title">App connections</h2><button class="btn-ghost" id="simple-pause-all" type="button" disabled>Pause sync</button></div><div class="simple-columns" aria-hidden="true"><span>Application</span><span>Copy status</span></div><div id="simple-apps" class="simple-apps"></div></section>
        <section id="simple-activity" class="recent-activity" aria-labelledby="simple-activity-title"><div class="section-heading"><h2 id="simple-activity-title">Recent activity</h2><button class="btn-ghost" id="simple-event-log" type="button">Full event log</button></div><div id="simple-events"><p class="dim">Activity will appear as your node runs.</p></div></section>
      </div>
      <aside class="card simple-inspector" aria-label="Selected app details">
        <div id="simple-inspector"></div>
        <form id="simple-limit-form" hidden>
          <h3 id="simple-limit-title">App storage limit</h3>
          <label class="field">Maximum copied data<input id="simple-limit-value" placeholder="500 MB or 5 GB" aria-describedby="simple-limit-help simple-limit-error"></label>
          <p class="dim" id="simple-limit-help">Leave blank to use the default. Lowering the limit pauses new copies when needed; it does not delete existing data.</p>
          <p id="simple-limit-error" role="alert"></p>
          <div class="simple-actions"><button type="submit" class="btn btn-approve">Save limit</button><button type="button" class="btn-ghost" id="simple-limit-cancel">Cancel</button></div>
        </form>
      </aside>
    </div>
    <section class="simple-ai-strip"><span>${icon('ai')}<strong>Local AI</strong><span id="simple-ai">Checking…</span></span><button class="btn-ghost" id="simple-ai-settings" type="button">AI settings in Advanced</button></section>
    <p class="dim simple-note">A copy covers the last shared version, not future edits. Keep Personal Node open to receive new data. Full backup and recovery are not yet available.</p>`
  const find = id => element.querySelector(`#${id}`)
  find('simple-connect').addEventListener('click', () => {
    if (!running || pendingInvite) return
    pendingInvite = true
    find('simple-connect').disabled = true
    find('simple-message').textContent = 'Creating your code…'
    send({ type: 'create-invite', uses: 1, expiresIn: 15 * 60_000,
      grants: { sync: ['manifest.replace', 'status', 'usage', 'pause', 'resume'] } })
  })
  find('simple-ai-settings').addEventListener('click', () => advanced('ai'))
  find('simple-event-log').addEventListener('click', () => {
    advanced('config')
    document.getElementById('log-filter')?.focus()
  })
  find('simple-code').addEventListener('focus', event => event.target.select())
  find('simple-pause-all').addEventListener('click', () => {
    if (!running) return
    const apps = simpleHomeModel(status).apps.filter(app => app.hasData)
    const resume = apps.length > 0 && apps.every(app => app.allPaused)
    for (const app of apps) send(resume ? commands.resumePeer(app.publicKey) : commands.pausePeer(app.publicKey))
  })
  function closeLimit(restoreFocus = true) {
    find('simple-limit-form').hidden = true
    limitKey = null
    if (restoreFocus) find('simple-inspector').querySelector('[data-simple-action="limit"]')?.focus()
  }
  find('simple-limit-cancel').addEventListener('click', () => closeLimit())
  find('simple-limit-form').addEventListener('submit', event => {
    event.preventDefault()
    if (!running || !limitKey || !simpleHomeModel(status).apps.some(app => app.publicKey === limitKey)) return
    const value = find('simple-limit-value').value.trim()
    const bytes = value ? parseByteAmount(value) : null
    if (value && bytes === null) {
      find('simple-limit-error').textContent = 'Enter a size such as 500 MB or 5 GB.'
      return
    }
    send(commands.setPeerQuota(limitKey, bytes))
    closeLimit()
  })
  element.addEventListener('click', event => {
    const select = event.target.closest('[data-select-app]')
    if (select) {
      selectedKey = select.dataset.selectApp
      closeLimit(false)
      render()
      return
    }
    const button = event.target.closest('button[data-simple-action]')
    if (!button || !running) return
    const row = simpleHomeModel(status).apps.find(app => app.publicKey === button.dataset.key)
    if (!row) return
    switch (button.dataset.simpleAction) {
      case 'browse': browse(row.label, row.peekTargets); break
      case 'pause': send(commands.pausePeer(row.publicKey)); break
      case 'resume': send(commands.resumePeer(row.publicKey)); break
      case 'details': advanced('overview'); break
      case 'limit': {
        limitKey = row.publicKey
        find('simple-limit-title').textContent = `Storage limit for ${row.label}`
        find('simple-limit-value').value = row.quotaBytes == null ? '' : `${row.quotaBytes} B`
        find('simple-limit-error').textContent = ''
        find('simple-limit-form').hidden = false
        find('simple-limit-value').focus()
        break
      }
      case 'disconnect':
        if (confirm(`Disconnect ${row.label}? This installation will no longer be allowed to connect. Data already copied here will stay on this computer. This does not delete the app’s own data.`)) send(commands.unpair(row.publicKey, row.label))
        break
    }
  })
  // Replace only changed content and preserve the focused control across snapshots.
  function updateHtml(id, html, previous) {
    if (html === previous) return html
    const target = find(id)
    const focused = target.contains(document.activeElement) ? { ...document.activeElement.dataset } : null
    target.innerHTML = html
    if (focused) [...target.querySelectorAll('button')].find(button =>
      focused.selectApp ? button.dataset.selectApp === focused.selectApp
        : button.dataset.key === focused.key && button.dataset.simpleAction === focused.simpleAction)?.focus()
    return html
  }
  function render() {
    const model = simpleHomeModel(status)
    const row = model.apps.find(app => app.publicKey === selectedKey) || model.apps[0]
    selectedKey = row?.publicKey || null
    if (limitKey && limitKey !== selectedKey) closeLimit(false)
    const online = model.apps.filter(app => app.online).length
    const active = model.apps.filter(app => app.hasData)
    find('simple-title').textContent = section === 'saved' ? 'Saved app data' : section === 'apps' ? 'Connected apps' : 'Your personal cloud'
    find('simple-description').textContent = failure
      ? 'Personal Node needs to restart. Copying is unavailable; saved data has not been deleted.'
      : section === 'saved' ? 'Browse read-only copies of the data your apps have shared.'
        : 'App sync and storage, running on this computer.'
    find('simple-sync').textContent = failure ? 'Unavailable' : !running || !status ? 'Checking…' : !model.apps.length ? 'No apps yet' : model.needsAttention ? 'Needs attention' : model.apps.some(app => app.state === 'paused') ? 'Sync paused' : model.apps.every(app => app.state === 'copied') ? 'Copied here' : 'Copy pending'
    find('simple-sync-detail').textContent = model.title
    find('simple-count').textContent = status ? String(model.apps.length).padStart(2, '0') : '–'
    find('simple-connections').textContent = !running ? 'Connection unavailable' : `${online} online · ${model.apps.length - online} offline`
    find('simple-connect').disabled = !running || pendingInvite
    find('simple-ai-settings').disabled = !running
    find('simple-pause-all').disabled = !running || !active.length
    find('simple-pause-all').textContent = active.length && active.every(app => app.allPaused) ? 'Resume sync' : 'Pause sync'
    find('simple-limit-form').querySelector('[type="submit"]').disabled = !running
    find('simple-storage').textContent = formatBytes(model.bytes)
    find('simple-ai').textContent = !status ? 'Checking…' : model.ai.ready
      ? model.ai.mock ? 'Developer demo — no real AI model.' : 'On — available to apps you allow.'
      : model.ai.error ? 'Unavailable. Check AI settings in Advanced.' : 'Off. Copying data does not need AI.'
    element.dataset.section = section
    find('simple-apps-title').textContent = section === 'saved' ? 'Saved collections' : 'App connections'
    const html = model.apps.length ? model.apps.map(app => `<article class="simple-app" data-app-key="${escape(app.publicKey)}">
      <button class="simple-select" type="button" data-select-app="${escape(app.publicKey)}" aria-pressed="${app.publicKey === selectedKey}" aria-controls="simple-inspector">
        <span class="simple-app-identity"><span class="app-icon">${icon('app')}</span><span><span class="simple-app-name" role="heading" aria-level="3">${escape(app.label)}</span><span class="simple-connection">${!running ? 'Connection unavailable' : app.online ? 'Connected' : 'Not connected'}${app.deviceName ? ` · ${escape(app.deviceName)}` : ''}</span></span></span>
        <span class="simple-app-status"><span class="simple-copy-state" data-copy-state="${escape(app.state)}">${escape(app.title)}</span><span class="mono dim">${formatBytes(app.bytes)} copied</span></span>
      </button></article>`).join('') : '<div class="empty-state"><span class="app-icon">' + icon('apps') + '</span><h3>No apps connected yet</h3><p>Choose “Connect an app” to create a pairing code. Compatible apps can then share data with this computer.</p></div>'
    lastAppsHtml = updateHtml('simple-apps', html, lastAppsHtml)
    const action = (name, label, extra = '') => `<button type="button" class="btn-ghost ${extra}" data-simple-action="${name}" data-key="${escape(row.publicKey)}" ${running ? '' : 'disabled'}>${label}</button>`
    const inspector = row ? `<p class="eyebrow">Selected app</p><div class="inspector-heading"><span class="app-icon">${icon('app')}</span><div><h3>${escape(row.label)}</h3><p class="dim">${!running ? 'Connection unavailable' : row.online ? 'Connected now' : 'App offline'}</p></div></div>
      <p class="simple-copy-state" data-copy-state="${escape(row.state)}">${escape(row.title)}</p><p class="inspector-description">${escape(row.detail)}</p>
      <dl class="inspector-facts"><div><dt>Data on this computer</dt><dd class="mono">${formatBytes(row.bytes)} copied</dd></div><div><dt>Storage limit</dt><dd class="mono">${escape(row.quotaLabel)}</dd></div><div><dt>AI access</dt><dd>${row.aiGranted ? 'Allowed' : 'Not allowed'}</dd></div><div><dt>Shared resources</dt><dd class="mono">${row.cores.length + row.drives.length}</dd></div>${row.copiedAt ? `<div><dt>Last verified</dt><dd>${escape(new Date(row.copiedAt).toLocaleString())}</dd></div>` : ''}</dl>
      <p class="simple-permissions">${row.canShare ? 'Can copy shared data here.' : 'Cannot register shared data for copying.'} AI access: ${row.aiGranted ? 'allowed' : 'not allowed'}.</p>
      <div class="simple-actions">${row.peekTargets.length ? action('browse', 'Browse saved data', 'btn-ghost-accent') : ''}${row.hasData ? action(row.allPaused ? 'resume' : 'pause', row.allPaused ? 'Resume copying' : 'Pause copying') : ''}${action('limit', 'Storage limit')}${action('details', 'App details in Advanced')}${action('disconnect', 'Disconnect app', 'btn-danger')}</div>`
      : '<p class="eyebrow">App details</p><h3>Your apps, under your control.</h3><p class="inspector-description">Select a connected app to inspect its copy status, browse saved data, or manage its storage limit.</p>'
    lastInspectorHtml = updateHtml('simple-inspector', inspector, lastInspectorHtml)
  }
  render()
  return {
    section(value) { section = ['overview', 'apps', 'saved'].includes(value) ? value : 'overview'; render() },
    activity(entries) {
      const visible = entries.filter(entry => entry.kind !== 'dim').slice(-4).reverse()
      find('simple-events').innerHTML = visible.length ? visible.map(entry => `<div class="activity-entry"><span class="activity-dot ${entry.kind === 'err' ? 'activity-error' : ''}" aria-hidden="true"></span><span>${escape(entry.text)}</span><time class="mono">${escape(entry.time)}</time></div>`).join('') : '<p class="dim">Activity will appear as your node runs.</p>'
    },
    ready() { running = true; failure = null; render() },
    update(value) { status = value; if (!failure) running = true; render() },
    fail(error) { running = false; failure = error || true; render() },
    invite(message) {
      if (!pendingInvite) return
      pendingInvite = false
      find('simple-connect').disabled = !running
      if (message.type === 'invite-error') {
        find('simple-message').textContent = 'Could not create a code. Try again, or check Advanced.'
        return
      }
      inviteId = message.invite.id
      find('simple-code').value = message.invite.code
      find('simple-pairing').hidden = false
      find('simple-message').textContent = 'Select the code to copy it into your app.'
      find('simple-code').focus()
    },
    redeemed(message) {
      if (message.id !== inviteId) return
      find('simple-pairing').hidden = true
      find('simple-code').value = ''
      find('simple-message').textContent = 'App connected. Its shared data will appear below.'
    }
  }
}
