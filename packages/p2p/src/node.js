import { EventEmitter } from 'bare-events'
import Hyperswarm from 'hyperswarm'
import Protomux from 'protomux'
import { normalizeLimits, boundedJson } from './limits.js'
import b4a from 'b4a'

import { acquireStorageLock, runtimePath } from './runtime-files.js'
import { loadIdentity } from './identity.js'
import { CapabilityRegistry } from './capabilities.js'
import { PeerRegistry } from './registry.js'
import { InviteStore } from './invite-store.js'
import { decodeInvite, inviteProof, inviteTopic, issueInvite } from './invite.js'
import { Peer, deferred } from './peer.js'
import {
  CONTROL_PROTOCOL,
  localDiscoveryTopic,
  MESSAGE,
  networkTopic,
  NODE_TYPES,
  PROTOCOL_VERSION,
  ROLES,
  toPublicKeyBuffer,
  toPublicKeyHex
} from './protocol.js'
import { CancelledError, ClosedError, InvalidOptionError, PairDeniedError, PeerNotFoundError } from './errors.js'

// How often an outstanding discover()/pair() re-queries the DHT.
const DISCOVERY_RETRY_MS = 2_000

// One runtime, two verbs. `listen()` accepts pair requests; `connect()` dials
// a known peer. A process may do either, both, or neither — which is what
// makes "an app that acts like a node" a configuration rather than a class.
export class UnstoppableNode extends EventEmitter {
  constructor (opts = {}) {
    super()
    // Diagnostics remain observable without making malformed remote traffic
    // crash an application that has not installed its own error listener.
    this.on('error', () => {})
    if (!opts.storage || typeof opts.storage !== 'string') {
      throw new InvalidOptionError('createNode() needs a `storage` directory for identity and peers')
    }

    this.storage = opts.storage
    this.profile = {
      appId: opts.profile?.appId || null,
      appName: opts.profile?.appName || null,
      deviceName: opts.profile?.deviceName || null
    }
    this.nodeType = opts.nodeType || NODE_TYPES.APP
    this.capabilities = new CapabilityRegistry(opts.capabilities || [])
    this.peerRegistry = new PeerRegistry(this.storage)
    this.invites = new InviteStore(this.storage)

    this.identity = null
    this.swarm = null
    this.listening = false
    this.closed = false

    this.limits = normalizeLimits(opts.limits)
    this._activeRequests = 0
    this._swarmOpts = opts.swarm || {}
    this._topic = opts.topic ?? null
    this._pairing = { ...(opts.pairing || {}) }
    if (typeof this._pairing.approve !== 'function') {
      this._pairing.approve = this._pairing.autoApprove === true
        ? async () => 'approve'
        : async () => 'approval required; use a scoped invitation'
    }
    this._connections = new Set() // all transports, including replication-only peers
    this._peers = new Map()          // remote public key (hex) -> Peer
    this._dialing = new Map()        // remote key -> shared handshake, independently bounded waiters
    this._discovering = null         // in-flight discover() by topic
    this._redeeming = null           // in-flight pair() by invite code
    this._servedInvites = new Set()  // invite topics currently announced
    this._networks = new Map()       // network id -> { id, topic, grants, requested, approve }
    this._inviteWatcher = null
    this._inviteWatchMs = opts.inviteWatchMs ?? 5_000
    // Peers we should chase when the connection drops. A node restarting is
    // the normal case, not an error, so an app that asked to stay connected
    // should not have to restart to recover.
    this._sticky = new Map()         // public key (hex) -> { attempts, timer, opts }
    this._reconnect = normalizeReconnect(opts.reconnect)
    this._readyPromise = null
    this._closePromise = null
    this._releaseStorage = null
    this._attachedPacks = []
    this._handshakeTimeout = opts.handshakeTimeoutMs ?? 30_000
    if (!Number.isSafeInteger(this._handshakeTimeout) || this._handshakeTimeout < 1) {
      throw new InvalidOptionError('handshakeTimeoutMs must be a positive safe integer')
    }
  }

  get publicKey () {
    return this.identity?.publicKey || null
  }

  get peers () {
    return [...this._peers.values()].filter((peer) => peer.paired)
  }

  peer (publicKey) {
    return this._peers.get(toPublicKeyHex(publicKey)) || null
  }

  async ready () {
    if (this.closed) throw new ClosedError()
    if (this._readyPromise) return this._readyPromise
    this._readyPromise = this._open()
    return this._readyPromise
  }

  async _open () {
    try {
      this._releaseStorage = await acquireStorageLock(runtimePath.join(this.storage, 'runtime.lock'), { timeout: 0 })
      if (this.closed) throw new ClosedError()
      this.identity = await loadIdentity(this.storage)
      await this.peerRegistry.ready()
      await this.invites.ready()
      if (this.closed) throw new ClosedError()
      this.swarm = new Hyperswarm({ ...this._swarmOpts, keyPair: this.identity.keyPair })
      this.swarm.on('connection', (socket, info) => this._onConnection(socket, info))
      for (const pack of this.capabilities.packs.values()) {
        this._attachedPacks.push(pack)
        if (typeof pack.onAttach === 'function') await pack.onAttach(this)
        if (this.closed) throw new ClosedError()
      }
      this.emit('ready', { publicKey: this.identity.publicKey })
    } catch (error) {
      try { await this._disposeResources() } catch (cleanupError) {
        this.emit('error', { type: 'cleanup', error: cleanupError.message })
      }
      throw error
    }
  }

  async _detachPacks () {
    let failure = null
    for (const pack of this._attachedPacks.splice(0).reverse()) {
      try { await pack.onDetach?.() } catch (error) { failure ||= error }
    }
    if (failure) throw failure
  }

