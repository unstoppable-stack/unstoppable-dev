import { defineCapability, procedure } from '@unstoppable-stack/p2p/rpc'

// The only domain module both apps import. No storage, networking or handlers
// are opened by importing a contract. Schema and capability versions are separate.
export function note(value) {
  if (value?.schemaVersion !== 1) throw new Error('Unsupported note schema')
  const { id, title, body } = value
  if (typeof id !== 'string' || !/^[a-z0-9-]{1,80}$/.test(id)) throw new Error('Invalid note id')
  if (typeof title !== 'string' || title.length < 1 || title.length > 200) throw new Error('Invalid title')
  if (typeof body !== 'string' || body.length > 16_000) throw new Error('Invalid body')
  return { schemaVersion: 1, id, title, body }
}

export function descriptor(value) {
  if (value?.schema !== 'ecosystem-notes' || value.schemaVersion !== 1) throw new Error('Unsupported dataset schema')
  if (!/^[a-f0-9]{64}$/.test(value.key)) throw new Error('Invalid dataset key')
  // Bound the example's download request; this is not a general backup client.
  if (!Number.isSafeInteger(value.length) || value.length < 1 || value.length > 10_000) throw new Error('Invalid checkpoint')
  return { schema: 'ecosystem-notes', schemaVersion: 1, key: value.key, length: value.length }
}

function summary(value) {
  if (!Number.isSafeInteger(value?.notes) || value.notes < 0 ||
      !Number.isSafeInteger(value?.words) || value.words < 0) throw new Error('Invalid summary')
  return { notes: value.notes, words: value.words }
}

export function notebookCapability(handlers = {}, version = 1) {
  return defineCapability({
    name: 'ecosystem-notebook', version, defaultGrants: [],
    methods: {
      describe: procedure.output(descriptor).query(() => handlers.describe()),
      summary: procedure.output(summary).query(() => handlers.summary()),
      watch: procedure.output(descriptor).stream(({ signal }) => handlers.watch(signal)),
    },
  })
}

export const notebookContract = notebookCapability().contract
