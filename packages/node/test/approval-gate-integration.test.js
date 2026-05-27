// Integration: prove the dashboard's ApprovalGate composes cleanly
// with NodeDaemon's `approvePairing` callback. Models exactly what
// `packages/node-desktop/worker.js` wires up at runtime, minus the
// Pear pipe.
//
// Lives here (and not in node-desktop/test/) because this package
// owns the network harness (hyperdht, hyperswarm bootstraps).
//
// Layered coverage:
//   - registry.test.js (in node-desktop): persistence
//   - approval.test.js (in node-desktop): TOFU + pending Map
//   - pairing.test.js (here): NodeDaemon's approvePairing callback
//   - this file: the composition.

import { describe, it, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { createTestEnv } from './helpers.js'
import { NodeDaemon } from '../src/node.js'
import { connectToNode } from '../../node-client/src/index.js'
import { ApprovalGate } from '../../node-desktop/lib/approval.js'
import { loadRegistry } from '../../node-desktop/lib/registry.js'

describe('integration — NodeDaemon + ApprovalGate', () => {
  let env, cleanups, regDirs

  afterEach(async () => {
    for (const c of (cleanups || [])) {
      try { await c() } catch {}
    }
    if (env) await env.cleanup()
    for (const d of (regDirs || [])) {
      await rm(d, { recursive: true, force: true }).catch(() => {})
    }
  })

  it('"user clicks approve" flow: gate prompts, decision flows through, client pairs, persisted', async () => {
    env = await createTestEnv()
    cleanups = []
    regDirs = []

    const regDir = await mkdtemp(join(tmpdir(), 'gate-reg-'))
    regDirs.push(regDir)
    const registryPath = join(regDir, 'trust.json')

    const gate = new ApprovalGate({ registryPath })
    await gate.ready()

    const node = await env.createNode({ approvePairing: (req) => gate.request(req) })
    cleanups.push(() => node.close())
    await node.start()

    // The "user" clicks Approve & Remember as soon as the modal pops.
    const seen = []
    gate.on('pending', async (info) => {
      seen.push(info)
      await gate.approve(info.publicKey, { remember: true })
    })

    const c1 = await env.createConnectedClient({ appId: 'integ-app', appName: 'Integ' })
    cleanups.push(() => c1.close())

    assert.equal(seen.length, 1, 'gate should have prompted exactly once')
    assert.ok(c1.paired)
    assert.ok(c1.registered)

    const onDisk = await loadRegistry(registryPath)
    assert.equal(Object.keys(onDisk.approved).length, 1)
    const approvedKey = Object.keys(onDisk.approved)[0]
    assert.equal(onDisk.approved[approvedKey].appId, 'integ-app')
  })

  it('"user clicks deny" flow: client is rejected with /denied/', async () => {
    env = await createTestEnv()
    cleanups = []
    regDirs = []

    const regDir = await mkdtemp(join(tmpdir(), 'gate-reg-'))
    regDirs.push(regDir)
    const registryPath = join(regDir, 'trust.json')

    const gate = new ApprovalGate({ registryPath })
    await gate.ready()

    const node = await env.createNode({ approvePairing: (req) => gate.request(req) })
    cleanups.push(() => node.close())
    await node.start()

    let promptCount = 0
    gate.on('pending', async (info) => {
      promptCount++
      await gate.deny(info.publicKey, { remember: true, reason: 'sketchy' })
    })

    await assert.rejects(
      env.createConnectedClient({ appId: 'shady', appName: 'Shady', timeout: 4000 }),
      /denied/i
    )

    assert.equal(promptCount, 1)
    const onDisk = await loadRegistry(registryPath)
    assert.equal(Object.keys(onDisk.denied).length, 1)
    assert.equal(Object.values(onDisk.denied)[0].reason, 'sketchy')
  })

  it('persistence survives a fresh ApprovalGate (TOFU across restart)', async () => {
    env = await createTestEnv()
    cleanups = []
    regDirs = []

    const regDir = await mkdtemp(join(tmpdir(), 'gate-reg-'))
    regDirs.push(regDir)
    const registryPath = join(regDir, 'trust.json')

    // Round 1: gate1 sees a key for the first time and denies it.
    const gate1 = new ApprovalGate({ registryPath })
    await gate1.ready()
    const node = await env.createNode({ approvePairing: (req) => gate1.request(req) })
    cleanups.push(() => node.close())
    await node.start()

    let capturedKey = null
    gate1.on('pending', async (info) => {
      capturedKey = info.publicKey
      await gate1.deny(info.publicKey, { remember: true })
    })

    await assert.rejects(
      env.createConnectedClient({ appId: 'banned', appName: 'Banned', timeout: 4000 }),
      /denied/i
    )
    assert.ok(capturedKey, 'expected to capture the rejected key')

    // Round 2: a brand new gate (simulating a daemon restart) should
    // honor the persisted denial without prompting.
    const gate2 = new ApprovalGate({ registryPath })
    await gate2.ready()

    let gate2Pending = 0
    gate2.on('pending', () => { gate2Pending++ })

    const decision = await gate2.request({
      appId: 'banned',
      appName: 'Banned',
      publicKey: capturedKey,
      remoteKey: 'rr'
    })

    assert.equal(decision, 'deny')
    assert.equal(gate2Pending, 0, 'restart must not re-prompt for a previously denied key')
  })
})