  async _disposeResources () {
    // Attempt every cleanup phase, even if transport or a hook rejects. The
    // caller still receives the first cleanup error after ownership is released.
    let failure = null
    for (const cleanup of [
      () => this.swarm?.destroy(),
      () => this.peerRegistry.flushed(),
      () => this.invites.flushed(),
      () => this._detachPacks()
    ]) {
      try { await cleanup() } catch (error) { failure ||= error }
    }
    if (this._releaseStorage) {
      const release = this._releaseStorage
      this._releaseStorage = null
      try { await release() } catch (error) { failure ||= error }
    }
    if (failure) throw failure
  }

  // Reachable by public key always; a topic is joined only when one is given.
  // App-nodes deliberately do not join the machine-local topic by default —
  // that topic means "the Personal Node on this box", and every app-node
  // joining it as a server is how peers end up greeting each other.
  async listen ({ topic } = {}) {
    await this.ready()
    if (this.closed) throw new ClosedError()

    await this.swarm.listen()
    if (this.closed) throw new ClosedError()

    const joinTopic = topic ?? this._topic
    if (joinTopic) {
      this.swarm.join(joinTopic, { server: true, client: false })
      await this.swarm.flush()
      if (this.closed) throw new ClosedError()
    }

    await this._serveOutstandingInvites()
    if (this.closed) throw new ClosedError()
    this._watchInvites()

    this.listening = true
    this.emit('listening', {
      publicKey: this.identity.publicKey,
      topic: joinTopic ? b4a.toString(joinTopic, 'hex') : null
    })
    return this
  }

  // Dial a known peer directly by public key. First contact for peers whose
  // key you do not have yet is an invite (Phase 3), which resolves to exactly
  // this call once the key is known.
  async connect (publicKey, { requested = null, timeout = 15_000, reconnect, signal } = {}) {
    await this.ready()
    if (this.closed) throw new ClosedError()

    if (signal?.aborted) throw new CancelledError()
    const keyBuffer = toPublicKeyBuffer(publicKey)
    if (!keyBuffer || keyBuffer.length !== 32) {
      throw new InvalidOptionError('connect() needs a 32-byte public key (hex string or buffer)')
    }
    const hex = toPublicKeyHex(keyBuffer)
    if (this.peerRegistry.isDenied(hex)) throw new PairDeniedError('peer revoked; forget the denial before pairing again')

    const existing = this._peers.get(hex)
    if (existing?.paired && !existing.closed) return existing

    let dialing = this._dialing.get(hex)
    if (!dialing) {
      const waiters = new Set()
      dialing = { requested, waiters, retryTimer: null,
        cleanup: () => { clearTimeout(dialing.retryTimer); for (const waiter of waiters) waiter.cleanup() },
        pending: {
          resolve: peer => { for (const waiter of [...waiters]) waiter.finish(null, peer) },
          reject: error => { for (const waiter of [...waiters]) waiter.finish(error) }
        }
      }
      this._dialing.set(hex, dialing)
    }

    // Share the transport/handshake, not a caller's timeout or cancellation.
    // In particular a foreground request must not inherit the almost-expired
    // deadline of a background reconnect attempt.
    const pending = deferred()
    let timer = null
    const waiter = {
      cleanup: () => { clearTimeout(timer); signal?.removeEventListener('abort', onAbort) },
      finish: (error, peer) => {
        if (!dialing.waiters.delete(waiter)) return
        waiter.cleanup()
        if (error) pending.reject(error)
        else pending.resolve(peer)
      }
    }
    const release = (error, cancelled) => {
      waiter.finish(error)
      if (dialing.waiters.size || this._dialing.get(hex) !== dialing) return
      dialing.cleanup()
      this._dialing.delete(hex)
      if (cancelled) {
        clearTimeout(this._sticky.get(hex)?.timer)
        this._sticky.delete(hex)
        this.swarm.leavePeer(keyBuffer)
        const peer = this._peers.get(hex)
        if (peer && !peer.paired) peer.close()
      } else {
        if (!this._sticky.has(hex)) this.swarm.leavePeer(keyBuffer)
        // A failed lookup creates no Peer and emits no peerDisconnected.
        this._scheduleReconnect(hex)
      }
    }
    const onAbort = () => release(new CancelledError(), true)
    dialing.waiters.add(waiter)
    if (timeout > 0) timer = setTimeout(() => release(new PeerNotFoundError(hex), false), timeout)
    signal?.addEventListener('abort', onAbort, { once: true })
    // Only register; never overwrite. A retry dial goes through connect() too,
    // and resetting `attempts` here would make maxAttempts unreachable and
    // hide the fact that a successful dial was a *re*connection.
    if ((reconnect ?? this._reconnect.enabled) && !this._sticky.has(hex)) {
      this._sticky.set(hex, { attempts: 0, timer: null, requested })
    }
    this.swarm.joinPeer(keyBuffer)
    if (existing?.publicKey && !existing.closed) this._initiatePairing(existing)

    return pending.promise
  }

  // Client-side counterpart of `listen({ topic })`: find whoever is serving a
  // topic without knowing their key up front. This is how an app finds the
  // Personal Node on its own machine; after pairing, the key is stored and
  // every reconnect goes direct.
  async discover ({ topic, timeout = 15_000, requested = null, reconnect, signal } = {}) {
    await this.ready()
    if (this.closed) throw new ClosedError()

    if (this._discovering || this._redeeming) throw new InvalidOptionError('Another discovery or pairing operation is already active')
    if (signal?.aborted) throw new CancelledError()
    const joinTopic = topic || localDiscoveryTopic()
    const pending = deferred()
    const timer = timeout > 0
      ? setTimeout(() => {
          this._discovering?.cleanup(true)
          this._discovering = null
          pending.reject(new PeerNotFoundError('topic:' + b4a.toString(joinTopic, 'hex').slice(0, 12)))
        }, timeout)
      : null

    this._discovering = { topic: joinTopic, pending, requested, timer, reconnect: reconnect ?? this._reconnect.enabled }
    const operation = this._discovering
    this._setupDiscovery(operation, joinTopic, signal, () => {
      if (this._discovering === operation) this._discovering = null
    })

    return pending.promise
  }

