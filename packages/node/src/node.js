import Corestore from 'corestore'
import Hyperswarm from 'hyperswarm'
import b4a from 'b4a'
import { EventEmitter } from 'bare-events'
import { AppRegistry } from './registry.js'
import { ReplicationEngine } from './replication.js'
import { AIProvider } from './ai-provider.js'
import { localDiscoveryTopic, encodeMessage, DEFAULT_SERVICES, PROTOCOL_VERSION } from './protocol.js'

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

    // AI provider is opt-in. Accept either an already-constructed provider
    // (for testing) or a config object like `{ mock: true }` that we'll use
    // to build one on start(). `services.ai` only flips to true when the
    // provider starts successfully.
    this._aiOpts = opts.ai || null
    this.ai = opts.aiProvider || null

    // Which services we're actually running. `files` was bolted onto the
    // protocol before Hyperdrive replication existed — it's always on now.
    // `ai` flips to true when start() successfully brings up an AIProvider.
    this.services = { ...DEFAULT_SERVICES, ...(opts.services || {}) }

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
        this.emit('aiReady', { mock: !!this._aiOpts?.mock, modelId: this.ai.modelId })
      } catch (err) {
        this.emit('aiError', { phase: 'start', error: err.message })
        this.ai = null
      }
    }

    this.emit('ready', {
      topic: b4a.toString(topic, 'hex'),
      publicKey: b4a.toString(this.discoverySwarm.keyPair.publicKey, 'hex')
    })
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
      services: this.services
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
      default:
        this.emit('unknownMessage', { type: msg.type, from: remoteKey })
    }
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
      remoteKey
    })

    if (this._approvePairing) {
      let decision
      try {
        decision = await this._approvePairing({
          appId: msg.appId,
          appName: msg.appName,
          publicKey: msg.publicKey,
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
          reason: typeof decision === 'string' ? decision : 'denied'
        })
        return
      }
    }

    await this.registry.registerApp({
      appId: msg.appId,
      appName: msg.appName,
      publicKey: msg.publicKey
    })

    socket.write(encodeMessage({
      type: 'pairAccepted',
      nodePublicKey: b4a.toString(this.discoverySwarm.keyPair.publicKey, 'hex'),
      services: this.services
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
  }

  async getStatus () {
    const apps = await this.registry.listApps()
    const coreStats = this.replication.getStats()
    const driveStats = this.replication.getDriveStats()
    const connectedPeers = this.connections.size

    return { apps, cores: coreStats, drives: driveStats, connectedPeers, services: this.services }
  }

  async unpairApp (appId) {
    await this.replication.removeAppCores(appId)
    await this.registry.removeApp(appId)
    this.emit('unpaired', { appId })
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
