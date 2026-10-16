// AbortController is a Node.js/browser global that Bare does not provide, and
// core must run in both — the Personal Node daemon is a Bare process. This is
// the subset the capability bus relies on: handlers read `signal.aborted`,
// callers may `addEventListener('abort', …, { once })`, and the bus aborts on
// cancel or disconnect. Prefer the platform class whenever it exists.

class PortableAbortSignal {
  constructor () {
    this.aborted = false
    this.reason = undefined
    this._listeners = new Set()
  }

  addEventListener (type, listener, opts = {}) {
    if (type !== 'abort' || typeof listener !== 'function') return
    if (this.aborted) {
      listener({ type: 'abort', target: this })
      return
    }
    listener._once = !!opts.once
    this._listeners.add(listener)
  }

  removeEventListener (type, listener) {
    if (type !== 'abort') return
    this._listeners.delete(listener)
  }

  throwIfAborted () {
    if (this.aborted) throw this.reason ?? new Error('This operation was aborted')
  }
}

class PortableAbortController {
  constructor () {
    this.signal = new PortableAbortSignal()
  }

  abort (reason) {
    const signal = this.signal
    if (signal.aborted) return
    signal.aborted = true
    signal.reason = reason ?? new Error('This operation was aborted')
    for (const listener of [...signal._listeners]) {
      if (listener._once) signal._listeners.delete(listener)
      try { listener({ type: 'abort', target: signal }) } catch {}
    }
  }
}

export const AbortControllerImpl =
  typeof globalThis.AbortController === 'function'
    ? globalThis.AbortController
    : PortableAbortController

export { PortableAbortController, PortableAbortSignal }
