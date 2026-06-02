import b4a from 'b4a'
import Hyperdrive from 'hyperdrive'

export class ReplicationEngine {
  constructor (store, swarm) {
    this.store = store
    this.swarm = swarm
    // Two separate maps keyed by hex-encoded key so we can cleanly report
    // stats + teardown. Hyperdrives share the same Corestore as hypercores
    // so their underlying cores replicate for free through the swarm's
    // single `store.replicate(socket)` call — we only need to open the
    // drive locally and announce its discovery key to attract peers.
    this.replicating = new Map()
    this.drives = new Map()
  }

  async addCore ({ key, type, name, appId, paused = false }) {
    const keyBuf = b4a.from(key, 'hex')
    const keyHex = b4a.toString(keyBuf, 'hex')

    if (this.replicating.has(keyHex)) return

    const core = this.store.get({ key: keyBuf })
    await core.ready()

    const topic = core.discoveryKey
    if (!paused) this.swarm.join(topic)

    this.replicating.set(keyHex, { core, type, name, appId, topic, paused })

    core.on('append', () => {
      const info = this.replicating.get(keyHex)
      if (info) info.lastSync = Date.now()
    })

    return { key: keyHex, length: core.length, byteLength: core.byteLength }
  }

  async addDrive ({ key, name, appId, paused = false }) {
    const keyBuf = b4a.from(key, 'hex')
    const keyHex = b4a.toString(keyBuf, 'hex')

    if (this.drives.has(keyHex)) return

    // Hyperdrive + Corestore: pass the root store and the drive's public
    // key. Hyperdrive manages its own sub-cores (metadata + blobs) inside
    // the namespace derived from the key — our existing
    // `store.replicate(socket)` handler in the daemon will replicate them
    // automatically once a peer connects on the discovery key.
    const drive = new Hyperdrive(this.store, keyBuf)
    await drive.ready()

    const topic = drive.discoveryKey
    if (!paused) this.swarm.join(topic)

    this.drives.set(keyHex, { drive, name, appId, topic, paused })

    drive.core.on('append', () => {
      const info = this.drives.get(keyHex)
      if (info) info.lastSync = Date.now()
    })

    return { key: keyHex, version: drive.version }
  }

  async removeCore (keyHex) {
    const info = this.replicating.get(keyHex)
    if (!info) return

    this.swarm.leave(info.topic)
    await info.core.close()
    this.replicating.delete(keyHex)
  }

  async removeDrive (keyHex) {
    const info = this.drives.get(keyHex)
    if (!info) return

    this.swarm.leave(info.topic)
    await info.drive.close()
    this.drives.delete(keyHex)
  }

  async removeAppCores (appId) {
    const toRemoveCores = []
    for (const [key, info] of this.replicating) {
      if (info.appId === appId) toRemoveCores.push(key)
    }
    for (const key of toRemoveCores) {
      await this.removeCore(key)
    }

    const toRemoveDrives = []
    for (const [key, info] of this.drives) {
      if (info.appId === appId) toRemoveDrives.push(key)
    }
    for (const key of toRemoveDrives) {
      await this.removeDrive(key)
    }
  }

  // Pause all swarm subscriptions for the given app. The cores stay open
  // (so reads from the dashboard still work) but we leave the discovery
  // topic so no new peers are accepted. We record the paused state on
  // each entry so getStats can surface it.
  async pauseApp (appId) {
    let touched = 0
    for (const [, info] of this.replicating) {
      if (info.appId !== appId || info.paused) continue
      try { await this.swarm.leave(info.topic) } catch {}
      info.paused = true
      touched++
    }
    for (const [, info] of this.drives) {
      if (info.appId !== appId || info.paused) continue
      try { await this.swarm.leave(info.topic) } catch {}
      info.paused = true
      touched++
    }
    return touched
  }

  // Reverse of pauseApp.
  async resumeApp (appId) {
    let touched = 0
    for (const [, info] of this.replicating) {
      if (info.appId !== appId || !info.paused) continue
      try { this.swarm.join(info.topic) } catch {}
      info.paused = false
      touched++
    }
    for (const [, info] of this.drives) {
      if (info.appId !== appId || !info.paused) continue
      try { this.swarm.join(info.topic) } catch {}
      info.paused = false
      touched++
    }
    return touched
  }

  getStats () {
    const stats = []
    for (const [key, info] of this.replicating) {
      stats.push({
        key,
        type: info.type,
        name: info.name,
        appId: info.appId,
        length: info.core.length,
        byteLength: info.core.byteLength,
        peers: info.core.peers.length,
        paused: !!info.paused,
        lastSync: info.lastSync || null
      })
    }
    return stats
  }

