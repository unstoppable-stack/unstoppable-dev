import { connectToNode as defaultConnectToNode } from '@unstoppable-stack/node-client'
import Hyperswarm from 'hyperswarm'

export async function connectMemoryToNode ({
  engine,
  connectToNode = defaultConnectToNode,
  createSwarm = () => new Hyperswarm(),
  required = false,
  reconnect = true,
  timeout = 5_000
} = {}) {
  if (!engine || typeof engine.getNodeRegistration !== 'function') {
    throw new Error('connectMemoryToNode requires an engine with getNodeRegistration()')
  }

  const registration = await engine.getNodeRegistration()
  let swarm = null
  try {
    swarm = await serveMemoryCore(engine, createSwarm)
    const client = await connectToNode({
      appId: registration.appId,
      appName: registration.appName,
      cores: registration.cores || [],
      drives: registration.drives || [],
      requireServices: ['data'],
      reconnect,
      timeout
    })
    return withReplicationCleanup(client, swarm)
  } catch (err) {
    if (swarm) await destroySwarm(swarm)
    if (!required) return null
    throw err
  }
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

function withReplicationCleanup (client, swarm) {
  const originalClose = typeof client?.close === 'function' ? client.close.bind(client) : null
  return {
    ...client,
    async close () {
      if (originalClose) await originalClose()
      await destroySwarm(swarm)
    }
  }
}

async function destroySwarm (swarm) {
  if (typeof swarm.destroy === 'function') await swarm.destroy()
}
