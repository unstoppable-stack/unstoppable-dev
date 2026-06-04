import { describe, it, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { NodeDaemon } from '../src/node.js'
import { createTestEnv } from './helpers.js'

describe('node config', () => {
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

  it('creates a default config file on start', async () => {
    env = await createTestEnv()
    cleanupItems = []

    const node = await env.createNode()
    cleanupItems.push(node)
    await node.start()

    const config = await node.getConfig()
    assert.equal(config.ai.enabled, false)
    assert.equal(config.pairing.requireApproval, true)
    assert.equal(config.notifications.pairRequestSound, false)

    const saved = JSON.parse(await readFile(join(node.storagePath, 'node-config.json'), 'utf8'))
    assert.deepEqual(saved, config)
  })

  it('seeds AI config from launch options only for a new store', async () => {
    env = await createTestEnv()
    cleanupItems = []

    const dir = await env.tmpDir('node-config-')
    const node = new NodeDaemon(dir, {
      swarm: { bootstrap: env.bootstrap },
      topic: env.topic,
      ai: { mock: true }
    })
    cleanupItems.push(node)
    await node.start()

    const config = await node.getConfig()
    assert.equal(config.ai.enabled, true)
    assert.equal(config.ai.mode, 'mock')
  })

  it('validates, persists, and reloads config updates', async () => {
    env = await createTestEnv()
    cleanupItems = []

    const dir = await env.tmpDir('node-config-')
    const node = new NodeDaemon(dir, { swarm: { bootstrap: env.bootstrap }, topic: env.topic })
    cleanupItems.push(node)
    await node.start()

    await assert.rejects(
      node.updateConfig({ storage: { globalQuotaBytes: -1 } }),
      /storage.globalQuotaBytes/
    )
    await assert.rejects(
      node.updateConfig({ notifications: { pairRequestSound: 'yes' } }),
      /notifications.pairRequestSound/
    )

    const updated = await node.updateConfig({
      ai: { enabled: true, mode: 'mock' },
      storage: { globalQuotaBytes: 1024 },
      pairing: { requireApproval: false },
      notifications: { pairRequestSound: true }
    })
    assert.equal(updated.ai.enabled, true)
    assert.equal(updated.storage.globalQuotaBytes, 1024)
    assert.equal(updated.pairing.requireApproval, false)
    assert.equal(updated.notifications.pairRequestSound, true)
    assert.equal(node.services.ai, true)

    await node.close()
    cleanupItems = []

    const restarted = new NodeDaemon(dir, { swarm: { bootstrap: env.bootstrap }, topic: env.topic })
    cleanupItems.push(restarted)
    await restarted.start()
    const reloaded = await restarted.getConfig()
    assert.equal(reloaded.storage.globalQuotaBytes, 1024)
    assert.equal(reloaded.pairing.requireApproval, false)
    assert.equal(reloaded.notifications.pairRequestSound, true)
  })
})
