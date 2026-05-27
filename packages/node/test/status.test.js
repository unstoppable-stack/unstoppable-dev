import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'

import { createTestEnv } from './helpers.js'

describe('node status RPC', () => {
  let env

  before(async () => {
    env = await createTestEnv()
  })

  after(async () => {
    await env.cleanup()
  })

  it('NodeDaemon.getStatus() returns a snapshot before any clients connect', async () => {
    const node = await env.createNode()
    await node.start()
    try {
      const status = await node.getStatus()
      assert.equal(status.protocolVersion, 'v1')
      assert.ok(status.services.data)
      assert.equal(status.pairedApps, 0)
      assert.deepEqual(status.apps, [])
      assert.equal(status.ai, null)
    } finally {
      await node.close()
    }
  })

  it('client.getNodeStatus() round-trips through the wire and includes paired apps', async () => {
    const node = await env.createNode()
    await node.start()

    const client = await env.createConnectedClient({ appId: 'status-app', appName: 'Status App' })

    try {
      const status = await client.getNodeStatus()
      assert.equal(status.protocolVersion, 'v1')
      assert.equal(status.pairedApps, 1)
      assert.equal(status.apps[0].appId, 'status-app')
      assert.equal(status.apps[0].appName, 'Status App')
      // Same shape is now cached locally (same content, separate object).
      assert.deepEqual(client.lastStatus, status)
      assert.equal(typeof status.connectedPeers, 'number')
    } finally {
      await client.close()
      await node.close()
    }
  })

  it('client emits a nodeStatus event for every status response', async () => {
    const node = await env.createNode()
    await node.start()

    const client = await env.createConnectedClient({ appId: 'evt-app', appName: 'Evt' })

    try {
      const seen = []
      client.on('nodeStatus', (s) => seen.push(s))

      await client.getNodeStatus()
      await client.getNodeStatus()

      assert.equal(seen.length, 2)
      assert.equal(seen[0].pairedApps, 1)
    } finally {
      await client.close()
      await node.close()
    }
  })

  it('client.getDiskUsage() returns bytes/files/path', async () => {
    const node = await env.createNode()
    await node.start()

    const client = await env.createConnectedClient({ appId: 'disk' })

    try {
      const usage = await client.getDiskUsage()
      assert.ok(usage, 'expected disk usage object')
      assert.equal(typeof usage.bytes, 'number')
      assert.equal(typeof usage.files, 'number')
      assert.ok(usage.files > 0, 'expected at least one file after corestore init')
      assert.ok(usage.bytes > 0, 'expected non-zero bytes')
      assert.ok(typeof usage.path === 'string' && usage.path.length > 0)
    } finally {
      await client.close()
      await node.close()
    }
  })

  it('status includes storage block with totals + perApp breakdown', async () => {
    const node = await env.createNode()
    await node.start()

    const client = await env.createConnectedClient({ appId: 'storage-app' })

    try {
      const status = await client.getNodeStatus()
      assert.ok(status.storage, 'status.storage should be present')
      assert.equal(typeof status.storage.total, 'number')
      assert.equal(typeof status.storage.totalCores, 'number')
      assert.equal(typeof status.storage.totalDrives, 'number')
      assert.ok(status.storage.perApp, 'storage.perApp present')
    } finally {
      await client.close()
      await node.close()
    }
  })

  it('status surfaces AI readiness when the node has a mock AI provider', async () => {
    const node = await env.createNode({ ai: { mock: true } })
    await node.start()

    const client = await env.createConnectedClient({ appId: 'ai-status', appName: 'AI Status' })

    try {
      const status = await client.getNodeStatus()
      assert.equal(status.services.ai, true)
      assert.equal(status.ai?.ready, true)
      assert.equal(status.ai?.mock, true)
    } finally {
      await client.close()
      await node.close()
    }
  })
})