  /**
   * Return the live Hyperdrive we're replicating for this key, or null.
   * Useful for the Node UI / dashboard to read files without opening a
   * second Hyperdrive against the same corestore (which needlessly
   * double-subscribes cores).
   */
  getDrive (keyHex) {
    const info = this.drives.get(keyHex)
    return info ? info.drive : null
  }

  getCore (keyHex) {
    const info = this.replicating.get(keyHex)
    return info ? info.core : null
  }

  // Read the last `limit` block headers from a core. For hyperbees this is
  // not the same as the last `limit` entries (Hyperbee buckets multiple
  // keys per block) but it's enough for the dashboard's "is data flowing?"
  // sanity check.
  async peekCore (keyHex, { limit = 5 } = {}) {
    const core = this.getCore(keyHex)
    if (!core) return null
    const length = core.length
    if (length === 0) {
      return { key: keyHex, length: 0, byteLength: core.byteLength, blocks: [] }
    }
    const lo = Math.max(0, length - limit)
    const blocks = []
    for (let seq = lo; seq < length; seq++) {
      try {
        // Wait briefly so peek works the first time after a write, but cap
        // the per-block delay so a torn-down peer can't hang the modal.
        const block = await core.get(seq, { wait: true, timeout: 1_500 })
        if (!block) continue
        const len = block.length || block.byteLength || 0
        // Best-effort preview: try utf-8 truncated to 80 chars. Binary will
        // come out as gibberish — that's fine, the user gets a length too.
        let preview = ''
        try {
          preview = block.toString('utf8', 0, Math.min(len, 80))
        } catch {}
        blocks.push({ seq, length: len, preview })
      } catch {}
    }
    return { key: keyHex, length, byteLength: core.byteLength, blocks }
  }

  // Top-level directory listing of a Hyperdrive. Returns `null` if the
  // drive isn't replicating. `dir` defaults to `/`; entries are limited to
  // `limit` to keep the dashboard responsive on large drives.
  async peekDrive (keyHex, { dir = '/', limit = 50 } = {}) {
    const drive = this.getDrive(keyHex)
    if (!drive) return null

    const entries = []
    try {
      for await (const entry of drive.list(dir, { recursive: false })) {
        entries.push({
          key: entry.key,
          type: entry.value?.linkname ? 'link' : (entry.value?.blob ? 'file' : 'unknown'),
          size: entry.value?.blob?.byteLength || 0
        })
        if (entries.length >= limit) break
      }
    } catch (err) {
      return { key: keyHex, dir, error: err.message, entries }
    }
    return { key: keyHex, dir, version: drive.version, entries }
  }

  getDriveStats () {
    const stats = []
    for (const [key, info] of this.drives) {
      stats.push({
        key,
        type: 'hyperdrive',
        name: info.name,
        appId: info.appId,
        version: info.drive.version,
        // `core.byteLength` for a Hyperdrive's metadata feed is small;
        // the actual file bytes live in the blobs core which Hyperdrive
        // exposes lazily. Try to include both when available.
        byteLength: info.drive.core.byteLength,
        blobsByteLength: info.drive.blobs?.core?.byteLength || 0,
        peers: info.drive.core.peers.length,
        paused: !!info.paused,
        lastSync: info.lastSync || null
      })
    }
    return stats
  }

  // Logical-bytes view: sum of what we'd replicate, not what's on disk.
  // Bytes-on-disk needs to walk the storage directory and is computed in
  // NodeDaemon.getDiskUsage() because the directory path lives there.
  getReplicatedBytes () {
    const perApp = new Map()
    let totalCores = 0
    let totalDrives = 0
    for (const [, info] of this.replicating) {
      const n = info.core.byteLength || 0
      totalCores += n
      perApp.set(info.appId, (perApp.get(info.appId) || 0) + n)
    }
    for (const [, info] of this.drives) {
      const n = (info.drive.core.byteLength || 0) + (info.drive.blobs?.core?.byteLength || 0)
      totalDrives += n
      perApp.set(info.appId, (perApp.get(info.appId) || 0) + n)
    }
    return {
      totalCores,
      totalDrives,
      total: totalCores + totalDrives,
      perApp: Object.fromEntries(perApp)
    }
  }

  async close () {
    for (const [, info] of this.replicating) {
      await info.core.close()
    }
    this.replicating.clear()

    for (const [, info] of this.drives) {
      try { await info.drive.close() } catch {}
    }
    this.drives.clear()
  }
}
