import { EventEmitter } from 'bare-events'
import { AbortControllerImpl } from './abort.js'
import { jsonBytes, resourceError } from './limits.js'
import { MESSAGE } from './protocol.js'
import { createClient, procedureMetadata } from './rpc.js'
import {
  NodeError,
  CancelledError,
  ClosedError,
  NotGrantedError,
  RequestTimeoutError,
  errorFromRemote,
  normalizeError
} from './errors.js'

// A paired remote. Symmetric by construction: the same object exposes the
// outbound side (`call`/`stream`) and services the inbound side, so whether a
// process "is a node" or "uses a node" is a matter of which verbs it uses,
// not which class it instantiated.
export class Peer extends EventEmitter {
  constructor ({ node, mux, channel, remotePublicKey, initiator }) {
    super()
    this.node = node
    this.mux = mux
    this.channel = channel
    // From the Noise handshake — authenticated by the transport, and the
    // yardstick the hello's self-reported key has to match.
    this.remotePublicKey = remotePublicKey
    this.initiator = initiator

    this.publicKey = null
    this.profile = null
    this.nodeType = null
    this.capabilities = null
    this.grantsGiven = null      // what we allow them to call on us
    this.grantsReceived = null   // what they allow us to call on them
    this.paired = false
    this.closed = false
    this.inviteId = null
    this.network = null

    this._message = null
    this._api = null
    this._nextId = 0
    this._outbound = new Map()   // requestId -> pending unary or stream queue
    this._inbound = new Map()    // live requestId -> AbortController
    this._runningInbound = new Map() // physical work, including cancelled handlers
    this.helloed = deferred()
    this.pairing = deferred()
  }

  get appId () {
    return this.profile?.appId ?? null
  }

  get appName () {
    return this.profile?.appName ?? null
  }

  attachMessage (message) {
    this._message = message
  }

  // A property-access view over the peer's advertised capabilities:
  //
  //   await peer.api.notes.search({ q: 'coffee' })
  //   for await (const c of peer.api.notes.watch({ prefix: 'a' })) { … }
  //
  // Built from the hello's descriptors, so it only ever exposes methods the
  // far side actually declared. Unary vs streaming is decided at call time by
  // how the result is used: it is a promise that is also an async iterable,
  // which avoids making the caller know which kind a method is.
  client (contract) {
    return createClient(this, contract)
  }

  get api () {
    if (this._api) return this._api
    const capabilities = this.capabilities || {}
    const api = {}
    for (const [name, descriptor] of Object.entries(capabilities)) {
      const methods = {}
      for (const method of descriptor?.methods || []) {
        methods[method] = (params, opts) => this._invoke(name, method, params, opts)
      }
      api[name] = methods
    }
    this._api = api
    return api
  }

  _invoke (capability, method, params = {}, opts = {}) {
    const peer = this
    let stream = null
    let unary = null

    // Lazily start whichever mode the caller asks for. Awaiting runs a unary
    // call; iterating opens a stream. Doing both on one handle is a mistake,
    // and it throws rather than quietly issuing two requests.
    const startStream = () => {
      if (unary) throw new ClosedError(`${capability}.${method} is already being consumed as a promise`)
      if (stream) return stream
      stream = peer.stream(capability, method, params, opts)
      return stream
    }

    return {
      then (resolve, reject) {
        if (stream) {
          return Promise.reject(
            new ClosedError(`${capability}.${method} is already being consumed as a stream`)
          ).then(resolve, reject)
        }
        unary ||= peer.call(capability, method, params, opts)
        return unary.then(resolve, reject)
      },
      catch (fn) { return this.then(undefined, fn) },
      finally (fn) { return this.then().finally(fn) },
      [Symbol.asyncIterator] () {
        return startStream()[Symbol.asyncIterator]()
      }
    }
  }

  send (msg) {
    if (this.closed || !this._message) return false
    if (msg.type === MESSAGE.PAIR_REQUEST) this._requestedPairing = true
    if (msg.type === MESSAGE.PAIR_ACCEPTED) this._acceptedPairing = true
    return this._message.send(msg)
  }

