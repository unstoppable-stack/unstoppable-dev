import { EventEmitter } from 'bare-events'
import { MESSAGE } from './protocol.js'
import {
  CancelledError,
  ClosedError,
  NotGrantedError,
  RequestTimeoutError,
  errorFromRemote
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
    this._inbound = new Map()    // requestId -> AbortController
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

    // Lazily start whichever mode the caller asks for. Awaiting runs a unary
    // call; iterating opens a stream. Doing both on one handle is a mistake,
    // and it throws rather than quietly issuing two requests.
    const startStream = () => {
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
        return peer.call(capability, method, params, opts).then(resolve, reject)
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
    return this._message.send(msg)
  }

  async call (capability, method, params = {}, { timeout = 30_000, signal } = {}) {
    this._assertOpen()
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
    this.send({ type: MESSAGE.CALL, requestId, capability, method, params })
    return pending.promise
  }

  async * stream (capability, method, params = {}, { signal } = {}) {
    this._assertOpen()
    const requestId = this._newRequestId()
    const queue = new AsyncQueue()

    const onAbort = () => {
      this.send({ type: MESSAGE.CANCEL, requestId })
      queue.fail(new CancelledError(`${capability}.${method} aborted`))
    }

    if (signal) {
      if (signal.aborted) throw new CancelledError(`${capability}.${method} aborted`)
      signal.addEventListener('abort', onAbort, { once: true })
    }

    this._outbound.set(requestId, { queue, capability, method })
    this.send({ type: MESSAGE.CALL, requestId, capability, method, params })

    try {
      for await (const value of queue) yield value
    } finally {
      // Consumer broke out early (or threw): tell the far side to stop
      // producing rather than leaving a generator running until disconnect.
      if (!queue.finished) this.send({ type: MESSAGE.CANCEL, requestId })
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
    if (typeof requestId !== 'string') return

    const controller = new AbortController()
    this._inbound.set(requestId, controller)

    try {
      // Grants are checked before resolution so an ungranted peer cannot
      // enumerate which capabilities exist by reading the error code.
      if (!this.node.capabilities.isGranted(this.grantsGiven, capability, method)) {
        throw new NotGrantedError(capability, method)
      }
      const { handler, streaming } = this.node.capabilities.resolve(capability, method)
      const ctx = {
        peer: this,
        appId: this.appId,
        grants: this.grantsGiven,
        signal: controller.signal
      }

      if (streaming) {
        for await (const value of handler(params ?? {}, ctx)) {
          if (controller.signal.aborted || this.closed) break
          this.send({ type: MESSAGE.CHUNK, requestId, value })
        }
        if (!controller.signal.aborted) this.send({ type: MESSAGE.END, requestId })
      } else {
        const value = await handler(params ?? {}, ctx)
        if (!controller.signal.aborted) {
          this.send({ type: MESSAGE.RESULT, requestId, value: value === undefined ? null : value })
        }
      }
    } catch (err) {
      this.send({
        type: MESSAGE.ERROR,
        requestId,
        code: err.code || 'REQUEST_FAILED',
        message: err.message || 'Request failed',
        capability,
        method
      })
      this.node.emit('requestError', { peer: this, capability, method, error: err.message })
    } finally {
      this._inbound.delete(requestId)
    }
  }

  _onCancel (msg) {
    const controller = this._inbound.get(msg.requestId)
    if (controller) controller.abort()
  }

  _onResult (msg) {
    const pending = this._outbound.get(msg.requestId)
    if (pending?.resolve) pending.resolve(msg.value)
  }

  _onChunk (msg) {
    const pending = this._outbound.get(msg.requestId)
    if (pending?.queue) pending.queue.push(msg.value)
  }

  _onEnd (msg) {
    const pending = this._outbound.get(msg.requestId)
    if (pending?.queue) pending.queue.end()
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

    for (const controller of this._inbound.values()) controller.abort()
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
  constructor () {
    this.values = []
    this.waiting = []
    this.finished = false
    this.error = null
  }

  push (value) {
    if (this.finished) return
    const waiter = this.waiting.shift()
    if (waiter) waiter.resolve({ value, done: false })
    else this.values.push(value)
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
    for (const waiter of this.waiting) waiter.reject(err)
    this.waiting = []
  }

  [Symbol.asyncIterator] () {
    return {
      next: () => {
        if (this.values.length > 0) return Promise.resolve({ value: this.values.shift(), done: false })
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
