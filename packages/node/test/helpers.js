import { mkdtemp, rm } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { createServer } from 'net'
import DHT from 'hyperdht'
import Corestore from 'corestore'
import Hyperbee from 'hyperbee'
import Hyperswarm from 'hyperswarm'
import { createNode } from '@unstoppable-stack/node-core'
import { PersonalNode } from '../src/personal-node.js'

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

  const dirs = []
  const closeables = []

  async function tmpDir (prefix = 'personal-node-') {
    const dir = await mkdtemp(join(tmpdir(), prefix))
    dirs.push(dir)
    return dir
  }

  async function makeNode ({ storage, ...opts } = {}) {
    const dir = storage || await tmpDir('node-')
    const node = new PersonalNode(dir, { swarm: { bootstrap }, ...opts })
    closeables.push(node)
    return node
  }

  async function makeClient (opts = {}) {
    const dir = await tmpDir('client-')
    const client = createNode({ storage: dir, swarm: { bootstrap }, ...opts })
    closeables.push(client)
    await client.ready()
    return client
  }

  async function makeApp (name = 'app') {
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

    closeables.push(swarm, store)
    return { store, bee, swarm, dir }
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

  function waitForEvent (emitter, event, timeoutMs = 20_000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`Timed out waiting for "${event}"`)), timeoutMs)
      emitter.once(event, (data) => { clearTimeout(timer); resolve(data) })
    })
  }

  async function cleanup () {
    // Close in creation order: nodes first (they hold the connections), then
    // each app's swarm, then its store. Reversing closes a Corestore while its
    // own swarm is still accepting connections that call store.replicate().
    for (const item of closeables) {
      try {
        if (item.close) await item.close()
        else if (item.destroy) await item.destroy()
      } catch {}
    }
    await bootstrapNode.destroy()
    for (const dir of dirs) await rm(dir, { recursive: true, force: true }).catch(() => {})
  }

  return { bootstrap, tmpDir, makeNode, makeClient, makeApp, until, waitForEvent, cleanup }
}

export function manifestFor (bee, { id = 'data', name = 'Data' } = {}) {
  return {
    schemaVersion: 1,
    resources: [{
      id,
      kind: 'hyperbee',
      key: Buffer.from(bee.core.key).toString('hex'),
      name,
      protection: { mode: 'mirror' }
    }]
  }
}
