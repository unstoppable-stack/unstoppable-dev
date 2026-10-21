import Hyperbee from 'hyperbee'
import { descriptor, note, notebookContract } from './contract.js'
import { openRuntime, beeOptions, download, manifest } from './runtime.js'

export async function openBriefing(options) {
  const runtime = await openRuntime({ ...options, appId: 'ecosystem-briefing' })
  return {
    ...runtime,
    async link({ invite, publicKey, signal }) {
      const peer = invite
        ? await runtime.node.pair(invite, { signal })
        : await runtime.node.connect(publicKey, {
          signal, requested: { 'ecosystem-notebook': ['describe', 'summary', 'watch'] },
        })
      const api = peer.client(notebookContract)
      const shared = descriptor(await api.describe(undefined, { signal }))
      const summary = await api.summary(undefined, { signal })
      // The reader knows only the public contract, not Notebook's implementation.
      await runtime.local.put('source', { publicKey: peer.remotePublicKey, descriptor: shared, summary })
      return { peer, api, descriptor: shared, summary }
    },
    async source() { return (await runtime.local.get('source', { wait: false }))?.value ?? null },
    async buildReport(shared, options = {}) {
      const checked = descriptor(shared)
      const replica = new Hyperbee(runtime.store.get({ key: checked.key }), beeOptions)
      let snapshot
      try {
        await replica.ready()
        // syncPack attached the store to the connection before any reads.
        // Briefing never registers Notebook's key as its own resource.
        await download(replica.core, checked.length, options)
        snapshot = replica.checkout(checked.length)
        await snapshot.ready()
        const items = []
        for await (const entry of snapshot.createReadStream()) {
          const item = note(entry.value)
          if (entry.key !== item.id) throw new Error('Note key does not match its schema')
          items.push({ id: item.id, title: item.title, excerpt: item.body.slice(0, 120) })
        }
        const report = { schemaVersion: 1, source: checked, items }
        // Commit only after every replicated record validates.
        await runtime.local.put('report', report)
        return report
      } finally {
        try { await snapshot?.close() } finally { await replica.close() }
      }
    },
    async report() { return (await runtime.local.get('report', { wait: false }))?.value ?? null },
    manifest: () => manifest(runtime.local, 'briefings', 'Briefing saved reports'),
  }
}
