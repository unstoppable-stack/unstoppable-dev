import { mkdtemp, rm } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { createSocket } from 'dgram'
import DHT from 'hyperdht'
import Hyperswarm from 'hyperswarm'
import Corestore from 'corestore'
import Hyperbee from 'hyperbee'
import Hyperdrive from 'hyperdrive'
import { createNode } from '@unstoppable-stack/p2p'
import { syncPack } from '../../src/sync/index.js'

function getFreePort () {
  return new Promise((resolve, reject) => {
    const srv = createSocket('udp4')
    srv.bind(0, '127.0.0.1', () => {
      const port = srv.address().port
      srv.close(() => resolve(port))
    })
    srv.on('error', reject)
  })
}

export async function createTestEnv () {
  // Select a UDP port: a free TCP port may be reserved for UDP on Windows.
  const port = await getFreePort()
  const bootstrapNode = DHT.bootstrapper(port, '127.0.0.1')
  await bootstrapNode.ready()
  const bootstrap = [{ host: '127.0.0.1', port: bootstrapNode.address().port }]

  const dirs = []
  const nodes = []
  const closeables = []

  async function tmpDir (prefix = 'caps-sync-') {
    const dir = await mkdtemp(join(tmpdir(), prefix))
    dirs.push(dir)
    return dir
  }

  async function makeNode ({ sync = false, storage, ...opts } = {}) {
    const dir = storage || await tmpDir('node-')
    const capabilities = opts.capabilities || []
    if (sync) capabilities.push(syncPack({ storage: join(dir, 'store') }))
    const node = createNode({ pairing: { autoApprove: true }, storage: dir, swarm: { bootstrap }, ...opts, capabilities })
    nodes.push(node)
    await node.ready()
    return node
  }

  // An ordinary app seeding its own data — the thing a node replicates.
  async function makeApp (name = 'app') {
    const dir = await tmpDir('app-')
    const store = new Corestore(dir)
    await store.ready()

    const bee = new Hyperbee(store.get({ name: 'data' }), {
      keyEncoding: 'utf-8',
      valueEncoding: 'json'
    })
    await bee.ready()

    const drive = new Hyperdrive(store.namespace(`${name}-drive`))
    await drive.ready()

    const swarm = new Hyperswarm({ bootstrap })
    swarm.on('connection', (socket) => store.replicate(socket))
    swarm.join(bee.core.discoveryKey, { server: true, client: false })
    swarm.join(drive.discoveryKey, { server: true, client: false })
    await swarm.flush()

    closeables.push(swarm, store)
    return { store, bee, drive, swarm, dir }
  }

  function waitForEvent (emitter, event, timeoutMs = 20_000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`Timed out waiting for "${event}"`)), timeoutMs)
      emitter.once(event, (data) => { clearTimeout(timer); resolve(data) })
    })
  }

  async function until (fn, { timeout = 20_000, interval = 100 } = {}) {
    const deadline = Date.now() + timeout
    for (;;) {
      const value = await fn()
      if (value) return value
      if (Date.now() > deadline) throw new Error('Condition never became true')
      await new Promise((resolve) => setTimeout(resolve, interval))
    }
  }

  async function cleanup () {
    for (const node of nodes) { try { await node.close() } catch {} }
    for (const item of closeables) {
      try { if (item.destroy) await item.destroy(); else if (item.close) await item.close() } catch {}
    }
    await bootstrapNode.destroy()
    for (const dir of dirs) await rm(dir, { recursive: true, force: true }).catch(() => {})
  }

  return { bootstrap, tmpDir, makeNode, makeApp, waitForEvent, until, cleanup }
}

export function manifestFor ({ bee, drive } = {}) {
  const resources = []
  if (bee) {
    resources.push({
      id: 'data',
      kind: 'hyperbee',
      key: Buffer.from(bee.core.key).toString('hex'),
      name: 'Data',
      protection: { mode: 'mirror' }
    })
  }
  if (drive) {
    resources.push({
      id: 'files',
      kind: 'hyperdrive',
      key: Buffer.from(drive.key).toString('hex'),
      name: 'Files',
      protection: { mode: 'mirror' }
    })
  }
  return { schemaVersion: 1, resources }
}
