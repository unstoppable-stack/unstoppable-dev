import Corestore from 'corestore'
import Hyperswarm from 'hyperswarm'
import b4a from 'b4a'
import { EventEmitter } from 'bare-events'
import { AppRegistry } from './registry.js'
import { ReplicationEngine } from './replication.js'
import { AIProvider } from './ai-provider.js'
import { loadConfig, saveConfig, mergeConfigPatch, validateConfig } from './config.js'
import { writeNodeStateBundle } from './export.js'
import { localDiscoveryTopic, encodeMessage, DEFAULT_SERVICES, PROTOCOL_VERSION, buildCapabilities, defaultCapabilityGrants, requestedCapabilityGrants } from './protocol.js'

const DEFAULT_DISCOVERY_WARMUP_MS = 0
const MAX_CONTROL_FRAME_CHARS = 1024 * 1024
const MAX_CORE_PEEK_BLOCKS = 10
const MAX_DRIVE_PEEK_ENTRIES = 100

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
    this.sessions = new Map()
    this._activeInferences = new Set()
    this._cancelledInferences = new Set()
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
    this.sessions.set(socket, { remoteKey, appId: null, publicKey: null, grants: null })
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
      if (buffer.length > MAX_CONTROL_FRAME_CHARS) {
        this.emit('error', { type: 'protocol', from: remoteKey, error: 'control frame exceeds maximum size' })
        socket.destroy()
        return
      }
      const lines = buffer.split('\n')
      buffer = lines.pop()
      for (const line of lines) {
        if (!line.trim()) continue
        try {
          const msg = JSON.parse(line)
          this._handleMessage(msg, socket, remoteKey).catch((err) => {
            this.emit('error', { type: 'message', from: remoteKey, error: err.message })
            this._writeError(socket, null, 'REQUEST_FAILED', 'Request failed')
          })
        } catch {
          // ignore malformed
        }
      }
    })

    socket.on('close', () => {
      this.connections.delete(remoteKey)
      this.sessions.delete(socket)
      for (const inferenceKey of this._activeInferences) {
        if (inferenceKey.startsWith(`${remoteKey}:`)) this._cancelledInferences.add(inferenceKey)
      }
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
        if (!this._authorize(socket, 'resources', 'status', msg.requestId)) break
        this.emit('heartbeat', { appId: this.sessions.get(socket).appId, uptime: msg.uptime })
        break
      case 'inference':
        await this._handleInference(msg, socket, remoteKey)
        break
      case 'inference-cancel': {
        const session = this._authorize(socket, 'ai', 'completion.stream', msg.requestId, 'inference-error')
        const inferenceKey = session && `${session.publicKey}:${msg.requestId}`
        if (inferenceKey && this._activeInferences.has(inferenceKey)) this._cancelledInferences.add(inferenceKey)
        break
      }
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
    const session = this._authorize(socket, 'resources', 'status', msg.requestId)
    if (!session) return
    const status = this._statusForApp(await this.getStatus(), session.appId)
    socket.write(encodeMessage({
      type: 'status',
      requestId: msg.requestId,
      status
    }))
  }

  async _handleDiskUsageRequest (msg, socket) {
    const session = this._authorize(socket, 'storage', 'usage', msg.requestId)
    if (!session) return
    const status = await this.getStatus()
    const bytes = status.storage?.perApp?.[session.appId] || 0
    socket.write(encodeMessage({
      type: 'disk-usage',
      requestId: msg.requestId,
      usage: { bytes, files: null, path: null, scope: 'self' }
    }))
  }

  async _handlePeekCore (msg, socket) {
    const session = this._authorize(socket, 'resources', 'peek', msg.requestId)
    if (!session) return
    const app = await this.registry.getApp(session.appId)
    if (!(app?.cores || []).some((core) => core.key === msg.key)) {
      this._writeError(socket, msg.requestId, 'RESOURCE_FORBIDDEN', 'Core is not registered to this app')
      return
    }
    const limit = clampInteger(msg.limit, 1, MAX_CORE_PEEK_BLOCKS, 5)
    const result = this.replication
      ? await this.replication.peekCore(msg.key, { limit })
      : null
    socket.write(encodeMessage({
      type: 'peek-core-result',
      requestId: msg.requestId,
      result
    }))
  }

  async _handlePeekDrive (msg, socket) {
    const session = this._authorize(socket, 'resources', 'peek', msg.requestId)
    if (!session) return
    const app = await this.registry.getApp(session.appId)
    if (!(app?.drives || []).some((drive) => drive.key === msg.key)) {
      this._writeError(socket, msg.requestId, 'RESOURCE_FORBIDDEN', 'Drive is not registered to this app')
      return
    }
    const limit = clampInteger(msg.limit, 1, MAX_DRIVE_PEEK_ENTRIES, 50)
    const dir = typeof msg.dir === 'string' && msg.dir.length <= 1024 ? msg.dir : '/'
    const result = this.replication
      ? await this.replication.peekDrive(msg.key, { dir, limit })
      : null
    socket.write(encodeMessage({
      type: 'peek-drive-result',
      requestId: msg.requestId,
      result
    }))
  }


  async _handleInference (msg, socket /* , remoteKey */) {
    const requestId = msg.requestId
    const session = this._authorize(socket, 'ai', 'completion.stream', requestId, 'inference-error')
    if (!session) return
    if (typeof requestId !== 'string' || !requestId || !Array.isArray(msg.messages)) {
      this._writeError(socket, requestId, 'INVALID_REQUEST', 'Inference requires a requestId and messages array', 'inference-error')
      return
    }
    if (!this.ai || !this.services.ai) {
      socket.write(encodeMessage({
        type: 'inference-error',
        requestId,
        error: 'AI service not available on this node'
      }))
      return
    }
    const inferenceKey = `${session.publicKey}:${requestId}`
    this._activeInferences.add(inferenceKey)
    try {
      for await (const token of this.ai.runStreaming({ messages: msg.messages, stream: true })) {
        if (this._cancelledInferences.has(inferenceKey)) break
        socket.write(encodeMessage({ type: 'inference-token', requestId, token }))
      }
      if (!this._cancelledInferences.has(inferenceKey)) {
        socket.write(encodeMessage({ type: 'inference-done', requestId }))
        this.emit('inference', { requestId, appId: session.appId })
      }
    } catch (err) {
      socket.write(encodeMessage({
        type: 'inference-error',
        requestId,
        error: err.message
      }))
    } finally {
      this._activeInferences.delete(inferenceKey)
      this._cancelledInferences.delete(inferenceKey)
    }
  }

  async _handlePairRequest (msg, socket, remoteKey) {
    const currentSession = this.sessions.get(socket)
    if (currentSession?.appId) {
      socket.write(encodeMessage({ type: 'pairDenied', reason: 'this connection is already paired' }))
      return
    }
    if (typeof msg.publicKey !== 'string' || msg.publicKey !== remoteKey) {
      socket.write(encodeMessage({ type: 'pairDenied', reason: 'identity key does not match secure transport' }))
      this.emit('pairDenied', { appId: msg.appId, appName: msg.appName, publicKey: msg.publicKey, reason: 'identity mismatch' })
      return
    }
    if (typeof msg.appId !== 'string' || !msg.appId.trim()) {
      socket.write(encodeMessage({ type: 'pairDenied', reason: 'invalid app identity' }))
      return
    }
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

    const grants = requestedCapabilityGrants(this.capabilities, msg.requestedCapabilities)
    await this.registry.registerApp({
      appId: msg.appId,
      appName: msg.appName,
      publicKey: msg.publicKey,
      deviceName: msg.deviceName,
      requestedCapabilities: msg.requestedCapabilities || null,
      grants
    })
    this.sessions.set(socket, { remoteKey, appId: msg.appId, publicKey: remoteKey, grants })

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
    const session = this._authorize(socket, 'resources', 'register', msg.requestId)
    if (!session) return
    const app = await this.registry.getApp(session.appId)

    const replicating = []
    for (const core of msg.cores || []) {
      try {
        await this.replication.addCore({ ...core, appId: session.appId })
        replicating.push(core.key)
      } catch (err) {
        this.emit('error', { type: 'replication', appId: session.appId, core: core.name, error: err.message })
      }
    }

    const replicatingDrives = []
    for (const drive of msg.drives || []) {
      try {
        await this.replication.addDrive({ ...drive, appId: session.appId })
        replicatingDrives.push(drive.key)
      } catch (err) {
        this.emit('error', { type: 'replication', appId: session.appId, drive: drive.name, error: err.message })
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
      appId: session.appId,
      coreCount: (msg.cores || []).length,
      driveCount: (msg.drives || []).length
    })

    await this._enforceQuotas(this.replication.getReplicatedBytes())
  }

  _authorize (socket, capability, method, requestId = null, errorType = 'error') {
    const session = this.sessions.get(socket)
    if (!session?.appId) {
      this._writeError(socket, requestId, 'NOT_PAIRED', 'App not paired. Send pairRequest first.', errorType)
      return null
    }
    if (!(session.grants?.[capability] || []).includes(method)) {
      this._writeError(socket, requestId, 'CAPABILITY_DENIED', `${capability}.${method} is not granted for this app`, errorType)
      return null
    }
    return session
  }

  _writeError (socket, requestId, code, message, type = 'error') {
    const payload = type === 'inference-error'
      ? { type, requestId, code, error: message }
      : { type, requestId, code, message }
    try { socket.write(encodeMessage(payload)) } catch {}
  }

  _statusForApp (status, appId) {
    const app = status.apps.find((entry) => entry.appId === appId)
    const cores = status.cores.filter((entry) => entry.appId === appId)
    const drives = status.drives.filter((entry) => entry.appId === appId)
    const bytes = status.storage?.perApp?.[appId] || 0
    const quota = status.storage?.quotas?.perApp?.[appId] || null
    return {
      protocolVersion: status.protocolVersion,
      nodePublicKey: status.nodePublicKey,
      services: status.services,
      capabilities: status.capabilities,
      apps: app ? [app] : [],
      pairedApps: app ? 1 : 0,
      cores,
      drives,
      connectedPeers: status.connectedPeers,
      storagePath: null,
      storage: {
        total: bytes,
        totalCores: cores.reduce((sum, core) => sum + (core.byteLength || 0), 0),
        totalDrives: drives.reduce((sum, drive) => sum + (drive.byteLength || 0) + (drive.blobsByteLength || 0), 0),
        perApp: { [appId]: bytes },
        quotas: {
          global: null,
          perAppLimit: quota?.limit ?? null,
          perApp: quota ? { [appId]: quota } : {},
          enforced: []
        }
      },
      ai: status.ai
    }
  }

  // Snapshot of the daemon's current state. Stable shape — consumed by:
  //   - the dashboard worker (full detail)
  //   - `NodeClient.getNodeStatus()` over the wire after per-app filtering
  //   - `us node status` and other headless tools
  async getStatus () {
    const apps = this.registry ? await this.registry.listApps() : []
    let coreStats = this.replication ? this.replication.getStats() : []
    let driveStats = this.replication ? this.replication.getDriveStats() : []
    const connectedPeers = this.connections.size
    const replicated = this.replication ? this.replication.getReplicatedBytes() : null
    const quotas = await this._enforceQuotas(replicated, apps)
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

  async _enforceQuotas (replicated, apps = null) {
    const config = await this.getConfig()
    const globalLimit = config.storage.globalQuotaBytes
    const defaultPerAppLimit = config.storage.perAppQuotaBytes
    const perApp = replicated?.perApp || {}
    const enforced = []
    const appStates = {}
    const globalExceeded = globalLimit !== null && (replicated?.total || 0) > globalLimit
    const appMap = new Map((apps || (this.registry ? await this.registry.listApps() : [])).map((app) => [app.appId, app]))

    for (const [appId, used] of Object.entries(perApp)) {
      const appLimit = appMap.get(appId)?.quotaBytes ?? defaultPerAppLimit
      const exceeded = (appLimit !== null && used > appLimit) || globalExceeded
      appStates[appId] = {
        used,
        limit: appLimit,
        exceeded,
        reason: exceeded ? (globalExceeded ? 'global' : 'per-app') : null
      }
      if (!exceeded || !this.replication) continue
      const touched = await this.replication.pauseApp(appId)
      if (touched > 0) {
        await this._persistPauseState(appId, true)
        const info = { appId, touched, reason: appStates[appId].reason, used, limit: globalExceeded ? globalLimit : appLimit }
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
      perAppLimit: defaultPerAppLimit,
      perApp: appStates,
      enforced
    }
  }

  async setAppQuota (appId, quotaBytes) {
    if (quotaBytes !== null && (!Number.isSafeInteger(quotaBytes) || quotaBytes < 0)) {
      throw new Error('quotaBytes must be a non-negative integer or null')
    }
    const app = await this.registry.getApp(appId)
    if (!app) throw new Error(`Unknown app: ${appId}`)
    await this.registry.registerApp({ ...app, quotaBytes })
    if (this.replication) await this._enforceQuotas(this.replication.getReplicatedBytes())
    this.emit('appQuotaChanged', { appId, quotaBytes })
    return this.registry.getApp(appId)
  }

  async setAppGrant (appId, capability, methods) {
    if (!capability || !Array.isArray(methods)) throw new Error('capability and methods[] are required')
    const app = await this.registry.getApp(appId)
    if (!app) throw new Error(`Unknown app: ${appId}`)
    const grants = { ...(app.grants || defaultCapabilityGrants(this.capabilities)) }
    grants[capability] = [...methods]
    await this.registry.registerApp({ ...app, grants })
    for (const [socket, session] of this.sessions) {
      if (session.appId !== appId) continue
      this.sessions.set(socket, { ...session, grants })
    }
    this.emit('appGrantChanged', { appId, capability, methods: grants[capability] })
    return this.registry.getApp(appId)
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
    for (const [socket, session] of this.sessions) {
      if (session.appId !== appId) continue
      this.sessions.delete(socket)
      try { socket.destroy() } catch {}
    }
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

function clampInteger (value, min, max, fallback) {
  if (!Number.isSafeInteger(value)) return fallback
  return Math.max(min, Math.min(max, value))
}
