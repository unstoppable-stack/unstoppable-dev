import { NodeError, CancelledError } from '@unstoppable-stack/p2p'
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
export function syncPack ({ store, storage, admit = async () => {} } = {}) {
  if (!store && !storage) {
    throw new Error('syncPack() needs either an existing `store` or a `storage` path')
  }

  let applyingManifest = false
  let node = null
  let engine = null
  let manifests = null
  let ownsStore = false
  let closing = false
  let onConnection = null

  async function readManifest (owner) {
    const entry = await manifests.get(`owners/${owner}`)
    return entry?.value || null
  }

  // Keys currently have one registering owner. Shared-database membership is
  // deliberately not inferred from knowing a resource key.
  function preflightManifest (owner, manifest) {
    for (const resource of manifest.resources) {
      const core = engine.replicating.get(resource.key)
      const drive = engine.drives.get(resource.key)
      const existing = core || drive
      if (existing && existing.owner !== owner) throw new NodeError('NOT_GRANTED', 'Resource is already registered to another peer')
      if ((core && resource.kind === 'hyperdrive') || (drive && resource.kind !== 'hyperdrive')) {
        throw new NodeError('REQUEST_FAILED', 'Resource kind cannot change for an existing key')
      }
    }
  }

  async function ownerPaused (owner) {
    return (await manifests.get(`paused/${owner}`))?.value === true
  }

  async function pauseOwner (owner) {
    await manifests.put(`paused/${owner}`, true)
    return engine.pauseOwner(owner)
  }

  async function resumeOwner (owner) {
    await manifests.put(`paused/${owner}`, false)
    return engine.resumeOwner(owner)
  }

  async function replaceManifest (owner, manifest, signal) {
    preflightManifest(owner, manifest)
    const previous = await readManifest(owner) || { schemaVersion: 1, resources: [] }
    const paused = await ownerPaused(owner)
    try {
      // Open new sessions without discovery or downloads. No existing resource
      // metadata/policy changes until all opens succeed and intent is durable.
      for (const resource of manifest.resources) {
        if (signal?.aborted || node.peerRegistry.isDenied(owner)) throw new CancelledError('Resource registration cancelled')
        if (engine.replicating.has(resource.key) || engine.drives.has(resource.key)) continue
        const common = { ...resource, resourceId: resource.id, owner, paused: true }
        if (resource.kind === 'hyperdrive') await engine.addDrive(common)
        else await engine.addCore({ ...common, type: resource.kind })
      }
      if (signal?.aborted || node.peerRegistry.isDenied(owner)) throw new CancelledError('Resource registration cancelled')
      await manifests.put(`owners/${owner}`, manifest)
      return await applyManifest(owner, manifest, signal, paused)
    } catch (error) {
      const recoveryErrors = []
      if (node.peerRegistry.isDenied(owner)) {
        try { await engine.removeOwnerCores(owner) } catch (cause) { recoveryErrors.push(cause) }
        try { await manifests.del(`owners/${owner}`) } catch (cause) { recoveryErrors.push(cause) }
      } else {
        // On a process crash the durable manifest is replayed at startup. For
        // ordinary failures restore both the durable and live previous set.
        try { await manifests.put(`owners/${owner}`, previous) } catch (cause) { recoveryErrors.push(cause) }
        try { await applyManifest(owner, previous, undefined, paused) } catch (cause) { recoveryErrors.push(cause) }
      }
      if (recoveryErrors.length) throw new AggregateError([error, ...recoveryErrors], 'Resource replacement failed; recovery was incomplete')
      throw error
    }
  }

  async function applyManifest (owner, manifest, signal, paused = false) {
    const applied = []
    for (const resource of manifest.resources) {
      if (signal?.aborted || node.peerRegistry.isDenied(owner)) throw new CancelledError('Resource registration cancelled')
      const common = {
        key: resource.key,
        name: resource.name,
        owner,
        resourceId: resource.id,
        metadata: resource.metadata,
        protection: resource.protection,
        paused
      }
      if (resource.kind === 'hyperdrive') await engine.addDrive(common)
      else await engine.addCore({ ...common, type: resource.kind })
      if (signal?.aborted || node.peerRegistry.isDenied(owner)) {
        await engine.removeOwnerCores(owner)
        await manifests.del(`owners/${owner}`)
        throw new CancelledError('Resource registration cancelled')
      }
      applied.push({ id: resource.id, key: resource.key })
    }

    // A manifest is the complete set: anything absent is dropped.
    await engine.reconcileOwnerResources(owner, {
      coreKeys: manifest.resources.filter((r) => r.kind !== 'hyperdrive').map((r) => r.key),
      driveKeys: manifest.resources.filter((r) => r.kind === 'hyperdrive').map((r) => r.key)
    })
    // Admission policy can pause an owner while a replacement is opening.
    // Re-read the durable intent instead of undoing a quota/operator pause.
    if (await ownerPaused(owner)) await engine.pauseOwner(owner)
    else await engine.resumeOwner(owner)

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
        if (applyingManifest) throw new NodeError('RESOURCE_LIMIT', 'Another resource manifest is being applied; retry later')
        applyingManifest = true
        try {
          const owner = ctx.peer.remotePublicKey
          await admit(owner)
          const manifest = validateResourceManifest(params?.manifest)
          const otherResources = engine.getStats().filter(r => r.owner !== owner).length + engine.getDriveStats().filter(r => r.owner !== owner).length
          if (otherResources + manifest.resources.length > 512) throw new NodeError('RESOURCE_LIMIT', 'Node resource capacity reached (512 resources)')
          const resources = await replaceManifest(owner, manifest, ctx.signal)
          return { manifest, resources }
        } finally { applyingManifest = false }
      },

      // The caller's own resources and their protection state. Never another
      // peer's, and never node-global paths.
      status: async (params, ctx) => {
        const owner = ctx.peer.remotePublicKey
        return {
          pauseScope: 'discovery-and-mirroring',
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
        if (applyingManifest) throw new NodeError('RESOURCE_LIMIT', 'Resource state is changing; retry later')
        applyingManifest = true
        try {
          return { paused: await pauseOwner(owner), scope: 'discovery-and-mirroring' }
        } finally { applyingManifest = false }
      },

      resume: async (params, ctx) => {
        const owner = ctx.peer.remotePublicKey
        if (applyingManifest) throw new NodeError('RESOURCE_LIMIT', 'Resource state is changing; retry later')
        applyingManifest = true
        try {
          await admit(owner)
          return { resumed: await resumeOwner(owner), scope: 'discovery-and-mirroring' }
        } finally { applyingManifest = false }
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

      engine = new ReplicationEngine(store, node.swarm, { admit })

      // Replication attaches to every swarm connection. For a paired peer this
      // rides the same connection as control traffic: Corestore resolves the
      // muxer P2P runtime published on the noise stream instead of building its
      // own. Connections found through a resource's discovery key — third
      // parties seeding the same data — are ordinary swarm connections that
      // carry no control channel, and replicate here just the same.
      onConnection = (socket) => {
        // A connection can still land while the node is shutting down.
        if (closing || store.closing) return
        store.replicate(socket)
        engine.onPeerConnection()
      }
      node.swarm.on('connection', onConnection)

      // Resources outlive the sessions that registered them: the point of the
      // node is to keep seeding while the app is closed.
      for await (const entry of manifests.createReadStream({ gte: 'owners/', lt: 'owners0' })) {
        const owner = entry.key.slice('owners/'.length)
        try {
          if (node.peerRegistry.isDenied(owner)) { await manifests.del(entry.key); continue }
          await applyManifest(owner, entry.value, undefined, await ownerPaused(owner))
        } catch (err) {
          node.emit('error', { type: 'restore', owner, error: err.message })
        }
      }
    },

    async onDetach () {
      closing = true
      if (onConnection) node.swarm.removeListener('connection', onConnection)
      if (engine) await engine.close()
      if (manifests) { try { await manifests.close() } catch {} }
      if (ownsStore && store) { try { await store.close() } catch {} }
    },

    // Exposed for the Personal Node shell's dashboard, which needs node-wide
    // views the per-peer capability methods deliberately do not expose.
    pauseOwner,
    resumeOwner,
    get engine () { return engine }
  }
}
