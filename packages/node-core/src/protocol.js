import b4a from 'b4a'
import crypto from 'hypercore-crypto'

// Wire protocol v2. There is no v1 compatibility path: the 0.5 line was
// published but never announced, and every consumer is in this repo.
export const PROTOCOL_VERSION = 2

// Protomux channel carrying control traffic. Replication and any pack-owned
// binary channels ride the same muxer on the same connection.
export const CONTROL_PROTOCOL = 'unstoppable/control/v2'

export const MESSAGE = Object.freeze({
  HELLO: 'hello',
  PAIR_REQUEST: 'pairRequest',
  PAIR_ACCEPTED: 'pairAccepted',
  PAIR_CONFIRM: 'pairConfirm',
  PAIR_DENIED: 'pairDenied',
  CALL: 'call',
  RESULT: 'result',
  CHUNK: 'chunk',
  END: 'end',
  ERROR: 'error',
  CANCEL: 'cancel'
})

export const NODE_TYPES = Object.freeze({
  APP: 'app',
  PERSONAL_NODE: 'personal-node'
})

export const ROLES = Object.freeze({
  HOST: 'host',
  CLIENT: 'client'
})

// `os` and `process` aren't available in Bare by default — `bare-os` and
// `bare-env` are separate modules. Load both lazily, preferring the Bare
// variants, so a Pear Desktop worker and a Node.js process on the same
// machine compute the same `localDiscoveryTopic()` hash. Without this, Bare
// would silently fall back to `'default'@'bare-runtime'` and miss every real
// peer on the DHT. Both are optional dependencies: present transitively in
// Pear apps, absent in pure-Node installs (where Node's globals pick up).
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

// Machine-scoped topic: finds the Personal Node on this box. Cross-device and
// app-to-app first contact go through invites instead, and every reconnect
// after pairing goes direct by public key.
export function localDiscoveryTopic () {
  if (_env?.UNSTOPPABLE_NODE_TOPIC) return b4a.from(_env.UNSTOPPABLE_NODE_TOPIC, 'hex')
  const user = _env?.USER || _env?.USERNAME || 'default'
  const host = _os && typeof _os.hostname === 'function' ? _os.hostname() : 'bare-runtime'
  const machineId = `${user}@${host}`
  // BLAKE2b-256 via hypercore-crypto: Bare-portable, identical in Node and
  // Pear, and still a valid 32-byte Hyperswarm topic. Node's built-in
  // `crypto` is unavailable in Bare.
  return crypto.hash(b4a.from(`unstoppable:node:local:v${PROTOCOL_VERSION}:${machineId}`))
}

// Topic for a named app network: every instance of an app that wants to find
// its siblings joins the same one. Unlike an invite secret this is derived
// from a guessable name, so anyone who knows the app can join — the grants a
// network hands out are the security boundary, not the topic.
export function networkTopic (id) {
  if (typeof id !== 'string' || !id.trim()) {
    throw new Error('Network id must be a non-empty string')
  }
  return crypto.hash(b4a.from(`unstoppable:app:${id}:v${PROTOCOL_VERSION}`))
}

export function toPublicKeyBuffer (key) {
  if (b4a.isBuffer(key)) return key
  if (key instanceof Uint8Array) return b4a.from(key)
  if (typeof key === 'string' && /^[0-9a-fA-F]{64}$/.test(key)) return b4a.from(key, 'hex')
  return null
}

export function toPublicKeyHex (key) {
  if (typeof key === 'string') return key.toLowerCase()
  return b4a.toString(key, 'hex')
}
