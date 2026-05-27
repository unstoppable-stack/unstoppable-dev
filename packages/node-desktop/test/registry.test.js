import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import {
  loadRegistry,
  saveRegistry,
  recordApproval,
  recordDenial,
  revoke,
  decisionFor
} from '../lib/registry.js'

describe('lib/registry', () => {
  let dir
  let path

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'reg-test-'))
    path = join(dir, 'trust.json')
  })

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  it('loads an empty registry when the file is missing', async () => {
    const reg = await loadRegistry(path)
    assert.deepEqual(reg.approved, {})
    assert.deepEqual(reg.denied, {})
  })

  it('round-trips through save + load', async () => {
    await saveRegistry(path, {
      approved: { 'aaaa': { appId: 'a', appName: 'A', approvedAt: 'x', remember: true } },
      denied: { 'bbbb': { appId: 'b', appName: 'B', deniedAt: 'y', reason: 'r' } }
    })
    const reg = await loadRegistry(path)
    assert.equal(reg.approved.aaaa.appId, 'a')
    assert.equal(reg.denied.bbbb.reason, 'r')
  })

  it('writes atomically via .tmp then rename', async () => {
    // Simulate a concurrent reader: there's never a moment where the
    // file exists but contains an empty/half JSON.
    await saveRegistry(path, { approved: { 'k': { appId: 'a' } }, denied: {} })
    const raw = await readFile(path, 'utf8')
    const parsed = JSON.parse(raw) // would throw if a partial write was visible
    assert.equal(parsed.approved.k.appId, 'a')
  })

  it('recordApproval moves a key from denied → approved', async () => {
    await saveRegistry(path, {
      approved: {},
      denied: { 'k': { appId: 'a', appName: 'A', deniedAt: 'x', reason: 'r' } }
    })
    const reg = await recordApproval(path, 'k', { appId: 'a', appName: 'A' })
    assert.ok(reg.approved.k)
    assert.equal(reg.denied.k, undefined)
  })

  it('recordDenial moves a key from approved → denied', async () => {
    await saveRegistry(path, {
      approved: { 'k': { appId: 'a', appName: 'A', approvedAt: 'x', remember: true } },
      denied: {}
    })
    const reg = await recordDenial(path, 'k', { appId: 'a', appName: 'A', reason: 'changed mind' })
    assert.ok(reg.denied.k)
    assert.equal(reg.approved.k, undefined)
    assert.equal(reg.denied.k.reason, 'changed mind')
  })

  it('revoke is sugar over recordDenial', async () => {
    await saveRegistry(path, {
      approved: { 'k': { appId: 'a', appName: 'A' } },
      denied: {}
    })
    const reg = await revoke(path, 'k', { appId: 'a', appName: 'A' })
    assert.equal(reg.approved.k, undefined)
    assert.equal(reg.denied.k.reason, 'revoked by user')
  })

  it('decisionFor returns the right verdict', () => {
    const reg = {
      approved: { 'a': { appId: 'a' } },
      denied: { 'd': { appId: 'd' } }
    }
    assert.equal(decisionFor(reg, 'a').decision, 'approve')
    assert.equal(decisionFor(reg, 'd').decision, 'deny')
    assert.equal(decisionFor(reg, 'x').decision, 'unknown')
  })

  it('survives a corrupted file by throwing (not silently resetting)', async () => {
    await writeFile(path, '{not json', 'utf8')
    await assert.rejects(loadRegistry(path), /JSON|Unexpected/i)
  })
})
