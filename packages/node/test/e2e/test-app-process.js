#!/usr/bin/env node

/**
 * Simulated app process for E2E tests.
 *
 * Reads config from argv, creates a Hyperbee, connects to the node,
 * and exposes operations via stdin commands (NDJSON).
 *
 * Stdout emits NDJSON events so the test harness can observe state.
 */

import Corestore from 'corestore'
import Hyperbee from 'hyperbee'
import Hyperswarm from 'hyperswarm'
import b4a from 'b4a'
import { connectToNode } from '../../../node-client/src/index.js'

const config = JSON.parse(process.argv[2])

const store = new Corestore(config.storagePath)
await store.ready()

const bee = new Hyperbee(store.get({ name: 'data' }), {
  keyEncoding: 'utf-8',
  valueEncoding: 'json'
})
await bee.ready()

const coreKeyHex = b4a.toString(bee.core.key, 'hex')

emit('ready', { coreKey: coreKeyHex })

const replicationSwarm = new Hyperswarm({ bootstrap: config.bootstrap })
replicationSwarm.on('connection', (socket) => store.replicate(socket))
replicationSwarm.join(bee.core.discoveryKey, { server: true, client: false })
await replicationSwarm.flush()

emit('announced', { discoveryKey: b4a.toString(bee.core.discoveryKey, 'hex') })

let client = null

async function connectApp () {
  try {
    client = await connectToNode({
      appId: config.appId,
      appName: config.appName,
      cores: [{ key: bee.core.key, type: 'hyperbee', name: 'data' }],
      swarm: { bootstrap: config.bootstrap },
      topic: Buffer.from(config.topic, 'hex'),
      timeout: config.timeout || 15000
    })

    client.on('disconnected', () => {
      emit('disconnected', {})
      client = null
    })

    emit('connected', {
      paired: client.paired,
      registered: client.registered,
      nodePublicKey: client.nodePublicKey
    })
  } catch (err) {
    emit('connectError', { message: err.message })
  }
}

await connectApp()

let buffer = ''
process.stdin.setEncoding('utf-8')
process.stdin.on('data', async (chunk) => {
  buffer += chunk
  const lines = buffer.split('\n')
  buffer = lines.pop()

  for (const line of lines) {
    if (!line.trim()) continue
    try {
      const cmd = JSON.parse(line)
      await handleCommand(cmd)
    } catch (err) {
      emit('error', { message: err.message })
    }
  }
})

async function handleCommand (cmd) {
  switch (cmd.type) {
    case 'put': {
      await bee.put(cmd.key, cmd.value)
      emit('putDone', { key: cmd.key })
      break
    }
    case 'get': {
      const node = await bee.get(cmd.key)
      emit('getValue', { key: cmd.key, value: node?.value ?? null })
      break
    }
    case 'getAll': {
      const entries = []
      for await (const node of bee.createReadStream()) {
        entries.push({ key: node.key, value: node.value })
      }
      emit('allEntries', { entries })
      break
    }
    case 'reconnect': {
      if (client) {
        await client.close()
        client = null
      }
      await connectApp()
      break
    }
    case 'heartbeat': {
      if (client) client.sendHeartbeat()
      emit('heartbeatSent', {})
      break
    }
    case 'close': {
      if (client) await client.close()
      await replicationSwarm.destroy()
      await store.close()
      emit('closed', {})
      process.exit(0)
    }
  }
}

function emit (event, data) {
  process.stdout.write(JSON.stringify({ event, ...data }) + '\n')
}
