import Corestore from 'corestore'
import Hyperswarm from 'hyperswarm'
import b4a from 'b4a'
import { EventEmitter } from 'bare-events'
import { AppRegistry } from './registry.js'
import { ReplicationEngine } from './replication.js'
import { AIProvider } from './ai-provider.js'
import { loadConfig, saveConfig, mergeConfigPatch, validateConfig } from './config.js'
import { writeNodeStateBundle } from './export.js'
import { localDiscoveryTopic, encodeMessage, DEFAULT_SERVICES, PROTOCOL_VERSION, buildCapabilities, defaultCapabilityGrants } from './protocol.js'

const DEFAULT_DISCOVERY_WARMUP_MS = 0

export class NodeDaemon extends EventEmitter {
  constructor (storagePath, opts = {}) {
    super()
    this.storagePath = storagePath
    this.store = new Corestore(storagePath)
    this.discoverySwarm = new Hyperswarm(opts.swarm)
    this.replicationSwarm = new Hyperswarm(opts.swarm)
    this.registry = null
    this.replication = null
    this.connections = new Map()
    this._closing = false
    this._topicOverride = opts.topic || null
    this._discoveryWarmupMs = typeof opts.discoveryWarmupMs === 'number'
      ? opts.discoveryWarmupMs
      : DEFAULT_DISCOVERY_WARMUP_MS

    // AI provider is opt-in. Accept either an already-constructed provider
    // (for testing) or a config object like `{ mock: true }` that we'll use
    // to build one on start(). `services.ai` only flips to true when the
    // provider starts successfully.
    this._aiOpts = opts.ai || null
    this.ai = opts.aiProvider || null
    this.config = null

    // Which services we're actually running. `files` was bolted onto the
    // protocol before Hyperdrive replication existed — it's always on now.
    // `ai` flips to true when start() successfully brings up an AIProvider.
    this.services = { ...DEFAULT_SERVICES, ...(opts.services || {}) }
    this.capabilities = buildCapabilities(this.services)

    // Optional pair-approval gate. When provided, we await it before
    // accepting a `pairRequest` and registering the app. The callback
    // receives `{ appId, appName, publicKey, remoteKey }` (publicKey =
    // app's identity key, remoteKey = transport peer key from
    // Hyperswarm) and must resolve to one of:
    //   'approve'           — proceed; do NOT remember
    //   'approve-remember'  — proceed; remember (caller persists)
    //   'deny' (or anything else) — reject with `pairDenied`
    // Without a callback, the daemon auto-accepts (CLI / headless
    // mode); the dashboard wires this up to the approval modal.
    this._approvePairing = typeof opts.approvePairing === 'function'
      ? opts.approvePairing
      : null
  }

