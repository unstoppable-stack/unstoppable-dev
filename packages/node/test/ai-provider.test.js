import { describe, it, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { AIProvider } from '../src/ai-provider.js'
import { createTestEnv } from './helpers.js'

describe('ai-provider (mock mode)', () => {
  let env, cleanupItems

  afterEach(async () => {
    for (const item of cleanupItems || []) {
      try {
        if (item.close) await item.close()
        if (item.destroy) await item.destroy()
      } catch {}
    }
    if (env) await env.cleanup()
  })

  it('AIProvider in mock mode streams echo tokens', async () => {
    const provider = new AIProvider({ mock: true })
    await provider.start()
    assert.equal(provider.isReady, true)
    assert.equal(provider.modelId, 'mock-model')

    const tokens = []
    for await (const tok of provider.runStreaming({
      messages: [{ role: 'user', content: 'hello' }]
    })) {
      tokens.push(tok)
    }
    const reply = tokens.join('')
    assert.match(reply, /^Mock: hello$/)

    await provider.close()
    assert.equal(provider.isReady, false)
  })

  it('rejects inference before start()', async () => {
    const provider = new AIProvider({ mock: true })
    await assert.rejects(async () => {
      // eslint-disable-next-line no-unused-vars
      for await (const _tok of provider.runStreaming({
        messages: [{ role: 'user', content: 'hi' }]
      })) { /* empty */ }
    }, /not ready/)
  })

  it('node with --ai-mock advertises services.ai = true', async () => {
    env = await createTestEnv()
    cleanupItems = []

    const node = await env.createNode({ ai: { mock: true } })
    cleanupItems.push(node)
    await node.start()
    assert.equal(node.services.ai, true)
  })

  it('paired client without AI required still pairs when AI is off', async () => {
    env = await createTestEnv()
    cleanupItems = []

    const node = await env.createNode()
    cleanupItems.push(node)
    await node.start()
    assert.equal(node.services.ai, false)

    const client = await env.createConnectedClient({ appId: 'app', appName: 'app' })
    cleanupItems.push(client)
    assert.equal(client.services.ai, false)
  })

  it('requireServices: ["ai"] rejects when node has no provider', async () => {
    env = await createTestEnv()
    cleanupItems = []

    const node = await env.createNode()
    cleanupItems.push(node)
    await node.start()

    await assert.rejects(
      env.createConnectedClient({
        appId: 'picky',
        appName: 'Picky',
        requireServices: ['ai']
      }),
      /required service/
    )
  })

  it('requireServices: ["ai"] accepts when node has mock provider', async () => {
    env = await createTestEnv()
    cleanupItems = []

    const node = await env.createNode({ ai: { mock: true } })
    cleanupItems.push(node)
    await node.start()

    const client = await env.createConnectedClient({
      appId: 'ai-app',
      appName: 'AI App',
      requireServices: ['ai']
    })
    cleanupItems.push(client)

    assert.equal(client.services.ai, true)
  })

  it('requestInference streams tokens end-to-end over the wire', async () => {
    env = await createTestEnv()
    cleanupItems = []

    const node = await env.createNode({ ai: { mock: true } })
    cleanupItems.push(node)
    await node.start()

    const client = await env.createConnectedClient({
      appId: 'chat-app',
      appName: 'Chat App',
      requireServices: ['ai']
    })
    cleanupItems.push(client)

    const tokens = []
    for await (const tok of client.requestInference({
      messages: [{ role: 'user', content: 'hi node' }]
    })) {
      tokens.push(tok)
    }
    const text = tokens.join('')
    assert.match(text, /^Mock: hi node$/)
  })

  it('requestInference rejects if AI service unavailable', async () => {
    env = await createTestEnv()
    cleanupItems = []

    const node = await env.createNode() // no AI
    cleanupItems.push(node)
    await node.start()

    const client = await env.createConnectedClient({ appId: 'app', appName: 'app' })
    cleanupItems.push(client)

    await assert.rejects(async () => {
      // eslint-disable-next-line no-unused-vars
      for await (const _tok of client.requestInference({
        messages: [{ role: 'user', content: 'hello' }]
      })) { /* empty */ }
    }, /does not advertise AI/)
  })

  it('node serves multiple inference requests in parallel', async () => {
    env = await createTestEnv()
    cleanupItems = []

    const node = await env.createNode({ ai: { mock: true } })
    cleanupItems.push(node)
    await node.start()

    const client = await env.createConnectedClient({
      appId: 'multi',
      appName: 'Multi',
      requireServices: ['ai']
    })
    cleanupItems.push(client)

    async function collect (prompt) {
      const out = []
      for await (const t of client.requestInference({
        messages: [{ role: 'user', content: prompt }]
      })) {
        out.push(t)
      }
      return out.join('')
    }

    const [a, b] = await Promise.all([collect('one'), collect('two')])
    assert.match(a, /^Mock: one$/)
    assert.match(b, /^Mock: two$/)
  })
})
