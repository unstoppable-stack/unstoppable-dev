import { describe, it, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { createTestEnv } from './helpers.js'

const RUN_REAL_QVAC = process.env.RUN_QVAC_E2E === '1'
const QVAC_MODEL_SRC = process.env.QVAC_MODEL_SRC
const QVAC_MODEL_TYPE = process.env.QVAC_MODEL_TYPE || 'llm'
const QVAC_TEST_TIMEOUT = Number(process.env.QVAC_TEST_TIMEOUT || 300_000)

describe('ai-provider (real QVAC)', () => {
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

  it('loads a real QVAC model and streams inference end-to-end', {
    skip: RUN_REAL_QVAC ? false : 'set RUN_QVAC_E2E=1 and QVAC_MODEL_SRC to run real QVAC validation',
    timeout: QVAC_TEST_TIMEOUT
  }, async () => {
    assert.ok(QVAC_MODEL_SRC, 'QVAC_MODEL_SRC is required when RUN_QVAC_E2E=1')

    env = await createTestEnv()
    cleanupItems = []

    const node = await env.createNode({
      ai: {
        modelSrc: QVAC_MODEL_SRC,
        modelType: QVAC_MODEL_TYPE
      }
    })
    cleanupItems.push(node)
    await node.start()

    assert.equal(node.services.ai, true)
    assert.equal(node.capabilities.ai.enabled, true)

    const client = await env.createConnectedClient({
      appId: 'real-qvac-app',
      appName: 'Real QVAC App',
      requireServices: ['ai']
    })
    cleanupItems.push(client)

    const tokens = []
    for await (const token of client.requestInference({
      messages: [{ role: 'user', content: 'Reply with exactly: unstoppable' }]
    })) {
      tokens.push(token)
      if (tokens.join('').length > 200) break
    }

    assert.ok(tokens.length > 0, 'expected at least one streamed QVAC token')
    assert.ok(tokens.join('').trim().length > 0, 'expected non-empty QVAC output')
  })
})
