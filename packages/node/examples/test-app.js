#!/usr/bin/env node

/**
 * Test app that creates a Hyperbee, writes data, and registers with the Node.
 *
 * Usage:
 *   Terminal 1: node packages/node/src/index.js
 *   Terminal 2: node packages/node/examples/test-app.js
 */

import Corestore from 'corestore'
import Hyperbee from 'hyperbee'
import Hyperswarm from 'hyperswarm'
import b4a from 'b4a'
import { connectToNode } from '../../node-client/src/index.js'

const APP_ID = 'test-notes-app'
const APP_NAME = 'Test Notes'
const STORAGE = './tmp/test-notes-storage'

console.log()
console.log('  Test Notes App')
console.log('  ──────────────')
console.log()

const store = new Corestore(STORAGE)
await store.ready()

const bee = new Hyperbee(store.get({ name: 'notes' }), {
  keyEncoding: 'utf-8',
  valueEncoding: 'json'
})
await bee.ready()

console.log('  Core key:', b4a.toString(bee.core.key, 'hex').slice(0, 16) + '...')
console.log('  Entries:', bee.version)

await bee.put('note-1', { title: 'First note', body: 'Hello from the test app!', createdAt: new Date().toISOString() })
await bee.put('note-2', { title: 'Second note', body: 'This data will be replicated to the Node.', createdAt: new Date().toISOString() })
await bee.put('note-3', { title: 'Third note', body: 'P2P sync is working!', createdAt: new Date().toISOString() })

console.log('  Wrote 3 notes')
console.log()

const swarm = new Hyperswarm()
swarm.on('connection', (socket) => store.replicate(socket))

const discoveryKey = bee.core.discoveryKey
swarm.join(discoveryKey, { server: true, client: false })
await swarm.flush()

console.log('  Announcing core on DHT...')
console.log('  Connecting to Node...')

try {
  const nodeClient = await connectToNode({
    appId: APP_ID,
    appName: APP_NAME,
    cores: [
      {
        key: bee.core.key,
        type: 'hyperbee',
        name: 'notes'
      }
    ]
  })

  console.log('  ✓ Connected and registered with Node!')
  console.log(`  Node key: ${nodeClient.nodePublicKey.slice(0, 16)}...`)
  console.log()
  console.log('  Replication is running. Press Ctrl+C to stop.')
  console.log()

  nodeClient.on('syncStatus', (status) => {
    console.log(`  Sync: ${status.coreKey.slice(0, 12)}... — ${status.length} entries, ${status.peers} peer(s)`)
  })

  nodeClient.on('disconnected', () => {
    console.log('  Node disconnected')
  })

  const heartbeatInterval = setInterval(() => {
    nodeClient.sendHeartbeat()
  }, 10_000)

  async function shutdown () {
    console.log()
    console.log('  Shutting down...')
    clearInterval(heartbeatInterval)
    await nodeClient.close()
    await swarm.destroy()
    await store.close()
    console.log('  Done.')
    process.exit(0)
  }

  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
} catch (err) {
  console.log(`  ✗ ${err.message}`)
  await swarm.destroy()
  await store.close()
  process.exit(1)
}
