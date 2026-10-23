import { it } from 'node:test'
import assert from 'node:assert/strict'
import { createTestEnv } from './helpers.js'

it('flushes nested RPC calls when their inbound requests arrive in one mux batch', async t => {
  const env = await createTestEnv()
  t.after(() => env.cleanup())
  const host = await env.makeNode({ capabilities: [{
    name: 'notes', defaultGrants: ['offer'], methods: {
      offer: (params, ctx) => ctx.peer.call('notes', 'accept', params, { timeout: 2000 })
    }
  }] })
  const client = await env.makeNode({ capabilities: [{
    name: 'notes', defaultGrants: ['accept'], methods: { accept: params => params }
  }] })
  await host.listen()
  const paired = env.waitForEvent(host, 'paired')
  const peer = await client.connect(host.publicKey)
  await paired

  // Real Protomux batching, not a mocked message callback. A handler waiting
  // on a reverse RPC must not keep that reverse request corked in the mux.
  peer.mux.cork()
  const calls = [1, 2].map(value => peer.call('notes', 'offer', { value }, { timeout: 3000 }))
  peer.mux.uncork()
  assert.deepEqual(await Promise.all(calls), [{ value: 1 }, { value: 2 }])
})
