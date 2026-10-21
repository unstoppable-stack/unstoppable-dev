import { commands, escape, formatBytes, parseByteAmount } from './render.js'
import { simpleHomeModel } from './simple-model.js'

export function createSimpleHome({ element, send, advanced, browse }) {
  let status = null, running = false, failure = null, pendingInvite = false, inviteId = null, limitKey = null
  let lastAppsHtml = ''
  element.innerHTML = `
    <section class="card simple-intro">
      <p class="simple-eyebrow">Your apps, on your computer</p>
      <h2 id="simple-title">Starting Personal Node…</h2>
      <p id="simple-description">Checking that your shared data is available.</p>
      <button class="btn btn-approve" id="simple-connect" type="button" disabled>Connect an app</button>
      <div id="simple-pairing" hidden>
        <h3>Connect with a pairing code</h3>
        <p>Paste this code into the app you want to connect. It allows the app to copy its shared data here. Share it only with an app you trust.</p>
        <label class="field">Pairing code<input id="simple-code" readonly spellcheck="false" aria-describedby="simple-code-help"></label>
        <p id="simple-code-help">One use. Expires in 15 minutes. Connecting does not allow AI access.</p>
      </div>
      <p id="simple-message" role="status"></p>
    </section>
    <div class="simple-overview">
      <section class="card"><h3>Data on this computer</h3><p id="simple-storage"></p><p class="dim">Copied app data. Actual disk use may be higher.</p></section>
      <section class="card"><h3>AI on this computer</h3><p id="simple-ai"></p><button class="btn-ghost" id="simple-ai-settings" type="button">AI settings in Advanced</button></section>
    </div>
    <form id="simple-limit-form" class="card" hidden>
      <h3 id="simple-limit-title">App storage limit</h3>
      <label class="field">Maximum copied data<input id="simple-limit-value" placeholder="500 MB or 5 GB" aria-describedby="simple-limit-help simple-limit-error"></label>
      <p id="simple-limit-help">Leave blank to use the default. Lowering the limit pauses new copies when needed; it does not delete existing data.</p>
      <p id="simple-limit-error" role="alert"></p>
      <div class="simple-actions"><button type="submit" class="btn-ghost">Save limit</button><button type="button" class="btn-ghost" id="simple-limit-cancel">Cancel</button></div>
    </form>
    <section aria-labelledby="simple-apps-title"><h2 id="simple-apps-title">Your apps</h2><div id="simple-apps" class="simple-apps"></div></section>
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
  find('simple-code').addEventListener('focus', event => event.target.select())
  function closeLimit() {
    find('simple-limit-form').hidden = true
    const key = limitKey
    limitKey = null
    const buttons = [...find('simple-apps').querySelectorAll('[data-simple-action="limit"]')]
    buttons.find(button => button.dataset.key === key)?.focus()
  }
  find('simple-limit-cancel').addEventListener('click', closeLimit)
  find('simple-limit-form').addEventListener('submit', event => {
    event.preventDefault()
    if (!running || !limitKey) return
    const value = find('simple-limit-value').value.trim()
    const bytes = value ? parseByteAmount(value) : null
    if (value && bytes === null) {
      find('simple-limit-error').textContent = 'Enter a size such as 500 MB or 5 GB.'
      return
    }
    send(commands.setPeerQuota(limitKey, bytes))
    closeLimit()
  })
  find('simple-apps').addEventListener('click', event => {
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
  function render() {
    const model = simpleHomeModel(status)
    find('simple-title').textContent = failure ? 'Personal Node needs to restart' : running ? model.title : 'Starting Personal Node…'
    find('simple-description').textContent = failure
      ? 'Copying is unavailable. Close and restart Personal Node. Your saved data has not been deleted.'
      : !model.apps.length ? 'Connect an app to keep a copy of the data it chooses to share.'
        : 'See what is connected and what has been copied. You choose what this computer can do.'
    find('simple-connect').disabled = !running || pendingInvite
    find('simple-ai-settings').disabled = !running
    find('simple-limit-form').querySelector('[type="submit"]').disabled = !running
    find('simple-storage').textContent = `${formatBytes(model.bytes)} of copied app data`
    find('simple-ai').textContent = !status ? 'Checking…' : model.ai.ready
      ? model.ai.mock ? 'Developer demo is running — no real AI model.' : 'On — available to apps you allow.'
      : model.ai.error ? 'Unavailable. Check AI settings in Advanced.' : 'Off. Copying data does not need AI.'
    const html = model.apps.length ? model.apps.map(row => {
      const action = (name, label) => `<button type="button" class="btn-ghost" data-simple-action="${name}" data-key="${escape(row.publicKey)}" ${running ? '' : 'disabled'}>${label}</button>`
      return `<article class="card simple-app" data-app-key="${escape(row.publicKey)}">
        <div class="simple-app-heading"><h3>${escape(row.label)}</h3><span class="badge ${running && row.online ? 'badge-ok' : 'badge-neutral'}">${!running ? 'Connection unavailable' : row.online ? 'Connected' : 'Not connected'}</span></div>
        <p class="simple-copy-state" data-copy-state="${escape(row.state)}">${escape(row.title)}</p>
        <p>${escape(row.detail)}</p>
        ${row.copiedAt ? `<p class="dim">Last verified: ${escape(new Date(row.copiedAt).toLocaleString())}</p>` : ''}
        <p class="dim">${formatBytes(row.bytes)} copied · Storage limit: ${escape(row.quotaLabel)}</p>
        <p class="simple-permissions">${row.canShare ? 'Can copy shared data here.' : 'Cannot register shared data for copying.'} AI access: ${row.aiGranted ? 'allowed' : 'not allowed'}.</p>
        <div class="simple-actions">${row.peekTargets.length ? action('browse', 'Browse saved data') : ''}${row.hasData ? action(row.allPaused ? 'resume' : 'pause', row.allPaused ? 'Resume copying' : 'Pause copying') : ''}${action('limit', 'Storage limit')}${row.state === 'attention' ? action('details', 'Check in Advanced') : ''}${action('disconnect', 'Disconnect app')}</div>
      </article>`
    }).join('') : '<p class="card dim">No apps connected yet. Choose “Connect an app” to get started.</p>'
    const list = find('simple-apps')
    // Status updates should not remove keyboard focus or duplicate listeners.
    if (lastAppsHtml !== html) {
      lastAppsHtml = html
      const focused = list.contains(document.activeElement) ? { ...document.activeElement.dataset } : null
      list.innerHTML = html
      if (focused) [...list.querySelectorAll('button')].find(button => button.dataset.key === focused.key && button.dataset.simpleAction === focused.simpleAction)?.focus()
    }
  }
  render()
  return {
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
