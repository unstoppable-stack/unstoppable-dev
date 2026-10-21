// View-model layer for the dashboard.
//
// Everything here is a pure function over the status snapshot the worker
// sends: no DOM, no imports from the Pear/Electron bridge. `index.js` turns
// these into HTML.
//
// The split exists because this is where the meaning lives — which peer owns
// which core, what a peer is allowed to call, whether an invite is still
// good — and that is what re-keying the registry from appId to public key
// actually changed. The HTML around it is comparatively hard to get wrong.

export function escape (s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[c])
}

export function short (hex) {
  if (typeof hex !== 'string') return ''
  return hex.length > 16 ? `${hex.slice(0, 8)}…${hex.slice(-4)}` : hex
}

export function formatBytes (n) {
  if (!Number.isFinite(n) || n <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let i = 0
  let v = n
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++ }
  return `${v < 10 && i > 0 ? v.toFixed(1) : Math.round(v)} ${units[i]}`
}

// Grants are `{ capability: [method] }`. Peers see plain language, not the
// wire names.
export function formatCapabilitySummary (capabilities) {
  if (!capabilities || typeof capabilities !== 'object') return ''
  const labels = {
    'sync:manifest.replace': 'protect its app data',
    'sync:status': 'view its own protection status',
    'sync:usage': 'view its own storage use',
    'sync:pause': 'pause its own protection',
    'sync:resume': 'resume its own protection',
    'sync:peek.core': 'inspect its own protected data',
    'sync:peek.drive': 'inspect its own protected files',
    'ai:completion.stream': 'use AI on this computer'
  }
  const parts = []
  for (const [name, methods] of Object.entries(capabilities)) {
    const list = Array.isArray(methods) ? methods : []
    for (const method of list) parts.push(labels[`${name}:${method}`] || `${name}: ${method}`)
  }
  return parts.join(', ')
}