  async call (capability, method, params, { timeout = 30_000, signal, version } = {}) {
    this._assertOpen()
    this._assertMethodKind(capability, method, 'unary')
    if (this._outbound.size >= this.node.limits.maxRequestsPerPeer) throw resourceError('Too many outgoing requests')
    const requestId = this._newRequestId()
    const pending = deferred()

    let timer = null
    const settle = (fn) => (value) => {
      if (timer) clearTimeout(timer)
      if (signal) signal.removeEventListener('abort', onAbort)
      this._outbound.delete(requestId)
      fn(value)
    }
    const resolve = settle(pending.resolve)
    const reject = settle(pending.reject)

    const onAbort = () => {
      this.send({ type: MESSAGE.CANCEL, requestId })
      reject(new CancelledError(`${capability}.${method} aborted`))
    }

    if (signal) {
      if (signal.aborted) throw new CancelledError(`${capability}.${method} aborted`)
      signal.addEventListener('abort', onAbort, { once: true })
    }

    if (timeout > 0) {
      timer = setTimeout(() => {
        this.send({ type: MESSAGE.CANCEL, requestId })
        reject(new RequestTimeoutError(capability, method, timeout))
      }, timeout)
    }

    this._outbound.set(requestId, { resolve, reject, capability, method })
    try { this.send({ type: MESSAGE.CALL, requestId, capability, method, params, kind: 'unary', version }) }
    catch (error) { reject(error) }
    return pending.promise
  }

  async * stream (capability, method, params, { signal, timeout = 30_000, version } = {}) {
    this._assertOpen()
    this._assertMethodKind(capability, method, 'stream')
    if (this._outbound.size >= this.node.limits.maxRequestsPerPeer) throw resourceError('Too many outgoing requests')
    const requestId = this._newRequestId()
    const queue = new AsyncQueue(this.node.limits)

    const onAbort = () => {
      this.send({ type: MESSAGE.CANCEL, requestId })
      queue.fail(new CancelledError(`${capability}.${method} aborted`))
    }

    if (signal) {
      if (signal.aborted) throw new CancelledError(`${capability}.${method} aborted`)
      signal.addEventListener('abort', onAbort, { once: true })
    }

    this._outbound.set(requestId, { queue, capability, method })
    let exhausted = false
    const timer = timeout > 0 ? setTimeout(() => {
      this.send({ type: MESSAGE.CANCEL, requestId })
      queue.fail(new RequestTimeoutError(capability, method, timeout))
    }, timeout) : null
    try {
      this.send({ type: MESSAGE.CALL, requestId, capability, method, params, kind: 'stream', version })
      for await (const value of queue) yield value
      exhausted = true
    } finally {
      // Consumer broke out early (or threw): tell the far side to stop
      // producing rather than leaving a generator running until disconnect.
      // Closing the local iterator marks its queue finished too. Track
      // natural exhaustion separately so an early return reaches the host.
      if (!exhausted && !queue.error) this.send({ type: MESSAGE.CANCEL, requestId })
      if (timer) clearTimeout(timer)
      if (signal) signal.removeEventListener('abort', onAbort)
      this._outbound.delete(requestId)
    }
  }

  onmessage (msg) {
    if (!msg || typeof msg.type !== 'string') return
    switch (msg.type) {
      case MESSAGE.CALL: return this._onCall(msg)
      case MESSAGE.CANCEL: return this._onCancel(msg)
      case MESSAGE.RESULT: return this._onResult(msg)
      case MESSAGE.CHUNK: return this._onChunk(msg)
      case MESSAGE.END: return this._onEnd(msg)
      case MESSAGE.ERROR: return this._onError(msg)
      default: return this.node._onPeerMessage(this, msg)
    }
  }

