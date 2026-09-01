import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm, readFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import {
  CONFIG_VERSION,
  DEFAULT_CONFIG,
  loadConfig,
  saveConfig,
  migrateConfig,
  mergeConfigPatch,
  validateConfig
} from '../src/config.js'

const dirs = []
async function tmp () {
  const dir = await mkdtemp(join(tmpdir(), 'node-config-'))
  dirs.push(dir)
  return dir
}

describe('node config', { after: async () => {
  for (const dir of dirs) await rm(dir, { recursive: true, force: true }).catch(() => {})
} }, () => {
  it('writes defaults on first load', async () => {
    const dir = await tmp()
    const config = await loadConfig(dir)
    assert.equal(config.configVersion, CONFIG_VERSION)
    assert.deepEqual(config.storage, { globalQuotaBytes: null, perPeerQuotaBytes: null })

    const onDisk = JSON.parse(await readFile(join(dir, 'node-config.json'), 'utf8'))
    assert.equal(onDisk.configVersion, CONFIG_VERSION)
  })

  it('round-trips through save and load', async () => {
    const dir = await tmp()
    const config = await loadConfig(dir)
    await saveConfig(dir, mergeConfigPatch(config, { storage: { perPeerQuotaBytes: 2048 } }))
    assert.equal((await loadConfig(dir)).storage.perPeerQuotaBytes, 2048)
  })

  // The rename is the visible half of re-keying the registry from appId to
  // peer public key. An existing limit has to survive it.
  it('migrates a v1 per-app quota to a per-peer quota', () => {
    const migrated = migrateConfig({
      configVersion: 1,
      storage: { globalQuotaBytes: 10, perAppQuotaBytes: 4096 }
    })
    assert.equal(migrated.configVersion, CONFIG_VERSION)
    assert.equal(migrated.storage.perPeerQuotaBytes, 4096)
    assert.equal(migrated.storage.globalQuotaBytes, 10)
    assert.equal(Object.hasOwn(migrated.storage, 'perAppQuotaBytes'), false)
  })

  it('migrates the unversioned beta format', () => {
    const migrated = migrateConfig({ ai: { enabled: true, mode: 'mock', modelSrc: '' } })
    assert.equal(migrated.configVersion, CONFIG_VERSION)
    assert.equal(migrated.ai.enabled, true)
  })

  it('refuses a config from the future', () => {
    assert.throws(() => migrateConfig({ configVersion: CONFIG_VERSION + 1 }), /newer than this app supports/)
  })

  it('rejects unknown options rather than silently ignoring them', () => {
    assert.throws(() => mergeConfigPatch(DEFAULT_CONFIG, { nope: 1 }), /Unknown node config option: nope/)
    assert.throws(
      () => mergeConfigPatch(DEFAULT_CONFIG, { storage: { nope: 1 } }),
      /Unknown node config option: storage.nope/
    )
  })

  it('validates types and quota shapes', () => {
    assert.throws(() => validateConfig({ ...DEFAULT_CONFIG, ai: { ...DEFAULT_CONFIG.ai, mode: 'nope' } }), /ai.mode/)
    assert.throws(
      () => validateConfig({ ...DEFAULT_CONFIG, storage: { globalQuotaBytes: -1, perPeerQuotaBytes: null } }),
      /globalQuotaBytes/
    )
    assert.throws(
      () => validateConfig({ ...DEFAULT_CONFIG, pairing: { requireApproval: 'yes', autoApproveLocal: false } }),
      /requireApproval/
    )
  })
})
