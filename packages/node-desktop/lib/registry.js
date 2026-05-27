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
    const parsed = JSON.parse(raw)
    return {
      version: parsed.version || SCHEMA_VERSION,
      approved: parsed.approved || {},
      denied: parsed.denied || {}
    }
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
  const payload = JSON.stringify({
    version: SCHEMA_VERSION,
    approved: data.approved || {},
    denied: data.denied || {}
  }, null, 2)
  const tmp = `${path}.tmp`
  await _fs.writeFile(tmp, payload, 'utf8')
  await _fs.rename(tmp, path)
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
