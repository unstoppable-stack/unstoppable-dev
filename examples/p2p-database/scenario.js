import { createSocket } from 'node:dgram'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import Corestore from 'corestore'
import DHT from 'hyperdht'
import { createNode } from '@unstoppable-stack/p2p'
import { openDatabase } from '@unstoppable-stack/p2p/db'
import { notesAdapter } from './notes.js'

async function until(check) {
  const deadline = Date.now() + 15_000
  while (!(await check())) {
    if (Date.now() > deadline) throw new Error('Database did not converge before the deadline')
    await new Promise(resolve => setTimeout(resolve, 25))
  }
}

// Isolated real peers, no public DHT or external service. All keys and state
// are temporary demo data, deleted in finally even if a step fails.
export async function runScenario(log = () => {}) {
  const socket = createSocket('udp4')
  await new Promise((resolve, reject) => {
    socket.once('error', reject)
    socket.bind(0, '127.0.0.1', resolve)
  })
  const port = socket.address().port
  await new Promise(resolve => socket.close(resolve))
  const dht = DHT.bootstrapper(port, '127.0.0.1')
  const directory = await mkdtemp(join(tmpdir(), 'p2p-db-example-'))
  const devices = []
  async function open(name, key = null) {
    const node = createNode({
      storage: join(directory, name, 'identity'), reconnect: false,
      swarm: { bootstrap: [{ host: '127.0.0.1', port: dht.address().port }] },
    })
    const store = new Corestore(join(directory, name, 'data'))
    const device = { node, store, db: null }
    devices.push(device)
    await node.ready()
    // Pairing controls transport here; replication still uses dataset-key
    // semantics. No production key distribution or row ACL is implied.
    device.db = await openDatabase({ node, store, key, adapter: notesAdapter, discovery: false })
    return device
  }
  async function close(device) {
    try { await device.db?.close() } finally {
      try { await device.node.close() } finally { await device.store.close() }
    }
  }
  try {
    await dht.ready()
    let alice = await open('alice')
    const key = alice.db.key
    let bob = await open('bob', key)
    const invite = await alice.node.createInvite({ grants: {}, uses: 1 })
    await bob.node.pair(invite.code)
    await alice.db.members.add(bob.db.writerKey)
    await bob.db.waitFor(state => state.writable, { timeoutMs: 15_000 })
    log('Founder admitted Bob as a writer (not an administrator or indexer).')

    // Destroy both transports before writing: no peer can deliver these edits.
    await Promise.all([alice.node.close(), bob.node.close()])
    const receipt = await alice.db.append({ type: 'note.put', name: 'alice', text: 'Written offline by Alice' })
    await bob.db.append({ type: 'note.put', name: 'bob', text: 'Written offline by Bob' })
    await alice.db.append({ type: 'note.put', name: 'shared', text: 'Alice revision' })
    await bob.db.append({ type: 'note.put', name: 'shared', text: 'Bob revision' })
    log(`Offline receipt: ${receipt.scope}; no remote durability claim.`)
    await close(alice)
    await close(bob)

    alice = await open('alice', key)
    bob = await open('bob', key)
    await alice.node.listen()
    await bob.node.connect(alice.node.publicKey, { reconnect: false })
    await until(async () => {
      await Promise.all([alice.db.update(), bob.db.update()])
      const [a, b, left, right] = await Promise.all([
        alice.db.view.get('bob'), bob.db.view.get('alice'),
        alice.db.view.get('shared'), bob.db.view.get('shared'),
      ])
      return a && b && left && right && left.value.text === right.value.text
    })
    const shared = (await alice.db.view.get('shared')).value
    log(`After restart/reconnect both views agree: ${shared.text}`)
    await alice.db.members.remove(bob.db.writerKey)
    await bob.db.waitFor(state => !state.writable, { timeoutMs: 15_000 })
    log('Bob learned his removal. Downloaded history remains readable.')
    return {
      receipt: receipt.scope, shared,
      alice: (await bob.db.view.get('alice')).value.text,
      bob: (await alice.db.view.get('bob')).value.text,
      bobWritable: bob.db.state().writable,
    }
  } finally {
    try { for (const device of devices.reverse()) await close(device) } finally {
      await dht.destroy()
      await rm(directory, { recursive: true, force: true })
    }
  }
}
