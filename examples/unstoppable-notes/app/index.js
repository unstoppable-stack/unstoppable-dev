import { ready, request, watch } from './bridge.js'

const $ = (selector) => document.querySelector(selector)
let state,
  selected = null,
  filter = 'all',
  dirty = false,
  saving = false,
  unavailable = false,
  invitationExpiry
const key = (note) => `${note.owner}:${note.id}`
const device = (owner) => `Desktop · ${owner.slice(0, 6)}`
const date = (value) =>
  new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
function notice(text, error = false) {
  const message = document.createElement('span')
  message.textContent = text
  const dismiss = document.createElement('button')
  dismiss.type = 'button'
  dismiss.textContent = '×'
  dismiss.setAttribute('aria-label', 'Dismiss notification')
  dismiss.onclick = () => notice('')
  $('#notice').replaceChildren(message, dismiss)
  $('#notice').hidden = !text
  $('#notice').setAttribute('role', error ? 'alert' : 'status')
}
function navigate(page) {
  $('#notes-page').hidden = page !== 'notes'
  $('#devices-page').hidden = page !== 'devices'
  for (const name of ['notes', 'devices']) {
    if (name === page) $(`#nav-${name}`).setAttribute('aria-current', 'page')
    else $(`#nav-${name}`).removeAttribute('aria-current')
  }
  $('#page-label').textContent =
    page === 'notes' ? 'Your library' : 'Device sync'
}
function canLeave() {
  return !dirty || window.confirm('Discard your unsaved changes?')
}
function open(note, force = false) {
  if (saving && !force) return
  if (!force && !canLeave()) return
  dirty = false
  selected = note ? key(note) : 'draft'
  navigate('notes')
  $('#empty-reader').hidden = true
  $('#editor').hidden = !!note && !note.local
  $('#received-reader').hidden = !note || note.local
  if (!note || note.local) {
    $('#note-title').value = note?.title || ''
    $('#note-text').value = note?.text || ''
    $('#editor-date').textContent = note ? date(note.updatedAt) : 'New note'
    $('#draft-status').textContent = note
      ? 'Saved on this desktop'
      : 'Unsaved note'
    $('#save-note').textContent = note ? 'Save changes' : 'Save note'
    $('#save-note').disabled = !!note
    if (!note) $('#note-title').focus()
  } else {
    $('#received-title').textContent = note.title
    $('#received-text').textContent = note.text
    $('#received-origin').textContent = `From ${device(note.owner)}`
    $('#received-check').textContent =
      `Copy checked ${date(note.checkedAt)}. Use Devices → Sync notes to check for updates.`
  }
  renderList()
}
function renderList() {
  if (!state) return
  const query = $('#search').value.trim().toLocaleLowerCase()
  const notes = state.notes.filter(
    (note) =>
      (filter === 'all' || (filter === 'local' ? note.local : !note.local)) &&
      `${note.title}\n${note.text}`.toLocaleLowerCase().includes(query),
  )
  const list = $('#note-list')
  const focusedKey = list.contains(document.activeElement)
    ? document.activeElement.dataset.key
    : null
  list.replaceChildren()
  if (!notes.length) {
    const empty = document.createElement('p')
    empty.className = 'list-empty'
    empty.textContent = query
      ? 'No matching notes. Try another word.'
      : filter === 'received'
        ? 'Pair a desktop to bring its notes here.'
        : 'A fresh page. Your notes will appear here.'
    list.append(empty)
  }
  for (const note of notes) {
    const button = document.createElement('button')
    button.className = 'note-item'
    button.setAttribute('aria-pressed', String(key(note) === selected))
    button.dataset.key = key(note)
    const title = document.createElement('strong')
    title.textContent = note.title
    const preview = document.createElement('span')
    preview.className = 'note-preview'
    preview.textContent = note.text.replace(/\s+/g, ' ').slice(0, 110)
    const meta = document.createElement('span')
    meta.className = 'note-item-meta'
    meta.textContent = `${new Date(note.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}  ·  ${note.local ? 'This desktop' : device(note.owner)}`
    button.append(title, preview, meta)
    button.onclick = () => open(note)
    list.append(button)
    if (key(note) === focusedKey) button.focus({ preventScroll: true })
  }
}
function renderDevices() {
  const list = $('#device-list')
  list.replaceChildren()
  if (!state.peers.length) {
    const empty = document.createElement('p')
    empty.className = 'device-empty'
    empty.textContent =
      'Just this desktop for now. Add another to exchange notes.'
    list.append(empty)
  }
  for (const peer of state.peers) {
    const row = document.createElement('div')
    row.className = 'device-row'
    const badge = document.createElement('span')
    badge.className = 'device-icon'
    badge.textContent = '▣'
    badge.setAttribute('aria-hidden', 'true')
    const info = document.createElement('div')
    const name = document.createElement('strong')
    name.textContent = device(peer.publicKey)
    const check = document.createElement('span')
    check.textContent = peer.checkedAt
      ? `${peer.receivedCount} copies · checked ${date(peer.checkedAt)}`
      : 'Paired · no received snapshot yet'
    info.append(name, check)
    const status = document.createElement('span')
    status.className = 'connection'
    status.textContent = peer.connected ? 'Connected' : 'Not connected'
    row.append(badge, info, status)
    list.append(row)
  }
  $('#device-operation').textContent = state.busy
    ? `${state.busy}… Local notes remain available.`
    : 'Sync runs when you choose it. A connection alone does not mean notes are up to date.'
  $('#cancel-operation').hidden = !state.busy
  for (const id of ['sync-notes', 'create-code', 'pair-device'])
    $(`#${id}`).disabled = !!state.busy
  $('#sync-notes').disabled ||= !state.peers.length
  $('#identity').textContent =
    `${device(state.publicKey)} · ${state.notes.filter((note) => note.local).length} original notes`
  updateInvitation()
}
function updateInvitation() {
  if (invitationExpiry) {
    const expired = Date.now() > Date.parse(invitationExpiry)
    $('#invitation-expiry').textContent = expired
      ? 'Code expired. Create a new code.'
      : `One use · expires ${date(invitationExpiry)}. Share privately with your other desktop.`
    $('#copy-code').disabled = expired
  }
}
function update(next) {
  if (next.fatal) {
    unavailable = true
    notice(next.fatal, true)
    $('#storage-status').textContent = 'Storage unavailable'
    for (const id of [
      'new-note',
      'first-note',
      'save-note',
      'sync-notes',
      'create-code',
      'pair-device',
    ])
      $(`#${id}`).disabled = true
    return
  }
  state = next
  if (invitationExpiry && !state.invitationActive) {
    invitationExpiry = null
    $('#invitation').hidden = true
    $('#pairing-code').value = ''
    if ($('#notice').textContent.startsWith('Pairing code ready'))
      notice(
        'Pairing code used. Notes appear when the device exchange finishes.',
      )
  }
  if (
    $('#notice').textContent.startsWith('Pairing code used') &&
    state.peers.some((peer) => peer.checkedAt)
  ) {
    notice(
      'Received notebook saved on this desktop. Use Devices to check for later changes.',
    )
  }
  $('#storage-status').textContent = 'Saved on this desktop'
  $('#note-count').textContent = state.notes.length
  $('#device-count').textContent = state.peers.length
  renderList()
  renderDevices()
  // A remote update never replaces an unsaved original draft or steals focus.
  const note = state.notes.find((note) => key(note) === selected)
  if (note && !note.local && !$('#received-reader').hidden) {
    $('#received-title').textContent = note.title
    $('#received-text').textContent = note.text
    $('#received-check').textContent =
      `Copy checked ${date(note.checkedAt)}. Use Devices → Sync notes to check for updates.`
  }
}
async function deviceAction(action, value) {
  notice('')
  try {
    const result = await request(action, value)
    if (action === 'invite') {
      $('#invitation').hidden = false
      $('#pairing-code').value = result.code
      invitationExpiry = result.expiresAt
      renderDevices()
      notice('Pairing code ready. Share it privately with your other desktop.')
    } else {
      if (action === 'pair') $('#pair-input').value = ''
      notice(
        result.failed.length
          ? `Exchanged notes with ${result.checked} desktop. ${result.failed.length} desktop did not answer; try again when it is online.`
          : `Saved notebook copies exchanged with ${result.checked} desktop${result.checked === 1 ? '' : 's'}.`,
      )
    }
  } catch (error) {
    notice(error.message, true)
  }
}
$('#nav-notes').onclick = () => navigate('notes')
$('#nav-devices').onclick = () => navigate('devices')
$('#new-note').onclick = $('#first-note').onclick = () => open(null)
$('#search').oninput = renderList
for (const button of document.querySelectorAll('[data-filter]'))
  button.onclick = () => {
    filter = button.dataset.filter
    for (const item of document.querySelectorAll('[data-filter]'))
      item.setAttribute('aria-pressed', String(item === button))
    renderList()
  }
