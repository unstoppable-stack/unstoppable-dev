import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'

import { createTestEnv } from './helpers.js'

describe('reconnect with backoff', () => {
  let env

  before(async () => {
    env = await createTestEnv()
  })

  after(async () => {
    await env.cleanup()
  })

  it('client without reconnect just emits disconnected on Node close', async () => {
    const node = await env.createNode()
    await node.start()

    const client = await env.createConnectedClient({ appId: 'no-reconnect' })

    const disconnected = env.waitForEvent(client, 'disconnected', 5000)
    await node.close()
    await disconnected

    let sawReconnecting = false
    client.on('reconnecting', () => { sawReconnecting = true })
    await new Promise((r) => setTimeout(r, 200))
    assert.equal(sawReconnecting, false)

    await client.close()
  })

  it('client with reconnect emits reconnecting events when Node goes away', async () => {
    const node = await env.createNode()
    await node.start()

    const client = await env.createConnectedClient({
      appId: 'reconnect-app',
      reconnect: { initialDelayMs: 50, maxDelayMs: 200, factor: 2 }
    })

    const reconnecting = []
    client.on('reconnecting', (info) => reconnecting.push(info))

    await node.close()
    // Wait long enough for at least 2 backoff attempts.
    await new Promise((r) => setTimeout(r, 600))

    assert.ok(reconnecting.length >= 1, `expected reconnect attempts, got ${reconnecting.length}`)
    assert.ok(reconnecting[0].delayMs >= 50)

    await client.close()
  })

  it('reconnects through to a freshly-started Node on the same topic', async () => {
    const node = await env.createNode()
    await node.start()

    const client = await env.createConnectedClient({
      appId: 'roundtrip',
      reconnect: { initialDelayMs: 50, maxDelayMs: 500, factor: 2 }
    })

    const events = []
    client.on('reconnecting', () => events.push('reconnecting'))
    client.on('reconnected', () => events.push('reconnected'))

    // Attach the wait BEFORE close, since `node.close()` is async and the
    // `disconnected` event can fire mid-await — .once() listeners attached
    // after the fact would miss it.
    const disconnected = env.waitForEvent(client, 'disconnected', 15_000)
    await node.close()
    await disconnected

    // Stand a brand new Node on the same topic.
    const node2 = await env.createNode()
    await node2.start()

    await env.waitForEvent(client, 'reconnected', 30_000)
    assert.equal(client.paired, true)
    assert.ok(events.includes('reconnecting'))
    assert.ok(events.includes('reconnected'))

    await client.close()
    await node2.close()
  })

  it('stops reconnecting after maxAttempts and emits reconnectFailed', async () => {
    const node = await env.createNode()
    await node.start()

    const client = await env.createConnectedClient({
      appId: 'bounded',
      reconnect: { initialDelayMs: 30, maxDelayMs: 60, factor: 1.5, maxAttempts: 2 }
    })

    const failed = env.waitForEvent(client, 'reconnectFailed', 5000)
    await node.close()
    const info = await failed
    assert.equal(info.attempts, 2)

    await client.close()
  })
})
