import { createNode } from './node.js'
import { createClient } from './rpc.js'
import { contracts } from './rpc-contracts.js'
import { InvalidOptionError, NodeError } from './errors.js'

// This opt-in entry loads native transport; /rpc remains safe for shared contracts.
function sessionNode (storage, nodeOptions) {
  return createNode({ ...nodeOptions, storage, reconnect: false })
}

async function closeAfterFailure (node, error) {
  try { await node.close() } catch (cleanupError) {
    // Preserve the operation error while retaining cleanup diagnostics.
    if (error && typeof error === 'object' && Object.isExtensible(error)) error.cleanupError = cleanupError
  }
  throw error
}

/** Own a node serving one typed capability; invites grant only named methods. */
export async function serve ({ storage, capability, nodeOptions = {} } = {}) {
  if (!contracts.has(capability?.contract)) {
    throw new InvalidOptionError('serve() needs a defineCapability() capability')
  }
  const node = await sessionNode(storage, { ...nodeOptions, capabilities: [capability] })
  try {
    await node.listen()
    return Object.freeze({
      node,
      contract: capability.contract,
      async invite (methods, options = {}) {
        if (!Array.isArray(methods) || methods.length === 0 ||
            methods.some(name => typeof name !== 'string' || !Object.hasOwn(capability.methods, name))) {
          throw new InvalidOptionError('invite() needs a non-empty list of defined method names')
        }
        const issued = await node.createInvite({
          ...options, grants: { [capability.name]: [...new Set(methods)] }
        })
        return issued.code
      },
      close: () => node.close()
    })
  } catch (error) { return closeAfterFailure(node, error) }
}

/** Pair (or reconnect by saved public key), bind a contract, and own cleanup. */
export async function connect ({ storage, invite, publicKey, contract: capability, timeout = 20_000, signal, nodeOptions = {} } = {}) {
  const contract = capability?.contract || capability
  if (!contracts.has(contract)) throw new InvalidOptionError('connect() needs a defineCapability() contract')
  if ((invite != null) === (publicKey != null)) throw new InvalidOptionError('connect() needs exactly one invite or publicKey')
  if (!Number.isSafeInteger(timeout) || timeout < 0) throw new InvalidOptionError('timeout must be a non-negative safe integer')
  if (signal?.aborted) throw new NodeError('CANCELLED', 'Connection cancelled')
  const node = await sessionNode(storage, { ...nodeOptions, capabilities: [] })
  try {
    const options = { timeout, signal, reconnect: false, requested: { [contract.name]: Object.keys(contract.methods) } }
    const peer = invite != null ? await node.pair(invite, options) : await node.connect(publicKey, options)
    const api = createClient(peer, contract)
    return Object.freeze({ node, peer, api, close: () => node.close() })
  } catch (error) { return closeAfterFailure(node, error) }
}
