import b4a from 'b4a'
import Hyperdrive from 'hyperdrive'
import Hyperbee from 'hyperbee'

// How long close() waits for an in-flight mirror pass before giving up on it.
const CLOSE_DRAIN_MS = 2_000

export class ReplicationEngine {
  constructor (store, swarm, { admit = async () => {} } = {}) {
    this.admit = admit
    this.store = store
    this.swarm = swarm
    // Two separate maps keyed by hex-encoded key so we can cleanly report
    // stats + teardown. Hyperdrives share the same Corestore as hypercores
    // so their underlying cores replicate for free through the swarm's
    // single `store.replicate(socket)` call — we only need to open the
    // drive locally and announce its discovery key to attract peers.
    this.replicating = new Map()
    this.drives = new Map()
    // Mirror passes are scheduled on timers and run async. Both have to be
    // stoppable, or a pass fires against a Corestore that close() already
    // tore down.
    this._timers = new Set()
    this._closing = false
  }

  _later (fn, ms) {
    if (this._closing) return null
    const timer = setTimeout(() => {
      this._timers.delete(timer)
      if (!this._closing) fn()
    }, ms)
    this._timers.add(timer)
    return timer
  }

  async addCore ({ key, type, name, owner, resourceId = null, metadata = {}, protection = { mode: 'metadata-only' }, paused = false }) {
    const keyBuf = b4a.from(key, 'hex')
    const keyHex = b4a.toString(keyBuf, 'hex')

    if (this.replicating.has(keyHex)) {
      const existing = this.replicating.get(keyHex)
      if (existing.owner !== owner) throw new Error('Resource is already registered to another peer')
      existing.type = type
      existing.name = name
      existing.resourceId = resourceId
      existing.metadata = metadata
      const nextMode = protection?.mode || 'metadata-only'
      if (existing.protection.mode !== nextMode) existing.protection = protectionState(nextMode)
      if (existing.protection.mode === 'mirror') this._scheduleCoreMirror(keyHex)
      return this._coreResult(keyHex, existing)
    }

    const core = this.store.get({ key: keyBuf })
    let topic
    let discovery = null
    try {
      await core.ready()
      topic = core.discoveryKey
      if (!paused) discovery = this.swarm.join(topic)
    } catch (error) {
      await core.close().catch(() => {})
      throw error
    }

    this.replicating.set(keyHex, {
      core,
      type,
      name,
      owner,
      resourceId,
      metadata,
      topic,
      discovery,
      paused,
      protection: protectionState(protection?.mode)
    })

    core.on('append', () => {
      const info = this.replicating.get(keyHex)
      if (info) {
        info.lastSync = Date.now()
        if (info.protection.mode === 'mirror') this._scheduleCoreMirror(keyHex)
      }
    })

    if (protection?.mode === 'mirror') this._scheduleCoreMirror(keyHex)
    return this._coreResult(keyHex, this.replicating.get(keyHex))
  }

  async addDrive ({ key, name, owner, resourceId = null, metadata = {}, protection = { mode: 'metadata-only' }, paused = false }) {
    const keyBuf = b4a.from(key, 'hex')
    const keyHex = b4a.toString(keyBuf, 'hex')

    if (this.drives.has(keyHex)) {
      const existing = this.drives.get(keyHex)
      if (existing.owner !== owner) throw new Error('Resource is already registered to another peer')
      existing.name = name
      existing.resourceId = resourceId
      existing.metadata = metadata
      const nextMode = protection?.mode || 'metadata-only'
      if (existing.protection.mode !== nextMode) existing.protection = protectionState(nextMode)
      if (existing.protection.mode === 'mirror') this._scheduleDriveMirror(keyHex)
      return { key: keyHex, version: existing.drive.version }
    }

    // Hyperdrive resolves its metadata + blobs cores from the key, so the
    // store it is handed only decides *lifetime*. It must be a session, not
    // the root store: `Hyperdrive._close()` closes the corestore it was given,
    // so passing the root would tear down every other session on this node —
    // the manifest bee included — the first time a drive is dropped.
    const drive = new Hyperdrive(this.store.session(), keyBuf)
    let topic
    let discovery = null
    try {
      await drive.ready()
      topic = drive.discoveryKey
      if (!paused) discovery = this.swarm.join(topic)
    } catch (error) {
      await drive.close().catch(() => {})
      throw error
    }

    this.drives.set(keyHex, {
      drive,
      name,
      owner,
      resourceId,
      metadata,
      topic,
      discovery,
      paused,
      protection: protectionState(protection?.mode)
    })

    drive.core.on('append', () => {
      const info = this.drives.get(keyHex)
      if (info) {
        info.lastSync = Date.now()
        if (info.protection.mode === 'mirror') this._scheduleDriveMirror(keyHex)
      }
    })

    if (protection?.mode === 'mirror') this._scheduleDriveMirror(keyHex)
    return { key: keyHex, version: drive.version }
  }