  async start () {
    await this.store.ready()
    this.config = await loadConfig(this.storagePath, { seed: this._configSeed() })
    if (!this._aiOpts && this.config.ai.enabled) {
      this._aiOpts = this._aiOptsFromConfig(this.config)
    }

    const registryCore = this.store.get({ name: 'node-registry' })
    await registryCore.ready()
    this.registry = new AppRegistry(registryCore)
    await this.registry.ready()

    this.replication = new ReplicationEngine(this.store, this.replicationSwarm)

    this.replicationSwarm.on('connection', (socket) => {
      this.store.replicate(socket)
    })

    this.discoverySwarm.on('connection', (socket, info) => {
      this._handleDiscoveryConnection(socket, info)
    })

    const topic = this._topicOverride || localDiscoveryTopic()
    this.discoverySwarm.join(topic, { server: true, client: false })
    await this.discoverySwarm.flush()

    await this._restoreReplication()

    // Start AI provider last — if it fails we still want the data/file
    // services to be usable. Errors bubble up so the CLI can report them,
    // but we also emit on the node so UIs can pick up the failure.
    if (this.ai || this._aiOpts) {
      try {
        if (!this.ai) this.ai = new AIProvider(this._aiOpts)
        this.ai.on('progress', (p) => this.emit('aiProgress', p))
        this.ai.on('error', (e) => this.emit('aiError', e))
        await this.ai.start()
        this.services = { ...this.services, ai: true }
        this.capabilities = buildCapabilities(this.services)
        this.emit('aiReady', { mock: !!this._aiOpts?.mock, modelId: this.ai.modelId })
      } catch (err) {
        this.emit('aiError', { phase: 'start', error: err.message })
        this.ai = null
      }
    }

    if (this._discoveryWarmupMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, this._discoveryWarmupMs))
    }

    this.emit('ready', {
      topic: b4a.toString(topic, 'hex'),
      publicKey: b4a.toString(this.discoverySwarm.keyPair.publicKey, 'hex')
    })
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

  _aiOptsFromConfig (config = this.config) {
    if (!config?.ai?.enabled) return null
    return {
      mock: config.ai.mode !== 'qvac',
      ...(config.ai.modelSrc ? { modelSrc: config.ai.modelSrc } : {})
    }
  }

  async getConfig () {
    if (!this.config) this.config = await loadConfig(this.storagePath, { seed: this._configSeed() })
    return JSON.parse(JSON.stringify(this.config))
  }

  async updateConfig (patch) {
    const current = await this.getConfig()
    const next = validateConfig(mergeConfigPatch(current, patch))
    await this._applyConfig(current, next)
    this.config = next
    await saveConfig(this.storagePath, next)
    if (this.replication) await this._enforceQuotas(this.replication.getReplicatedBytes())
    this.emit('configChanged', { config: await this.getConfig() })
    return this.getConfig()
  }

  async exportState (outPath) {
    const apps = this.registry ? await this.registry.listApps() : []
    const config = await this.getConfig()
    return writeNodeStateBundle({ storagePath: this.storagePath, outPath, config, apps })
  }

  async _applyConfig (previous, next) {
    const prevAi = previous.ai || {}
    const nextAi = next.ai || {}
    const changedAi = prevAi.enabled !== nextAi.enabled || prevAi.mode !== nextAi.mode || prevAi.modelSrc !== nextAi.modelSrc
    if (!changedAi) return
    if (!nextAi.enabled) {
      await this.disableAI()
      return
    }
    await this.enableAI(this._aiOptsFromConfig(next))
  }

  async _restoreReplication () {
    const apps = await this.registry.listApps()
    for (const app of apps) {
      for (const core of app.cores || []) {
        try {
          await this.replication.addCore({ ...core, appId: app.appId })
        } catch (err) {
          this.emit('error', { type: 'restore', appId: app.appId, core: core.name, error: err.message })
        }
      }
      for (const drive of app.drives || []) {
        try {
          await this.replication.addDrive({ ...drive, appId: app.appId })
        } catch (err) {
          this.emit('error', { type: 'restore', appId: app.appId, drive: drive.name, error: err.message })
        }
      }
    }
    if (apps.length > 0) {
      this.emit('restored', { appCount: apps.length })
    }
  }

  _handleDiscoveryConnection (socket, info) {
    const remoteKey = b4a.toString(info.publicKey, 'hex')
    this.connections.set(remoteKey, socket)
    this.emit('peerConnected', { publicKey: remoteKey })

    // Greet the peer immediately so the client can confirm it's talking to a
    // real Node (and not some other app that happened to land on the same
    // discovery topic) and learn which services are available.
    socket.write(encodeMessage({
      type: 'nodeHello',
      protocolVersion: PROTOCOL_VERSION,
      nodePublicKey: b4a.toString(this.discoverySwarm.keyPair.publicKey, 'hex'),
      services: this.services,
      capabilities: this.capabilities
    }))

    let buffer = ''
    socket.on('data', (data) => {
      buffer += b4a.toString(data)
      const lines = buffer.split('\n')
      buffer = lines.pop()
      for (const line of lines) {
        if (!line.trim()) continue
        try {
          const msg = JSON.parse(line)
          this._handleMessage(msg, socket, remoteKey)
        } catch {
          // ignore malformed
        }
      }
    })

    socket.on('close', () => {
      this.connections.delete(remoteKey)
      this.emit('peerDisconnected', { publicKey: remoteKey })
    })

    socket.on('error', () => {
      this.connections.delete(remoteKey)
    })
  }

  async _handleMessage (msg, socket, remoteKey) {
    switch (msg.type) {
      case 'pairRequest':
        await this._handlePairRequest(msg, socket, remoteKey)
        break
      case 'register':
        await this._handleRegister(msg, socket, remoteKey)
        break
      case 'heartbeat':
        this.emit('heartbeat', { appId: msg.appId, uptime: msg.uptime })
        break
      case 'inference':
        await this._handleInference(msg, socket, remoteKey)
        break
      case 'status-request':
        await this._handleStatusRequest(msg, socket)
        break
      case 'disk-usage-request':
        await this._handleDiskUsageRequest(msg, socket)
        break
      case 'peek-core':
        await this._handlePeekCore(msg, socket)
        break
      case 'peek-drive':
        await this._handlePeekDrive(msg, socket)
        break
      default:
        this.emit('unknownMessage', { type: msg.type, from: remoteKey })
    }
  }

  async _handleStatusRequest (msg, socket) {
    socket.write(encodeMessage({
      type: 'status',
      requestId: msg.requestId,
      status: await this.getStatus()
    }))
  }

  async _handleDiskUsageRequest (msg, socket) {
    socket.write(encodeMessage({
      type: 'disk-usage',
      requestId: msg.requestId,
      usage: await this.getDiskUsage()
    }))
  }

  async _handlePeekCore (msg, socket) {
    const result = this.replication
      ? await this.replication.peekCore(msg.key, { limit: msg.limit })
      : null
    socket.write(encodeMessage({
      type: 'peek-core-result',
      requestId: msg.requestId,
      result
    }))
  }

  async _handlePeekDrive (msg, socket) {
    const result = this.replication
      ? await this.replication.peekDrive(msg.key, { dir: msg.dir, limit: msg.limit })
      : null
    socket.write(encodeMessage({
      type: 'peek-drive-result',
      requestId: msg.requestId,
      result
    }))
  }


  async _handleInference (msg, socket /* , remoteKey */) {
    const requestId = msg.requestId
    if (!this.ai || !this.services.ai) {
      socket.write(encodeMessage({
        type: 'inference-error',
        requestId,
        error: 'AI service not available on this node'
      }))
      return
    }
    try {
      for await (const token of this.ai.runStreaming({ messages: msg.messages, stream: true })) {
        socket.write(encodeMessage({ type: 'inference-token', requestId, token }))
      }
      socket.write(encodeMessage({ type: 'inference-done', requestId }))
      this.emit('inference', { requestId, appId: msg.appId })
    } catch (err) {
      socket.write(encodeMessage({
        type: 'inference-error',
        requestId,
        error: err.message
      }))
    }
  }

  async _handlePairRequest (msg, socket, remoteKey) {
    this.emit('pairRequest', {
      appId: msg.appId,
      appName: msg.appName,
      publicKey: msg.publicKey,
      deviceName: msg.deviceName,
      requestedCapabilities: msg.requestedCapabilities,
      remoteKey
    })

    if (this._approvePairing) {
      let decision
      try {
        decision = await this._approvePairing({
          appId: msg.appId,
          appName: msg.appName,
          publicKey: msg.publicKey,
          deviceName: msg.deviceName,
          requestedCapabilities: msg.requestedCapabilities,
          remoteKey
        })
      } catch (err) {
        this.emit('error', { type: 'approval', appId: msg.appId, error: err.message })
        decision = 'deny'
      }
      if (decision !== 'approve' && decision !== 'approve-remember') {
        socket.write(encodeMessage({
          type: 'pairDenied',
          reason: typeof decision === 'string' ? decision : 'denied'
        }))
        this.emit('pairDenied', {
          appId: msg.appId,
          appName: msg.appName,
          publicKey: msg.publicKey,
          deviceName: msg.deviceName,
          reason: typeof decision === 'string' ? decision : 'denied'
        })
        return
      }
    }

    const grants = defaultCapabilityGrants(this.capabilities)
    await this.registry.registerApp({
      appId: msg.appId,
      appName: msg.appName,
      publicKey: msg.publicKey,
      deviceName: msg.deviceName,
      requestedCapabilities: msg.requestedCapabilities || null,
      grants
    })

    socket.write(encodeMessage({
      type: 'pairAccepted',
      nodePublicKey: b4a.toString(this.discoverySwarm.keyPair.publicKey, 'hex'),
      services: this.services,
      capabilities: this.capabilities,
      grants
    }))

    this.emit('paired', { appId: msg.appId, appName: msg.appName })
  }

  async _handleRegister (msg, socket, remoteKey) {
    const app = await this.registry.getApp(msg.appId)
    if (!app) {
      socket.write(encodeMessage({
        type: 'error',
        message: 'App not paired. Send pairRequest first.'
      }))
      return
    }

    const replicating = []
    for (const core of msg.cores || []) {
      try {
        await this.replication.addCore({ ...core, appId: msg.appId })
        replicating.push(core.key)
      } catch (err) {
        this.emit('error', { type: 'replication', appId: msg.appId, core: core.name, error: err.message })
      }
    }

    const replicatingDrives = []
    for (const drive of msg.drives || []) {
      try {
        await this.replication.addDrive({ ...drive, appId: msg.appId })
        replicatingDrives.push(drive.key)
      } catch (err) {
        this.emit('error', { type: 'replication', appId: msg.appId, drive: drive.name, error: err.message })
      }
    }

    await this.registry.registerApp({
      ...app,
      cores: msg.cores || [],
      drives: msg.drives || []
    })

    socket.write(encodeMessage({
      type: 'registered',
      replicating,
      replicatingDrives
    }))

    this.emit('appRegistered', {
      appId: msg.appId,
      coreCount: (msg.cores || []).length,
      driveCount: (msg.drives || []).length
    })

    await this._enforceQuotas(this.replication.getReplicatedBytes())
  }

  // Snapshot of the daemon's current state. Stable shape — consumed by:
  //   - the dashboard worker (full detail)
  //   - `NodeClient.getNodeStatus()` over the wire (full detail; safe to
  //     send to the same client that already paired)
  //   - `us node status` and other headless tools
  async getStatus () {
    const apps = this.registry ? await this.registry.listApps() : []
    let coreStats = this.replication ? this.replication.getStats() : []
    let driveStats = this.replication ? this.replication.getDriveStats() : []
    const connectedPeers = this.connections.size
    const replicated = this.replication ? this.replication.getReplicatedBytes() : null
    const quotas = await this._enforceQuotas(replicated)
    if (quotas.enforced.length > 0) {
      coreStats = this.replication ? this.replication.getStats() : []
      driveStats = this.replication ? this.replication.getDriveStats() : []
    }

    return {
      protocolVersion: PROTOCOL_VERSION,
      nodePublicKey: this.discoverySwarm
        ? b4a.toString(this.discoverySwarm.keyPair.publicKey, 'hex')
        : null,
      services: { ...this.services },
      capabilities: this.capabilities,
      apps,
      pairedApps: apps.length,
      cores: coreStats,
      drives: driveStats,
      connectedPeers,
      storagePath: this.storagePath,
      storage: replicated ? { ...replicated, quotas } : null,
      ai: this.ai ? {
        ready: !!this.services.ai,
        mock: !!this._aiOpts?.mock,
        modelId: this.ai.modelId || null
      } : null
    }
  }

  async _enforceQuotas (replicated) {
    const config = await this.getConfig()
    const globalLimit = config.storage.globalQuotaBytes
    const perAppLimit = config.storage.perAppQuotaBytes
    const perApp = replicated?.perApp || {}
    const enforced = []
    const appStates = {}
    const globalExceeded = globalLimit !== null && (replicated?.total || 0) > globalLimit

    for (const [appId, used] of Object.entries(perApp)) {
      const exceeded = (perAppLimit !== null && used > perAppLimit) || globalExceeded
      appStates[appId] = {
        used,
        limit: perAppLimit,
        exceeded,
        reason: exceeded ? (globalExceeded ? 'global' : 'per-app') : null
      }
      if (!exceeded || !this.replication) continue
      const touched = await this.replication.pauseApp(appId)
      if (touched > 0) {
        await this._persistPauseState(appId, true)
        const info = { appId, touched, reason: appStates[appId].reason, used, limit: globalExceeded ? globalLimit : perAppLimit }
        enforced.push(info)
        this.emit('quotaExceeded', info)
        this.emit('appPaused', { appId, touched, reason: 'quota' })
      }
    }

    return {
      global: {
        used: replicated?.total || 0,
        limit: globalLimit,
        exceeded: globalExceeded
      },
      perAppLimit,
      perApp: appStates,
      enforced
    }
  }

  // Bring up the AI provider after start(). Idempotent — calling twice
  // returns the existing provider. Throws if QVAC dynamic import fails.
  // After success, `services.ai === true` and an `aiReady` event is emitted.
  async enableAI (opts = {}) {
    if (this.ai && this._ready === undefined) return this.ai
    if (this.ai && this.services.ai) return this.ai

    if (this.ai) {
      try { await this.ai.close() } catch {}
      this.ai = null
    }

    this._aiOpts = opts && Object.keys(opts).length > 0 ? opts : (this._aiOpts || {})
    this.ai = new AIProvider(this._aiOpts)
    this.ai.on('progress', (p) => this.emit('aiProgress', p))
    this.ai.on('error', (e) => this.emit('aiError', e))
    try {
      await this.ai.start()
      this.services = { ...this.services, ai: true }
      this.capabilities = buildCapabilities(this.services)
      this.emit('aiReady', { mock: !!this._aiOpts?.mock, modelId: this.ai.modelId })
      this.emit('servicesChanged', { services: { ...this.services }, capabilities: this.capabilities })
      return this.ai
    } catch (err) {
      this.emit('aiError', { phase: 'enable', error: err.message })
      try { await this.ai.close() } catch {}
      this.ai = null
      this.services = { ...this.services, ai: false }
      this.capabilities = buildCapabilities(this.services)
      this.emit('servicesChanged', { services: { ...this.services }, capabilities: this.capabilities })
      throw err
    }
  }

  // Tear down a running AI provider. Cheap if AI was never enabled.
  // After this, `services.ai === false` and a `servicesChanged` event
  // fires so the dashboard can re-render the pill row.
  async disableAI () {
    if (!this.ai && !this.services.ai) return
    if (this.ai) {
      try { await this.ai.close() } catch (err) {
        this.emit('aiError', { phase: 'disable', error: err.message })
      }
      this.ai = null
    }
    this.services = { ...this.services, ai: false }
    this.capabilities = buildCapabilities(this.services)
    this.emit('servicesChanged', { services: { ...this.services }, capabilities: this.capabilities })
  }

  // Walks the storage directory to compute actual bytes-on-disk. Slow on
  // large stores — call ad-hoc from the dashboard, not in tight loops.
  // Returns null if the storage path is unreadable. Skips the trust
  // registry sidecar so the number tracks "data the node is hosting".
  async getDiskUsage () {
    if (!this.storagePath) return null
    const { stat, readdir } = await import('fs/promises')
    const { join } = await import('path')

    let total = 0
    let files = 0
    async function walk (dir) {
      let entries
      try { entries = await readdir(dir, { withFileTypes: true }) } catch { return }
      for (const entry of entries) {
        const full = join(dir, entry.name)
        if (entry.isDirectory()) {
          await walk(full)
        } else if (entry.isFile()) {
          try {
            const st = await stat(full)
            total += st.size
            files++
          } catch {}
        }
      }
    }
    try {
      await walk(this.storagePath)
    } catch { return null }
    return { bytes: total, files, path: this.storagePath }
  }

  async unpairApp (appId) {
    await this.replication.removeAppCores(appId)
    await this.registry.removeApp(appId)
    this.emit('unpaired', { appId })
  }

  async pauseApp (appId) {
    if (!this.replication) return 0
    const touched = await this.replication.pauseApp(appId)
    await this._persistPauseState(appId, true)
    if (touched > 0) this.emit('appPaused', { appId, touched })
    return touched
  }

  async resumeApp (appId) {
    if (!this.replication) return 0
    const touched = await this.replication.resumeApp(appId)
    await this._persistPauseState(appId, false)
    if (touched > 0) this.emit('appResumed', { appId, touched })
    return touched
  }

  async _persistPauseState (appId, paused) {
    if (!this.registry) return
    const app = await this.registry.getApp(appId)
    if (!app) return
    await this.registry.registerApp({
      ...app,
      cores: (app.cores || []).map((core) => ({ ...core, paused })),
      drives: (app.drives || []).map((drive) => ({ ...drive, paused }))
    })
  }

  async close () {
    if (this._closing) return
    this._closing = true
    this.emit('closing')

    for (const [, socket] of this.connections) {
      socket.destroy()
    }

    if (this.ai) {
      try { await this.ai.close() } catch {}
    }
    await this.replication.close()
    await this.registry.close()
    await this.discoverySwarm.destroy()
    await this.replicationSwarm.destroy()
    await this.store.close()

    this.emit('closed')
  }
}
