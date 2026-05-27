import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'

import { createTestEnv } from './helpers.js'

describe('peek core / drive', () => {
  let env

  before(async () => {
    env = await createTestEnv()
  })

  after(async () => {
    await env.cleanup()
  })

  it('peekCore over the wire returns last N blocks + total length', async () => {
    const node = await env.createNode()
    await node.start()

    const { bee, swarm: appSwarm } = await env.createAppWithBee('peek-bee')
    await bee.put('a', { n: 1 })
    await bee.put('b', { n: 2 })
    await bee.put('c', { n: 3 })

    const client = await env.createConnectedClient({
      appId: 'peek-bee',
      cores: [{ key: bee.core.key, type: 'hyperbee', name: 'data' }],
      timeout: 30_000
    })

    try {
      const keyHex = bee.core.key.toString('hex')
      // Replication is async — poll until the node sees the blocks.
      let peek = null
      const deadline = Date.now() + 15_000
      while (Date.now() < deadline) {
        peek = await client.peekCore(keyHex, { limit: 5 })
        if (peek && peek.length >= 3) break
        await new Promise((r) => setTimeout(r, 100))
      }
      assert.ok(peek, 'expected peek result')
      assert.equal(peek.key, keyHex)
      assert.ok(peek.length >= 3, `expected at least 3 blocks, got ${peek?.length}`)
      assert.ok(peek.blocks.length > 0, 'expected blocks array to be populated')
    } finally {
      await client.close()
      try { await appSwarm.destroy() } catch {}
      await node.close()
    }
  })

  it('peekCore returns null for an unknown key', async () => {
    const node = await env.createNode()
    await node.start()
    const client = await env.createConnectedClient({ appId: 'peek-unknown' })

    try {
      const peek = await client.peekCore('00'.repeat(32))
      assert.equal(peek, null)
    } finally {
      await client.close()
      await node.close()
    }
  })

  it('peekDrive returns a directory listing with file sizes', async () => {
    const node = await env.createNode()
    await node.start()

    const { drive, swarm: appSwarm } = await env.createAppWithDrive('peek-drive')
    await drive.put('/hello.txt', Buffer.from('hi from peek-drive'))
    await drive.put('/sub/file.json', Buffer.from('{"ok":true}'))

    const client = await env.createConnectedClient({
      appId: 'peek-drive',
      drives: [{ key: drive.key, name: 'files' }],
      timeout: 30_000
    })

    try {
      const keyHex = drive.key.toString('hex')
      let peek = null
      const deadline = Date.now() + 15_000
      while (Date.now() < deadline) {
        peek = await client.peekDrive(keyHex)
        if (peek && peek.entries.length >= 1) break
        await new Promise((r) => setTimeout(r, 100))
      }
      assert.ok(peek, 'expected drive peek result')
      assert.ok(peek.entries.length >= 1, `expected at least 1 entry, got ${peek?.entries?.length}`)
      const hello = peek.entries.find((e) => e.key === '/hello.txt')
      assert.ok(hello, 'expected /hello.txt in listing')
      assert.equal(hello.type, 'file')
      assert.ok(hello.size > 0)
    } finally {
      await client.close()
      try { await appSwarm.destroy() } catch {}
      await node.close()
    }
  })
})