  // Issue an invite: a short code carrying this node's public key and a
  // one-off secret. Unlike same-machine discovery, the grants come from the
  // invite rather than from the packs' defaults — a peer reachable from
  // another device should get exactly what the person issuing the code chose.
  async createInvite ({ grants = null, expiresIn = 15 * 60_000, uses = 1, label = null } = {}) {
    await this.ready()
    if (this.closed) throw new ClosedError()
    if (uses !== null && (!Number.isSafeInteger(uses) || uses < 1)) {
      throw new InvalidOptionError('Invite uses must be a positive integer or null for unlimited')
    }

    const issued = await issueInvite({
      storage: this.storage,
      grants: grants ? this.capabilities.grantsFor(grants) : this.capabilities.defaultGrants(),
      uses,
      expiresIn,
      label
    })
    if (this.closed) throw new ClosedError()
    await this.invites.reload()
    if (this.closed) throw new ClosedError()

    // Serving the invite topic is what lets a peer that has never seen this
    // node find it. Reconnects afterwards go direct by key.
    await this.swarm.listen()
    if (this.closed) throw new ClosedError()
    await this._serveOutstandingInvites()
    if (this.closed) throw new ClosedError()
    await this.swarm.flush().catch(() => {})
    if (this.closed) throw new ClosedError()

    this.emit('inviteCreated', { id: issued.id, expiresAt: issued.expiresAt, uses })
    return issued
  }

  listInvites () {
    return this.invites.list().map(({ secret, ...rest }) => rest)
  }

  async revokeInvite (id) {
    const revoked = await this.invites.revoke(id)
    if (revoked) this.emit('inviteRevoked', { id })
    return revoked
  }

  // Announce every outstanding invite, and stop announcing ones that expired,
  // were spent, or were revoked. Safe to call repeatedly.
  async _serveOutstandingInvites ({ reload = false } = {}) {
    if (this.closed) return
    if (reload) await this.invites.reload()
    if (this.closed) return

    const live = new Set()
    let joined = 0
    for (const record of this.invites.list()) {
      if (!record.secret) continue
      const topic = inviteTopic(b4a.from(record.secret, 'hex'))
      const hex = b4a.toString(topic, 'hex')
      live.add(hex)
      if (this._servedInvites.has(hex)) continue
      this.swarm.join(topic, { server: true, client: false })
      this._servedInvites.add(hex)
      joined++
    }

    for (const hex of [...this._servedInvites]) {
      if (live.has(hex)) continue
      try { this.swarm.leave(b4a.from(hex, 'hex')) } catch {}
      this._servedInvites.delete(hex)
    }

    // Joining is not announcing. Without flushing, an invite picked up by the
    // watcher is not yet findable on the DHT, and a joiner redeeming it right
    // away sees nobody serving the topic.
    if (joined > 0) await this.swarm.flush().catch(() => {})
  }

  // `us node invite` writes to the same storage directory rather than talking
  // to this process, so poll for invites created behind our back.
  _watchInvites () {
    if (this._inviteWatcher || this._inviteWatchMs <= 0) return
    this._inviteWatcher = setInterval(() => {
      this._serveOutstandingInvites({ reload: true }).catch((err) => {
        if (!this.closed) this.emit('error', { type: 'invites', error: err.message })
      })
    }, this._inviteWatchMs)
    if (this._inviteWatcher.unref) this._inviteWatcher.unref()
  }

  // Join a named app network: every instance of an app that wants to find its
  // siblings joins the same topic. Invites are 1:1, so a five-device mesh
  // would otherwise need ten codes.
  //
  // The topic is derived from a guessable name, so treat everyone on it as a
  // stranger: `grants` is the ceiling for what they may call here, and it is
  // the real security boundary. Without it they get the packs' defaults.
  async joinNetwork (id, { grants = null, requested = null, approve = null } = {}) {
    await this.ready()
    if (this.closed) throw new ClosedError()

    const topic = networkTopic(id)

    await this.swarm.listen()
    if (this.closed) throw new ClosedError()
    this._networks.set(id, { id, topic, grants, requested, approve })
    this.swarm.join(topic, { server: true, client: true })
    await this.swarm.flush().catch(() => {})
    if (this.closed) throw new ClosedError()

    this.emit('networkJoined', { id, topic: b4a.toString(topic, 'hex') })
    return { id, topic: b4a.toString(topic, 'hex') }
  }

  async leaveNetwork (id) {
    const network = this._networks.get(id)
    if (!network) return false
    this._networks.delete(id)
    try { await this.swarm.leave(network.topic) } catch {}
    this.emit('networkLeft', { id })
    return true
  }

  get networks () {
    return [...this._networks.keys()]
  }

  // Redeem an invite code: derive its topic, find the issuer, and pair with
  // proof that we hold the secret.
  async pair (code, { timeout = 20_000, requested = null, reconnect, signal } = {}) {
    await this.ready()
    if (this.closed) throw new ClosedError()

    if (this._discovering || this._redeeming) throw new InvalidOptionError('Another discovery or pairing operation is already active')
    if (signal?.aborted) throw new CancelledError()
    const invite = decodeInvite(code)
    const pending = deferred()
    const timer = timeout > 0
      ? setTimeout(() => {
          this._redeeming?.cleanup(true)
          this._redeeming = null
          pending.reject(new PeerNotFoundError(invite.publicKey))
        }, timeout)
      : null

    this._redeeming = {
      pending,
      invite,
      requested,
      timer,
      reconnect: reconnect ?? this._reconnect.enabled
    }

    const operation = this._redeeming
    this._setupDiscovery(operation, invite.topic, signal, () => {
      if (this._redeeming === operation) this._redeeming = null
    })

    return pending.promise
  }

