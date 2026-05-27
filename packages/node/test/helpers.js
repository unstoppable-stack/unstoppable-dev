import { mkdtemp, rm } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { createServer } from 'net'
import { createHash, randomBytes } from 'crypto'
import DHT from 'hyperdht'
import Corestore from 'corestore'
import Hyperbee from 'hyperbee'
import Hyperdrive from 'hyperdrive'
import Hyperswarm from 'hyperswarm'
import { NodeDaemon } from '../src/node.js'
import { NodeClient } from '../../node-client/src/client.js'
import { connectToNode } from '../../node-client/src/index.js'

function getFreePort () {
  return new Promise((resolve, reject) => {
    const srv = createServer()
    srv.listen(0, '127.0.0.1', () => {
      const port = srv.address().port
      srv.close(() => resolve(port))
    })
    srv.on('error', reject)
  })
}

export async function createTestEnv () {
  const port = await getFreePort()
  const bootstrapNode = DHT.bootstrapper(port, '127.0.0.1')
  await bootstrapNode.ready()
  const bootstrap = [{ host: '127.0.0.1', port: bootstrapNode.address().port }]

  const topic = createHash('sha256').update('test:' + randomBytes(16).toString('hex')).digest()

  const dirs = []

  async function tmpDir (prefix = 'node-test-') {
    const dir = await mkdtemp(join(tmpdir(), prefix))
    dirs.push(dir)
    return dir
  }

  async function createNode (opts = {}) {
    const dir = await tmpDir('node-daemon-')
    const node = new NodeDaemon(dir, {
      swarm: { bootstrap },
      topic,
      ...opts
    })
    return node
  }

  async function createClient (opts = {}) {
    const client = new NodeClient({
      appId: opts.appId || 'test-app',
      appName: opts.appName || 'Test App',
      cores: opts.cores || [],
      drives: opts.drives || [],
      swarm: { bootstrap },
      topic
    })
    return client
  }

  async function createConnectedClient (opts = {}) {
    return connectToNode({
      appId: opts.appId || 'test-app',
      appName: opts.appName || 'Test App',
      cores: opts.cores || [],
      drives: opts.drives || [],
      swarm: { bootstrap },
      topic,
      timeout: opts.timeout,
      requireServices: opts.requireServices,
      reconnect: opts.reconnect
    })
  }

  async function createAppWithBee (name = 'test-app') {
    const dir = await tmpDir('app-')
    const store = new Corestore(dir)
    await store.ready()

    const bee = new Hyperbee(store.get({ name: 'data' }), {
      keyEncoding: 'utf-8',
      valueEncoding: 'json'
    })
    await bee.ready()

    const swarm = new Hyperswarm({ bootstrap })
    swarm.on('connection', (socket) => store.replicate(socket))

    swarm.join(bee.core.discoveryKey, { server: true, client: false })
    await swarm.flush()

    return { store, bee, swarm, dir }
  }

  async function createAppWithDrive (name = 'test-drive-app') {
    const dir = await tmpDir('drive-app-')
    const store = new Corestore(dir)
    await store.ready()

    const drive = new Hyperdrive(store.namespace(name))
    await drive.ready()

    const swarm = new Hyperswarm({ bootstrap })
    swarm.on('connection', (socket) => store.replicate(socket))

    swarm.join(drive.discoveryKey, { server: true, client: false })
    await swarm.flush()

    return { store, drive, swarm, dir }
  }

  function waitForEvent (emitter, event, timeoutMs = 10000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`Timed out waiting for "${event}"`)), timeoutMs)
      emitter.once(event, (data) => {
        clearTimeout(timer)
        resolve(data)
      })
    })
  }

  async function cleanup (...extras) {
    for (const item of extras) {
      try {
        if (item && typeof item.close === 'function') await item.close()
        if (item && typeof item.destroy === 'function') await item.destroy()
      } catch {}
    }
    await bootstrapNode.destroy()
    for (const dir of dirs) {
      await rm(dir, { recursive: true, force: true }).catch(() => {})
    }
  }

  return { bootstrap, topic, tmpDir, createNode, createClient, createConnectedClient, createAppWithBee, createAppWithDrive, waitForEvent, cleanup }
}