for (const input of [$('#note-title'), $('#note-text')])
  input.oninput = () => {
    dirty = true
    $('#draft-status').textContent = 'Unsaved changes'
    $('#save-note').disabled = saving
  }
$('#editor').onsubmit = async (event) => {
  event.preventDefault()
  if (saving) return
  saving = true
  $('#save-note').disabled = true
  $('#draft-status').textContent = 'Saving note…'
  for (const id of ['new-note', 'first-note', 'nav-devices'])
    $(`#${id}`).disabled = true
  $('#note-title').readOnly = $('#note-text').readOnly = true
  try {
    const original = state.notes.find((note) => key(note) === selected)
    const note = await request('save', {
      id: original?.id,
      title: $('#note-title').value,
      text: $('#note-text').value,
    })
    dirty = false
    update(await request('state'))
    open(
      state.notes.find((item) => item.local && item.id === note.id),
      true,
    )
    notice(
      'Saved on this desktop. Use Devices to exchange it with your paired desktops.',
    )
  } catch (error) {
    notice(error.message, true)
  } finally {
    saving = false
    $('#save-note').disabled = !dirty
    for (const id of ['new-note', 'first-note', 'nav-devices'])
      $(`#${id}`).disabled = unavailable
    $('#note-title').readOnly = $('#note-text').readOnly = unavailable
    if (dirty) $('#draft-status').textContent = 'Unsaved changes'
  }
}
$('#create-code').onclick = () => deviceAction('invite')
$('#sync-notes').onclick = () => deviceAction('sync')
$('#pair-form').onsubmit = (event) => {
  event.preventDefault()
  deviceAction('pair', $('#pair-input').value)
}
$('#cancel-operation').onclick = () =>
  request('cancel').catch((error) => notice(error.message, true))
$('#copy-code').onclick = async () => {
  try {
    await navigator.clipboard.writeText($('#pairing-code').value)
    notice('Pairing code copied. Paste it on your other trusted desktop.')
  } catch {
    $('#pairing-code').select()
    notice('Select and copy the pairing code using your keyboard.')
  }
}
document.addEventListener('keydown', (event) => {
  if (!(event.metaKey || event.ctrlKey) || !state) return
  if (event.key.toLowerCase() === 'n') {
    event.preventDefault()
    open(null)
  }
  if (
    event.key.toLowerCase() === 's' &&
    !$('#editor').hidden &&
    !$('#save-note').disabled
  ) {
    event.preventDefault()
    $('#editor').requestSubmit()
  }
  if (event.key.toLowerCase() === 'f') {
    event.preventDefault()
    navigate('notes')
    $('#search').focus()
  }
})
watch(update)
setInterval(updateInvitation, 1000)
try {
  update(await ready)
  $('#new-note').disabled = $('#first-note').disabled = false
  if (state.notes.length) open(state.notes[0], true)
} catch (error) {
  notice(error.message, true)
  $('#storage-status').textContent = 'Storage unavailable'
}