  _setupDiscovery (operation, topic, signal, remove) {
    // Each join returns its own lease; destroying it preserves other joins.
    let discovery
    try {
      discovery = this.swarm.join(topic, { server: false, client: true })
    } catch (error) {
      clearTimeout(operation.timer)
      remove()
      throw error
    }
    let stopped = false
    let pollTimer = null
    const onAbort = () => {
      operation.cleanup(true)
      remove()
      operation.pending.reject(new CancelledError())
    }
    operation.cleanup = (closePeers = false) => {
      if (stopped) return
      stopped = true
      clearTimeout(operation.timer)
      clearTimeout(pollTimer)
      signal?.removeEventListener('abort', onAbort)
      if (closePeers) {
        for (const peer of this._peers.values()) {
          if (!peer.paired && (peer._discovery === operation || operation.invite?.publicKey === peer.remotePublicKey)) peer.close()
        }
      }
      discovery.destroy().catch(() => {})
    }
    signal?.addEventListener('abort', onAbort, { once: true })
    if (signal?.aborted) onAbort()
    const poll = async () => {
      if (stopped || this.closed) return
      try { await discovery.refresh() } catch {}
      if (stopped || this.closed) return
      pollTimer = setTimeout(poll, DISCOVERY_RETRY_MS)
      if (pollTimer.unref) pollTimer.unref()
    }
    poll()
  }

  _onConnection (socket, info) {
    if (this.closed || this._connections.size >= this.limits.maxPeers) { socket.destroy(); return }
    this._connections.add(socket)
    socket.once('close', () => this._connections.delete(socket))
    const remotePublicKey = b4a.toString(socket.remotePublicKey, 'hex')

    // Hypercore's `createProtocolStream` looks for an existing muxer at
    // `noiseStream.userData` and builds its own when that slot is empty. If we
    // keep our muxer to ourselves, `store.replicate(socket)` would create a
    // second Protomux over the same stream and the two would corrupt each
    // other. Publishing it here is what lets control traffic and replication
    // share one connection.
    const noiseStream = socket.noiseStream || socket
    const mux = Protomux.from(noiseStream)
    if (!noiseStream.userData) noiseStream.userData = mux
    // Publishing our mux bypasses Hypercore's stream initialization, including
    // its keep-alive setup. Idle database peers still need transport liveness.
    if (noiseStream.keepAlive === 0) noiseStream.setKeepAlive(5000)

    const channel = mux.createChannel({
      protocol: CONTROL_PROTOCOL,
      // A plain Hypercore seeder never opens this channel. Its connection
      // remains bounded by maxPeers, but is not a stalled control handshake.
      onopen: () => {
        this._armHandshakeDeadline(peer)
      },
      onclose: () => this._onPeerClose(remotePublicKey)
    })
    // Already have a control channel with this peer on this stream.
    if (!channel) return

    const peer = new Peer({
      node: this,
      mux,
      channel,
      remotePublicKey,
      // Transport direction alone does not authorize pairing. The dialer
      // must also have an explicit operation or a matching network policy.
      initiator: !!info?.client
    })

    peer._discovery = this._discovering && info?.topics?.some(topic => b4a.equals(topic, this._discovering.topic))
      ? this._discovering : null
    peer._networkCandidates = [...this._networks.values()].filter(network =>
      info?.topics?.some(topic => b4a.equals(topic, network.topic)))

    const message = channel.addMessage({
      encoding: boundedJson(this.limits.maxFrameBytes),
      onmessage: (msg) => {
        // Protomux keeps batched replies corked until callback promises settle.
        // A capability can await a reverse RPC (or stream indefinitely), so
        // returning its promise would prevent the traffic it needs to finish.
        // Peer owns request cancellation/lifetime; retain async error handling.
        void Promise.resolve().then(() => peer.onmessage(msg)).catch((err) => {
          this.emit('error', { type: 'message', publicKey: remotePublicKey, error: err.message })
          peer.close()
        })
      }
    })
    peer.attachMessage(message)
    channel.open()

    this._peers.set(remotePublicKey, peer)
    this.emit('connection', { publicKey: remotePublicKey, initiator: peer.initiator })

    peer.send({
      type: MESSAGE.HELLO,
      protocolVersion: PROTOCOL_VERSION,
      nodeType: this.nodeType,
      roles: this.listening ? [ROLES.HOST, ROLES.CLIENT] : [ROLES.CLIENT],
      publicKey: this.identity.publicKey,
      profile: this.profile,
      capabilities: this.capabilities.describe()
    })
  }

  // Handshake and pairing messages the Peer does not service itself.
  async _onPeerMessage (peer, msg) {
    switch (msg.type) {
      case MESSAGE.HELLO: return this._onHello(peer, msg)
      case MESSAGE.PAIR_REQUEST: return this._onPairRequest(peer, msg)
      case MESSAGE.PAIR_ACCEPTED: return this._onPairAccepted(peer, msg)
      case MESSAGE.PAIR_CONFIRM: return this._onPairConfirm(peer, msg)
      case MESSAGE.PAIR_DENIED: return this._onPairDenied(peer, msg)
    }
  }