  async reconcileOwnerResources (owner, { coreKeys = [], driveKeys = [] }) {
    const wantedCores = new Set(coreKeys.map(normalizeKey))
    const wantedDrives = new Set(driveKeys.map(normalizeKey))
    for (const [key, info] of [...this.replicating]) {
      if (info.owner === owner && !wantedCores.has(key)) await this.removeCore(key)
    }
    for (const [key, info] of [...this.drives]) {
      if (info.owner === owner && !wantedDrives.has(key)) await this.removeDrive(key)
    }
  }

  onPeerConnection () {
    // Give the Hypercore handshake a moment to exchange remote lengths before
    // taking a protection checkpoint, then retry every requested mirror.
    this._later(() => {
      for (const key of this.replicating.keys()) this._scheduleCoreMirror(key)
      for (const key of this.drives.keys()) this._scheduleDriveMirror(key)
    }, 100)
  }

  async removeCore (keyHex) {
    const info = this.replicating.get(keyHex)
    if (!info) return

    await info.discovery?.destroy()
    info.discovery = null
    await info.core.close()
    this.replicating.delete(keyHex)
  }

  async removeDrive (keyHex) {
    const info = this.drives.get(keyHex)
    if (!info) return

    await info.discovery?.destroy()
    info.discovery = null
    await info.drive.close()
    this.drives.delete(keyHex)
  }

  async removeOwnerCores (owner) {
    const toRemoveCores = []
    for (const [key, info] of this.replicating) {
      if (info.owner === owner) toRemoveCores.push(key)
    }
    for (const key of toRemoveCores) {
      await this.removeCore(key)
    }

    const toRemoveDrives = []
    for (const [key, info] of this.drives) {
      if (info.owner === owner) toRemoveDrives.push(key)
    }
    for (const key of toRemoveDrives) {
      await this.removeDrive(key)
    }
  }

  // Pause all swarm subscriptions for the given app. The cores stay open
  // (so reads from the dashboard still work) but we leave the discovery
  // topic so no new peers are accepted. We record the paused state on
  // each entry so getStats can surface it.
  async pauseOwner (owner) {
    let touched = 0
    for (const [key, info] of this.replicating) {
      if (info.owner !== owner || info.paused) continue
      info.paused = true
      info.download?.destroy()
      try { await info.discovery?.destroy() } catch {}
      info.discovery = null
      touched++
    }
    for (const [, info] of this.drives) {
      if (info.owner !== owner || info.paused) continue
      info.paused = true
      info.download?.destroy()
      try { await info.discovery?.destroy() } catch {}
      info.discovery = null
      touched++
    }
    return touched
  }

  // Reverse of pauseOwner.
  async resumeOwner (owner) {
    let touched = 0
    for (const [key, info] of this.replicating) {
      if (info.owner !== owner || !info.paused) continue
      info.discovery = this.swarm.join(info.topic)
      info.paused = false
      if (info.protection.mode === 'mirror') this._scheduleCoreMirror(key)
      touched++
    }
    for (const [key, info] of this.drives) {
      if (info.owner !== owner || !info.paused) continue
      info.discovery = this.swarm.join(info.topic)
      info.paused = false
      if (info.protection.mode === 'mirror') this._scheduleDriveMirror(key)
      touched++
    }
    return touched
  }

