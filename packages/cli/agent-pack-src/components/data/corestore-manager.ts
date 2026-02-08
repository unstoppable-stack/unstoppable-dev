/**
 * Corestore Manager — Manages multiple Hypercores with shared storage.
 *
 * Handles: store lifecycle, named cores, replication wiring, cleanup.
 *
 * CUSTOMIZE: Add your own named cores in the `init()` method.
 */

import Corestore from 'corestore'

export interface CorestoreManagerOptions {
  /** Storage path for all cores */
  storagePath: string
}

export class CorestoreManager {
  private store: any
  private cores = new Map<string, any>()
  private ready = false

  constructor(private opts: CorestoreManagerOptions) {
    this.store = new Corestore(opts.storagePath)
  }

  /**
   * Initialize the store. Must be called before getting cores.
   */
  async init(): Promise<void> {
    await this.store.ready()
    this.ready = true
  }

  /**
   * Get or create a named Hypercore.
   * Named cores have deterministic keys — same name always produces same core.
   *
   * Usage:
   *   const events = await manager.getCore('events')
   *   await events.append('hello')
   */
  async getCore(name: string): Promise<any> {
    if (!this.ready) await this.init()

    if (this.cores.has(name)) {
      return this.cores.get(name)
    }

    const core = this.store.get({ name })
    await core.ready()
    this.cores.set(name, core)
    return core
  }

  /**
   * Get a core by its public key (for replicating remote cores).
   *
   * Usage:
   *   const remote = await manager.getCoreByKey(peerKeyBuffer)
   */
  async getCoreByKey(key: Buffer): Promise<any> {
    if (!this.ready) await this.init()

    const core = this.store.get({ key })
    await core.ready()
    return core
  }

  /**
   * Wire all cores in this store for replication over a connection.
   * Typically called from swarm.on('connection').
   *
   * Usage:
   *   swarm.on('connection', (conn) => manager.replicate(conn))
   */
  replicate(conn: any): void {
    this.store.replicate(conn)
  }

  /** The underlying Corestore instance (for advanced use) */
  get raw(): any {
    return this.store
  }

  /**
   * Graceful shutdown — close all cores and store.
   */
  async destroy(): Promise<void> {
    for (const [, core] of this.cores) {
      await core.close().catch(() => {})
    }
    this.cores.clear()
    await this.store.close().catch(() => {})
  }
}
