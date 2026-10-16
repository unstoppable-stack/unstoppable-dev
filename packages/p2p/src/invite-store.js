import { atomicWriteFile, runtimeFs, runtimePath } from './runtime-files.js'

export const INVITES_FILE = 'invites.json'
export const INVITES_VERSION = 1

// Pending invites the node has issued. Persisted because an invite is
// something a person is carrying to another device: it has to survive a
// restart, and its expiry and remaining uses have to be honoured after one.
export class InviteStore {
  constructor (storagePath) {
    this.file = runtimePath.join(storagePath, INVITES_FILE)
    this.invites = new Map()
    this._ready = false
  }

  // Re-read from disk. Invites can be created by another process against the
  // same storage directory — `us node invite` talks to no daemon — so a
  // running node has to notice them.
  async reload () {
    this._ready = false
    this.invites.clear()
    await this.ready()
  }

  async ready () {
    if (this._ready) return
    try {
      const parsed = JSON.parse(await runtimeFs.readFile(this.file, 'utf8'))
      if (parsed?.version === INVITES_VERSION && parsed.invites && typeof parsed.invites === 'object') {
        for (const [id, record] of Object.entries(parsed.invites)) {
          if (record && typeof record === 'object' && record.id === id) this.invites.set(id, record)
        }
      }
    } catch (err) {
      if (err.code !== 'ENOENT') throw err
    }
    this._ready = true
    await this.prune()
  }

  async put (record) {
    this.invites.set(record.id, record)
    await this._flush()
    return record
  }

  get (id) {
    const record = this.invites.get(id)
    if (!record || !isLive(record)) return null
    return record
  }

  // Only invites that can still be redeemed. Expired and spent records linger
  // in the map until prune() runs, but nothing should offer them: the node
  // must not keep announcing their topics, and the dashboard must not show
  // them as live codes.
  list () {
    return [...this.invites.values()].filter((record) => isLive(record))
  }

  // Everything on disk, including dead records awaiting prune. For diagnostics.
  listAll () {
    return [...this.invites.values()]
  }

  // Returns the record if it still had a use left, after spending one.
  async consume (id) {
    const record = this.get(id)
    if (!record) return null
    record.used++
    record.lastUsedAt = new Date().toISOString()
    if (record.uses !== null && record.used >= record.uses) {
      this.invites.delete(id)
    }
    await this._flush()
    return record
  }

  async revoke (id) {
    const removed = this.invites.delete(id)
    if (removed) await this._flush()
    return removed
  }

  async prune () {
    let changed = false
    for (const [id, record] of [...this.invites]) {
      if (!isLive(record)) {
        this.invites.delete(id)
        changed = true
      }
    }
    if (changed) await this._flush()
    return changed
  }

  async _flush () {
    const invites = {}
    for (const [id, record] of this.invites) invites[id] = record
    await atomicWriteFile(this.file, JSON.stringify({ version: INVITES_VERSION, invites }, null, 2))
  }
}

export function isExpired (record) {
  return !!record.expiresAt && Date.parse(record.expiresAt) <= Date.now()
}

export function isLive (record) {
  if (isExpired(record)) return false
  return record.uses === null || record.used < record.uses
}
