import { describe, it, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { createSocket } from 'dgram'
import DHT from 'hyperdht'
import { createNode } from '@unstoppable-stack/p2p'
import { aiPack } from '../src/ai/index.js'

const RUN_REAL_QVAC = process.env.RUN_QVAC_E2E === '1' || process.env.npm_lifecycle_event === 'test:qvac'
const QVAC_MODEL_SRC = process.env.QVAC_MODEL_SRC
const QVAC_MODEL_TYPE = process.env.QVAC_MODEL_TYPE || 'llm'
const QVAC_TEST_TIMEOUT = Number(process.env.QVAC_TEST_TIMEOUT || 3_000_000)

function getFreePort () {
  return new Promise((resolve, reject) => {
    const server = createSocket('udp4')
    server.bind(0, '127.0.0.1', () => {
      const port = server.address().port
      server.close(() => resolve(port))
    })
    server.on('error', reject)
  })
}

describe('ai capability pack (real QVAC)', () => {
  let bootstrapNode
  let nodes = []
  let dirs = []

  afterEach(async () => {
    for (const node of nodes) {
      try { await node.close() } catch {}
    }
    if (bootstrapNode) await bootstrapNode.destroy()
    for (const dir of dirs) {
      await rm(dir, { recursive: true, force: true }).catch(() => {})
    }
    bootstrapNode = null
    nodes = []
    dirs = []
  })

  it('loads the requested model and streams non-empty output over the capability bus', {
    skip: RUN_REAL_QVAC
      ? false
      : 'set RUN_QVAC_E2E=1 and QVAC_MODEL_SRC to run real QVAC validation',
    timeout: QVAC_TEST_TIMEOUT
  }, async () => {
    assert.ok(QVAC_MODEL_SRC, 'QVAC_MODEL_SRC is required when RUN_QVAC_E2E=1')

    const port = await getFreePort()
    bootstrapNode = DHT.bootstrapper(port, '127.0.0.1')
    await bootstrapNode.ready()
    const bootstrap = [{ host: '127.0.0.1', port: bootstrapNode.address().port }]

    async function makeNode (opts = {}) {
      const storage = await mkdtemp(join(tmpdir(), 'caps-ai-real-'))
      dirs.push(storage)
      const node = createNode({ pairing: { autoApprove: true }, storage, swarm: { bootstrap }, ...opts })
      nodes.push(node)
      await node.ready()
      return node
    }

    const pack = aiPack({
      modelSrc: QVAC_MODEL_SRC,
      modelType: QVAC_MODEL_TYPE
    })
    const host = await makeNode({ capabilities: [pack] })
    await host.listen()

    assert.equal(pack.ready, true, `QVAC provider failed to start: ${pack.lastError || 'unknown error'}`)
    assert.ok(pack.modelId, 'expected QVAC to return a model id')

    const client = await makeNode()
    const peer = await client.connect(host.publicKey)
    let output = ''

    for await (const token of peer.stream('ai', 'completion.stream', {
      messages: [{ role: 'user', content: 'Reply with one short sentence about local-first software.' }]
    })) {
      output += token
      if (output.length >= 200) break
    }

    assert.ok(output.trim().length > 0, 'expected non-empty streamed QVAC output')
    for (let attempt = 0; attempt < 100 && host._activeRequests; attempt++) await new Promise(resolve => setTimeout(resolve, 50))
    assert.equal(host._activeRequests, 0)
    let received = 0
    for await (const token of peer.stream('ai', 'completion.stream', {
      messages: [{ role: 'user', content: 'Write a detailed essay about coffee cultivation.' }]
    })) {
      received += token.length
      if (received >= 40) break
    }
    assert.ok(received > 0, 'real cancellation must follow visible output')
    for (let attempt = 0; attempt < 100 && host._activeRequests; attempt++) {
      await new Promise(resolve => setTimeout(resolve, 50))
    }
    assert.equal(pack.provider._active, false, 'native request must stop when the peer cancels')
    let recovered = ''
    for await (const token of peer.stream('ai', 'completion.stream', {
      messages: [{ role: 'user', content: 'Reply with the word coffee.' }]
    })) recovered += token
    assert.ok(recovered.trim(), 'provider must complete another request after cancellation')
    const revoked = peer.stream('ai', 'completion.stream', {
      messages: [{ role: 'user', content: 'Write a detailed essay about coffee cultivation.' }]
    })[Symbol.asyncIterator]()
    assert.ok((await revoked.next()).value, 'native inference must be running before revocation')
    await host.setPeerGrants(client.publicKey, { ai: [] })
    await assert.rejects(() => revoked.next(), { code: 'NOT_GRANTED' })
    for (let attempt = 0; attempt < 100 && host._activeRequests; attempt++) await new Promise(resolve => setTimeout(resolve, 50))
    assert.equal(host._activeRequests, 0)
    assert.equal(pack.provider._active, false, 'grant removal must stop native inference')
  })
})