  async _onCall (msg) {
    const { requestId, capability, method, params } = msg
    if (typeof requestId !== 'string' || requestId.length > 64 ||
        typeof capability !== 'string' || capability.length > 128 ||
        typeof method !== 'string' || method.length > 128) { await this.close(); return }
    let terminal = false
    const fail = (value) => {
      if (terminal || this.closed) return
      terminal = true
      const error = normalizeError(value)
      const frame = { type: MESSAGE.ERROR, requestId, code: error.code,
        message: error.message.slice(0, 512), capability, method }
      try { this.send(frame) } catch {
        try { this.send({ type: MESSAGE.ERROR, requestId, code: 'REQUEST_FAILED', message: 'Request failed' }) }
        catch { this.close() }
      }
    }
    // Reusing an active id must not replace its abort controller.
    if (this._runningInbound.has(requestId)) { await this.close(); return }
    if (!this.paired || !this.node.capabilities.isGranted(this.grantsGiven, capability, method)) {
      fail(new NotGrantedError(capability, method)); return
    }
    const limits = this.node.limits
    if (this._runningInbound.size >= limits.maxRequestsPerPeer || this.node._activeRequests >= limits.maxRequests) {
      fail(resourceError('Node request capacity reached')); return
    }
    const controller = new AbortControllerImpl()
    controller.capability = capability
    controller.method = method
    this._inbound.set(requestId, controller)
    this._runningInbound.set(requestId, controller)
    this.node._activeRequests++
    const cleanup = () => {
      clearTimeout(timer)
      this._inbound.delete(requestId)
    }
    const timer = setTimeout(() => {
      fail(new RequestTimeoutError(capability, method, limits.requestTimeoutMs))
      controller.abort()
    }, limits.requestTimeoutMs)
    controller.signal.addEventListener('abort', cleanup, { once: true })
    let bytes = 0
    try {
      const { pack, handler, streaming } = this.node.capabilities.resolve(capability, method)
      if (msg.version != null && msg.version !== (pack.version ?? 1)) {
        throw new NodeError('INCOMPATIBLE_CAPABILITY', `Unsupported ${capability} version`)
      }
      if (msg.kind != null && msg.kind !== (streaming ? 'stream' : 'unary')) {
        throw new NodeError('METHOD_KIND_MISMATCH', `Wrong invocation kind for ${capability}.${method}`)
      }
      const ctx = { peer: this, appId: this.appId, grants: this.grantsGiven, signal: controller.signal }
      // Typed parsers own optional/default/nullable input semantics. Preserve
      // their exact wire input while keeping the legacy empty-object default.
      const input = procedureMetadata(handler) ? params : params ?? {}
      if (streaming) {
        for await (const value of handler(input, ctx)) {
          if (controller.signal.aborted || this.closed) break
          bytes += jsonBytes(value)
          if (bytes > limits.maxStreamBytes) throw resourceError('Stream output exceeds byte limit')
          if (!this.send({ type: MESSAGE.CHUNK, requestId, value })) {
            await this._waitForDrain(controller.signal)
          }
        }
        if (!controller.signal.aborted) {
          this.send({ type: MESSAGE.END, requestId })
          terminal = true
        }
      } else {
        const value = await handler(input, ctx)
        if (!controller.signal.aborted) {
          this.send({ type: MESSAGE.RESULT, requestId, value: value === undefined ? null : value })
          terminal = true
        }
      }
    } catch (err) {
      if (!controller.signal.aborted && !this.closed) fail(err)
      this.node.emit('requestError', { peer: this, capability, method, error: normalizeError(err).message })
    } finally {
      cleanup()
      controller.signal.removeEventListener('abort', cleanup)
      this._runningInbound.delete(requestId)
      this.node._activeRequests--
    }
  }

  _waitForDrain (signal) {
    if (signal.aborted || this.closed || this.mux.drained) return Promise.resolve()
    return new Promise(resolve => {
      const stream = this.mux.stream
      const done = () => {
        stream.removeListener('drain', done)
        stream.removeListener('close', done)
        signal.removeEventListener('abort', done)
        resolve()
      }
      stream.once('drain', done)
      stream.once('close', done)
      signal.addEventListener('abort', done, { once: true })
    })
  }

  _onCancel (msg) {
    const controller = this._inbound.get(msg.requestId)
    if (controller) controller.abort()
  }

  _onResult (msg) {
    const pending = this._outbound.get(msg.requestId)
    if (pending?.queue) {
      pending.queue.fail(new NodeError('METHOD_KIND_MISMATCH', 'Expected a stream, received a unary result'))
    } else if (pending?.resolve) pending.resolve(msg.value)
  }

  _onChunk (msg) {
    const pending = this._outbound.get(msg.requestId)
    if (pending?.reject) {
      pending.reject(new NodeError('METHOD_KIND_MISMATCH', 'Expected a unary result, received a stream'))
      this.send({ type: MESSAGE.CANCEL, requestId: msg.requestId })
    } else if (pending?.queue && !pending.queue.push(msg.value)) {
      this.send({ type: MESSAGE.CANCEL, requestId: msg.requestId })
    }
  }

