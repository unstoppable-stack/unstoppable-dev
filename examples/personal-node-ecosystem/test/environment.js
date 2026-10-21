import { createSocket } from 'node:dgram'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import DHT from 'hyperdht'
import { PersonalNode } from 'unstoppable-node/personal-node'
import { openNotebook } from '../src/notebook.js'
import { openBriefing } from '../src/briefing.js'

export async function environment() {
  const socket = createSocket('udp4')
  await new Promise((resolve, reject) => {
    socket.once('error', reject)
    socket.bind(0, '127.0.0.1', resolve)
  })
  const port = socket.address().port
  await new Promise(resolve => socket.close(resolve))
  const dht = DHT.bootstrapper(port, '127.0.0.1')
  await dht.ready()
  const directory = await mkdtemp(join(tmpdir(), 'ecosystem-'))
  const swarm = { bootstrap: [{ host: '127.0.0.1', port: dht.address().port }] }
  const active = new Set()
  return {
    directory, swarm,
    async notebook(name = 'notebook', offline = false) {
      const app = await openNotebook({ storage: join(directory, name), swarm: offline ? { bootstrap: [] } : swarm })
      active.add(app)
      return app
    },
    async briefing(name = 'briefing', offline = false) {
      const app = await openBriefing({ storage: join(directory, name), swarm: offline ? { bootstrap: [] } : swarm })
      active.add(app)
      return app
    },
    async host() {
      const host = new PersonalNode(join(directory, 'personal-node'), { swarm, topic: null })
      active.add(host)
      await host.start()
      return host
    },
    async close(item) { await item.close(); active.delete(item) },
    async cleanup() {
      try {
        const results = await Promise.allSettled([...active].map(item => item.close()))
        const failure = results.find(result => result.status === 'rejected')
        if (failure) throw failure.reason
      } finally {
        await dht.destroy()
        await rm(directory, { recursive: true, force: true })
      }
    },
  }
}

export async function nodeInvite(host) {
  return (await host.createInvite({ grants: { sync: ['manifest.replace', 'status', 'usage'] }, uses: 1 })).code
}

export async function notebookInvite(app, methods = ['describe', 'summary', 'watch']) {
  return (await app.node.createInvite({ grants: { 'ecosystem-notebook': methods }, uses: 1 })).code
}