export function formatLastActivity (units, now = Date.now()) {
  const latest = units.reduce((value, unit) => {
    const source = unit.lastSync || unit.updatedAt || ''
    const timestamp = typeof source === 'number' ? source : Date.parse(source)
    return Number.isFinite(timestamp) ? Math.max(value, timestamp) : value
  }, 0)
  if (!latest) return 'waiting for first sync'
  const seconds = Math.max(0, Math.round((now - latest) / 1000))
  if (seconds < 60) return 'active just now'
  if (seconds < 3600) return `active ${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `active ${Math.floor(seconds / 3600)}h ago`
  return `active ${Math.floor(seconds / 86400)}d ago`
}

export function parseByteAmount (value) {
  const match = String(value).trim().match(/^(\d+(?:\.\d+)?)\s*(b|kb|mb|gb|tb)?$/i)
  if (!match) return null
  const units = { b: 1, kb: 1024, mb: 1024 ** 2, gb: 1024 ** 3, tb: 1024 ** 4 }
  const amount = Number(match[1]) * units[(match[2] || 'b').toLowerCase()]
  return Number.isSafeInteger(amount) && amount >= 0 ? amount : null
}

// A peer's display name. appId is a label now, not an identity — two devices
// running one app share it — so the public key is the fallback.
export function peerLabel (peer) {
  return peer.appName || peer.appId || short(peer.publicKey)
}

// One row per paired peer, with its own resources attached. Cores and drives
// carry `owner` (a public key), which is what makes this correct when two
// devices run the same app.
export function peerRows (status, now = Date.now()) {
  const peers = status?.peers || []
  const approved = status?.trust?.approved || {}
  const perOwner = status?.storage?.perOwner || {}
  const quotas = status?.storage?.quotas?.perPeer || {}

  return peers.map((peer) => {
    const cores = (status.cores || []).filter((c) => c.owner === peer.publicKey)
    const drives = (status.drives || []).filter((d) => d.owner === peer.publicKey)
    const units = [...cores, ...drives]
    const quota = quotas[peer.publicKey] || null

    return {
      publicKey: peer.publicKey,
      label: peerLabel(peer),
      appId: peer.appId || null,
      deviceName: peer.deviceName || null,
      online: !!peer.online,
      trusted: !!approved[peer.publicKey],
      invited: peer.pairingMethod === 'invite',
      cores,
      drives,
      entries: cores.reduce((sum, c) => sum + (c.length || 0), 0),
      connections: cores.reduce((sum, c) => sum + (c.peers || 0), 0),
      bytes: perOwner[peer.publicKey] || 0,
      allPaused: units.length > 0 && units.every((u) => u.paused),
      hasData: units.length > 0,
      activity: units.length === 0 ? 'no data registered' : formatLastActivity(units, now),
      quotaBytes: peer.quotaBytes ?? null,
      quotaLabel: quotaLabelFor(peer, quota),
      quotaExceeded: !!quota?.exceeded,
      grants: peer.grantsGiven || null,
      grantSummary: formatCapabilitySummary(peer.grantsGiven),
      aiGranted: (peer.grantsGiven?.ai || []).includes('completion.stream'),
      state: peerReplicationState(units),
      peekTargets: [
        ...cores.map((c) => ({ kind: 'core', key: c.key, name: c.name, type: c.type })),
        ...drives.map((d) => ({ kind: 'drive', key: d.key, name: d.name }))
      ]
    }
  })
}

function peerReplicationState (units) {
  if (units.length === 0) return 'empty'
  if (units.every((unit) => unit.paused)) return 'paused'

  const active = units.filter((unit) => !unit.paused)
  if (active.some((unit) => unit.protection?.state === 'error')) return 'error'
  if (active.every((unit) =>
    unit.protection?.mode === 'mirror' && unit.protection?.state === 'protected'
  )) return 'protected'
  if (active.some((unit) => unit.protection?.state === 'syncing')) return 'copying'
  return 'pending'
}

function quotaLabelFor (peer, quota) {
  if (peer.quotaBytes !== null && peer.quotaBytes !== undefined) return formatBytes(peer.quotaBytes)
  if (quota?.limit !== null && quota?.limit !== undefined) return `${formatBytes(quota.limit)} default`
  return 'unlimited'
}

export function storageRows (status) {
  const perOwner = status?.storage?.perOwner || {}
  const quotas = status?.storage?.quotas?.perPeer || {}
  return (status?.peers || []).map((peer) => {
    const quota = quotas[peer.publicKey] || null
    return {
      publicKey: peer.publicKey,
      label: peerLabel(peer),
      deviceName: peer.deviceName || 'This app',
      bytes: perOwner[peer.publicKey] || 0,
      limit: quota?.limit ?? null,
      exceeded: !!quota?.exceeded
    }
  })
}

// Capabilities are always advertised; what varies is whether the AI provider
// has a model loaded. The 0.5 `services` flags conflated the two, so a node
// whose model failed to load looked like it had no AI capability at all.
export function capabilityPills (status) {
  const capabilities = status?.capabilities || {}
  const aiReady = !!status?.ai?.ready
  const pills = []
  if (capabilities.sync) pills.push({ label: 'Data & files ready', on: true })
  if (capabilities.ai) pills.push({ label: aiReady ? 'AI ready' : 'AI off', on: aiReady })
  return pills
}

export function inviteRows (status) {
  return (status?.invites || []).map((invite) => ({
    id: invite.id,
    label: invite.label || 'Pairing code',
    uses: invite.uses === null
      ? 'unlimited'
      : `${Math.max(0, invite.uses - invite.used)} of ${invite.uses} left`,
    expiry: invite.expiresAt ? new Date(invite.expiresAt).toLocaleString() : 'never expires'
  }))
}

export function summaryCounts (status) {
  return {
    peers: status?.peers?.length ?? 0,
    cores: status?.cores?.length ?? 0,
    drives: status?.drives?.length ?? 0,
    connected: status?.connectedPeers ?? 0,
    bytes: status?.storage?.total ?? 0
  }
}

// Command payloads the renderer sends to the worker. Kept here so the wire
// names and their identifiers are covered by tests: a typo in a command type
// is silently dropped by the main process allowlist.
export const commands = {
  unpair: (publicKey, appName) => ({ type: 'unpair', publicKey, appName }),
  pausePeer: (publicKey) => ({ type: 'pause-peer', publicKey }),
  resumePeer: (publicKey) => ({ type: 'resume-peer', publicKey }),
  setPeerQuota: (publicKey, quotaBytes) => ({ type: 'set-peer-quota', publicKey, quotaBytes }),
  setPeerGrant: (publicKey, capability, methods) => ({ type: 'set-peer-grant', publicKey, capability, methods }),
  createInvite: ({ expiresIn, uses }) => ({ type: 'create-invite', expiresIn, uses }),
  revokeInvite: (id) => ({ type: 'revoke-invite', id }),
  promoteTrust: (publicKey, appName) => ({ type: 'promote-trust', publicKey, appName })
}
