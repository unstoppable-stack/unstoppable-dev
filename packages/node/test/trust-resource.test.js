import { it, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { createTestEnv, manifestFor } from './helpers.js'
let env
afterEach(async () => { if (env) await env.cleanup(); env = null })

it('headless defaults refuse public-key pairing but accept scoped invitations', async () => {
  env = await createTestEnv()
  const node = await env.makeNode({ topic: null, approvePairing: undefined, ai: { mock: true } })
  await node.start()
  const client = await env.makeClient()
  await assert.rejects(() => client.connect(node.publicKey), { code: 'PAIR_DENIED' })
  const invite = await node.createInvite({ grants: { sync: ['status'] } })
  const peer = await client.pair(invite.code)
  assert.deepEqual(await peer.call('sync', 'status'), { cores: [], drives: [] })
  await assert.rejects(() => peer.call('ai', 'completion.stream', { messages: [{ role: 'user', content: 'hello' }] }), { code: 'NOT_GRANTED' })
})

it('enforces quotas without a status poll and refuses peer attempts to resume or register more resources', async () => {
  env = await createTestEnv()
  const node = await env.makeNode({ topic: null })
  await node.start()
  await node.updateConfig({ storage: { perPeerQuotaBytes: 1 } })
  const app = await env.makeApp()
  for (let i = 0; i < 20; i++) await app.bee.put('key'+i, { text: 'x'.repeat(200) })
  const client = await env.makeClient()
  const peer = await client.connect(node.publicKey)
  const exceeded = env.waitForEvent(node, 'quotaExceeded')
  await peer.call('sync', 'manifest.replace', { manifest: manifestFor(app.bee) })
  await exceeded
  assert.equal(node._sync.engine.getStats()[0].paused, true)
  await assert.rejects(() => peer.call('sync', 'resume'), { code: 'RESOURCE_LIMIT' })
  await assert.rejects(() => peer.call('sync', 'manifest.replace', { manifest: manifestFor(app.bee) }), { code: 'RESOURCE_LIMIT' })
})