  _onHello (peer, msg) {
    // The hello is self-reported; the Noise handshake is not. A peer that
    // claims a different key than it authenticated with is rejected outright.
    if (msg.publicKey !== peer.remotePublicKey) {
      this.emit('error', {
        type: 'handshake',
        publicKey: peer.remotePublicKey,
        error: 'identity key does not match secure transport'
      })
      peer.close()
      return
    }
    if (msg.protocolVersion !== PROTOCOL_VERSION) {
      this.emit('error', {
        type: 'handshake',
        publicKey: peer.remotePublicKey,
        error: `unsupported protocol version ${msg.protocolVersion}`
      })
      peer.close()
      return
    }

    if (peer.publicKey) { peer.close(); return }
    // A valid greeting completes the control handshake. Resource-discovery
    // peers can replicate indefinitely without requesting RPC authority.
    clearTimeout(peer._handshakeTimer)
    peer.publicKey = msg.publicKey
    peer.profile = msg.profile || {}
    peer.nodeType = msg.nodeType || null
    peer.capabilities = msg.capabilities || {}
    peer.helloed.resolve(peer)
    this.emit('hello', { publicKey: peer.publicKey, profile: peer.profile, capabilities: peer.capabilities })

    if (peer.initiator) this._initiatePairing(peer)
  }

  _armHandshakeDeadline (peer) {
    clearTimeout(peer._handshakeTimer)
    peer._handshakeTimer = setTimeout(() => { peer.close() }, this._handshakeTimeout)
    peer._handshakeTimer.unref?.()
  }

  _initiatePairing (peer) {
    if (peer.closed || peer.paired || peer._requestedPairing) return
    const dialing = this._dialing.get(peer.remotePublicKey)
    const redeeming = this._redeeming?.invite.publicKey === peer.remotePublicKey ? this._redeeming : null
    const discovering = peer._discovery === this._discovering ? peer._discovery : null
    const network = peer._networkCandidates?.find(candidate => this._networks.get(candidate.id) === candidate)
    // Transport initiation is not consent: replication discovers arbitrary
    // seeders. Only an explicit operation or a matched app network may pair.
    if (!dialing && !redeeming && !discovering && !network) return
    this._armHandshakeDeadline(peer)
    peer._pairingIntent = dialing || redeeming || discovering
      ? { kind: 'explicit' } : { kind: 'network', network }
    peer.send({
      type: MESSAGE.PAIR_REQUEST,
      ...(peer._pairingIntent.kind === 'network' ? { networks: [network.id] } : {}),
      requested: dialing?.requested ?? redeeming?.requested ?? discovering?.requested ?? network?.requested ?? null,
      ...(redeeming ? { invite: {
        id: redeeming.invite.id,
        proof: inviteProof(redeeming.invite.secret, this.identity.publicKey, peer.remotePublicKey)
      } } : {})
    })
  }

  async _onPairRequest (peer, msg) {
    if (!peer.publicKey || peer.paired || peer._pairRequestPending) return
    peer._pairRequestPending = true
    this._armHandshakeDeadline(peer)
    const known = this.peerRegistry.get(peer.remotePublicKey)
    if (this.peerRegistry.isDenied(peer.remotePublicKey) ||
        await this._pairing.isDenied?.(peer.remotePublicKey)) {
      peer.send({ type: MESSAGE.PAIR_DENIED, reason: 'peer revoked' })
      return
    }

    if (msg.invite) {
      const accepted = await this._redeemInvite(peer, msg)
      if (!accepted) return
      peer.send({
        type: MESSAGE.PAIR_ACCEPTED,
        grants: peer.grantsGiven,
        requested: this._pairing.request ?? null
      })
      return
    }

    const network = this._matchNetwork(msg.networks)
    if (network) {
      const approve = network.approve || this._pairing.approve
      if (typeof approve === 'function' && known?.pairingMethod !== 'invite') {
        const decision = await this._askApproval(peer, msg, approve, { network: network.id })
        if (decision !== true) return
      }
      if (peer.closed || this.peerRegistry.isDenied(peer.remotePublicKey)) return
      // The network's ceiling wins over whatever the peer asked for.
      peer.grantsGiven = network.grants
        ? this.capabilities.grantsFor(network.grants)
        : this.capabilities.grantsFor(msg.requested)
      if (known) peer.grantsGiven = intersectGrants(peer.grantsGiven, known.grantsGiven || {})
      peer.network = network.id

      peer.send({
        type: MESSAGE.PAIR_ACCEPTED,
        grants: peer.grantsGiven,
        requested: network.requested ?? this._pairing.request ?? null
      })
      return
    }

    if (typeof this._pairing.approve === 'function' && known?.pairingMethod !== 'invite') {
      this.emit('pairRequest', {
        publicKey: peer.remotePublicKey,
        profile: peer.profile,
        nodeType: peer.nodeType,
        requested: msg.requested
      })
      let decision
      try {
        decision = await this._requestApproval(peer, this._pairing.approve, {
          publicKey: peer.remotePublicKey,
          profile: peer.profile,
          nodeType: peer.nodeType,
          capabilities: peer.capabilities,
          requested: msg.requested
        })
      } catch (err) {
        this.emit('error', { type: 'approval', publicKey: peer.remotePublicKey, error: err.message })
        decision = 'deny'
      }
      if (decision !== 'approve' && decision !== 'approve-remember') {
        const reason = typeof decision === 'string' && decision !== 'deny' ? decision : 'denied'
        peer.send({ type: MESSAGE.PAIR_DENIED, reason })
        this.emit('pairDenied', { publicKey: peer.remotePublicKey, reason })
        return
      }
    }

    if (peer.closed || this.peerRegistry.isDenied(peer.remotePublicKey)) return

    // Absent `requested` means the packs' own defaults, never everything.
    peer.grantsGiven = known
      ? intersectGrants(this.capabilities.grantsFor(msg.requested), known.grantsGiven || {})
      : this.capabilities.grantsFor(msg.requested)

    // `grants` answers their direction; `requested` opens ours. Grants are
    // per-direction: each side decides what the other may call.
    peer.send({
      type: MESSAGE.PAIR_ACCEPTED,
      grants: peer.grantsGiven,
      requested: this._pairing.request ?? null
    })
  }

