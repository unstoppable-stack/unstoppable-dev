import { createNode as defaultCreateNode } from '@unstoppable-stack/p2p'
import Hyperswarm from 'hyperswarm'

// Connects a memory engine to whatever Personal Node is running on this
// machine: discover it on the local topic, hand it a resource manifest, and
// keep seeding the memory core so it has something to replicate.
export async function connectMemoryToNode ({
  engine,
  storage,
  createNode = defaultCreateNode,
  createSwarm = () => new Hyperswarm(),
  required = false,
  timeout = 5_000
} = {}) {
  if (!engine || typeof engine.getNodeRegistration !== 'function') {
    throw new Error('connectMemoryToNode requires an engine with getNodeRegistration()')
  }

  const registration = await engine.getNodeRegistration()
  let swarm = null
  let node = null

  try {
    swarm = await serveMemoryCore(engine, createSwarm)

    node = createNode({
      storage: storage || registration.storage || './.unstoppable-memory-node',
      profile: { appId: registration.appId, appName: registration.appName },
      // This app hosts nothing; it only consumes the node's sync capability.
      capabilities: [],
      pairing: {}
    })
    await node.ready()

    const peer = await node.discover({ timeout, requested: { sync: ['manifest.replace', 'status', 'usage'] } })
    await peer.call('sync', 'manifest.replace', {
      manifest: toManifest(registration)
    })

    return withCleanup({ node, peer, swarm })
  } catch (err) {
    if (node) await node.close().catch(() => {})
    if (swarm) await destroySwarm(swarm)
    if (!required) return null
    throw err
  }
}

// The 0.5 protocol took parallel `cores` and `drives` arrays; v2 takes one
// manifest describing the complete set.
export function toManifest (registration) {
  const resources = []
  for (const [index, core] of (registration.cores || []).entries()) {
    resources.push({
      id: core.name || `core-${index}`,
      kind: core.type === 'hyperbee' ? 'hyperbee' : 'hypercore',
      key: toHex(core.key),
      name: core.name || `Core ${index}`,
      protection: { mode: 'mirror' }
    })
  }
  for (const [index, drive] of (registration.drives || []).entries()) {
    resources.push({
      id: drive.name || `drive-${index}`,
      kind: 'hyperdrive',
      key: toHex(drive.key),
      name: drive.name || `Drive ${index}`,
      protection: { mode: 'mirror' }
    })
  }
  return { schemaVersion: 1, resources }
}

function toHex (key) {
  return typeof key === 'string' ? key.toLowerCase() : Buffer.from(key).toString('hex')
}

async function serveMemoryCore (engine, createSwarm) {
  if (!engine.store || !engine.core?.discoveryKey) {
    throw new Error('Memory engine must expose store and core.discoveryKey for replication')
  }

  const swarm = createSwarm()
  swarm.on('connection', (conn) => {
    engine.store.replicate(conn)
    conn.on?.('error', () => {})
  })
  swarm.join(engine.core.discoveryKey, { server: true, client: true })
  if (typeof swarm.flush === 'function') await swarm.flush()
  return swarm
}

function withCleanup ({ node, peer, swarm }) {
  return {
    node,
    peer,
    nodePublicKey: peer.publicKey,
    getStatus: (opts) => peer.call('sync', 'status', {}, opts),
    getUsage: (opts) => peer.call('sync', 'usage', {}, opts),
    replaceManifest: (manifest, opts) => peer.call('sync', 'manifest.replace', { manifest }, opts),
    async close () {
      await node.close().catch(() => {})
      await destroySwarm(swarm)
    }
  }
}

async function destroySwarm (swarm) {
  if (typeof swarm.destroy === 'function') await swarm.destroy()
}
