import { createSocket } from 'node:dgram'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import DHT from 'hyperdht'
import { createNotesPeer } from '../src/notes.js'

export async function createEnvironment() {
  const server = createSocket('udp4')
  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.bind(0, '127.0.0.1', resolve)
  })
  const port = server.address().port
  await new Promise(resolve => server.close(resolve))
  const dht = DHT.bootstrapper(port, '127.0.0.1')
  await dht.ready()
  const directory = await mkdtemp(join(tmpdir(), 'p2p-notes-'))
  const peers = new Set()
  const swarm = { bootstrap: [{ host: '127.0.0.1', port: dht.address().port }] }
  return {
    async open(name) {
      const peer = await createNotesPeer({ storage: join(directory, name), swarm, deviceName: name })
      peers.add(peer)
      return peer
    },
    async close(peer) { await peer.close(); peers.delete(peer) },
    async cleanup() {
      try { for (const peer of peers) await peer.close() } finally {
        await dht.destroy()
        await rm(directory, { recursive: true, force: true })
      }
    },
  }
}

export async function until(check, timeout = 15000) {
  const deadline = Date.now() + timeout
  while (Date.now() < deadline) {
    const result = await check()
    if (result) return result
    await new Promise(resolve => setTimeout(resolve, 25))
  }
  throw new Error('Replication did not reach the expected checkpoint')
}
