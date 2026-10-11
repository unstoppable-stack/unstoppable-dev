import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { ApprovalGate } from '../lib/approval.js'
import { loadRegistry } from '../lib/registry.js'

describe('lib/approval — ApprovalGate', () => {
  let dir
  let path

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'gate-test-'))
    path = join(dir, 'trust.json')
  })

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  it('first request is pending; approve resolves it as approve-remember', async () => {
    const gate = new ApprovalGate({ registryPath: path })
    await gate.ready()

    const pendings = []
    gate.on('pending', (p) => pendings.push(p))

    const decision = gate.request({
      appId: 'first-app',
      appName: 'First',
      publicKey: 'aa11',
      remoteKey: 'rr01'
    })

    // Yield to the microtask queue so the gate can emit + register pending.
    await Promise.resolve()
    assert.equal(pendings.length, 1)
    assert.equal(pendings[0].appId, 'first-app')

    await gate.approve('aa11')
    assert.equal(await decision, 'approve-remember')

    // Persisted to disk.
    const reg = await loadRegistry(path)
    assert.ok(reg.approved.aa11)
    assert.equal(reg.approved.aa11.appId, 'first-app')
  })

  it('approve once does not persist', async () => {
    const gate = new ApprovalGate({ registryPath: path })
    await gate.ready()

    const decision = gate.request({ appId: 'a', appName: 'A', publicKey: 'aa', remoteKey: 'rr' })
    await Promise.resolve()
    await gate.approve('aa', { remember: false })

    assert.equal(await decision, 'approve')

    const reg = await loadRegistry(path)
    assert.equal(reg.approved.aa, undefined)
  })

  it('deny resolves to "deny" and remembers', async () => {
    const gate = new ApprovalGate({ registryPath: path })
    await gate.ready()

    const decision = gate.request({ appId: 'b', appName: 'B', publicKey: 'bb', remoteKey: 'rr' })
    await Promise.resolve()
    await gate.deny('bb', { reason: 'sketchy' })

    assert.equal(await decision, 'deny')

    const reg = await loadRegistry(path)
    assert.equal(reg.denied.bb.reason, 'sketchy')
  })

  it('a known-approved key bypasses the modal entirely', async () => {
    // Pre-load the registry: this key has already been approved.
    const gate = new ApprovalGate({ registryPath: path })
    await gate.ready()
    const first = gate.request({ appId: 'c', appName: 'C', publicKey: 'cc', remoteKey: 'rr' })
    await Promise.resolve()
    await gate.approve('cc')
    assert.equal(await first, 'approve-remember')

    // Second time: same key, no pending event, immediate approve.
    let pendings = 0
    gate.on('pending', () => { pendings++ })
    const second = await gate.request({ appId: 'c-again', appName: 'C2', publicKey: 'cc', remoteKey: 'rr' })
    assert.equal(second, 'approve')
    assert.equal(pendings, 0)
  })

  it('a known-denied key returns deny without prompting', async () => {
    const gate = new ApprovalGate({ registryPath: path })
    await gate.ready()
    const first = gate.request({ appId: 'd', appName: 'D', publicKey: 'dd', remoteKey: 'rr' })
    await Promise.resolve()
    await gate.deny('dd')
    assert.equal(await first, 'deny')

    let pendings = 0
    gate.on('pending', () => { pendings++ })
    const second = await gate.request({ appId: 'd-again', appName: 'D2', publicKey: 'dd', remoteKey: 'rr' })
    assert.equal(second, 'deny')
    assert.equal(pendings, 0)
  })

  it('revoke moves an approved key to denied', async () => {
    const gate = new ApprovalGate({ registryPath: path })
    await gate.ready()
    const first = gate.request({ appId: 'e', appName: 'E', publicKey: 'ee', remoteKey: 'rr' })
    await Promise.resolve()
    await gate.approve('ee')
    assert.equal(await first, 'approve-remember')

    await gate.revoke('ee', { appId: 'e', appName: 'E' })

    const second = await gate.request({ appId: 'e', appName: 'E', publicKey: 'ee', remoteKey: 'rr' })
    assert.equal(second, 'deny')

    const reg = await loadRegistry(path)
    assert.equal(reg.approved.ee, undefined)
    assert.equal(reg.denied.ee.reason, 'revoked by user')
  })

  it('forget returns a key to "unknown" (next request prompts again)', async () => {
    const gate = new ApprovalGate({ registryPath: path })
    await gate.ready()
    const first = gate.request({ appId: 'f', appName: 'F', publicKey: 'ff', remoteKey: 'rr' })
    await Promise.resolve()
    await gate.deny('ff')
    assert.equal(await first, 'deny')

    await gate.forget('ff')

    let pendingFired = false
    gate.on('pending', () => { pendingFired = true })
    const second = gate.request({ appId: 'f', appName: 'F', publicKey: 'ff', remoteKey: 'rr' })
    await Promise.resolve()
    assert.equal(pendingFired, true)
    await gate.approve('ff', { remember: false })
    assert.equal(await second, 'approve')
  })

  it('persists across instances (TOFU survives restart)', async () => {
    const gate1 = new ApprovalGate({ registryPath: path })
    await gate1.ready()
    const first = gate1.request({ appId: 'g', appName: 'G', publicKey: 'gg', remoteKey: 'rr' })
    await Promise.resolve()
    await gate1.approve('gg')
    assert.equal(await first, 'approve-remember')

    // New gate, same path — should treat 'gg' as already-approved.
    const gate2 = new ApprovalGate({ registryPath: path })
    await gate2.ready()
    let pendings = 0
    gate2.on('pending', () => { pendings++ })
    const second = await gate2.request({ appId: 'g', appName: 'G', publicKey: 'gg', remoteKey: 'rr' })
    assert.equal(second, 'approve')
    assert.equal(pendings, 0)
  })

  it('forwards deviceName on the pending event so the modal can show it', async () => {
    const gate = new ApprovalGate({ registryPath: path })
    await gate.ready()

    const pendings = []
    gate.on('pending', (p) => pendings.push(p))

    const decision = gate.request({
      appId: 'app',
      appName: 'App',
      publicKey: 'kk11',
      deviceName: 'my-laptop.local',
      remoteKey: 'rr01'
    })
    await Promise.resolve()
    assert.equal(pendings.length, 1)
    assert.equal(pendings[0].deviceName, 'my-laptop.local')

    await gate.approve('kk11')
    assert.equal(await decision, 'approve-remember')
  })

  it('null deviceName falls through to null on the pending event', async () => {
    const gate = new ApprovalGate({ registryPath: path })
    await gate.ready()

    const pendings = []
    gate.on('pending', (p) => pendings.push(p))

    const decision = gate.request({
      appId: 'app',
      appName: 'App',
      publicKey: 'kk22',
      remoteKey: 'rr02'
    })
    await Promise.resolve()
    assert.equal(pendings[0].deviceName, null)
    await gate.approve('kk22')
    await decision
  })

  it('promote() writes a remembered approval for an auto-paired key', async () => {
    const gate = new ApprovalGate({ registryPath: path })
    await gate.ready()

    const events = []
    gate.on('promoted', (e) => events.push(e))

    await gate.promote('autopairedkey', { appId: 'aa', appName: 'AA' })

    const snap = gate.snapshot()
    assert.equal(snap.approved.autopairedkey?.appId, 'aa')
    assert.equal(events.length, 1)
    assert.equal(events[0].publicKey, 'autopairedkey')

    // And from now on this key short-circuits to "approve".
    const decision = await gate.request({
      appId: 'aa',
      appName: 'AA',
      publicKey: 'autopairedkey',
      remoteKey: 'r1'
    })
    assert.equal(decision, 'approve')
  })

  it('snapshot reflects persisted state and pending requests', async () => {
    const gate = new ApprovalGate({ registryPath: path })
    await gate.ready()
    const first = gate.request({ appId: 'h', appName: 'H', publicKey: 'hh', remoteKey: 'rr' })
    await Promise.resolve()
    const snap1 = gate.snapshot()
    assert.equal(snap1.pending.length, 1)
    await gate.approve('hh')
    await first

    const snap2 = gate.snapshot()
    assert.equal(snap2.pending.length, 0)
    assert.ok(snap2.approved.hh)
  })

  it('imports and persists a validated trust snapshot', async () => {
    const gate = new ApprovalGate({ registryPath: path })
    await gate.ready()

    await gate.importSnapshot({
      version: 1,
      approved: { imported: { appId: 'notes', appName: 'Notes' } },
      denied: { blocked: { appId: 'bad', reason: 'user denied' } }
    })

    assert.equal(gate.snapshot().approved.imported.appId, 'notes')
    assert.equal((await loadRegistry(path)).denied.blocked.appId, 'bad')
    await assert.rejects(gate.importSnapshot([]), /must be an object/)
    await assert.rejects(gate.importSnapshot({ approved: [] }), /approved entries/)
  })
})

it('expires pending decisions, bounds their count and resolves duplicate requests together', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'bounded-gate-'))
  const gate = new ApprovalGate({ registryPath: join(dir, 'trust.json'), maxPending: 1, timeoutMs: 20 })
  try {
    await gate.ready()
    const decisions = []
    gate.on('decided', info => decisions.push(info))
    const first = gate.request({ publicKey: 'one' })
    const duplicate = gate.request({ publicKey: 'one' })
    await Promise.resolve()
    assert.equal(await gate.request({ publicKey: 'two' }), 'deny')
    // Keep the test alive; the gate's timer deliberately does not keep a host alive.
    await new Promise(resolve => setTimeout(resolve, 30))
    assert.equal(await first, 'deny')
    assert.equal(await duplicate, 'deny')
    assert.equal(decisions[0].publicKey, 'one')
    assert.equal(decisions[0].decision, 'deny')
    assert.equal(gate.listPending().length, 0)
    const pending = gate.request({ publicKey: 'two' })
    await Promise.resolve()
    gate.close()
    assert.equal(await pending, 'deny')
  } finally { gate.close(); await rm(dir, { recursive: true, force: true }) }
})
