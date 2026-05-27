import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'

import { createTestEnv } from './helpers.js'

describe('live AI toggle', () => {
  let env

  before(async () => {
    env = await createTestEnv()
  })

  after(async () => {
    await env.cleanup()
  })

  it('node starts without AI and can enable it later', async () => {
    const node = await env.createNode()
    await node.start()
    try {
      assert.equal(node.services.ai, false)

      const changes = []
      node.on('servicesChanged', (e) => changes.push(e.services))

      await node.enableAI({ mock: true })

      assert.equal(node.services.ai, true)
      assert.equal(node.ai?.modelId, 'mock-model')
      assert.ok(changes.length >= 1)
      assert.equal(changes.at(-1).ai, true)
    } finally {
      await node.close()
    }
  })

  it('disableAI tears down the provider and updates services', async () => {
    const node = await env.createNode({ ai: { mock: true } })
    await node.start()
    try {
      assert.equal(node.services.ai, true)

      const changes = []
      node.on('servicesChanged', (e) => changes.push(e.services))

      await node.disableAI()

      assert.equal(node.services.ai, false)
      assert.equal(node.ai, null)
      assert.equal(changes.at(-1).ai, false)
    } finally {
      await node.close()
    }
  })

  it('re-enabling after disable is allowed and works end-to-end', async () => {
    const node = await env.createNode()
    await node.start()
    try {
      await node.enableAI({ mock: true })
      await node.disableAI()
      await node.enableAI({ mock: true })
      assert.equal(node.services.ai, true)
    } finally {
      await node.close()
    }
  })

  it('clients see services.ai flip in subsequent getNodeStatus calls', async () => {
    const node = await env.createNode()
    await node.start()
    const client = await env.createConnectedClient({ appId: 'toggle' })

    try {
      const before = await client.getNodeStatus()
      assert.equal(before.services.ai, false)

      await node.enableAI({ mock: true })

      const after = await client.getNodeStatus()
      assert.equal(after.services.ai, true)
      assert.equal(after.ai?.ready, true)
    } finally {
      await client.close()
      await node.close()
    }
  })
})
