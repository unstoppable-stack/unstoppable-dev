import { createSocket } from 'node:dgram'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import DHT from 'hyperdht'
import { openNotebook } from '../src/notebook.js'

export async function environment() {
  const socket = createSocket('udp4')
  await new Promise((resolve, reject) => {
    socket.once('error', reject)
    socket.bind(0, '127.0.0.1', resolve)
  })
  const port = socket.address().port
  await new Promise((resolve) => socket.close(resolve))
  const dht = DHT.bootstrapper(port, '127.0.0.1')
  await dht.ready()
  const directory = await mkdtemp(join(tmpdir(), 'public-notes-test-'))
  const bootstrap = [{ host: '127.0.0.1', port: dht.address().port }]
  const peers = new Set()
  return {
    directory,
    bootstrap,
    async open(name, onChange) {
      const notebook = await openNotebook({
        directory: join(directory, name),
        swarm: { bootstrap },
        onChange,
      })
      peers.add(notebook)
      return notebook
    },
    async close(notebook) {
      await notebook.close()
      peers.delete(notebook)
    },
    async cleanup() {
      try {
        for (const notebook of peers) await notebook.close()
      } finally {
        await dht.destroy()
        await rm(directory, { recursive: true, force: true })
      }
    },
  }
}