  _matchNetwork (claimed) {
    if (!Array.isArray(claimed)) return null
    for (const id of claimed) {
      const network = this._networks.get(id)
      if (network) return network
    }
    return null
  }

  async _requestApproval (peer, approve, request) {
    if (peer.closed || this.closed) return 'deny'
    let onClose
    const closed = new Promise(resolve => { onClose = () => resolve('deny') })
    peer.once('close', onClose)
    try {
      return await Promise.race([Promise.resolve().then(() => approve(request)), closed])
    } finally { peer.removeListener('close', onClose) }
  }

  async _askApproval (peer, msg, approve, extra = {}) {
    this.emit('pairRequest', {
      publicKey: peer.remotePublicKey,
      profile: peer.profile,
      nodeType: peer.nodeType,
      requested: msg.requested,
      ...extra
    })
    let decision
    try {
      decision = await this._requestApproval(peer, approve, {
        publicKey: peer.remotePublicKey,
        profile: peer.profile,
        nodeType: peer.nodeType,
        capabilities: peer.capabilities,
        requested: msg.requested,
        ...extra
      })
    } catch (err) {
      this.emit('error', { type: 'approval', publicKey: peer.remotePublicKey, error: err.message })
      decision = 'deny'
    }
    if (decision !== 'approve' && decision !== 'approve-remember') {
      const reason = typeof decision === 'string' && decision !== 'deny' ? decision : 'denied'
      peer.send({ type: MESSAGE.PAIR_DENIED, reason })
      this.emit('pairDenied', { publicKey: peer.remotePublicKey, reason })
      return false
    }
    return true
  }

  // An invite is an explicit, out-of-band decision by the person who issued
  // it, so it stands in for the approval prompt — but only for its own grants.
  async _redeemInvite (peer, msg) {
    const { id, proof } = msg.invite || {}
    const record = typeof id === 'string' ? this.invites.get(id) : null

    if (!record || !record.secret) {
      peer.send({ type: MESSAGE.PAIR_DENIED, reason: 'invite is unknown, expired, or already used' })
      this.emit('pairDenied', { publicKey: peer.remotePublicKey, reason: 'invalid invite' })
      return false
    }

    const expected = inviteProof(
      b4a.from(record.secret, 'hex'),
      peer.remotePublicKey,
      this.identity.publicKey
    )
    if (proof !== expected) {
      peer.send({ type: MESSAGE.PAIR_DENIED, reason: 'invite proof did not verify' })
      this.emit('pairDenied', { publicKey: peer.remotePublicKey, reason: 'invalid invite proof' })
      return false
    }

    if (peer.closed || this.closed) return false
    const consumed = await this.invites.consume(id)
    if (!consumed) {
      peer.send({ type: MESSAGE.PAIR_DENIED, reason: 'invite has no uses left' })
      return false
    }

    // Invite grants are the ceiling. A peer arriving by invite never falls
    // back to the packs' defaults the way a same-machine peer does.
    peer.grantsGiven = record.grants
      ? this.capabilities.grantsFor(record.grants)
      : this.capabilities.defaultGrants()
    const known = this.peerRegistry.get(peer.remotePublicKey)
    if (known) peer.grantsGiven = intersectGrants(peer.grantsGiven, known.grantsGiven || {})
    peer.inviteId = id

    this.emit('inviteRedeemed', { id, publicKey: peer.remotePublicKey, remaining: remainingUses(consumed) })
    return true
  }

  async _onPairAccepted (peer, msg) {
    if (!peer._requestedPairing || !peer._pairingIntent || peer.paired || peer._pairAcceptedPending) return
    peer._pairAcceptedPending = true
    if (this.peerRegistry.isDenied(peer.remotePublicKey)) { await peer.close(); return }
    peer.grantsReceived = msg.grants || {}
    const network = peer._pairingIntent.network
    if (network) {
      if (this._networks.get(network.id) !== network) { await peer.close(); return }
      if (this.peerRegistry.get(peer.remotePublicKey)?.pairingMethod !== 'invite' &&
          !await this._askApproval(peer, msg, network.approve || this._pairing.approve, { network: network.id })) {
        await peer.close()
        return
      }
      if (peer.closed || this.peerRegistry.isDenied(peer.remotePublicKey)) return
      if (this._networks.get(network.id) !== network) { await peer.close(); return }
      peer.network = network.id
    }
    peer.grantsGiven = this.capabilities.grantsFor(network?.grants ?? msg.requested)
    const known = this.peerRegistry.get(peer.remotePublicKey)
    if (known) peer.grantsGiven = intersectGrants(peer.grantsGiven, known.grantsGiven || {})
    peer.send({ type: MESSAGE.PAIR_CONFIRM, grants: peer.grantsGiven })
    await this._finishPairing(peer)
  }

  async _onPairConfirm (peer, msg) {
    if (!peer._acceptedPairing || peer.paired) return
    peer.grantsReceived = msg.grants || {}
    await this._finishPairing(peer)
  }