  getStats () {
    const stats = []
    for (const [key, info] of this.replicating) {
      stats.push({
        key,
        resourceId: info.resourceId,
        type: info.type,
        name: info.name,
        metadata: info.metadata,
        owner: info.owner,
        length: info.core.length,
        byteLength: info.core.byteLength,
        peers: info.core.peers.length,
        paused: !!info.paused,
        lastSync: info.lastSync || null,
        protection: this._coreProtection(info)
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
  async peekCore (keyHex, { limit = 5, readable = false } = {}) {
    const core = this.getCore(keyHex)
    if (!core) return null
    limit = Math.max(1, Math.min(50, Number.isInteger(limit) ? limit : 5))
    if (readable && this.replicating.get(keyHex)?.type === 'hyperbee') {
      const bee = new Hyperbee(core.session(), { keyEncoding: 'utf-8', valueEncoding: 'binary' })
      let snapshot
      try {
        await bee.ready()
        snapshot = bee.checkout(core.length)
        const entries = []
        let bytes = 0
        for await (const entry of snapshot.createReadStream({ limit: limit + 1, wait: false })) {
          if (entries.length === limit || bytes + entry.value.length > 256 * 1024) {
            return { entries, more: true }
          }
          bytes += entry.value.length
          const text = b4a.toString(entry.value, 'utf8')
          let value = text
          try { value = JSON.parse(text) } catch {}
          entries.push({ key: entry.key, value })
        }
        return { entries, more: false }
      } catch {
        return { error: 'Some saved data is not available on this computer yet. Try again after copying finishes.' }
      } finally {
        await snapshot?.close()
        await bee.close()
      }
    }
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
        resourceId: info.resourceId,
        type: 'hyperdrive',
        name: info.name,
        metadata: info.metadata,
        owner: info.owner,
        version: info.drive.version,
        // `core.byteLength` for a Hyperdrive's metadata feed is small;
        // the actual file bytes live in the blobs core which Hyperdrive
        // exposes lazily. Try to include both when available.
        byteLength: info.drive.core.byteLength,
        blobsByteLength: info.drive.blobs?.core?.byteLength || 0,
        peers: info.drive.core.peers.length,
        paused: !!info.paused,
        lastSync: info.lastSync || null,
        protection: { ...info.protection }
      })
    }
    return stats
  }

  // Logical-bytes view: sum of what we'd replicate, not what's on disk.
  // Bytes-on-disk needs to walk the storage directory and is computed in
  // PersonalNode.getDiskUsage() because the directory path lives there.
  getReplicatedBytes () {
    const perOwner = new Map()
    let totalCores = 0
    let totalDrives = 0
    for (const [, info] of this.replicating) {
      const n = info.core.byteLength || 0
      totalCores += n
      perOwner.set(info.owner, (perOwner.get(info.owner) || 0) + n)
    }
    for (const [, info] of this.drives) {
      const n = (info.drive.core.byteLength || 0) + (info.drive.blobs?.core?.byteLength || 0)
      totalDrives += n
      perOwner.set(info.owner, (perOwner.get(info.owner) || 0) + n)
    }
    return {
      totalCores,
      totalDrives,
      total: totalCores + totalDrives,
      perOwner: Object.fromEntries(perOwner)
    }
  }

  async close () {
    this._closing = true
    for (const timer of this._timers) clearTimeout(timer)
    this._timers.clear()

    // Let any mirror pass that already started finish before the cores it is
    // reading go away — but bounded. A mirror waiting on a download from a
    // peer that just vanished never settles, and shutdown must not wait for
    // the network.
    const inFlight = []
    for (const [, info] of this.replicating) if (info.mirrorPromise) inFlight.push(info.mirrorPromise)
    for (const [, info] of this.drives) if (info.mirrorPromise) inFlight.push(info.mirrorPromise)
    if (inFlight.length > 0) {
      await Promise.race([
        Promise.allSettled(inFlight),
        new Promise((resolve) => setTimeout(resolve, CLOSE_DRAIN_MS).unref?.())
      ])
    }

    for (const [, info] of this.replicating) {
      try { await info.discovery?.destroy() } catch {}
      try { await info.core.close() } catch {}
    }
    this.replicating.clear()

    for (const [, info] of this.drives) {
      try { await info.discovery?.destroy() } catch {}
      try { await info.drive.close() } catch {}
    }
    this.drives.clear()
  }

  _coreResult (key, info) {
    return { key, length: info.core.length, byteLength: info.core.byteLength }
  }

  _coreProtection (info) {
    const targetLength = info.protection.targetLength || info.core.length
    const localContiguousLength = Math.min(info.core.contiguousLength, targetLength)
    return {
      ...info.protection,
      targetLength,
      localContiguousLength,
      blocksRemaining: Math.max(0, targetLength - localContiguousLength)
    }
  }

  _scheduleCoreMirror (keyHex) {
    if (this._closing) return
    const info = this.replicating.get(keyHex)
    if (!info || info.paused || info.protection.mode !== 'mirror') return
    if (info.mirrorPromise) {
      info.mirrorAgain = true
      return
    }
    info.protection.state = 'pending'
    info.mirrorPromise = this._mirrorCore(keyHex, info)
      .catch((err) => {
        info.protection.state = 'error'
        info.protection.lastError = err.message
      })
      .finally(() => {
        info.mirrorPromise = null
        if (info.mirrorAgain) {
          info.mirrorAgain = false
          this._scheduleCoreMirror(keyHex)
        }
      })
  }

  async _mirrorCore (keyHex, info) {
    if (this.replicating.get(keyHex) !== info) return
    info.protection.state = 'syncing'
    info.protection.lastError = null
    if (info.core.peers.length > 0) {
      info.observedPeer = true
      await info.core.update({ wait: true })
    }
    if (info.paused || this._closing) return
    await this.admit(info.owner)
    const targetLength = info.core.length
    // A restarted mirror can verify its persisted signed checkpoint without
    // seeing the writer again. Require a non-empty tree and every local block:
    // a newly opened unknown key (length 0) is not proof of an empty dataset.
    if (!info.observedPeer && (targetLength === 0 || !await info.core.has(0, targetLength))) {
      info.protection.state = 'pending'
      return
    }
    info.protection.targetLength = targetLength
    if (info.paused || this._closing) return
    if (targetLength > 0) {
      info.download = info.core.download({ start: 0, end: targetLength, linear: true })
      try { await info.download.done() } finally { info.download = null }
    }
    if (info.paused || this._closing) return
    const complete = targetLength === 0 || await info.core.has(0, targetLength)
    info.protection.state = complete ? 'protected' : 'pending'
    if (complete) info.protection.caughtUpAt = new Date().toISOString()
    if (info.core.length > targetLength) info.mirrorAgain = true
  }

  _scheduleDriveMirror (keyHex) {
    if (this._closing) return
    const info = this.drives.get(keyHex)
    if (!info || info.paused || info.protection.mode !== 'mirror') return
    if (info.mirrorPromise) {
      info.mirrorAgain = true
      return
    }
    info.protection.state = 'pending'
    info.mirrorPromise = this._mirrorDrive(keyHex, info)
      .catch((err) => {
        info.protection.state = 'error'
        info.protection.lastError = err.message
      })
      .finally(() => {
        info.mirrorPromise = null
        if (info.mirrorAgain) {
          info.mirrorAgain = false
          this._scheduleDriveMirror(keyHex)
        }
      })
  }

  async _mirrorDrive (keyHex, info) {
    if (this.drives.get(keyHex) !== info) return
    info.protection.state = 'syncing'
    info.protection.lastError = null
    if (info.drive.core.peers.length > 0) {
      info.observedPeer = true
      await info.drive.update({ wait: true })
    }
    if (info.paused || this._closing) return
    await this.admit(info.owner)
    const targetVersion = info.drive.version
    if (!info.observedPeer) {
      info.protection.state = 'pending'
      return
    }
    info.protection.targetVersion = targetVersion
    // Download one file range at a time, retaining its cancellation handle.
    // Hyperdrive.download('/') otherwise hides handles for every file.
    for await (const entry of info.drive.list('/')) {
      if (info.paused || this._closing) return
      const blob = entry.value?.blob
      if (!blob) continue
      const blobs = await info.drive.getBlobs()
      await this.admit(info.owner)
      if (info.paused || this._closing) return
      info.download = blobs.core.download({ start: blob.blockOffset, length: blob.blockLength })
      try { await info.download.done() } finally { info.download = null }
    }
    if (info.paused || this._closing) return
    const progress = await driveProgress(info.drive)
    Object.assign(info.protection, progress)
    const complete = progress.bytesRemaining === 0 && info.drive.version === targetVersion
    info.protection.state = complete ? 'protected' : 'pending'
    if (complete) info.protection.caughtUpAt = new Date().toISOString()
    if (info.drive.version > targetVersion) info.mirrorAgain = true
  }
}

function protectionState (mode = 'metadata-only') {
  return {
    mode,
    state: mode === 'mirror' ? 'pending' : 'metadata-only',
    caughtUpAt: null,
    lastError: null
  }
}

function normalizeKey (key) {
  return typeof key === 'string' ? key.toLowerCase() : b4a.toString(key, 'hex')
}

async function driveProgress (drive) {
  let totalBytes = 0
  let protectedBytes = 0
  const blobs = await drive.getBlobs()
  for await (const entry of drive.list('/', { recursive: true })) {
    const blob = entry.value?.blob
    if (!blob) continue
    totalBytes += blob.byteLength || 0
    if (await blobs.core.has(blob.blockOffset, blob.blockOffset + blob.blockLength)) {
      protectedBytes += blob.byteLength || 0
    }
  }
  return { totalBytes, protectedBytes, bytesRemaining: Math.max(0, totalBytes - protectedBytes) }
}
