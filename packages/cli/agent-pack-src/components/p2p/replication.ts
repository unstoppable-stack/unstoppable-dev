/**
 * Replication helpers — Wire Hypercore/Corestore replication to Hyperswarm.
 *
 * Handles: connection lifecycle, error handling, findingPeers coordination.
 *
 * CUSTOMIZE: Replace `core` or `store` with your data structure.
 */

import Hyperswarm from 'hyperswarm'
import Hypercore from 'hypercore'

/**
 * Replicate a single Hypercore over Hyperswarm.
 *
 * Usage:
 *   const cleanup = replicateCore(swarm, core)
 *   // later: cleanup()
 */
export function replicateCore(swarm: any, core: any): () => void {
  const connections = new Set<any>()

  const onConnection = (conn: any) => {
    connections.add(conn)
    // core.replicate() wires the replication protocol over this connection
    const stream = core.replicate(conn)

    conn.on('error', () => {
      // Socket errors are expected in P2P (peer went offline, NAT timeout, etc.)
      connections.delete(conn)
    })

    conn.on('close', () => {
      connections.delete(conn)
    })
  }

  swarm.on('connection', onConnection)

  return () => {
    swarm.removeListener('connection', onConnection)
    for (const conn of connections) {
      conn.destroy()
    }
    connections.clear()
  }
}

/**
 * Replicate a Corestore (multiple cores) over Hyperswarm.
 *
 * Usage:
 *   const cleanup = replicateStore(swarm, store)
 */
export function replicateStore(swarm: any, store: any): () => void {
  const connections = new Set<any>()

  const onConnection = (conn: any) => {
    connections.add(conn)
    // store.replicate() handles all cores in this store
    store.replicate(conn)

    conn.on('error', () => {
      connections.delete(conn)
    })

    conn.on('close', () => {
      connections.delete(conn)
    })
  }

  swarm.on('connection', onConnection)

  return () => {
    swarm.removeListener('connection', onConnection)
    for (const conn of connections) {
      conn.destroy()
    }
    connections.clear()
  }
}

/**
 * Join a core's discoveryKey on the swarm and start replicating.
 *
 * IMPORTANT: Uses discovery.flushed() (not swarm.flush()) for topic-specific waiting.
 * Uses core.findingPeers() to coordinate core.update() with peer discovery.
 *
 * Usage:
 *   const cleanup = await joinAndReplicate(swarm, core)
 */
export async function joinAndReplicate(
  swarm: any,
  core: any
): Promise<() => void> {
  await core.ready()

  const cleanupReplication = replicateCore(swarm, core)

  // Tell the core we're looking for peers — coordinates core.update()
  const done = core.findingPeers()
  const discovery = swarm.join(core.discoveryKey, { server: true, client: true })
  // Wait for topic announcements, then signal the core
  discovery.flushed().then(done, done)

  return async () => {
    cleanupReplication()
    await discovery.destroy()
  }
}
