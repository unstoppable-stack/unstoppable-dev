import { join } from 'node:path'
import Corestore from 'corestore'
import Hyperbee from 'hyperbee'
import { createNode } from '@unstoppable-stack/p2p'
import { syncPack } from '@unstoppable-stack/p2p/sync'

// Application data and business methods live here. Identity, invitations,
// permission checks, streams and replication come from the public P2P library.
export async function createNotesPeer({ storage, swarm, deviceName = 'notes' }) {
  const store = new Corestore(join(storage, 'data'))
  const notes = new Hyperbee(store.get({ name: 'notes' }), {
    keyEncoding: 'utf-8', valueEncoding: 'json',
  })
  const node = createNode({
    storage: join(storage, 'identity'),
    swarm,
    profile: { appId: 'p2p-notes', appName: 'P2P Notes', deviceName },
    // A new peer needs an explicitly scoped invitation, even if it knows a key.
    pairing: { approve: async () => 'deny' },
    capabilities: [
      {
        name: 'notes', version: 1, defaultGrants: [],
        methods: {
          get: async ({ name }) => (await notes.get(name))?.value ?? null,
          list: async function* (_params, { signal }) {
            for await (const entry of notes.createReadStream()) {
              if (signal.aborted) return
              yield { name: entry.key, value: entry.value }
            }
          },
        },
      },
      // This attaches replication to the same connections as capability calls.
      syncPack({ store }),
    ],
  })

  try {
    await notes.ready()
    await node.ready()
  } catch (error) {
    await node.close().catch(() => {})
    await notes.close().catch(() => {})
    await store.close().catch(() => {})
    throw error
  }

  return {
    node,
    notes,
    manifest() {
      return { schemaVersion: 1, resources: [{
        id: 'notes', kind: 'hyperbee', key: Buffer.from(notes.core.key).toString('hex'),
        name: 'Notes', protection: { mode: 'mirror' },
      }] }
    },
    async readReplica(coreKey, name) {
      const replica = new Hyperbee(store.get({ key: coreKey }), { keyEncoding: 'utf-8', valueEncoding: 'json' })
      try {
        await replica.ready()
        return (await replica.get(name))?.value ?? null
      } finally { await replica.close() }
    },
    async close() {
      try { await node.close() } finally {
        try { await notes.close() } finally { await store.close() }
      }
    },
  }
}
