import { EventEmitter } from 'bare-events'
import { createNode, localDiscoveryTopic, PROTOCOL_VERSION } from '@unstoppable-stack/p2p'
import { syncPack } from '@unstoppable-stack/p2p/sync'
import { aiPack } from './ai/index.js'
import { loadConfig, saveConfig, mergeConfigPatch } from './config.js'
import { exportNodeState, importNodeState, writeNodeStateBundle } from './export.js'
import { runtimeFs, runtimePath } from './runtime-files.js'

// The Personal Node is not a special kind of peer any more — it is
// the P2P library composed with replication and an internal QVAC adapter, plus the
// local management surface the CLI and the desktop dashboard drive.
//
// Everything here is *local* administration: quotas, config, backup, and
// per-peer permissions. None of it is on the wire; peers only ever see the
// capability bus.
export class PersonalNode extends EventEmitter {
  constructor (storagePath, opts = {}) {
    super()
    this.storagePath = storagePath
    this.config = null
    this.started = false

    this._aiOpts = opts.ai || null
    this._sync = syncPack({ storage: runtimePath.join(storagePath, 'store') })
    this._ai = aiPack({
      enabled: !!this._aiOpts,
      mock: !!this._aiOpts?.mock,
      modelSrc: this._aiOpts?.modelSrc,
      ...(opts.aiProvider ? { provider: opts.aiProvider } : {})
    })

    this.node = createNode({
      storage: storagePath,
      nodeType: 'personal-node',
      profile: {
        appId: 'unstoppable-node',
        appName: 'Unstoppable Personal Node',
        deviceName: opts.deviceName || null
      },
      capabilities: [this._sync, this._ai],
      swarm: opts.swarm,
      // The Personal Node is the one node that *should* own the machine-local
      // topic: "the node on this box" is exactly what it means. App-nodes
      // stay off it and are reached by key.
      topic: opts.topic === undefined ? localDiscoveryTopic() : opts.topic,
      pairing: opts.approvePairing ? { approve: opts.approvePairing } : {}
    })

    this._forward()
  }

  get publicKey () {
    return this.node.publicKey
  }

  _forward () {
    const passthrough = [
      'ready', 'listening', 'connection', 'hello', 'pairRequest', 'pairDenied',
      'paired', 'peerDisconnected', 'unpaired', 'grantsChanged', 'policyChanged',
      'error', 'requestError', 'aiReady', 'aiError', 'aiProgress', 'aiDisabled',
      'inference', 'inviteCreated', 'inviteRedeemed', 'inviteRevoked'
    ]
    for (const event of passthrough) {
      this.node.on(event, (info) => this.emit(event, info))
    }
  }

  async start () {
    this.config = await loadConfig(this.storagePath, { seed: this._configSeed() })

    // Config is the source of truth once it exists; CLI flags seed it on
    // first run. A node configured for AI comes back up with AI.
    if (!this._aiOpts && this.config.ai.enabled) {
      await this._ai.enable({
        mock: this.config.ai.mode !== 'qvac',
        ...(this.config.ai.modelSrc ? { modelSrc: this.config.ai.modelSrc } : {})
      }).catch(() => {})
    }

    await this.node.listen()
    this.started = true

    const restored = this._sync.engine?.getStats().length || 0
    if (restored > 0) this.emit('restored', { resourceCount: restored })

    return this
  }

  _configSeed () {
    if (!this._aiOpts) return null
    return {
      ai: {
        enabled: true,
        mode: this._aiOpts.mock ? 'mock' : 'qvac',
        modelSrc: this._aiOpts.modelSrc || ''
      }
    }
  }

  async getConfig () {
    if (!this.config) this.config = await loadConfig(this.storagePath, { seed: this._configSeed() })
    return JSON.parse(JSON.stringify(this.config))
  }

