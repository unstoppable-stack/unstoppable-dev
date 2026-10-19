import { openCollection, openCollaborativeDatabase } from '@unstoppable-stack/p2p/data'
async function useData() {
  const collection = await openCollection({ storage: './collection' })
  await collection.network.ready({ timeoutMs: 60000 })
  const connections: number = collection.network.status().connections
  void connections
  await collection.put('note', { text: 'hello' })
  await collection.sync({ version: 2, signal: new AbortController().signal })
  // @ts-expect-error Values must be JSON data
  await collection.put('bad', new Date())
  // @ts-expect-error A version is required
  await collection.sync({})
  const db = await openCollaborativeDatabase({ storage: './db' })
  await db.put('note', [1, true, null])
  await db.members.add('a'.repeat(64))
  await db.waitFor(state => state.writable)
  await db.close()
  await collection.close()
}
void useData
