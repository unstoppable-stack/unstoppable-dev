import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { openCollaborativeDatabase } from '@unstoppable-stack/p2p/data'

const directory = await mkdtemp(join(tmpdir(), 'p2p-collaborate-'))
let alice, bob
try {
  alice = await openCollaborativeDatabase({ storage: join(directory, 'alice') })
  await alice.network.ready() // Local open remains usable without a network.
  bob = await openCollaborativeDatabase({ storage: join(directory, 'bob'), key: alice.key })
  // Verify Bob's writer key through your app's trusted sharing channel.
  await alice.members.add(bob.writerKey)
  await bob.waitFor(state => state.writable, { timeoutMs: 60_000 })
  await bob.put('note', { text: 'Written by Bob' })

  // update() processes available history, not a global synchronization barrier.
  const deadline = Date.now() + 60_000
  while (await alice.get('note') === null) {
    if (Date.now() > deadline) throw new Error('Alice did not receive the edit in time')
    await new Promise(resolve => setTimeout(resolve, 50))
    await alice.update()
  }
  console.log(await alice.get('note'))
} catch (error) {
  console.error(error.code || 'ERROR', error.message)
  if (error.network) console.error('Network status:', JSON.stringify(error.network))
  process.exitCode = 1
} finally {
  try { await bob?.close() } finally {
    try { await alice?.close() } finally { await rm(directory, { recursive: true, force: true }) }
  }
}