  async updateConfig (patch) {
    const previous = await this.getConfig()
    const next = mergeConfigPatch(previous, patch)
    await saveConfig(this.storagePath, next)
    this.config = next

    // Some config changes apply live; the caller should not have to know
    // which. AI is the only one today.
    if (next.ai.enabled !== previous.ai.enabled ||
        next.ai.mode !== previous.ai.mode ||
        next.ai.modelSrc !== previous.ai.modelSrc) {
      if (next.ai.enabled) {
        await this._ai.enable({
          mock: next.ai.mode !== 'qvac',
          ...(next.ai.modelSrc ? { modelSrc: next.ai.modelSrc } : {})
        }).catch((err) => this.emit('aiError', { phase: 'config', error: err.message }))
      } else {
        await this._ai.disable()
      }
    }

    this.emit('configChanged', { config: next })
    return JSON.parse(JSON.stringify(next))
  }

  async enableAI (opts = {}) {
    const provider = await this._ai.enable(opts)
    await this.updateConfig({
      ai: {
        enabled: true,
        mode: opts.mock ?? this._ai.mock ? 'mock' : 'qvac',
        ...(opts.modelSrc ? { modelSrc: opts.modelSrc } : {})
      }
    })
    return provider
  }

  async disableAI () {
    const changed = await this._ai.disable()
    await this.updateConfig({ ai: { enabled: false } })
    return changed
  }

  // Aggregate view for the CLI and dashboard. Unlike the per-peer `sync`
  // capability methods, this is node-wide on purpose: it is the operator's
  // view of their own machine, not something a peer can request.
  async getStatus () {
    const engine = this._sync.engine
    let cores = engine ? engine.getStats() : []
    let drives = engine ? engine.getDriveStats() : []
    const replicated = engine ? engine.getReplicatedBytes() : null

    const quotas = await this._enforceQuotas(replicated)
    if (quotas.enforced.length > 0 && engine) {
      cores = engine.getStats()
      drives = engine.getDriveStats()
    }

    const live = new Set(this.node.peers.map((peer) => peer.remotePublicKey))
    const peers = this.node.peerRegistry.list().map((record) => ({
      ...record,
      online: live.has(record.publicKey),
      quotaBytes: record.policy?.quotaBytes ?? null
    }))

    return {
      protocolVersion: PROTOCOL_VERSION,
      nodePublicKey: this.node.publicKey,
      capabilities: this.node.capabilities.describe(),
      peers,
      pairedPeers: peers.length,
      cores,
      drives,
      connectedPeers: live.size,
      storagePath: this.storagePath,
      storage: replicated ? { ...replicated, quotas } : null,
      invites: this.node.listInvites(),
      ai: {
        ready: this._ai.ready,
        mock: this._ai.mock,
        modelId: this._ai.modelId,
        error: this._ai.lastError
      }
    }
  }

  // Quotas are per peer, not per app: two devices running one app used to
  // share a budget because the registry keyed on appId.
  async _enforceQuotas (replicated) {
    const config = await this.getConfig()
    const globalLimit = config.storage.globalQuotaBytes
    const defaultLimit = config.storage.perPeerQuotaBytes
    const perOwner = replicated?.perOwner || {}
    const globalExceeded = globalLimit !== null && (replicated?.total || 0) > globalLimit

    const states = {}
    const enforced = []

    for (const [publicKey, used] of Object.entries(perOwner)) {
      const record = this.node.peerRegistry.get(publicKey)
      const limit = record?.policy?.quotaBytes ?? defaultLimit
      const exceeded = (limit !== null && used > limit) || globalExceeded
      states[publicKey] = {
        used,
        limit,
        exceeded,
        reason: exceeded ? (globalExceeded ? 'global' : 'per-peer') : null
      }
      if (!exceeded || !this._sync.engine) continue

      const touched = await this._sync.engine.pauseOwner(publicKey)
      if (touched > 0) {
        const info = {
          publicKey,
          touched,
          reason: states[publicKey].reason,
          used,
          limit: globalExceeded ? globalLimit : limit
        }
        enforced.push(info)
        this.emit('quotaExceeded', info)
        this.emit('peerPaused', { publicKey, touched, reason: 'quota' })
      }
    }

    return {
      global: { used: replicated?.total || 0, limit: globalLimit, exceeded: globalExceeded },
      perPeerLimit: defaultLimit,
      perPeer: states,
      enforced
    }
  }

