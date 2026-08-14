import { describe, it, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { readFile, readdir, stat, writeFile } from 'fs/promises'
import { join } from 'path'
import { NodeDaemon } from '../src/node.js'
import { CONFIG_VERSION, loadConfig } from '../src/config.js'
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
    assert.equal(config.notifications.pairRequestAutoRestore, false)
    assert.equal(config.configVersion, CONFIG_VERSION)

    const configFile = join(node.storagePath, 'node-config.json')
    const saved = JSON.parse(await readFile(configFile, 'utf8'))
    assert.deepEqual(saved, config)
    assert.equal((await readdir(node.storagePath)).some((name) => name.endsWith('.tmp')), false)
    if (process.platform !== 'win32') assert.equal((await stat(configFile)).mode & 0o077, 0)
  })

  it('migrates the unversioned beta config and rejects unknown future versions', async () => {
    env = await createTestEnv()
    cleanupItems = []
    const dir = await env.tmpDir('node-config-migration-')
    const file = join(dir, 'node-config.json')

    await writeFile(file, JSON.stringify({
      ai: { enabled: false, mode: 'mock', modelSrc: '' },
      storage: { globalQuotaBytes: 2048, perAppQuotaBytes: null },
      pairing: { requireApproval: true, autoApproveLocal: false },
      notifications: { pairRequests: true, pairRequestSound: false, pairRequestAutoRestore: false },
      ui: { showWelcome: false }
    }))

    const migrated = await loadConfig(dir)
    assert.equal(migrated.configVersion, CONFIG_VERSION)
    assert.equal(migrated.storage.globalQuotaBytes, 2048)
    assert.equal(migrated.ui.showWelcome, false)

    await writeFile(file, JSON.stringify({ configVersion: CONFIG_VERSION + 1 }))
    await assert.rejects(loadConfig(dir), /newer than this app supports/)
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
    await assert.rejects(
      node.updateConfig({ notifications: { pairRequestAutoRestore: 'yes' } }),
      /notifications.pairRequestAutoRestore/
    )

    const updated = await node.updateConfig({
      ai: { enabled: true, mode: 'mock' },
      storage: { globalQuotaBytes: 1024 },
      pairing: { requireApproval: false },
      notifications: { pairRequestSound: true, pairRequestAutoRestore: true }
    })
    assert.equal(updated.ai.enabled, true)
    assert.equal(updated.storage.globalQuotaBytes, 1024)
    assert.equal(updated.pairing.requireApproval, false)
    assert.equal(updated.notifications.pairRequestSound, true)
    assert.equal(updated.notifications.pairRequestAutoRestore, true)
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
    assert.equal(reloaded.notifications.pairRequestAutoRestore, true)
  })

  it('rejects unknown config keys and oversized model sources', async () => {
    env = await createTestEnv()
    cleanupItems = []
    const node = await env.createNode()
    cleanupItems.push(node)
    await node.start()

    await assert.rejects(node.updateConfig({ pairing: { unexpected: true } }), /Unknown node config option/)
    await assert.rejects(node.updateConfig({ unexpected: true }), /Unknown node config option/)
    await assert.rejects(node.updateConfig({ ai: { modelSrc: 'x'.repeat(4097) } }), /at most 4096/)
  })
})
