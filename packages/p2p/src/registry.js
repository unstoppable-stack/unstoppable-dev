import { atomicWriteFile, runtimeFs, runtimePath } from './runtime-files.js'
import { toPublicKeyHex } from './protocol.js'

export const PEERS_FILE = 'peers.json'
export const PEERS_VERSION = 1

// Peers are keyed by public key, not by appId. Two devices running the same
// app are two peers; the 0.5 registry collided them and papered over it with a
// `deviceName` field.
//
// Plain JSON rather than a Hyperbee: keeping core free of the storage stack is
// the point of the split, and a peer list is small, flat, and read at boot.
export class PeerRegistry {
  constructor (storagePath) {
    this.file = runtimePath.join(storagePath, PEERS_FILE)
    this.peers = new Map()
    this._ready = false
    this._writing = Promise.resolve()
  }

  async ready () {
    if (this._ready) return
    try {
      const parsed = JSON.parse(await runtimeFs.readFile(this.file, 'utf8'))
      if (parsed?.version === PEERS_VERSION && parsed.peers && typeof parsed.peers === 'object') {
        for (const [key, record] of Object.entries(parsed.peers)) {
          if (isValidRecord(key, record)) this.peers.set(key, record)
        }
      }
    } catch (err) {
      if (err.code !== 'ENOENT') throw err
    }
    this._ready = true
  }

  async put ({ publicKey, appId, appName, deviceName, nodeType, grantsGiven, grantsReceived, pairingMethod, inviteId, network, policy }) {
    const key = toPublicKeyHex(publicKey)
    const existing = this.peers.get(key) || null
    const record = {
      publicKey: key,
      appId: appId ?? existing?.appId ?? null,
      appName: appName ?? existing?.appName ?? null,
      deviceName: deviceName ?? existing?.deviceName ?? null,
      nodeType: nodeType ?? existing?.nodeType ?? null,
      grantsGiven: grantsGiven ?? existing?.grantsGiven ?? null,
      grantsReceived: grantsReceived ?? existing?.grantsReceived ?? null,
      pairingMethod: pairingMethod ?? existing?.pairingMethod ?? 'direct',
      inviteId: inviteId ?? existing?.inviteId ?? null,
      network: network ?? existing?.network ?? null,
      // Free-form, owned by whoever composes the node. The Personal Node
      // shell keeps per-peer quotas here; core never interprets it.
      policy: policy ?? existing?.policy ?? {},
      pairedAt: existing?.pairedAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
    this.peers.set(key, record)
    await this._flush()
    return record
  }

  get (publicKey) {
    return this.peers.get(toPublicKeyHex(publicKey)) || null
  }

  has (publicKey) {
    return this.peers.has(toPublicKeyHex(publicKey))
  }

  list () {
    return [...this.peers.values()]
  }

  async remove (publicKey) {
    const removed = this.peers.delete(toPublicKeyHex(publicKey))
    if (removed) await this._flush()
    return removed
  }

  flushed () {
    return this._writing
  }

  _flush () {
    const peers = {}
    for (const [key, record] of this.peers) peers[key] = record
    const data = JSON.stringify({ version: PEERS_VERSION, peers }, null, 2)
    // Preserve write order when several peers finish pairing together.
    this._writing = this._writing.catch(() => {}).then(() => atomicWriteFile(this.file, data))
    return this._writing
  }
}

function isValidRecord (key, record) {
  if (!/^[0-9a-f]{64}$/.test(key)) return false
  if (!record || typeof record !== 'object' || Array.isArray(record)) return false
  return record.publicKey === key
}
