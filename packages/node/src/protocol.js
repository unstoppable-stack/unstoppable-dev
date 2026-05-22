import b4a from 'b4a'
import crypto from 'hypercore-crypto'

export const PROTOCOL_VERSION = 'v1'

// Which services the Node currently implements. When a service flips from
// false -> true (e.g. `ai` once the QVAC provider is wired in), only this
// constant needs to change — clients use these flags to decide whether they
// can rely on a given capability on this peer.
export const DEFAULT_SERVICES = Object.freeze({
  data: true,
  files: true,
  ai: false
})

// `os` and `process` aren't available in Bare by default — `bare-os` and
// `bare-env` are separate modules. Load both lazily, preferring the Bare
// variants, so a Pear Desktop worker and a Node.js client on the same
// machine compute the same `localDiscoveryTopic()` hash. Without this,
// Bare would silently fall back to `'default'@'bare-runtime'` and miss
// every real client on the DHT. Both are declared as optional
// dependencies: present transitively in Pear apps, absent in pure-Node
// installs (where Node's globals/builtins pick up).
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
  // BLAKE2b-256 via hypercore-crypto (Bare-portable, same in Node and
  // Pear). Node's built-in `crypto` is unavailable in Bare; this is the
  // canonical Holepunch-ecosystem hashing primitive and Hypercore is a
  // dep anyway. The output is still 32 bytes — a valid Hyperswarm topic.
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
