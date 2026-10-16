// Keep the raw embedded Bare sidecar alive through asynchronous ESM startup.
// CLI Bare and the embedded executable have different entrypoint lifetimes.
if (!globalThis.Bare) throw new Error('Run this smoke with Bare, not Node')
const keepAlive = setInterval(() => {}, 1000)
try {
  const { default: os } = await import('bare-os')
  const { createNode, loadIdentity, issueInvite, InviteStore } = await import('../src/index.js')
  const { runtimeFs: fs, runtimePath: path } = await import('../src/runtime-files.js')
  const { syncPack } = await import('../src/sync/index.js')
  const storage = await fs.mkdtemp(path.join(os.tmpdir(), 'unstoppable-p2p-bare-'))
  let node
  try {
    const identities = await Promise.all(Array.from({ length: 8 }, () => loadIdentity(storage)))
    if (new Set(identities.map(identity => identity.publicKey)).size !== 1) throw new Error('Concurrent identity creation diverged')
    const invite = await issueInvite({ storage, uses: 1 })
    if (invite.publicKey !== identities[0].publicKey) throw new Error('Invitation used a different identity')
    const daemon = new InviteStore(storage)
    const stale = new InviteStore(storage)
    await Promise.all([daemon.ready(), stale.ready()])
    await daemon.consume(invite.id)
    await stale.put({ id: 'other', uses: 1, used: 0 })
    await stale.reload()
    if (stale.get(invite.id)) throw new Error('Consumed invitation resurrected')

    node = createNode({ storage, swarm: { bootstrap: [] }, capabilities: [syncPack({ storage: path.join(storage, 'store') })] })
    await node.ready()
    const duplicate = createNode({ storage, swarm: { bootstrap: [] } })
    try {
      await duplicate.ready()
      throw new Error('Two runtimes acquired the same storage')
    } catch (error) {
      if (error.code !== 'STORAGE_LOCKED') throw error
    } finally { await duplicate.close() }
    await node.close()
    node = createNode({ storage, swarm: { bootstrap: [] } })
    await node.ready()
    await node.close()
  } finally {
    if (node) await node.close()
    await fs.rm(storage, { recursive: true, force: true })
  }
} finally { clearInterval(keepAlive) }
console.log(`P2P Bare smoke passed (${Bare.versions.bare}): identity, invites, ownership, sync attach and reopen`)
// The embedded sidecar keeps its IPC descriptor alive until explicitly stopped.
Bare.exit()
