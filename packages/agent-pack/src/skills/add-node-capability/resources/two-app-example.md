# Two Apps, No Personal Node

A host/joiner pattern for the experimental P2P library. Save each snippet
as a separate script in a project with `@unstoppable-stack/p2p` installed.

## Host — Notes

```js
import { createNode } from '@unstoppable-stack/p2p'

const NOTES = new Map([
  ['note-1', { title: 'Flat white', body: 'Ratio 1:2, 27s' }],
  ['note-2', { title: 'Cortado', body: 'Equal parts, drink fast' }]
])

const notesPack = {
  name: 'notes',
  version: 1,
  methods: {
    search: async ({ q = '' }) => ({
      hits: [...NOTES.entries()]
        .filter(([, n]) => n.title.toLowerCase().includes(q.toLowerCase()))
        .map(([id, n]) => ({ id, ...n }))
    }),

    feed: async function * (params, ctx) {
      for (const [id, note] of NOTES) {
        if (ctx.signal.aborted) return
        yield { id, ...note }
      }
    },

    // Destructive: deliberately not granted by default.
    erase: async ({ id }) => ({ erased: NOTES.delete(id) })
  },
  defaultGrants: ['search', 'feed']
}

const node = createNode({
  storage: './.notes-node',
  profile: { appId: 'notes', appName: 'Notes' },
  capabilities: [notesPack]
})

await node.ready()
await node.listen()

const invite = await node.createInvite({ uses: 1, expiresIn: 10 * 60_000 })
console.log('Pairing code:', invite.code)
```

## Joiner — Reader

```js
import { createNode } from '@unstoppable-stack/p2p'

const node = createNode({
  storage: './.reader-node',
  profile: { appId: 'reader', appName: 'Reader' },
  capabilities: []                    // hosts nothing
})
await node.ready()

const peer = await node.pair(process.argv[2])

const { hits } = await peer.api.notes.search({ q: 'flat' })

// Breaking out cancels the far-side generator.
let seen = 0
for await (const note of peer.api.notes.feed({})) {
  if (++seen === 2) break
}

// Never granted -> NOT_GRANTED, without reaching the handler.
try {
  await peer.api.notes.erase({ id: 'note-1' })
} catch (err) {
  console.log(err.code)               // 'NOT_GRANTED'
}

await node.close()
```

## What To Notice

- Both files import the same `createNode`. The only difference is that Notes
  calls `listen()` and declares a pack.
- The reader never learned Notes' public key ahead of time — the invite
  carried it. After this, `node.connect(peer.publicKey)` works with no code.
- `erase` exists and is implemented, but is not in `defaultGrants` and the
  invite did not ask for it, so the call is refused before the handler runs.
