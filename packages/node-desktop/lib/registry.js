// Persistent trust registry for the dashboard.
//
// Stores per-app pair decisions (approved + denied) as a single JSON
// file under the daemon's storage path. Decisions are keyed by the
// app's identity public key (hex string), not its `appId`, because
// `appId` is user-facing and could be re-used by a different app
// (and a malicious one). The public key is what the daemon
// cryptographically pairs against.
//
// File layout:
//
//   {
//     "version": 1,
//     "approved": {
//       "<publicKey-hex>": {
//         "appId": "notes-app",
//         "appName": "Notes",
//         "approvedAt": "2026-05-22T13:00:00.000Z",
//         "remember": true
//       }
//     },
//     "denied": {
//       "<publicKey-hex>": {
//         "appId": "shady",
//         "appName": "Shady",
//         "deniedAt": "2026-05-22T13:01:00.000Z",
//         "reason": "user denied"
//       }
//     }
//   }
//
// Bare-portable: prefers `bare-fs/promises`, falls back to Node's
// `fs/promises`. So unit tests run under Node while the dashboard
// worker runs under Bare without changes.

// `bare-fs/promises` resolves under Node (it's in node_modules via
// the Pear toolchain) but its functions throw "Bare is not defined"
// when actually called. Pick the runtime up front so unit tests
// running under Node don't get a half-loaded module.
async function _loadFs () {
  if (typeof globalThis.Bare !== 'undefined') {
    try {
      const m = await import('bare-fs/promises')
      return m.default || m
    } catch {}
  }
  try {
    const m = await import('fs/promises')
    return m
  } catch {}
  return null
}

const _fs = await _loadFs()
if (!_fs) throw new Error('No filesystem module available (bare-fs or fs/promises)')

const SCHEMA_VERSION = 1

function emptyRegistry () {
  return { version: SCHEMA_VERSION, approved: {}, denied: {} }
}

export async function loadRegistry (path) {
  try {
    const raw = await _fs.readFile(path, 'utf8')
    return validateRegistry(JSON.parse(raw))
  } catch (err) {
    if (err && (err.code === 'ENOENT' || err.code === 'ENOTDIR')) {
      return emptyRegistry()
    }
    throw err
  }
}

// Atomic write: stage to `<path>.tmp`, then rename. Avoids leaving a
// half-written registry if the worker is killed mid-save.
export async function saveRegistry (path, data) {
  const registry = validateRegistry(data)
  const payload = JSON.stringify({
    version: SCHEMA_VERSION,
    approved: registry.approved,
    denied: registry.denied
  }, null, 2)
  const tmp = `${path}.${Date.now()}-${Math.random().toString(16).slice(2)}.tmp`
  try {
    await _fs.writeFile(tmp, payload, { encoding: 'utf8', mode: 0o600, flag: 'wx' })
    await _fs.rename(tmp, path)
  } catch (error) {
    try { await _fs.unlink(tmp) } catch {}
    throw error
  }
  return registry
}

export function validateRegistry (input) {
  if (!isPlainObject(input)) throw new Error('Trust registry must be an object')
  const version = input.version == null ? SCHEMA_VERSION : input.version
  if (version !== SCHEMA_VERSION) throw new Error(`Unsupported trust registry version: ${version}`)
  const approved = validateEntries(input.approved, 'approved')
  const denied = validateEntries(input.denied, 'denied')
  for (const publicKey of Object.keys(approved)) {
    if (Object.hasOwn(denied, publicKey)) throw new Error(`Trust key cannot be both approved and denied: ${publicKey}`)
  }
  return { version: SCHEMA_VERSION, approved, denied }
}

function validateEntries (entries, field) {
  if (entries == null) return {}
  if (!isPlainObject(entries)) throw new Error(`Trust registry ${field} entries must be an object`)
  const keys = Object.keys(entries)
  if (keys.length > 10_000) throw new Error(`Trust registry contains too many ${field} entries`)
  const result = {}
  for (const publicKey of keys) {
    if (!/^[A-Za-z0-9_-]{1,256}$/.test(publicKey) || ['__proto__', 'prototype', 'constructor'].includes(publicKey)) {
      throw new Error(`Trust registry contains an invalid public key: ${publicKey}`)
    }
    if (!isPlainObject(entries[publicKey])) throw new Error(`Trust registry entry ${publicKey} must be an object`)
    result[publicKey] = JSON.parse(JSON.stringify(entries[publicKey]))
  }
  return result
}

function isPlainObject (value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

export async function recordApproval (path, publicKey, info) {
  const reg = await loadRegistry(path)
  delete reg.denied[publicKey]
  reg.approved[publicKey] = {
    appId: info.appId,
    appName: info.appName,
    approvedAt: new Date().toISOString(),
    remember: info.remember !== false
  }
  await saveRegistry(path, reg)
  return reg
}

export async function recordDenial (path, publicKey, info) {
  const reg = await loadRegistry(path)
  delete reg.approved[publicKey]
  reg.denied[publicKey] = {
    appId: info.appId,
    appName: info.appName,
    deniedAt: new Date().toISOString(),
    reason: info.reason || 'denied'
  }
  await saveRegistry(path, reg)
  return reg
}

// Used by the Unpair / Revoke path. Removes any approval and writes a
// denial entry so the same key can't silently re-pair later.
export async function revoke (path, publicKey, info = {}) {
  return recordDenial(path, publicKey, {
    appId: info.appId,
    appName: info.appName,
    reason: info.reason || 'revoked by user'
  })
}

export function decisionFor (registry, publicKey) {
  if (registry.denied[publicKey]) return { decision: 'deny', entry: registry.denied[publicKey] }
  if (registry.approved[publicKey]) return { decision: 'approve', entry: registry.approved[publicKey] }
  return { decision: 'unknown', entry: null }
}
