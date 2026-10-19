import { it } from 'node:test'
import assert from 'node:assert/strict'
import { defineCapability, procedure } from '../src/rpc.js'
import { serve, connect } from '../src/service.js'
import { createNode } from '../src/index.js'
import { createTestEnv } from './helpers.js'

const notes = defineCapability({ name: 'notes', version: 1, methods: {
  get: procedure.input(value => {
    if (typeof value?.id !== 'string') throw new Error('id')
    return value
  }).query(({ input }) => ({ id: input.id, text: 'hello' })),
  list: procedure.stream(async function* () { yield 'one'; yield 'two' }),
  private: procedure.query(() => 'private')
} })

it('serves, invites and connects with typed calls, streams and explicit grants', async t => {
  const env = await createTestEnv()
  t.after(() => env.cleanup())
  const nodeOptions = { swarm: { bootstrap: env.bootstrap } }
  const service = await serve({ storage: await env.tmpDir(), capability: notes, nodeOptions })
  t.after(() => service.close())
  await assert.rejects(() => service.invite([]), { code: 'INVALID_OPTION' })
  await assert.rejects(() => service.invite(['typo']), { code: 'INVALID_OPTION' })
  const invite = await service.invite(['get', 'list'])
  const storage = await env.tmpDir()
  const connection = await connect({ storage, invite, contract: notes.contract, nodeOptions })
  t.after(() => connection.close())
  assert.deepEqual(await connection.api.get({ id: 'n1' }), { id: 'n1', text: 'hello' })
  const chunks = []
  for await (const item of connection.api.list()) chunks.push(item)
  assert.deepEqual(chunks, ['one', 'two'])
  await assert.rejects(() => connection.api.get({ id: 42 }), { code: 'INVALID_INPUT' })
  await assert.rejects(() => connection.api.private(), { code: 'NOT_GRANTED' })
  const publicKey = connection.peer.publicKey
  await connection.close()
  await connection.close()
  const again = await connect({ storage, publicKey, contract: notes, nodeOptions })
  t.after(() => again.close())
  assert.equal((await again.api.get({ id: 'n2' })).id, 'n2')
  await assert.rejects(() => again.api.private(), { code: 'NOT_GRANTED' })
  await service.node.setPeerGrants(again.node.publicKey, { notes: ['list'] })
  await again.close()
  const restricted = await connect({ storage, publicKey, contract: notes, nodeOptions })
  t.after(() => restricted.close())
  await assert.rejects(() => restricted.api.get({ id: 'n2' }), { code: 'NOT_GRANTED' })
  await service.close()
  await env.until(() => restricted.peer.closed)
  await assert.rejects(() => restricted.api.get({ id: 'n3' }), { code: 'CLOSED' })
})

it('releases storage after binding failure, invalid invite and cancellation', async t => {
  const env = await createTestEnv()
  t.after(() => env.cleanup())
  const nodeOptions = { swarm: { bootstrap: env.bootstrap } }
  const service = await serve({ storage: await env.tmpDir(), capability: notes, nodeOptions })
  t.after(() => service.close())
  const storage = await env.tmpDir()
  const wrong = defineCapability({ name: 'notes', version: 2, methods: { get: procedure.query(() => null) } })
  await assert.rejects(() => connect({ storage, invite: 'invalid', contract: notes, nodeOptions }), { code: 'INVALID_OPTION' })
  await assert.rejects(() => connect({ storage, invite: service.invite, contract: notes, nodeOptions }), { code: 'INVALID_OPTION' })
  await assert.rejects(() => connect({ storage, invite: null, contract: notes, nodeOptions }), { code: 'INVALID_OPTION' })
  await assert.rejects(() => connect({ storage, invite: 'x', contract: notes, timeout: -1 }), { code: 'INVALID_OPTION' })
  const invite = await service.invite(['get'])
  await assert.rejects(() => connect({ storage, invite, contract: wrong, nodeOptions }), { code: 'INCOMPATIBLE_CAPABILITY' })
  // The failed binding still paired persistently; reconnect with the right contract.
  const connection = await connect({ storage, publicKey: service.node.publicKey, contract: notes, nodeOptions })
  assert.equal((await connection.api.get({ id: 'recovered' })).id, 'recovered')
  await connection.close()
  await assert.rejects(() => connect({ storage, publicKey: 'b'.repeat(64), contract: notes, timeout: 10, nodeOptions }), { code: 'PEER_NOT_FOUND' })
  const controller = new AbortController()
  const pending = connect({ storage, publicKey: 'a'.repeat(64), contract: notes, signal: controller.signal, nodeOptions })
  setTimeout(() => controller.abort(), 20)
  await assert.rejects(() => pending, { code: 'CANCELLED' })
  const reopened = createNode({ storage, ...nodeOptions })
  await reopened.ready()
  await reopened.close()
})

it('cleans up a failed service start and does not bypass direct-pair approval', async t => {
  const env = await createTestEnv()
  t.after(() => env.cleanup())
  const nodeOptions = { swarm: { bootstrap: env.bootstrap } }
  const storage = await env.tmpDir()
  const broken = defineCapability({ name: 'broken', version: 1, methods: { ping: procedure.query(() => 'ok') },
    onAttach () { throw new Error('attach failed') }
  })
  await assert.rejects(() => serve({ storage, capability: broken, nodeOptions }), /attach failed/)
  const service = await serve({ storage, capability: notes, nodeOptions })
  t.after(() => service.close())
  const clientStorage = await env.tmpDir()
  await assert.rejects(() => connect({ storage: clientStorage, publicKey: service.node.publicKey, contract: notes, nodeOptions }), { code: 'PAIR_DENIED' })
})
