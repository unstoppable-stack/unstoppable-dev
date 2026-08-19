// Typed errors so callers can branch on a stable `code` (or `instanceof`)
// rather than parsing English. Everything thrown or rejected by the runtime is
// a `NodeError` with a non-empty `code`.
//
// Stable codes:
//
//   PEER_NOT_FOUND      — connect() timed out; no peer answered on that key
//   PAIR_DENIED         — remote returned `pairDenied`; reason in .reason
//   NOT_GRANTED         — peer called a capability method it was not granted
//   UNKNOWN_CAPABILITY  — peer called a capability this node does not host
//   UNKNOWN_METHOD      — capability exists, method does not
//   REQUEST_FAILED      — handler threw; message is the handler's message
//   REQUEST_TIMEOUT     — no result before the caller's timeout elapsed
//   CANCELLED           — request aborted by signal, cancel, or disconnect
//   INVALID_OPTION      — bad input (malformed pack, bad key, etc.)
//   CLOSED              — operation issued on a closed node or peer

export class NodeError extends Error {
  constructor (code, message, extra = {}) {
    super(message)
    this.name = 'NodeError'
    this.code = code
    Object.assign(this, extra)
  }
}

export class PeerNotFoundError extends NodeError {
  constructor (publicKey) {
    super('PEER_NOT_FOUND', `No peer answered on key ${String(publicKey).slice(0, 12)}…`, { publicKey })
    this.name = 'PeerNotFoundError'
  }
}

export class PairDeniedError extends NodeError {
  constructor (reason) {
    super('PAIR_DENIED', `Peer denied pairing: ${reason}`, { reason })
    this.name = 'PairDeniedError'
  }
}

export class NotGrantedError extends NodeError {
  constructor (capability, method) {
    super('NOT_GRANTED', `Not granted: ${capability}.${method}`, { capability, method })
    this.name = 'NotGrantedError'
  }
}

export class UnknownCapabilityError extends NodeError {
  constructor (capability) {
    super('UNKNOWN_CAPABILITY', `Unknown capability: ${capability}`, { capability })
    this.name = 'UnknownCapabilityError'
  }
}

export class UnknownMethodError extends NodeError {
  constructor (capability, method) {
    super('UNKNOWN_METHOD', `Unknown method: ${capability}.${method}`, { capability, method })
    this.name = 'UnknownMethodError'
  }
}

export class RequestTimeoutError extends NodeError {
  constructor (capability, method, timeout) {
    super('REQUEST_TIMEOUT', `${capability}.${method} timed out after ${timeout}ms`, { capability, method, timeout })
    this.name = 'RequestTimeoutError'
  }
}

export class CancelledError extends NodeError {
  constructor (message = 'Request cancelled') {
    super('CANCELLED', message)
    this.name = 'CancelledError'
  }
}

export class InvalidOptionError extends NodeError {
  constructor (message) {
    super('INVALID_OPTION', message)
    this.name = 'InvalidOptionError'
  }
}

export class ClosedError extends NodeError {
  constructor (message = 'Node is closed') {
    super('CLOSED', message)
    this.name = 'ClosedError'
  }
}

// Rebuild a local error from a remote `error` frame so `peer.call()` rejects
// with the same shape a local failure would produce.
export function errorFromRemote ({ code, message, capability, method }) {
  switch (code) {
    case 'NOT_GRANTED': return new NotGrantedError(capability, method)
    case 'UNKNOWN_CAPABILITY': return new UnknownCapabilityError(capability)
    case 'UNKNOWN_METHOD': return new UnknownMethodError(capability, method)
    case 'CANCELLED': return new CancelledError(message)
    default: return new NodeError(code || 'REQUEST_FAILED', message || 'Request failed', { capability, method })
  }
}
