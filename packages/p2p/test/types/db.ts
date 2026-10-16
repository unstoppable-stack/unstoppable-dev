import { createNode } from '@unstoppable-stack/p2p'
import { autobaseAdapter, openDatabase } from '@unstoppable-stack/p2p/db'
import { syncPack, validateResourceManifest, type ResourceManifest } from '@unstoppable-stack/p2p/sync'

type Operation = { type: 'put'; key: string; value: string }
type View = { put(key: string, value: string): Promise<void>; get(key: string): Promise<string | null>; close(): Promise<void> }
const adapter = autobaseAdapter<View, Operation>({
  openView: views => views.get('records'),
  validate: value => typeof value === 'object' && value !== null,
  async apply(operation, view, context) {
    const source: string = context.writerKey
    await view.put(operation.key, operation.value + source)
  }
})
async function types(store: { session(): any }) {
  const pack = syncPack({ store })
  const node = createNode({ storage: '/tmp/db-types', capabilities: [pack] })
  const db = await openDatabase({ node, store, adapter })
  await db.append({ type: 'put', key: 'a', value: 'text' })
  // @ts-expect-error wrong operation value
  await db.append({ type: 'put', key: 'a', value: 12 })
  const value: string | null = await db.view.get('a')
  const unwatch = db.watch(state => { const flag: boolean = state.writable; return flag })
  await db.members.add(db.writerKey)
  await db.waitFor(state => state.writable, { timeoutMs: 100 })
  const manifest: ResourceManifest = validateResourceManifest({ schemaVersion: 1, resources: [] })
  await pack.pauseOwner(db.writerKey)
  unwatch()
  await db.close()
  return { value, manifest }
}
void types