  _onPairDenied (peer, msg) {
    const err = new PairDeniedError(msg.reason || 'denied')
    // A refusal is not a temporary network failure. Stop automatic retries
    // without changing the caller's persisted trust or local denial policy.
    clearTimeout(this._sticky.get(peer.remotePublicKey)?.timer)
    this._sticky.delete(peer.remotePublicKey)
    this.swarm.leavePeer(toPublicKeyBuffer(peer.remotePublicKey))
    peer.pairing.reject(err)
    const dialing = this._dialing.get(peer.remotePublicKey)
    if (dialing) {
      dialing.cleanup?.()
      if (dialing.timer) clearTimeout(dialing.timer)
      this._dialing.delete(peer.remotePublicKey)
      dialing.pending.reject(err)
    }
    if (this._redeeming && this._redeeming.invite.publicKey === peer.remotePublicKey) {
      this._redeeming.cleanup?.()
      if (this._redeeming.timer) clearTimeout(this._redeeming.timer)
      this._redeeming.pending.reject(err)
      this._redeeming = null
    }
    this.emit('pairDenied', { publicKey: peer.remotePublicKey, reason: msg.reason })
    peer.close()
  }

  async _finishPairing (peer) {
    if (this.closed || peer.paired || peer.closed || this.peerRegistry.isDenied(peer.remotePublicKey)) return
    peer.paired = true
    clearTimeout(peer._handshakeTimer)

    await this.peerRegistry.put({
      publicKey: peer.remotePublicKey,
      appId: peer.appId,
      appName: peer.appName,
      deviceName: peer.profile?.deviceName || null,
      nodeType: peer.nodeType,
      grantsGiven: peer.grantsGiven,
      grantsReceived: peer.grantsReceived,
      pairingMethod: peer.inviteId ? 'invite' : (peer.network ? 'network' : this.peerRegistry.get(peer.remotePublicKey)?.pairingMethod || 'direct'),
      inviteId: peer.inviteId || null,
      network: peer.network || null
    })

    if (this.closed || peer.closed) return
    peer.pairing.resolve(peer)
    await this.capabilities.onPeer(peer)
    if (this.closed || peer.closed) return

    const dialing = this._dialing.get(peer.remotePublicKey)
    if (dialing) {
      dialing.cleanup?.()
      if (dialing.timer) clearTimeout(dialing.timer)
      this._dialing.delete(peer.remotePublicKey)
      dialing.pending.resolve(peer)
    }

    if (this._redeeming && this._redeeming.invite.publicKey === peer.remotePublicKey) {
      const redeeming = this._redeeming
      this._redeeming = null
      redeeming.cleanup?.()
      if (redeeming.timer) clearTimeout(redeeming.timer)
      if (redeeming.reconnect) {
        this._sticky.set(peer.remotePublicKey, { attempts: 0, timer: null, requested: redeeming.requested })
      }
      redeeming.pending.resolve(peer)
    }

    if (this._discovering && peer._discovery === this._discovering) {
      const discovering = this._discovering
      this._discovering = null
      discovering.cleanup?.()
      if (discovering.timer) clearTimeout(discovering.timer)
      if (discovering.reconnect) {
        this._sticky.set(peer.remotePublicKey, { attempts: 0, timer: null, requested: discovering.requested })
      }
      discovering.pending.resolve(peer)
    }

    const sticky = this._sticky.get(peer.remotePublicKey)
    if (sticky) {
      const reconnected = sticky.attempts > 0
      clearTimeout(sticky.timer)
      sticky.timer = null
      sticky.attempts = 0
      if (reconnected) this.emit('reconnected', { publicKey: peer.remotePublicKey })
    }

    this.emit('peer', peer)
    this.emit('paired', {
      publicKey: peer.remotePublicKey,
      appId: peer.appId,
      appName: peer.appName
    })
  }

  // Change what a peer is allowed to call on us, live. Persisted so the
  // decision survives a restart, and applied to an open session immediately
  // so a revocation takes effect without waiting for a reconnect.
  async setPeerGrants (publicKey, grants) {
    const hex = toPublicKeyHex(publicKey)
    const known = this.peerRegistry.get(hex)
    if (!known) throw new InvalidOptionError(`Unknown peer: ${hex.slice(0, 12)}…`)

    const next = this.capabilities.grantsFor(grants)
    await this.peerRegistry.put({ publicKey: hex, grantsGiven: next })

    const peer = this._peers.get(hex)
    if (peer) {
      peer.grantsGiven = next
      for (const [requestId, controller] of peer._inbound) {
        if (!this.capabilities.isGranted(next, controller.capability, controller.method)) {
          controller.abort()
          peer.send({ type: MESSAGE.ERROR, requestId, code: 'NOT_GRANTED',
            capability: controller.capability, method: controller.method, message: 'Grant revoked' })
        }
      }
    }

    this.emit('grantsChanged', { publicKey: hex, grants: next })
    return next
  }

  async setPeerPolicy (publicKey, policy) {
    const hex = toPublicKeyHex(publicKey)
    if (!this.peerRegistry.get(hex)) throw new InvalidOptionError(`Unknown peer: ${hex.slice(0, 12)}…`)
    const record = await this.peerRegistry.put({ publicKey: hex, policy })
    this.emit('policyChanged', { publicKey: hex, policy: record.policy })
    return record
  }

  // Revoke a peer persistently, including attempts using another invite.
  // An operator must forget the denial explicitly before pairing again.
  async unpair (publicKey) {
    const hex = toPublicKeyHex(publicKey)
    const removed = this.peerRegistry.has(hex)
    await this.peerRegistry.deny(hex)
    const sticky = this._sticky.get(hex)
    if (sticky?.timer) clearTimeout(sticky.timer)
    this._sticky.delete(hex)
    this.swarm?.leavePeer(toPublicKeyBuffer(hex))

    const peer = this._peers.get(hex)
    if (peer) await peer.close()

    if (removed) this.emit('unpaired', { publicKey: hex })
    return removed
  }

  _onPeerClose (remotePublicKey) {
    const peer = this._peers.get(remotePublicKey)
    if (!peer) return
    this._peers.delete(remotePublicKey)
    clearTimeout(peer._handshakeTimer)
    peer._destroy('Peer disconnected')
    this.emit('peerDisconnected', { publicKey: remotePublicKey })
    this._scheduleReconnect(remotePublicKey)
  }

