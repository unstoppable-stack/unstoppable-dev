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

  async addCore ({ key, type, name, appId }) {
    const keyBuf = b4a.from(key, 'hex')
    const keyHex = b4a.toString(keyBuf, 'hex')

    if (this.replicating.has(keyHex)) return

    const core = this.store.get({ key: keyBuf })
    await core.ready()

    const topic = core.discoveryKey
    this.swarm.join(topic)

    this.replicating.set(keyHex, { core, type, name, appId, topic })

    core.on('append', () => {
      const info = this.replicating.get(keyHex)
      if (info) info.lastSync = Date.now()
    })

    return { key: keyHex, length: core.length, byteLength: core.byteLength }
  }

  async addDrive ({ key, name, appId }) {
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
    this.swarm.join(topic)

    this.drives.set(keyHex, { drive, name, appId, topic })

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

  getDriveStats () {
    const stats = []
    for (const [key, info] of this.drives) {
      stats.push({
        key,
        type: 'hyperdrive',
        name: info.name,
        appId: info.appId,
        version: info.drive.version,
        peers: info.drive.core.peers.length,
        lastSync: info.lastSync || null
      })
    }
    return stats
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
