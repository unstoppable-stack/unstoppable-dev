import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createEnvironment, until } from './helpers.js'

test('invited apps read and stream real notes; uninvited and ungranted calls fail', async () => {
  const env = await createEnvironment()
  try {
    const alice = await env.open('alice')
    const bob = await env.open('bob')
    await alice.notes.put('morning', { coffee: 'oat latte' })
    await alice.notes.put('afternoon', { coffee: 'espresso' })
    await alice.node.listen()

    await assert.rejects(() => bob.node.connect(alice.node.publicKey), { code: 'PAIR_DENIED' })
    const invite = await alice.node.createInvite({ grants: { notes: ['get', 'list'] }, uses: 1 })
    const peer = await bob.node.pair(invite.code)
    assert.notEqual(alice.node.publicKey, bob.node.publicKey)
    assert.deepEqual(await peer.call('notes', 'get', { name: 'morning' }), { coffee: 'oat latte' })
    const entries = []
    for await (const item of peer.stream('notes', 'list', {})) entries.push(item)
    assert.deepEqual(entries.map(entry => entry.name), ['afternoon', 'morning'])
    await assert.rejects(() => peer.call('sync', 'usage'), { code: 'NOT_GRANTED' })
    await assert.rejects(() => peer.call('notes', 'delete', { name: 'morning' }), { code: 'NOT_GRANTED' })
  } finally { await env.cleanup() }
})

test('replicated notes survive the source going offline and a complete replica restart', async () => {
  const env = await createEnvironment()
  try {
    let alice = await env.open('alice')
    let replica = await env.open('replica')
    await alice.notes.put('morning', { coffee: 'flat white', revision: 1 })
    const key = Buffer.from(alice.notes.core.key).toString('hex')
    const identity = replica.node.publicKey
    const invite = await replica.node.createInvite({ grants: { sync: ['manifest.replace', 'status', 'usage'] }, uses: 1 })
    const peer = await alice.node.pair(invite.code)
    await peer.call('sync', 'manifest.replace', { manifest: alice.manifest() })
    await until(async () => (await peer.call('sync', 'status')).cores[0]?.protection.state === 'protected')
    assert.deepEqual(await replica.readReplica(key, 'morning'), { coffee: 'flat white', revision: 1 })

    await alice.notes.put('morning', { coffee: 'cappuccino', revision: 2 })
    await until(async () => {
      const status = await peer.call('sync', 'status')
      return status.cores[0]?.protection.state === 'protected' && status.cores[0]?.length === alice.notes.core.length
    })
    assert.deepEqual(await replica.readReplica(key, 'morning'), { coffee: 'cappuccino', revision: 2 })

    await env.close(alice)
    await until(() => replica.node.peers.length === 0)
    await env.close(replica)
    replica = await env.open('replica')
    assert.equal(replica.node.publicKey, identity, 'identity persists across restart')
    assert.equal(replica.node.peers.length, 0, 'source remains offline')
    assert.deepEqual(await replica.readReplica(key, 'morning'), { coffee: 'cappuccino', revision: 2 })
    assert.equal(await replica.notes.get('morning'), null, 'replicas remain separate from this app’s own notes')
  } finally { await env.cleanup() }
})