  _onEnd (msg) {
    const pending = this._outbound.get(msg.requestId)
    if (pending?.queue) pending.queue.end()
    else if (pending?.reject) pending.reject(new NodeError('METHOD_KIND_MISMATCH', 'Expected a unary result, received a stream'))
  }

  _onError (msg) {
    const pending = this._outbound.get(msg.requestId)
    if (!pending) return
    const err = errorFromRemote(msg)
    if (pending.queue) pending.queue.fail(err)
    else if (pending.reject) pending.reject(err)
  }

  _newRequestId () {
    return String(++this._nextId)
  }

  _assertMethodKind (capability, method, kind) {
    // Leave permission failures to the host, preserving NOT_GRANTED precedence.
    if (this.grantsReceived && !this.node.capabilities.isGranted(this.grantsReceived, capability, method)) return
    const advertised = this.capabilities?.[capability]?.methodKinds?.[method]
    if (advertised && advertised !== kind) {
      throw new NodeError('METHOD_KIND_MISMATCH', `Wrong invocation kind for ${capability}.${method}`)
    }
  }

  _assertOpen () {
    if (this.closed) throw new ClosedError('Peer is closed')
    if (!this.paired) throw new ClosedError('Peer is not paired yet')
  }

  _destroy (reason) {
    if (this.closed) return
    this.closed = true

    const err = new ClosedError(reason || 'Peer disconnected')
    for (const pending of this._outbound.values()) {
      if (pending.queue) pending.queue.fail(err)
      else if (pending.reject) pending.reject(err)
    }
    this._outbound.clear()

    for (const controller of this._runningInbound.values()) controller.abort()
    this._inbound.clear()

    this.helloed.reject(err)
    this.pairing.reject(err)
    this.emit('close')
  }

  async close () {
    if (this.closed) return
    this._destroy('Peer closed locally')
    try { this.channel?.close() } catch {}
    try { this.mux?.stream?.destroy() } catch {}
  }
}

// Single-consumer async queue backing `stream()`. Values that arrive before
// the consumer asks for them are buffered; a consumer that asks first parks
// on a promise.
export class AsyncQueue {
  constructor (limits = { maxBufferedChunks: 64, maxBufferedBytes: 1024 * 1024 }) {
    this.limits = limits
    this.bytes = 0
    this.values = []
    this.waiting = []
    this.finished = false
    this.error = null
  }

  push (value) {
    if (this.finished) return true
    const waiter = this.waiting.shift()
    if (waiter) waiter.resolve({ value, done: false })
    else {
      const size = jsonBytes(value)
      if (this.values.length >= this.limits.maxBufferedChunks || this.bytes + size > this.limits.maxBufferedBytes) {
        this.fail(resourceError('Consumer stream buffer is full'))
        return false
      }
      this.bytes += size
      this.values.push({ value, size })
    }
    return true
  }

  end () {
    if (this.finished) return
    this.finished = true
    for (const waiter of this.waiting) waiter.resolve({ value: undefined, done: true })
    this.waiting = []
  }

  fail (err) {
    if (this.finished) return
    this.finished = true
    this.error = err
    this.values = []
    this.bytes = 0
    for (const waiter of this.waiting) waiter.reject(err)
    this.waiting = []
  }

  [Symbol.asyncIterator] () {
    return {
      next: () => {
        if (this.values.length > 0) {
          const { value, size } = this.values.shift()
          this.bytes -= size
          return Promise.resolve({ value, done: false })
        }
        if (this.error) return Promise.reject(this.error)
        if (this.finished) return Promise.resolve({ value: undefined, done: true })
        return new Promise((resolve, reject) => this.waiting.push({ resolve, reject }))
      },
      return: () => {
        this.end()
        return Promise.resolve({ value: undefined, done: true })
      }
    }
  }
}

export function deferred () {
  let resolve, reject
  const promise = new Promise((res, rej) => { resolve = res; reject = rej })
  // Nothing awaits these until the handshake progresses; an unhandled
  // rejection on a peer that dies early would otherwise crash the process.
  promise.catch(() => {})
  return { promise, resolve, reject }
}
