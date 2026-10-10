import { mkdtemp, rm } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { createServer } from 'net'
import DHT from 'hyperdht'
import { createNode } from '../src/index.js'

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
  const nodes = []

  async function tmpDir (prefix = 'node-core-') {
    const dir = await mkdtemp(join(tmpdir(), prefix))
    dirs.push(dir)
    return dir
  }

  async function makeNode (opts = {}) {
    const storage = opts.storage || await tmpDir('node-core-')
    const node = createNode({ pairing: { autoApprove: true },
      storage,
      swarm: { bootstrap },
      ...opts
    })
    nodes.push(node)
    await node.ready()
    return node
  }

  async function until (fn, { timeout = 25_000, interval = 100 } = {}) {
    const deadline = Date.now() + timeout
    for (;;) {
      const value = await fn()
      if (value) return value
      if (Date.now() > deadline) throw new Error('Condition never became true')
      await new Promise((resolve) => setTimeout(resolve, interval))
    }
  }

  function waitForEvent (emitter, event, timeoutMs = 15_000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`Timed out waiting for "${event}"`)), timeoutMs)
      emitter.once(event, (data) => {
        clearTimeout(timer)
        resolve(data)
      })
    })
  }

  async function cleanup () {
    for (const node of nodes) {
      try { await node.close() } catch {}
    }
    await bootstrapNode.destroy()
    for (const dir of dirs) {
      await rm(dir, { recursive: true, force: true }).catch(() => {})
    }
  }

  return { bootstrap, tmpDir, makeNode, until, waitForEvent, cleanup }
}

export function echoPack (name = 'echo') {
  return {
    name,
    version: 1,
    methods: {
      ping: async (params) => ({ pong: params?.value ?? null }),
      boom: async () => { throw new Error('handler exploded') },
      count: async function * (params) {
        const n = params?.n ?? 3
        for (let i = 0; i < n; i++) yield i
      },
      slow: async () => new Promise(() => {}),
      forever: async function * (params, ctx) {
        let i = 0
        while (!ctx.signal.aborted) {
          yield i++
          await new Promise((resolve) => setTimeout(resolve, 10))
        }
      }
    },
    defaultGrants: ['ping', 'count', 'forever', 'slow']
  }
}
