import { it } from 'node:test'
import assert from 'node:assert/strict'
import { dataNetwork } from '../src/data-network.js'

it('retries a missed announcement without overlapping queries and stops on close', async () => {
  let attempts = 0, active = 0, maxActive = 0, destroyed = false
  const swarm = { connections: new Set(), dht: { toArray: () => attempts > 1 ? [{}] : [] }, join: () => ({
    flushed: async () => false,
    refresh: async () => {
      attempts++; active++; maxActive = Math.max(maxActive, active)
      await new Promise(resolve => setTimeout(resolve, 10))
      active--
      return attempts > 1
    },
    destroy: async () => { destroyed = true }
  }) }
  const network = dataNetwork(swarm, null, { retryMs: 5, maxRetryMs: 10 })
  try {
    await network.ready({ timeoutMs: 1000 })
    assert.equal(network.status().announced, true)
    assert.equal(maxActive, 1)
  } finally { await network.close() }
  const count = attempts
  await new Promise(resolve => setTimeout(resolve, 40))
  assert.equal(attempts, count)
  assert.equal(destroyed, true)
})
