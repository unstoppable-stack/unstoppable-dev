import { defineCapability, procedure } from '@unstoppable-stack/p2p/rpc'

function noteName(value) {
  if (typeof value?.name !== 'string' || !value.name.length || value.name.length > 200) {
    throw new Error('Expected a note name of 1–200 characters')
  }
  return { name: value.name }
}

// Pure application contract: importing this module never opens storage.
export function createNotesCapability(handlers = {}) {
  return defineCapability({
    name: 'notes', version: 1, defaultGrants: [],
    methods: {
      get: procedure.input(noteName).query(({ input }) => handlers.get(input.name)),
      list: procedure.stream(async function* ({ signal }) { yield* handlers.list(signal) }),
    },
  })
}

export const notesContract = createNotesCapability().contract
