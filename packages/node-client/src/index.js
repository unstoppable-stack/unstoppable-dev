import { NodeClient } from './client.js'
import { KNOWN_SERVICES } from './protocol.js'

export { NodeClient }

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
  requireServices = []
}) {
  for (const s of requireServices) {
    if (!KNOWN_SERVICES.includes(s)) {
      throw new Error(`Unknown service "${s}" — known: ${KNOWN_SERVICES.join(', ')}`)
    }
  }

  const client = new NodeClient({ appId, appName, cores, drives, swarm, topic })

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      client.close()
      reject(new Error('Node not found — is unstoppable-node running?'))
    }, timeoutMs)

    // Check requireServices as soon as we learn about the node (don't wait
    // for pairing to finish — fail fast so the app can fall back).
    client.on('nodeHello', ({ services }) => {
      const missing = requireServices.filter((s) => !services?.[s])
      if (missing.length > 0) {
        clearTimeout(timeout)
        client.close()
        reject(new Error(
          `Node does not offer required service(s): ${missing.join(', ')}. ` +
          `Advertised: ${JSON.stringify(services)}`
        ))
      }
    })

    client.on('registered', () => {
      clearTimeout(timeout)
      resolve(client)
    })

    client.on('pairDenied', ({ reason }) => {
      clearTimeout(timeout)
      client.close()
      reject(new Error(`Node denied pairing: ${reason}`))
    })

    client.connect().catch((err) => {
      clearTimeout(timeout)
      reject(err)
    })
  })
}
