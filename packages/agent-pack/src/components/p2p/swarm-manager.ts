/**
 * Swarm Manager — Battle-tested Hyperswarm connection management.
 *
 * Handles: peer discovery, connection lifecycle, error handling, graceful shutdown.
 *
 * CUSTOMIZE: Change the topic generation and onConnection handler for your app.
 */

import Hyperswarm from 'hyperswarm'
import crypto from 'hypercore-crypto'

export interface SwarmManagerOptions {
  /** Optional seed for deterministic key pair */
  seed?: Buffer
  /** Max peers to connect to (default: 32) */
  maxPeers?: number
  /** Called when a new peer connects */
  onConnection?: (conn: any, info: any) => void
  /** Called when a peer disconnects */
  onDisconnect?: (conn: any) => void
  /** Called on connection errors (non-fatal) */
  onError?: (err: Error, conn?: any) => void
}

export class SwarmManager {
  private swarm: any
  private connections = new Set<any>()
  private discoveries = new Map<string, any>()
  private opts: SwarmManagerOptions
  private destroyed = false

  constructor(opts: SwarmManagerOptions = {}) {
    this.opts = opts
    this.swarm = new Hyperswarm({
      seed: opts.seed,
      maxPeers: opts.maxPeers ?? 32,
    })

    this.swarm.on('connection', (conn: any, info: any) => {
      this.connections.add(conn)

      conn.on('close', () => {
        this.connections.delete(conn)
        this.opts.onDisconnect?.(conn)
      })

      conn.on('error', (err: Error) => {
        // Socket errors are normal in P2P — don't crash, just log
        this.opts.onError?.(err, conn)
      })

      this.opts.onConnection?.(conn, info)
    })
  }

  /**
   * Join a topic for peer discovery.
   * IMPORTANT: Both peers must use { server: true, client: true } for reliable discovery.
   */
  async join(topic: Buffer): Promise<void> {
    const key = topic.toString('hex')
    if (this.discoveries.has(key)) return

    const discovery = this.swarm.join(topic, { server: true, client: true })
    this.discoveries.set(key, discovery)

    // Wait for THIS topic's announcements (not swarm.flush() which is global)
    await discovery.flushed()
  }

  /**
   * Join using a string topic (hashed to 32 bytes).
   */
  async joinTopic(topicString: string): Promise<void> {
    const topic = crypto.discoveryKey(Buffer.from(topicString))
    await this.join(topic)
  }

  /**
   * Leave a topic.
   */
  async leave(topic: Buffer): Promise<void> {
    const key = topic.toString('hex')
    const discovery = this.discoveries.get(key)
    if (discovery) {
      await discovery.destroy()
      this.discoveries.delete(key)
    }
  }

  /** Number of active peer connections */
  get peerCount(): number {
    return this.connections.size
  }

  /** The underlying Hyperswarm instance (for advanced use) */
  get raw(): any {
    return this.swarm
  }

  /**
   * Graceful shutdown — close all connections, leave all topics, destroy swarm.
   * Always call this on app exit.
   */
  async destroy(): Promise<void> {
    if (this.destroyed) return
    this.destroyed = true

    // Leave all topics
    for (const [, discovery] of this.discoveries) {
      await discovery.destroy().catch(() => {})
    }
    this.discoveries.clear()

    // Destroy swarm (closes all connections)
    await this.swarm.destroy()
    this.connections.clear()
  }
}

/**
 * Quick helper to create a swarm manager and join a topic.
 *
 * Usage:
 *   const { manager, topic } = await createSwarm('my-app-room')
 *   // manager.onConnection is set via options
 */
export async function createSwarm(
  topicString: string,
  opts: SwarmManagerOptions = {}
): Promise<{ manager: SwarmManager; topic: Buffer }> {
  const manager = new SwarmManager(opts)
  const topic = crypto.discoveryKey(Buffer.from(topicString))
  await manager.join(topic)
  return { manager, topic }
}