  _scheduleReconnect (publicKey) {
    if (this.closed || this._peers.get(publicKey)?.paired) return
    const dialing = this._dialing.get(publicKey)
    if (dialing) {
      // Losing a transport before pairing must not leave an active caller
      // waiting on the swarm's long retry queue. Rejoin after close handlers
      // finish; keep every caller's original deadline and cancellation.
      if (!dialing.retryTimer) {
        dialing.retryTimer = setTimeout(() => {
          dialing.retryTimer = null
          if (!this.closed && this._dialing.get(publicKey) === dialing) {
            this.swarm.joinPeer(toPublicKeyBuffer(publicKey))
          }
        }, this._reconnect.initialDelayMs)
        dialing.retryTimer.unref?.()
      }
      return
    }
    const sticky = this._sticky.get(publicKey)
    if (!sticky || sticky.timer) return

    const { initialDelayMs, maxDelayMs, factor, maxAttempts } = this._reconnect
    if (maxAttempts !== null && sticky.attempts >= maxAttempts) {
      this._sticky.delete(publicKey)
      this.swarm.leavePeer(toPublicKeyBuffer(publicKey))
      this.emit('reconnectFailed', { publicKey, attempts: sticky.attempts })
      return
    }

    const delay = Math.min(initialDelayMs * Math.pow(factor, sticky.attempts), maxDelayMs)
    sticky.attempts++
    this.emit('reconnecting', { publicKey, attempt: sticky.attempts, delay })

    sticky.timer = setTimeout(() => {
      sticky.timer = null
      if (this.closed || !this._sticky.has(publicKey)) return
      // A failed dial closes nothing, so the retry chain is driven from here
      // rather than from another peerDisconnected.
      this.connect(publicKey, { requested: sticky.requested, timeout: this._reconnect.dialTimeoutMs })
        .catch(() => this._scheduleReconnect(publicKey))
    }, delay)
    if (sticky.timer.unref) sticky.timer.unref()
  }

  close () {
    if (this._closePromise) return this._closePromise
    this.closed = true
    this._closePromise = this._close()
    return this._closePromise
  }

  async _close () {
    if (this._readyPromise) await this._readyPromise.catch(() => {})

    for (const [, dialing] of this._dialing) {
      dialing.cleanup?.()
      if (dialing.timer) clearTimeout(dialing.timer)
      dialing.pending.reject(new ClosedError('Node closed while dialing'))
    }
    this._dialing.clear()

    if (this._discovering) {
      this._discovering.cleanup?.()
      if (this._discovering.timer) clearTimeout(this._discovering.timer)
      this._discovering.pending.reject(new ClosedError('Node closed while discovering'))
      this._discovering = null
    }

    if (this._redeeming) {
      this._redeeming.cleanup?.()
      if (this._redeeming.timer) clearTimeout(this._redeeming.timer)
      this._redeeming.pending.reject(new ClosedError('Node closed while redeeming an invite'))
      this._redeeming = null
    }

    if (this._inviteWatcher) {
      clearInterval(this._inviteWatcher)
      this._inviteWatcher = null
    }

    for (const [, sticky] of this._sticky) if (sticky.timer) clearTimeout(sticky.timer)
    this._sticky.clear()

    for (const peer of this._peers.values()) { clearTimeout(peer._handshakeTimer); peer._destroy('Node closed') }
    this._peers.clear()

    // Order matters: stop accepting connections before tearing down the packs.
    // The reverse lets a connection land mid-teardown and hand a closed
    // resource (a Corestore, say) to a pack that has already shut down.
    await this._disposeResources()
    this.emit('close')
  }
}

function remainingUses (record) {
  return record.uses === null ? null : Math.max(0, record.uses - record.used)
}

function normalizeReconnect (value) {
  const defaults = {
    enabled: false,
    initialDelayMs: 1_000,
    maxDelayMs: 30_000,
    factor: 2,
    maxAttempts: null,
    dialTimeoutMs: 15_000
  }
  if (value === undefined || value === null || value === false) return defaults
  if (value === true) return { ...defaults, enabled: true }
  if (typeof value !== 'object' || Array.isArray(value)) throw new InvalidOptionError('reconnect must be a boolean or options object')
  const options = { ...defaults, ...value, enabled: value.enabled === undefined ? true : value.enabled }
  if (typeof options.enabled !== 'boolean') throw new InvalidOptionError('reconnect.enabled must be a boolean')
  for (const name of ['initialDelayMs', 'maxDelayMs', 'dialTimeoutMs']) {
    if (!Number.isSafeInteger(options[name]) || options[name] < 1) {
      throw new InvalidOptionError(`reconnect.${name} must be a positive safe integer`)
    }
  }
  if (options.maxDelayMs < options.initialDelayMs) throw new InvalidOptionError('reconnect.maxDelayMs must be at least initialDelayMs')
  if (!Number.isFinite(options.factor) || options.factor < 1) throw new InvalidOptionError('reconnect.factor must be finite and at least one')
  if (options.maxAttempts !== null && (!Number.isSafeInteger(options.maxAttempts) || options.maxAttempts < 0)) {
    throw new InvalidOptionError('reconnect.maxAttempts must be null or a non-negative safe integer')
  }
  return options
}

export function createNode (opts) {
  return new UnstoppableNode(opts)
}

function intersectGrants (requested, ceiling) {
  const grants = {}
  for (const [name, methods] of Object.entries(requested)) {
    const allowed = new Set(ceiling[name] || [])
    grants[name] = methods.filter(method => allowed.has(method))
  }
  return grants
}
