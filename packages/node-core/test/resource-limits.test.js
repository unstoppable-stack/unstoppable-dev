import { it, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { createTestEnv, echoPack } from './helpers.js'
import { Peer, AsyncQueue } from '../src/peer.js'
import { MESSAGE } from '../src/protocol.js'
import { boundedJson } from '../src/limits.js'
import c from 'compact-encoding'

let env
afterEach(async () => { if (env) await env.cleanup(); env = null })

it('retains narrowed grants after host restart and blocks revoked keys, including new invites', async () => {
  env = await createTestEnv()
  const storage = await env.tmpDir()
  let host = await env.makeNode({ storage, capabilities: [echoPack()], pairing: { approve: async () => 'deny' } })
  await host.listen()
  const client = await env.makeNode()
  const invite = await host.createInvite({ grants: { echo: ['ping', 'count'] } })
  const peer = await client.pair(invite.code)
  await host.setPeerGrants(client.publicKey, { echo: ['ping'] })
  const key = host.publicKey
  await host.close()
  await env.until(() => peer.closed)
  host = await env.makeNode({ storage, capabilities: [echoPack()], pairing: { approve: async () => 'deny' } })
  await host.listen()
  const fresh = await client.connect(key)
  assert.deepEqual(await fresh.call('echo', 'ping', { value: 'restarted' }), { pong: 'restarted' })
  await assert.rejects(() => fresh.call('echo', 'count'), { code: 'NOT_GRANTED' })
  await host.unpair(client.publicKey)
  await env.until(() => fresh.closed)
  await host.close()
  host = await env.makeNode({ storage, capabilities: [echoPack()] })
  await host.listen()
  await assert.rejects(() => client.connect(key), { code: 'PAIR_DENIED' })
  const second = await host.createInvite({ grants: { echo: ['count'] } })
  await assert.rejects(() => client.pair(second.code), { code: 'PAIR_DENIED' })
})

it('bounds simultaneous requests, cancels timed-out work, and admits subsequent calls', async () => {
  env = await createTestEnv()
  const pack = echoPack()
  let aborted = 0
  pack.methods.slow = async (_params, ctx) => new Promise(resolve => {
    ctx.signal.addEventListener('abort', () => { aborted++; resolve(null) }, { once: true })
  })
  const host = await env.makeNode({ capabilities: [pack], limits: { maxRequestsPerPeer: 1, maxRequests: 1, requestTimeoutMs: 150 } })
  await host.listen()
  const client = await env.makeNode()
  const other = await env.makeNode()
  const peer = await client.connect(host.publicKey)
  const peer2 = await other.connect(host.publicKey)
  const timeout = assert.rejects(() => peer.call('echo', 'slow'), { code: 'REQUEST_TIMEOUT' })
  await env.until(() => host._activeRequests === 1, { interval: 1 })
  await assert.rejects(() => peer2.call('echo', 'ping'), { code: 'RESOURCE_LIMIT' })
  await timeout
  await env.until(() => host._activeRequests === 0)
  assert.equal(aborted, 1)
  assert.deepEqual(await peer.call('echo', 'ping', { value: 'again' }), { pong: 'again' })
})

it('cancels an active stream when its grant is removed', async () => {
  env = await createTestEnv()
  const host = await env.makeNode({ capabilities: [echoPack()] })
  await host.listen()
  const client = await env.makeNode()
  const peer = await client.connect(host.publicKey)
  const iterator = peer.stream('echo', 'forever')[Symbol.asyncIterator]()
  await iterator.next()
  await host.setPeerGrants(client.publicKey, { echo: ['ping'] })
  await assert.rejects(() => iterator.next(), { code: 'NOT_GRANTED' })
  await env.until(() => host._activeRequests === 0)
})

it('cancels slow consumers instead of buffering indefinitely', async () => {
  env = await createTestEnv()
  const pack = echoPack()
  pack.methods.count = async function * () { for (let i = 0; i < 100; i++) yield 'abcdefgh' }
  const host = await env.makeNode({ capabilities: [pack], limits: { maxStreamBytes: 20000 } })
  await host.listen()
  const client = await env.makeNode({ limits: { maxBufferedChunks: 2 } })
  const peer = await client.connect(host.publicKey)
  const iterator = peer.stream('echo', 'count')[Symbol.asyncIterator]()
  await iterator.next()
  await new Promise(resolve => setTimeout(resolve, 50))
  await assert.rejects(() => iterator.next(), { code: 'RESOURCE_LIMIT' })
  await env.until(() => host._activeRequests === 0)
})

it('rejects oversized control frames before parsing and outbound allocation', () => {
  const encoding = boundedJson(1024)
  const frame = { content: 'x'.repeat(4096) }
  assert.throws(() => c.encode(encoding, frame), { code: 'RESOURCE_LIMIT' })
  assert.throws(() => c.decode(encoding, c.encode(c.json, frame)), { code: 'RESOURCE_LIMIT' })
})

it('clears buffered data on failure and counts UTF-8 bytes', async () => {
  const queue = new AsyncQueue({ maxBufferedChunks: 10, maxBufferedBytes: 8 })
  assert.equal(queue.push('💻'), true)
  assert.equal(queue.push('💻'), false)
  assert.equal(queue.values.length, 0)
  await assert.rejects(() => queue[Symbol.asyncIterator]().next(), { code: 'RESOURCE_LIMIT' })
})

it('ignores unsolicited pairing responses that could bypass host approval', async () => {
  env = await createTestEnv()
  const host = await env.makeNode({ capabilities: [echoPack()], pairing: { approve: async () => 'deny' } })
  const peer = new Peer({ node: host, remotePublicKey: 'a'.repeat(64) })
  peer.attachMessage({ send () { return true } })
  await host._onPeerMessage(peer, { type: MESSAGE.PAIR_ACCEPTED, grants: {}, requested: null })
  await host._onPeerMessage(peer, { type: MESSAGE.PAIR_CONFIRM, grants: {} })
  assert.equal(peer.paired, false)
  assert.equal(host.peerRegistry.has(peer.remotePublicKey), false)
})

it('default core hosts refuse unknown peers without an invitation or explicit approval', async () => {
  env = await createTestEnv()
  const host = await env.makeNode({ capabilities: [echoPack()], pairing: {} })
  await host.listen()
  const client = await env.makeNode()
  await assert.rejects(() => client.connect(host.publicKey), { code: 'PAIR_DENIED' })
  const invite = await host.createInvite()
  // A default invitation does not grant non-default methods asked by a peer.
  const peer = await client.pair(invite.code, { requested: { echo: ['boom'] } })
  await assert.rejects(() => peer.call('echo', 'boom'), { code: 'NOT_GRANTED' })
})

it('checks total stream output independently of the consumer buffer', async () => {
  env = await createTestEnv()
  const pack = echoPack()
  pack.methods.count = async function * () {
    for (let i = 0; i < 10; i++) { yield 'abcdefgh'; await new Promise(resolve => setTimeout(resolve, 5)) }
  }
  const host = await env.makeNode({ capabilities: [pack], limits: { maxStreamBytes: 32 } })
  await host.listen()
  const client = await env.makeNode()
  const peer = await client.connect(host.publicKey)
  await assert.rejects(async () => { for await (const token of peer.stream('echo', 'count')) assert.equal(token, 'abcdefgh') }, { code: 'RESOURCE_LIMIT' })
})
