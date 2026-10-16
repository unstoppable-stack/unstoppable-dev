import Corestore from 'corestore'
import Hyperbee from 'hyperbee'
import { ReplicationEngine } from './replication.js'
import { validateResourceManifest } from './resource-manifest.js'

export { ReplicationEngine } from './replication.js'
export { validateResourceManifest } from './resource-manifest.js'

// Data + file replication as a capability pack.
//
// Ownership is keyed by peer public key, not appId: two devices running the
// same app are two peers with two resource sets. Every method is scoped to the
// calling peer — a peer can never see or touch another peer's resources.
export function syncPack ({ store, storage } = {}) {
  if (!store && !storage) {
    throw new Error('syncPack() needs either an existing `store` or a `storage` path')
  }

  let node = null
  let engine = null
  let manifests = null
  let ownsStore = false
  let closing = false

  async function readManifest (owner) {
    const entry = await manifests.get(`owners/${owner}`)
    return entry?.value || null
  }

  async function applyManifest (owner, manifest) {
    const applied = []
    for (const resource of manifest.resources) {
      const common = {
        key: resource.key,
        name: resource.name,
        owner,
        resourceId: resource.id,
        metadata: resource.metadata,
        protection: resource.protection
      }
      if (resource.kind === 'hyperdrive') await engine.addDrive(common)
      else await engine.addCore({ ...common, type: resource.kind })
      applied.push({ id: resource.id, key: resource.key })
    }

    // A manifest is the complete set: anything absent is dropped.
    await engine.reconcileOwnerResources(owner, {
      coreKeys: manifest.resources.filter((r) => r.kind !== 'hyperdrive').map((r) => r.key),
      driveKeys: manifest.resources.filter((r) => r.kind === 'hyperdrive').map((r) => r.key)
    })

    return applied
  }

  function ownedCores (owner) {
    return engine.getStats().filter((stat) => stat.owner === owner)
  }

  function ownedDrives (owner) {
    return engine.getDriveStats().filter((stat) => stat.owner === owner)
  }

  return {
    name: 'sync',
    version: 1,

    methods: {
      // Replace the caller's complete resource set.
      'manifest.replace': async (params, ctx) => {
        const owner = ctx.peer.remotePublicKey
        const manifest = validateResourceManifest(params?.manifest)
        const resources = await applyManifest(owner, manifest)
        await manifests.put(`owners/${owner}`, manifest)
        return { manifest, resources }
      },

      // The caller's own resources and their protection state. Never another
      // peer's, and never node-global paths.
      status: async (params, ctx) => {
        const owner = ctx.peer.remotePublicKey
        return {
          cores: ownedCores(owner),
          drives: ownedDrives(owner)
        }
      },

      // The caller's logical replicated bytes — not the node's disk footprint.
      usage: async (params, ctx) => {
        const owner = ctx.peer.remotePublicKey
        const replicated = engine.getReplicatedBytes()
        return { bytes: replicated.perOwner[owner] || 0, scope: 'self' }
      },

      pause: async (params, ctx) => {
        const owner = ctx.peer.remotePublicKey
        return { paused: await engine.pauseOwner(owner) }
      },

      resume: async (params, ctx) => {
        const owner = ctx.peer.remotePublicKey
        return { resumed: await engine.resumeOwner(owner) }
      },

      // Debug reads, deliberately outside defaultGrants.
      'peek.core': async (params, ctx) => {
        const owner = ctx.peer.remotePublicKey
        const key = String(params?.key || '')
        if (!ownedCores(owner).some((stat) => stat.key === key)) return null
        return engine.peekCore(key, { limit: params?.limit })
      },

      'peek.drive': async (params, ctx) => {
        const owner = ctx.peer.remotePublicKey
        const key = String(params?.key || '')
        if (!ownedDrives(owner).some((stat) => stat.key === key)) return null
        return engine.peekDrive(key, { dir: params?.dir, limit: params?.limit })
      }
    },

    defaultGrants: ['manifest.replace', 'status', 'usage', 'pause', 'resume'],

    async onAttach (n) {
      node = n
      if (!store) {
        store = new Corestore(storage)
        ownsStore = true
      }
      await store.ready()

      manifests = new Hyperbee(store.get({ name: 'sync-manifests' }), {
        keyEncoding: 'utf-8',
        valueEncoding: 'json'
      })
      await manifests.ready()

      engine = new ReplicationEngine(store, node.swarm)

      // Replication attaches to every swarm connection. For a paired peer this
      // rides the same connection as control traffic: Corestore resolves the
      // muxer P2P runtime published on the noise stream instead of building its
      // own. Connections found through a resource's discovery key — third
      // parties seeding the same data — are ordinary swarm connections that
      // carry no control channel, and replicate here just the same.
      node.swarm.on('connection', (socket) => {
        // A connection can still land while the node is shutting down.
        if (closing || store.closing) return
        store.replicate(socket)
        engine.onPeerConnection()
      })

      // Resources outlive the sessions that registered them: the point of the
      // node is to keep seeding while the app is closed.
      for await (const entry of manifests.createReadStream({ gte: 'owners/', lt: 'owners0' })) {
        const owner = entry.key.slice('owners/'.length)
        try {
          await applyManifest(owner, entry.value)
        } catch (err) {
          node.emit('error', { type: 'restore', owner, error: err.message })
        }
      }
    },

    async onDetach () {
      closing = true
      if (engine) await engine.close()
      if (manifests) { try { await manifests.close() } catch {} }
      if (ownsStore && store) { try { await store.close() } catch {} }
    },

    // Exposed for the Personal Node shell's dashboard, which needs node-wide
    // views the per-peer capability methods deliberately do not expose.
    get engine () { return engine }
  }
}
