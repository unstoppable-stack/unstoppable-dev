import Hyperswarm from 'hyperswarm'
import b4a from 'b4a'
import { EventEmitter } from 'bare-events'
import { localDiscoveryTopic, localDeviceName, encodeMessage } from './protocol.js'
import { ClientClosedError, InferenceError, NodeClientError } from './errors.js'

// How long we'll wait for a peer to send `nodeHello` before deciding it's
// not actually a Node and dropping the connection. This matters because
// anyone on the same Hyperswarm topic could connect; we only trust peers
// that identify themselves with the Node greeting.
const HELLO_TIMEOUT_MS = 2_000

// `process` exists in Node.js and Bare, but Bare does not expose `pid` or
// `uptime()`. Wrap in guards so the client works across both runtimes.
const _proc = typeof process !== 'undefined' ? process : null
const _pid = _proc && typeof _proc.pid === 'number' ? _proc.pid : 0
const _startedAt = Date.now()
function _uptime () {
  if (_proc && typeof _proc.uptime === 'function') return _proc.uptime()
  return (Date.now() - _startedAt) / 1000
}

// Default reconnect knobs when the caller passes `reconnect: true`.
const DEFAULT_RECONNECT = Object.freeze({
  initialDelayMs: 500,
  maxDelayMs: 15_000,
  factor: 2,
  maxAttempts: Infinity
})

export class NodeClient extends EventEmitter {
  constructor ({
    appId,
    appName,
    cores = [],
    drives = [],
    swarm: swarmOpts,
    topic: topicOverride,
    deviceName,
    reconnect
  }) {
    super()
    this.appId = appId
    this.appName = appName
    this.cores = cores
    this.drives = drives
    this.deviceName = typeof deviceName === 'string' && deviceName.length > 0
      ? deviceName
      : localDeviceName()

    this.swarm = new Hyperswarm(swarmOpts)
    this.socket = null
    this.nodePublicKey = null
    this.services = null
    this.protocolVersion = null
    this.paired = false
    this.registered = false
    this._closing = false
    this._candidates = new Map()
    this._topicOverride = topicOverride || null
    this._inferenceRequests = new Map()
    this._statusRequests = new Map()
    this._requestSeq = 0
    this.lastStatus = null
    this._topic = null

    this._reconnect = reconnect
      ? { ...DEFAULT_RECONNECT, ...(typeof reconnect === 'object' ? reconnect : {}) }
      : null
    this._reconnectAttempt = 0
    this._reconnectTimer = null
    this._wasEverPaired = false
  }

  async connect () {
    const topic = this._topicOverride || localDiscoveryTopic()
    this._topic = topic

    this.swarm.join(topic, { server: false, client: true })

    this.swarm.on('connection', (socket, info) => {
      if (this.paired) {
        socket.destroy()
        return
      }

      const remoteKey = b4a.toString(info.publicKey, 'hex')
      // Don't pair until the peer greets us with `nodeHello`. If the
      // greeting never arrives inside HELLO_TIMEOUT_MS, it's not a Node
      // (probably another app sharing the local discovery topic) and we
      // quietly drop the socket. We previously fired `pairRequest` eagerly
      // here, which worked but gave us no way to advertise service
      // capabilities and leaked pair attempts to non-Node peers.
      const helloTimer = setTimeout(() => {
        this._candidates.delete(remoteKey)
        socket.destroy()
      }, HELLO_TIMEOUT_MS)

      this._candidates.set(remoteKey, { socket, helloTimer })
      this.emit('candidateFound', { publicKey: remoteKey })

      this._setupCandidateSocket(socket, remoteKey)
    })

    await this.swarm.flush()
    this.emit('searching')
  }

