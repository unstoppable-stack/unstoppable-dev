import { EventEmitter } from 'node:events'
import { note, descriptor, notebookCapability } from './contract.js'
import { openRuntime, manifest } from './runtime.js'

export async function openNotebook(options) {
  let runtime
  const changes = new EventEmitter()
  const describe = () => descriptor({
    schema: 'ecosystem-notes', schemaVersion: 1,
    key: Buffer.from(runtime.local.core.key).toString('hex'),
    length: runtime.local.core.length,
  })
  const capability = notebookCapability({
    describe,
    async summary() {
      let notes = 0, words = 0
      for await (const entry of runtime.local.createReadStream()) {
        const item = note(entry.value)
        notes++
        words += item.body.trim().split(/\s+/u).filter(Boolean).length
      }
      return { notes, words }
    },
    async *watch(signal) {
      // Subscribe before the initial checkpoint so a concurrent edit is not lost.
      let wake, dirty = true
      const changed = () => { dirty = true; wake?.() }
      const aborted = () => wake?.()
      changes.on('change', changed)
      signal.addEventListener('abort', aborted, { once: true })
      try {
        // Coalesce edits to the latest checkpoint instead of buffering an
        // unbounded event queue for a slow consumer.
        while (!signal.aborted) {
          if (!dirty) await new Promise(resolve => { wake = resolve })
          wake = null
          if (signal.aborted) break
          dirty = false
          yield describe()
        }
      } finally {
        changes.off('change', changed)
        signal.removeEventListener('abort', aborted)
      }
    },
  })
  runtime = await openRuntime({ ...options, appId: 'ecosystem-notebook', capabilities: [capability] })
  return {
    ...runtime, describe,
    async put(value) {
      const validated = note(value)
      await runtime.local.put(validated.id, validated)
      changes.emit('change')
    },
    async get(id) { return (await runtime.local.get(id, { wait: false }))?.value ?? null },
    manifest: () => manifest(runtime.local, 'notes', 'Notebook shared notes'),
    // Useful local diagnostics; never part of the remote capability.
    get watchers() { return changes.listenerCount('change') },
  }
}
