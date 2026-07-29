import { NodeClient } from './client.js'
import { KNOWN_SERVICES, buildRequestedCapabilities } from './protocol.js'
import {
  NodeClientError,
  NodeNotFoundError,
  NodeDeniedError,
  NodeMissingServiceError,
  InvalidOptionError,
  ClientClosedError,
  InferenceError
} from './errors.js'

export { NodeClient }
export {
  NodeClientError,
  NodeNotFoundError,
  NodeDeniedError,
  NodeMissingServiceError,
  InvalidOptionError,
  ClientClosedError,
  InferenceError
}

/**
 * Connect an app to the local Unstoppable Node.
 *
 * @param {Object} opts
 * @param {string} opts.appId            - Unique app identifier
 * @param {string} opts.appName          - Human-readable app name
 * @param {Array}  opts.cores            - Cores to register: [{ key: Buffer|string, type: string, name: string }]
 * @param {Array}  [opts.drives]         - Drives to register: [{ key: Buffer|string, name: string }]
 * @param {Object} [opts.swarm]          - Hyperswarm options (e.g. { bootstrap })
 * @param {Buffer} [opts.topic]          - Override discovery topic (for testing)
 * @param {number} [opts.timeout=15000]  - How long to wait for pairing before rejecting
 * @param {string[]} [opts.requireServices]  - Services the Node must advertise
 *                                             (e.g. ['data', 'files']). Rejects
 *                                             if the Node reports any as false.
 * @param {string} [opts.deviceName]     - Friendly device label shown in the
 *                                         dashboard's pair-approval modal.
 *                                         Defaults to `os.hostname()`.
 * @param {boolean|Object} [opts.reconnect] - If truthy, the client will
 *                                          re-search for the Node and
 *                                          re-pair on disconnect, with
 *                                          exponential backoff. Pass an
 *                                          object to tune
 *                                          `{ initialDelayMs, maxDelayMs,
 *                                            factor, maxAttempts }`.
 *                                          Listen for `reconnecting` /
 *                                          `reconnected` events.
 * @returns {Promise<NodeClient>} Connected and paired client
 */
export async function connectToNode ({
  appId,
  appName,
  cores = [],
  drives = [],
  swarm,
  topic,
  timeout: timeoutMs = 15_000,
  requireServices = [],
  deviceName,
  reconnect,
  requestedCapabilities
} = {}) {
  if (typeof appId !== 'string' || !appId.trim()) {
    throw new InvalidOptionError('appId must be a non-empty string')
  }
  if (appName !== undefined && typeof appName !== 'string') {
    throw new InvalidOptionError('appName must be a string when provided')
  }
  if (!Array.isArray(cores) || !Array.isArray(drives)) {
    throw new InvalidOptionError('cores and drives must be arrays')
  }
  for (const s of requireServices) {
    if (!KNOWN_SERVICES.includes(s)) {
      throw new InvalidOptionError(`Unknown service "${s}" — known: ${KNOWN_SERVICES.join(', ')}`)
    }
  }

  const client = new NodeClient({
    appId,
    appName,
    cores,
    drives,
    swarm,
    topic,
    deviceName,
    reconnect,
    requestedCapabilities: requestedCapabilities || buildRequestedCapabilities({ requireServices })
  })

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      client.close()
      reject(new NodeNotFoundError())
    }, timeoutMs)

    // Check requireServices as soon as we learn about the node (don't wait
    // for pairing to finish — fail fast so the app can fall back).
    client.on('nodeHello', ({ services }) => {
      const missing = requireServices.filter((s) => !services?.[s])
      if (missing.length > 0) {
        clearTimeout(timeout)
        client.close()
        reject(new NodeMissingServiceError(missing, services))
      }
    })

    client.on('registered', () => {
      clearTimeout(timeout)
      resolve(client)
    })

    client.on('pairDenied', ({ reason }) => {
      clearTimeout(timeout)
      client.close()
      reject(new NodeDeniedError(reason))
    })

    client.connect().catch((err) => {
      clearTimeout(timeout)
      reject(err)
    })
  })
}
