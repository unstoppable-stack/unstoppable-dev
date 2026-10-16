import { atomicWriteFile, runtimeFs, runtimePath, withStorageLock } from './runtime-files.js'

export const INVITES_FILE = 'invites.json'
export const INVITES_VERSION = 1

// Every mutation reloads under a cross-process lock. Atomic rename alone cannot
// prevent a stale CLI process from resurrecting an invite consumed by the daemon.
export class InviteStore {
  constructor (storagePath) {
    this.file = runtimePath.join(storagePath, INVITES_FILE)
    this.invites = new Map()
    this._ready = false
    this._writing = Promise.resolve()
  }

  async _read () {
    const records = new Map()
    try {
      const parsed = JSON.parse(await runtimeFs.readFile(this.file, 'utf8'))
      if (parsed?.version !== INVITES_VERSION || !parsed.invites || typeof parsed.invites !== 'object') {
        throw new Error('Unsupported or corrupt invite store')
      }
      for (const [id, record] of Object.entries(parsed.invites)) {
        if (record && typeof record === 'object' && record.id === id) records.set(id, record)
      }
    } catch (error) {
      if (error.code !== 'ENOENT') throw error
    }
    this.invites = records
    this._ready = true
  }

  _transaction (operation, persist = true) {
    const result = this._writing.catch(() => {}).then(() => withStorageLock(this.file, async () => {
      await this._read()
      const value = await operation()
      if (persist) {
        await atomicWriteFile(this.file, JSON.stringify({
          version: INVITES_VERSION, invites: Object.fromEntries(this.invites)
        }, null, 2))
      }
      return value
    }))
    this._writing = result
    return result
  }

  reload () { return this._transaction(() => {}, false) }
  async ready () { if (!this._ready) await this.reload() }
  flushed () { return this._writing }

  put (record) {
    return this._transaction(() => {
      this.invites.set(record.id, record)
      return record
    })
  }

  get (id) {
    const record = this.invites.get(id)
    return record && isLive(record) ? record : null
  }

  list () { return [...this.invites.values()].filter(isLive) }
  listAll () { return [...this.invites.values()] }

  consume (id) {
    return this._transaction(() => {
      const record = this.get(id)
      if (!record) return null
      record.used++
      record.lastUsedAt = new Date().toISOString()
      if (record.uses !== null && record.used >= record.uses) this.invites.delete(id)
      return record
    })
  }

  revoke (id) { return this._transaction(() => this.invites.delete(id)) }

  prune () {
    return this._transaction(() => {
      let changed = false
      for (const [id, record] of this.invites) {
        if (!isLive(record)) { this.invites.delete(id); changed = true }
      }
      return changed
    })
  }
}

export function isExpired (record) {
  return !!record.expiresAt && Date.parse(record.expiresAt) <= Date.now()
}

export function isLive (record) {
  if (isExpired(record)) return false
  return record.uses === null || record.used < record.uses
}
