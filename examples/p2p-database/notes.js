import Hyperbee from 'hyperbee'
import { autobaseAdapter } from '@unstoppable-stack/p2p/db'

// A replayable, ordered replacement view. Concurrent writes to the same name
// resolve by Autobase order, never by a device clock. This is not a text CRDT.
export const notesAdapter = autobaseAdapter({
  openView: views => new Hyperbee(views.get('notes'), { keyEncoding: 'utf-8', valueEncoding: 'json' }),
  validate: op => op?.type === 'note.put' &&
    typeof op.name === 'string' && op.name.length > 0 && op.name.length <= 200 &&
    typeof op.text === 'string' && op.text.length <= 4000,
  apply: async (op, view, { writerKey }) => {
    await view.put(op.name, { text: op.text, author: writerKey })
  },
})
