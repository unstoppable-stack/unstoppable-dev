import { createHash, randomBytes } from 'crypto'
import { mkdtemp, rm } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { createServer } from 'net'
import DHT from 'hyperdht'
import { NodeDaemon } from '../src/node.js'
import { localDiscoveryTopic } from '../src/protocol.js'
import { connectToNode } from '../../node-client/src/index.js'

const runs = parsePositiveInt(process.env.NODE_DISCOVERY_RUNS, 20)
const timeoutMs = parsePositiveInt(process.env.NODE_DISCOVERY_TIMEOUT_MS, 5_000)
const warmupMs = parsePositiveInt(process.env.NODE_DISCOVERY_WARMUP_MS, 0)
const topicMode = process.env.NODE_DISCOVERY_TOPIC === 'default' ? 'default' : 'isolated'

const dirs = []
let bootstrapNode = null
let node = null

try {
  const port = await getFreePort()
  bootstrapNode = DHT.bootstrapper(port, '127.0.0.1')
  await bootstrapNode.ready()
  const bootstrap = [{ host: '127.0.0.1', port: bootstrapNode.address().port }]
  const topic = topicMode === 'default'
    ? localDiscoveryTopic()
    : createHash('sha256').update('discovery-stress:' + randomBytes(16).toString('hex')).digest()
  const storagePath = await tmpDir('node-discovery-stress-')

  node = new NodeDaemon(storagePath, {
    swarm: { bootstrap },
    topic,
    discoveryWarmupMs: warmupMs
  })
  await node.start()

  const timings = []
  for (let i = 0; i < runs; i++) {
    const started = Date.now()
    const client = await connectToNode({
      appId: `discovery-stress-${i}`,
      appName: `Discovery Stress ${i}`,
      swarm: { bootstrap },
      topic,
      timeout: timeoutMs
    })
    timings.push(Date.now() - started)
    await client.close()
  }

  const max = Math.max(...timings)
  const avg = Math.round(timings.reduce((sum, n) => sum + n, 0) / timings.length)
  console.log(JSON.stringify({ runs, timeoutMs, warmupMs, topicMode, minMs: Math.min(...timings), avgMs: avg, maxMs: max, timings }, null, 2))
} finally {
  if (node) await node.close().catch(() => {})
  if (bootstrapNode) await bootstrapNode.destroy().catch(() => {})
  for (const dir of dirs) await rm(dir, { recursive: true, force: true }).catch(() => {})
}

async function tmpDir (prefix) {
  const dir = await mkdtemp(join(tmpdir(), prefix))
  dirs.push(dir)
  return dir
}

function parsePositiveInt (value, fallback) {
  const n = Number(value)
  return Number.isInteger(n) && n > 0 ? n : fallback
}

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
