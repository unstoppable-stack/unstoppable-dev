import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'

import { createTestEnv } from './helpers.js'

describe('per-app pause/resume', () => {
  let env

  before(async () => {
    env = await createTestEnv()
  })

  after(async () => {
    await env.cleanup()
  })

  it('pause/resume report 0 units for unknown apps', async () => {
    const node = await env.createNode()
    await node.start()
    try {
      assert.equal(await node.pauseApp('does-not-exist'), 0)
      assert.equal(await node.resumeApp('does-not-exist'), 0)
    } finally {
      await node.close()
    }
  })

  it('flips paused flag on getStats for paired app cores + drives', async () => {
    const node = await env.createNode()
    await node.start()

    const { bee, swarm: appSwarm } = await env.createAppWithBee('pause-app')
    const { drive, swarm: appDriveSwarm } = await env.createAppWithDrive('pause-app')

    const client = await env.createConnectedClient({
      appId: 'pause-app',
      appName: 'Pause App',
      cores: [{ key: bee.core.key, type: 'hyperbee', name: 'data' }],
      drives: [{ key: drive.key, name: 'files' }]
    })

    try {
      const before = await client.getNodeStatus()
      assert.ok(before.cores.length >= 1)
      assert.ok(before.drives.length >= 1)
      for (const u of [...before.cores, ...before.drives]) assert.equal(u.paused, false)

      const paused = await node.pauseApp('pause-app')
      assert.ok(paused >= 2)

      const after = await client.getNodeStatus()
      for (const u of [...after.cores, ...after.drives]) {
        if (u.appId === 'pause-app') assert.equal(u.paused, true)
      }

      const resumed = await node.resumeApp('pause-app')
      assert.ok(resumed >= 2)

      const final = await client.getNodeStatus()
      for (const u of [...final.cores, ...final.drives]) assert.equal(u.paused, false)
    } finally {
      await client.close()
      try { await appSwarm.destroy() } catch {}
      try { await appDriveSwarm.destroy() } catch {}
      await node.close()
    }
  })

  it('emits appPaused/appResumed events with touched counts', async () => {
    const node = await env.createNode()
    await node.start()

    const { bee, swarm: appSwarm } = await env.createAppWithBee('evt')
    const client = await env.createConnectedClient({
      appId: 'evt-app',
      cores: [{ key: bee.core.key, type: 'hyperbee', name: 'data' }],
      timeout: 30_000
    })

    try {
      const events = []
      node.on('appPaused', (e) => events.push(['paused', e]))
      node.on('appResumed', (e) => events.push(['resumed', e]))

      await node.pauseApp('evt-app')
      await node.resumeApp('evt-app')

      assert.deepEqual(events.map((e) => e[0]), ['paused', 'resumed'])
      assert.ok(events[0][1].touched >= 1)
    } finally {
      await client.close()
      try { await appSwarm.destroy() } catch {}
      await node.close()
    }
  })
})
