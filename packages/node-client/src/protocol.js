import b4a from 'b4a'
import crypto from 'hypercore-crypto'

export const PROTOCOL_VERSION = 'v1'

// Known service flags the client understands. The actual flags for a given
// node come from its `nodeHello` message — this list is only used for type
// hints and for validating `requireServices` option values.
export const KNOWN_SERVICES = Object.freeze(['data', 'files', 'ai'])

// Node has `os` + `process`, Bare has `bare-os` + `bare-env`. Prefer the
// Bare modules so a Pear app and a Node client on the same machine
// compute the same `localDiscoveryTopic()` hash (otherwise Bare would
// silently fall back to `'default'@'bare-runtime'` and never meet a real
// client on the DHT). Both are declared as optionalDependencies. Mobile
// clients on a different machine should pass an explicit `topic`.
async function _loadOs () {
  try { return await import('bare-os') } catch {}
  try { return await import('os') } catch {}
  return null
}
async function _loadEnv () {
  try {
    const m = await import('bare-env')
    return m.default || m
  } catch {}
  if (typeof process !== 'undefined' && process?.env) return process.env
  return null
}
const _os = await _loadOs()
const _env = await _loadEnv()

export function localDiscoveryTopic () {
  const user = _env?.USER || _env?.USERNAME || 'default'
  const host = _os && typeof _os.hostname === 'function' ? _os.hostname() : 'bare-runtime'
  const machineId = `${user}@${host}`
  // BLAKE2b-256 via hypercore-crypto. See the daemon's protocol.js for
  // why we don't use Node's built-in `crypto` here (Bare doesn't ship it).
  return crypto.hash(b4a.from(`unstoppable:node:local:${PROTOCOL_VERSION}:${machineId}`))
}

export function parseMessages (data) {
  try {
    const lines = b4a.toString(data).split('\n').filter(Boolean)
    return lines.map(line => JSON.parse(line))
  } catch {
    return []
  }
}

export function encodeMessage (msg) {
  return b4a.from(JSON.stringify(msg) + '\n')
}
