import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import Corestore from 'corestore'
import { mkdtemp, rm } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { AppRegistry } from '../src/registry.js'

describe('AppRegistry', () => {
  let store, registry, dir

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'registry-test-'))
    store = new Corestore(dir)
    await store.ready()
    const core = store.get({ name: 'test-registry' })
    await core.ready()
    registry = new AppRegistry(core)
    await registry.ready()
  })

  afterEach(async () => {
    await registry.close()
    await store.close()
    await rm(dir, { recursive: true, force: true })
  })

  it('registers and retrieves an app', async () => {
    await registry.registerApp({
      appId: 'my-app',
      appName: 'My App',
      publicKey: 'abc123',
      cores: [{ key: 'def456', type: 'hyperbee', name: 'data' }]
    })

    const app = await registry.getApp('my-app')
    assert.ok(app)
    assert.equal(app.appId, 'my-app')
    assert.equal(app.appName, 'My App')
    assert.equal(app.publicKey, 'abc123')
    assert.equal(app.cores.length, 1)
    assert.equal(app.cores[0].key, 'def456')
  })

  it('preserves pairedAt on re-register', async () => {
    await registry.registerApp({ appId: 'app-1', appName: 'App', publicKey: 'key1' })
    const first = await registry.getApp('app-1')

    await new Promise(r => setTimeout(r, 10))

    await registry.registerApp({ appId: 'app-1', appName: 'App Updated', publicKey: 'key1', cores: [{ key: 'c1', name: 'x' }] })
    const second = await registry.getApp('app-1')

    assert.equal(second.pairedAt, first.pairedAt)
    assert.notEqual(second.updatedAt, first.updatedAt)
    assert.equal(second.appName, 'App Updated')
    assert.equal(second.cores.length, 1)
  })

  it('does not erase resources during a pairing-only update', async () => {
    const cores = [{ key: 'c1', name: 'catalog' }]
    const drives = [{ key: 'd1', name: 'originals' }]
    await registry.registerApp({ appId: 'app-1', appName: 'App', publicKey: 'key1', cores, drives })

    await registry.registerApp({ appId: 'app-1', appName: 'App', publicKey: 'key1', grants: { resources: ['status'] } })
    const app = await registry.getApp('app-1')
    assert.deepEqual(app.cores, cores)
    assert.deepEqual(app.drives, drives)
  })

  it('lists multiple apps', async () => {
    await registry.registerApp({ appId: 'app-a', appName: 'A', publicKey: 'k1' })
    await registry.registerApp({ appId: 'app-b', appName: 'B', publicKey: 'k2' })
    await registry.registerApp({ appId: 'app-c', appName: 'C', publicKey: 'k3' })

    const apps = await registry.listApps()
    assert.equal(apps.length, 3)
    const ids = apps.map(a => a.appId).sort()
    assert.deepEqual(ids, ['app-a', 'app-b', 'app-c'])
  })

  it('removes an app', async () => {
    await registry.registerApp({ appId: 'app-x', appName: 'X', publicKey: 'k1' })
    assert.ok(await registry.getApp('app-x'))

    await registry.removeApp('app-x')
    assert.equal(await registry.getApp('app-x'), null)
  })

  it('checks trusted keys', async () => {
    await registry.registerApp({ appId: 'app-1', appName: 'A', publicKey: 'trusted-key' })

    assert.ok(await registry.isTrustedKey('trusted-key'))
    assert.ok(!(await registry.isTrustedKey('unknown-key')))
  })

  it('returns null for unknown app', async () => {
    const app = await registry.getApp('nonexistent')
    assert.equal(app, null)
  })

  it('returns empty list when no apps registered', async () => {
    const apps = await registry.listApps()
    assert.deepEqual(apps, [])
  })

  it('sets default permissions', async () => {
    await registry.registerApp({ appId: 'app-1', appName: 'A', publicKey: 'k' })
    const app = await registry.getApp('app-1')
    assert.ok(app.permissions)
    assert.equal(app.permissions.dataSync, true)
    assert.equal(app.permissions.fileSync, true)
    assert.equal(app.permissions.aiDelegation, true)
  })
})