  async setPeerQuota (publicKey, quotaBytes) {
    if (quotaBytes !== null && (!Number.isSafeInteger(quotaBytes) || quotaBytes < 0)) {
      throw new Error('quotaBytes must be a non-negative integer or null')
    }
    const record = this.node.peerRegistry.get(publicKey)
    const policy = { ...(record?.policy || {}), quotaBytes }
    const updated = await this.node.setPeerPolicy(publicKey, policy)
    if (this._sync.engine) await this._enforceQuotas(this._sync.engine.getReplicatedBytes())
    this.emit('peerQuotaChanged', { publicKey, quotaBytes })
    return updated
  }

  async setPeerGrant (publicKey, capability, methods) {
    if (!capability || !Array.isArray(methods)) throw new Error('capability and methods[] are required')
    const record = this.node.peerRegistry.get(publicKey)
    if (!record) throw new Error(`Unknown peer: ${publicKey}`)
    const grants = { ...(record.grantsGiven || {}), [capability]: [...methods] }
    const applied = await this.node.setPeerGrants(publicKey, grants)
    this.emit('peerGrantChanged', { publicKey, capability, methods: applied[capability] || [] })
    return applied
  }

  async unpairPeer (publicKey) {
    if (this._sync.engine) await this._sync.engine.removeOwnerCores(publicKey)
    return this.node.unpair(publicKey)
  }

  async pausePeer (publicKey) {
    const touched = this._sync.engine ? await this._sync.engine.pauseOwner(publicKey) : 0
    this.emit('peerPaused', { publicKey, touched, reason: 'user' })
    return touched
  }

  async resumePeer (publicKey) {
    const touched = this._sync.engine ? await this._sync.engine.resumeOwner(publicKey) : 0
    this.emit('peerResumed', { publicKey, touched })
    return touched
  }

  // Bytes actually on disk, which is the operator's question. Peers get their
  // own logical figure through `sync.usage` and never learn this path.
  async getDiskUsage () {
    if (!this.storagePath) return null
    const { stat, readdir } = runtimeFs
    const { join } = runtimePath

    let total = 0
    let files = 0
    async function walk (dir) {
      let entries
      try { entries = await readdir(dir, { withFileTypes: true }) } catch { return }
      for (const entry of entries) {
        const full = join(dir, entry.name)
        if (entry.isDirectory()) await walk(full)
        else if (entry.isFile()) {
          try {
            const info = await stat(full)
            total += info.size
            files++
          } catch {}
        }
      }
    }
    try { await walk(this.storagePath) } catch { return null }
    return { bytes: total, files, path: this.storagePath }
  }

  // Invites are how a phone or a second computer pairs with this node: the
  // machine-local topic only ever finds processes on this box.
  async createInvite (opts) {
    return this.node.createInvite(opts)
  }

  listInvites () {
    return this.node.listInvites()
  }

  async revokeInvite (id) {
    return this.node.revokeInvite(id)
  }

  // Operator-side debug reads. The equivalent peer-facing methods are scoped
  // to the caller and off by default; these are node-wide because the person
  // running the node can already read the files.
  async peekCore (key, opts) {
    return this._sync.engine ? this._sync.engine.peekCore(key, opts) : null
  }

  async peekDrive (key, opts) {
    return this._sync.engine ? this._sync.engine.peekDrive(key, opts) : null
  }

  async exportState (outPath) {
    return writeNodeStateBundle({
      storagePath: this.storagePath,
      outPath,
      config: await this.getConfig(),
      peers: this.node.peerRegistry.list()
    })
  }

  async importState (inPath) {
    const bundle = await importNodeState({ storagePath: this.storagePath, inPath })
    this.config = await loadConfig(this.storagePath)
    return bundle
  }

  async close () {
    this.started = false
    await this.node.close()
  }
}

export { exportNodeState, importNodeState }