  _setupCandidateSocket (socket, remoteKey) {
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
      this._clearCandidate(remoteKey)
      if (this.socket === socket) {
        this.socket = null
        this.paired = false
        this.registered = false
        this.services = null
        if (!this._closing) {
          this.emit('disconnected')
          if (this._reconnect) this._scheduleReconnect()
        }
      }
    })

    socket.on('error', () => {
      this._clearCandidate(remoteKey)
    })
  }

  _clearCandidate (remoteKey) {
    const entry = this._candidates.get(remoteKey)
    if (!entry) return
    if (entry.helloTimer) clearTimeout(entry.helloTimer)
    this._candidates.delete(remoteKey)
  }

  _handleNodeHello (msg, socket, remoteKey) {
    const entry = this._candidates.get(remoteKey)
    if (!entry) return
    // Already greeted — ignore duplicates.
    if (entry.greeted) return
    entry.greeted = true
    if (entry.helloTimer) {
      clearTimeout(entry.helloTimer)
      entry.helloTimer = null
    }

    // Remember the first node's advertised services so the caller can
    // decide whether to proceed even before `paired` fires.
    if (!this.services) {
      this.services = msg.services || null
      this.protocolVersion = msg.protocolVersion || null
      this.emit('nodeHello', {
        publicKey: remoteKey,
        nodePublicKey: msg.nodePublicKey,
        services: msg.services,
        protocolVersion: msg.protocolVersion
      })
    }

    this._sendPairRequest(socket)
  }

  _sendPairRequest (socket) {
    socket.write(encodeMessage({
      type: 'pairRequest',
      appId: this.appId,
      appName: this.appName,
      publicKey: b4a.toString(this.swarm.keyPair.publicKey, 'hex'),
      deviceName: this.deviceName || undefined,
      pid: _pid
    }))
  }

  _handleMessage (msg, socket, remoteKey) {
    switch (msg.type) {
      case 'nodeHello':
        this._handleNodeHello(msg, socket, remoteKey)
        break

      case 'pairAccepted':
        if (this.paired) {
          socket.destroy()
          return
        }
        this.paired = true
        this.socket = socket
        this.nodePublicKey = msg.nodePublicKey
        // `pairAccepted` carries services too, but nodeHello already filled
        // these in — keep them in sync in case the node updates between
        // hello and pair (e.g. ai comes online mid-session in future).
        if (msg.services) this.services = msg.services

        for (const [key, candidate] of this._candidates) {
          if (key !== remoteKey) candidate.socket.destroy()
        }
        this._candidates.clear()

        this.emit('paired', {
          nodePublicKey: msg.nodePublicKey,
          services: msg.services
        })
        this._sendRegistration()
        break

      case 'pairDenied':
        this.emit('pairDenied', { reason: msg.reason })
        socket.destroy()
        break

      case 'registered': {
        this.registered = true
        const isReconnection = this._wasEverPaired
        this._wasEverPaired = true
        if (isReconnection) {
          this._reconnectAttempt = 0
          this.emit('reconnected', { attempts: this._reconnectAttempt })
        }
        this.emit('registered', { replicating: msg.replicating })
        break
      }

      case 'syncStatus':
        this.emit('syncStatus', msg)
        break

      case 'inference-token':
      case 'inference-done':
      case 'inference-error': {
        const handler = this._inferenceRequests.get(msg.requestId)
        if (handler) handler(msg)
        else this.emit('message', msg)
        break
      }

      case 'status': {
        this.lastStatus = msg.status
        this.emit('nodeStatus', msg.status)
        const resolve = this._statusRequests.get(msg.requestId)
        if (resolve) {
          this._statusRequests.delete(msg.requestId)
          resolve(msg.status)
        }
        break
      }

      case 'disk-usage': {
        const resolve = this._statusRequests.get(msg.requestId)
        if (resolve) {
          this._statusRequests.delete(msg.requestId)
          resolve(msg.usage)
        }
        break
      }

      case 'peek-core-result':
      case 'peek-drive-result': {
        const resolve = this._statusRequests.get(msg.requestId)
        if (resolve) {
          this._statusRequests.delete(msg.requestId)
          resolve(msg.result)
        }
        break
      }

      case 'error':
        this.emit('nodeError', { message: msg.message })
        break

      default:
        this.emit('message', msg)
    }
  }

  /**
   * Request an AI completion from the node's AI provider.
   *
   * Yields token strings as they arrive. Throws if the node didn't advertise
   * `services.ai` or if inference errors on the server side.
   *
   * @param {Object} req
   * @param {Array<{role:string,content:string}>} req.messages
   * @returns {AsyncGenerator<string>}
   */
  /**
   * Ask the Node for a fresh status snapshot. Useful for "Connected to:
   * 3 apps, AI ready" style headers. Also emits a `nodeStatus` event.
   *
   * @param {Object} [opts]
   * @param {number} [opts.timeout=5000]
   * @returns {Promise<Object>}
   */
  async getNodeStatus ({ timeout = 5_000 } = {}) {
    if (this._closing) throw new ClientClosedError()
    if (!this.paired || !this.socket) throw new ClientClosedError('Not paired with a node')

    const requestId = `s${++this._requestSeq}`
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this._statusRequests.delete(requestId)
        reject(new NodeClientError('STATUS_TIMEOUT', `getNodeStatus() timed out after ${timeout}ms`))
      }, timeout)
      this._statusRequests.set(requestId, (status) => {
        clearTimeout(timer)
        resolve(status)
      })
      this.socket.write(encodeMessage({ type: 'status-request', requestId }))
    })
  }

  /**
   * Ask the Node to walk its storage directory and report disk usage in
   * bytes. Slow on large stores — call ad-hoc, not in tight loops.
   * Returns `null` if the node can't read its storage.
   *
   * @param {Object} [opts]
   * @param {number} [opts.timeout=30000]
   * @returns {Promise<{ bytes:number, files:number, path:string }|null>}
   */
  async getDiskUsage ({ timeout = 30_000 } = {}) {
    if (this._closing) throw new ClientClosedError()
    if (!this.paired || !this.socket) throw new ClientClosedError('Not paired with a node')

    const requestId = `d${++this._requestSeq}`
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this._statusRequests.delete(requestId)
        reject(new NodeClientError('STATUS_TIMEOUT', `getDiskUsage() timed out after ${timeout}ms`))
      }, timeout)
      this._statusRequests.set(requestId, (usage) => {
        clearTimeout(timer)
        resolve(usage)
      })
      this.socket.write(encodeMessage({ type: 'disk-usage-request', requestId }))
    })
  }

  /**
   * Peek at the last N blocks of a core the Node is replicating. Useful
   * for a "data flowing?" sanity check from the dashboard; not a
   * Hyperbee query API. Returns `null` if the Node isn't replicating
   * that key.
   */
  async peekCore (key, { limit = 5, timeout = 15_000 } = {}) {
    return this._peek('peek-core', { key, limit }, timeout)
  }

  /**
   * Directory listing for a Hyperdrive the Node is replicating.
   * Returns `null` if the Node isn't replicating that key.
   */
  async peekDrive (key, { dir = '/', limit = 50, timeout = 15_000 } = {}) {
    return this._peek('peek-drive', { key, dir, limit }, timeout)
  }

  _peek (type, payload, timeoutMs) {
    if (this._closing) throw new ClientClosedError()
    if (!this.paired || !this.socket) throw new ClientClosedError('Not paired with a node')

    const requestId = `p${++this._requestSeq}`
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this._statusRequests.delete(requestId)
        reject(new NodeClientError('PEEK_TIMEOUT', `${type} timed out after ${timeoutMs}ms`))
      }, timeoutMs)
      this._statusRequests.set(requestId, (result) => {
        clearTimeout(timer)
        resolve(result)
      })
      this.socket.write(encodeMessage({ type, requestId, ...payload }))
    })
  }

  async *requestInference ({ messages }) {
    if (this._closing) throw new ClientClosedError()
    if (!this.paired || !this.socket) throw new ClientClosedError('Not paired with a node')
    if (!this.services?.ai) throw new NodeClientError('NODE_MISSING_SERVICE', 'Node does not advertise AI service', { missing: ['ai'], services: this.services })

    const requestId = `r${++this._requestSeq}`
    const queue = []
    let resolveNext = null
    let done = false
    let error = null

    this._inferenceRequests.set(requestId, (msg) => {
      if (msg.type === 'inference-token') {
        queue.push(msg.token)
      } else if (msg.type === 'inference-done') {
        done = true
      } else if (msg.type === 'inference-error') {
        error = new InferenceError(msg.error || 'inference failed')
        done = true
      }
      if (resolveNext) { const r = resolveNext; resolveNext = null; r() }
    })

    this.socket.write(encodeMessage({
      type: 'inference',
      requestId,
      appId: this.appId,
      messages
    }))

    try {
      while (true) {
        if (queue.length > 0) {
          yield queue.shift()
          continue
        }
        if (done) break
        await new Promise((resolve) => { resolveNext = resolve })
      }
      if (error) throw error
    } finally {
      this._inferenceRequests.delete(requestId)
    }
  }

  _sendRegistration () {
    if (!this.socket || !this.paired) return

    const coreDescriptors = this.cores.map(c => ({
      key: typeof c.key === 'string' ? c.key : b4a.toString(c.key, 'hex'),
      type: c.type || 'hypercore',
      name: c.name
    }))

    const driveDescriptors = this.drives.map(d => ({
      key: typeof d.key === 'string' ? d.key : b4a.toString(d.key, 'hex'),
      name: d.name
    }))

    this.socket.write(encodeMessage({
      type: 'register',
      appId: this.appId,
      cores: coreDescriptors,
      drives: driveDescriptors
    }))
  }

  sendHeartbeat () {
    if (!this.socket || !this.paired) return
    this.socket.write(encodeMessage({
      type: 'heartbeat',
      appId: this.appId,
      uptime: _uptime()
    }))
  }

  // Opt-in reconnect with exponential backoff. The hyperswarm topic stays
  // joined across disconnects, so most of the time a new peer will arrive
  // on its own; the scheduler is here mainly to (a) re-emit `searching`
  // events for the app to react to and (b) optionally bail out after
  // maxAttempts so a poorly-behaved Node doesn't trap the app forever.
  _scheduleReconnect () {
    if (this._closing || !this._reconnect) return
    if (this._reconnectTimer) return

    const { initialDelayMs, maxDelayMs, factor, maxAttempts } = this._reconnect
    if (this._reconnectAttempt >= maxAttempts) {
      this.emit('reconnectFailed', { attempts: this._reconnectAttempt })
      return
    }
    this._reconnectAttempt++
    const delay = Math.min(
      initialDelayMs * Math.pow(factor, this._reconnectAttempt - 1),
      maxDelayMs
    )
    this.emit('reconnecting', { attempt: this._reconnectAttempt, delayMs: delay })
    this._reconnectTimer = setTimeout(() => {
      this._reconnectTimer = null
      if (this._closing || this.paired) return
      // Re-join the discovery topic to nudge the swarm. Hyperswarm dedupes
      // joins on the same topic so this is cheap if we're still joined.
      try {
        if (this._topic) this.swarm.join(this._topic, { server: false, client: true })
        this.swarm.flush().catch(() => {})
      } catch {}
      this.emit('searching')
      // If we still haven't paired by the next backoff window, escalate.
      this._scheduleReconnect()
    }, delay)
  }

  async close () {
    this._closing = true
    if (this._reconnectTimer) {
      clearTimeout(this._reconnectTimer)
      this._reconnectTimer = null
    }
    for (const [, entry] of this._candidates) {
      if (entry.helloTimer) clearTimeout(entry.helloTimer)
      try { entry.socket.destroy() } catch {}
    }
    this._candidates.clear()
    if (this.socket) this.socket.destroy()
    await this.swarm.destroy()
    this.emit('closed')
  }
}
