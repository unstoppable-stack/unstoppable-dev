import { describe, it, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { createServer } from 'net'
import DHT from 'hyperdht'
import { createNode } from '@unstoppable-stack/p2p'
import { aiPack } from '../src/ai/index.js'

function getFreePort () {
  return new Promise((resolve, reject) => {
    const srv = createServer()
    srv.listen(0, '127.0.0.1', () => {
      const port = srv.address().port
      srv.close(() => resolve(port))
    })
    srv.on('error', reject)
  })
}

describe('ai capability pack', () => {
  let bootstrapNode, nodes, dirs

  afterEach(async () => {
    for (const node of nodes || []) { try { await node.close() } catch {} }
    if (bootstrapNode) await bootstrapNode.destroy()
    for (const dir of dirs || []) await rm(dir, { recursive: true, force: true }).catch(() => {})
    bootstrapNode = null; nodes = null; dirs = null
  })

  async function env () {
    const port = await getFreePort()
    bootstrapNode = DHT.bootstrapper(port, '127.0.0.1')
    await bootstrapNode.ready()
    const bootstrap = [{ host: '127.0.0.1', port: bootstrapNode.address().port }]
    nodes = []; dirs = []

    async function makeNode (opts = {}) {
      const dir = await mkdtemp(join(tmpdir(), 'caps-ai-'))
      dirs.push(dir)
      const node = createNode({ pairing: { autoApprove: true }, storage: dir, swarm: { bootstrap }, ...opts })
      nodes.push(node)
      await node.ready()
      return node
    }
    return { makeNode }
  }

  it('streams tokens to a paired peer', async () => {
    const { makeNode } = await env()
    const host = await makeNode({ capabilities: [aiPack({ mock: true })] })
    await host.listen()
    const client = await makeNode({})
    const peer = await client.connect(host.publicKey)

    let out = ''
    for await (const token of peer.stream('ai', 'completion.stream', {
      messages: [{ role: 'user', content: 'hello' }]
    })) out += token

    assert.equal(out, 'Mock: hello')
  })

  it('stops generating when the consumer stops listening', async () => {
    const { makeNode } = await env()
    const host = await makeNode({ capabilities: [aiPack({ mock: true })] })
    await host.listen()
    const client = await makeNode({})
    const peer = await client.connect(host.publicKey)

    let received = 0
    for await (const _token of peer.stream('ai', 'completion.stream', {
      messages: [{ role: 'user', content: 'a long prompt that yields many tokens' }]
    })) {
      if (++received === 3) break
    }
    assert.equal(received, 3)

    // Cancellation is asynchronous: capacity is not reusable until the
    // old provider iterator has returned and native cancellation completed.
    const deadline = Date.now() + 1000
    while (host._activeRequests > 0 && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 5))
    assert.equal(host._activeRequests, 0)
    // Session survives the cancel and can serve a fresh request.
    let out = ''
    for await (const token of peer.stream('ai', 'completion.stream', {
      messages: [{ role: 'user', content: 'again' }]
    })) out += token
    assert.equal(out, 'Mock: again')
  })

  it('rejects a malformed request', async () => {
    const { makeNode } = await env()
    const host = await makeNode({ capabilities: [aiPack({ mock: true })] })
    await host.listen()
    const client = await makeNode({})
    const peer = await client.connect(host.publicKey)

    await assert.rejects(async () => {
      for await (const _t of peer.stream('ai', 'completion.stream', { messages: [] })) { /* drain */ }
    }, { code: 'REQUEST_FAILED' })
  })

  it('advertises the capability so peers can detect it', async () => {
    const { makeNode } = await env()
    const host = await makeNode({ capabilities: [aiPack({ mock: true })] })
    await host.listen()
    const client = await makeNode({})
    const peer = await client.connect(host.publicKey)

    assert.deepEqual(peer.capabilities.ai, { version: 1, methods: ['completion.stream'] })
  })

  it('keeps the node usable when the model fails to load', async () => {
    const { makeNode } = await env()
    const broken = {
      isReady: false,
      on () {},
      async start () { throw new Error('no model here') },
      async close () {},
      async * runStreaming () {}
    }
    const host = await makeNode({ capabilities: [aiPack({ provider: broken })] })
    await host.listen()
    const client = await makeNode({})

    // Pairing still works; only the AI calls fail, and they say why.
    const peer = await client.connect(host.publicKey)
    await assert.rejects(async () => {
      for await (const _t of peer.stream('ai', 'completion.stream', {
        messages: [{ role: 'user', content: 'hi' }]
      })) { /* drain */ }
    }, { message: 'no model here' })
  })
})

describe('runtime toggle', () => {
  let bootstrapNode2, nodes2, dirs2

  afterEach(async () => {
    for (const node of nodes2 || []) { try { await node.close() } catch {} }
    if (bootstrapNode2) await bootstrapNode2.destroy()
    for (const dir of dirs2 || []) await rm(dir, { recursive: true, force: true }).catch(() => {})
    bootstrapNode2 = null; nodes2 = null; dirs2 = null
  })

  async function env2 () {
    const port = await getFreePort()
    bootstrapNode2 = DHT.bootstrapper(port, '127.0.0.1')
    await bootstrapNode2.ready()
    const bootstrap = [{ host: '127.0.0.1', port: bootstrapNode2.address().port }]
    nodes2 = []; dirs2 = []
    return async function makeNode (opts = {}) {
      const dir = await mkdtemp(join(tmpdir(), 'caps-ai-'))
      dirs2.push(dir)
      const node = createNode({ pairing: { autoApprove: true }, storage: dir, swarm: { bootstrap }, ...opts })
      nodes2.push(node)
      await node.ready()
      return node
    }
  }

  it('starts disabled and can be enabled at runtime', async () => {
    const makeNode = await env2()
    const pack = aiPack({ mock: true, enabled: false })
    const host = await makeNode({ capabilities: [pack] })
    await host.listen()
    const client = await makeNode({})
    const peer = await client.connect(host.publicKey)

    assert.equal(pack.ready, false)
    await assert.rejects(async () => {
      for await (const _t of peer.stream('ai', 'completion.stream', {
        messages: [{ role: 'user', content: 'hi' }]
      })) { /* drain */ }
    }, { code: 'REQUEST_FAILED' })

    await pack.enable()
    assert.equal(pack.ready, true)

    let out = ''
    for await (const token of peer.stream('ai', 'completion.stream', {
      messages: [{ role: 'user', content: 'now' }]
    })) out += token
    assert.equal(out, 'Mock: now')
  })

  it('can be disabled without dropping the session', async () => {
    const makeNode = await env2()
    const pack = aiPack({ mock: true })
    const host = await makeNode({ capabilities: [pack] })
    await host.listen()
    const client = await makeNode({})
    const peer = await client.connect(host.publicKey)

    assert.equal(await pack.disable(), true)
    await assert.rejects(async () => {
      for await (const _t of peer.stream('ai', 'completion.stream', {
        messages: [{ role: 'user', content: 'hi' }]
      })) { /* drain */ }
    }, { message: 'AI provider is disabled' })

    // The capability is still advertised, so the peer sees a clear failure
    // rather than a capability that vanished mid-session.
    assert.ok(peer.capabilities.ai)
  })
})
