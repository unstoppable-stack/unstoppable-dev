// Typed errors so apps can branch on a stable `code` (or `instanceof`) rather
// than parsing English. Every error thrown or rejected by `connectToNode` /
// `NodeClient` is an instance of `NodeClientError` (or a subclass) with a
// non-empty `code`.
//
// Stable codes:
//
//   NODE_NOT_FOUND        — discovery timeout, no Node answered nodeHello
//   NODE_DENIED           — Node returned `pairDenied`; reason in .reason
//   NODE_MISSING_SERVICE  — Node advertised services that don't cover
//                           `requireServices`. missing[] is the diff.
//   INVALID_OPTION        — bad input (unknown service name, etc.)
//   CLOSED                — operation issued on a closed client
//   INFERENCE_ERROR       — server-side AI provider error during streaming

export class NodeClientError extends Error {
  constructor (code, message, extra = {}) {
    super(message)
    this.name = 'NodeClientError'
    this.code = code
    Object.assign(this, extra)
  }
}

export class NodeNotFoundError extends NodeClientError {
  constructor (message = 'Node not found — is unstoppable-node running?') {
    super('NODE_NOT_FOUND', message)
    this.name = 'NodeNotFoundError'
  }
}

export class NodeDeniedError extends NodeClientError {
  constructor (reason) {
    super('NODE_DENIED', `Node denied pairing: ${reason}`, { reason })
    this.name = 'NodeDeniedError'
  }
}

export class NodeMissingServiceError extends NodeClientError {
  constructor (missing, services) {
    super(
      'NODE_MISSING_SERVICE',
      `Node does not offer required service(s): ${missing.join(', ')}. ` +
        `Advertised: ${JSON.stringify(services)}`,
      { missing, services }
    )
    this.name = 'NodeMissingServiceError'
  }
}

export class InvalidOptionError extends NodeClientError {
  constructor (message) {
    super('INVALID_OPTION', message)
    this.name = 'InvalidOptionError'
  }
}

export class ClientClosedError extends NodeClientError {
  constructor (message = 'NodeClient is closed') {
    super('CLOSED', message)
    this.name = 'ClientClosedError'
  }
}

export class InferenceError extends NodeClientError {
  constructor (message) {
    super('INFERENCE_ERROR', message)
    this.name = 'InferenceError'
  }
}
