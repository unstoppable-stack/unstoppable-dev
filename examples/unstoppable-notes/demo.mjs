import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createSocket } from 'node:dgram'
import DHT from 'hyperdht'
import { openCollection } from '@unstoppable-stack/p2p/data'

// Two isolated test peers; no public discovery, phone, models or personal data.
const directory = await mkdtemp(join(tmpdir(), 'unstoppable-notes-example-'))
let writer, reader, bootstrapper
try {
  const socket = createSocket('udp4')
  let port
  try {
    await new Promise((resolve, reject) => {
      socket.once('error', reject)
      socket.bind(0, '127.0.0.1', resolve)
    })
    port = socket.address().port
  } finally {
    await new Promise(resolve => socket.close(resolve))
  }
  bootstrapper = DHT.bootstrapper(port, '127.0.0.1')
  await bootstrapper.ready()
  const nodeOptions = { swarm: { bootstrap: [{ host: '127.0.0.1', port: bootstrapper.address().port }] } }
  const writerStorage = join(directory, 'writer')
  const readerStorage = join(directory, 'reader')
  writer = await openCollection({ storage: writerStorage, nodeOptions })
  const note = { text: 'Coffee with Maya. Bring the prototype.', capturedAt: new Date().toISOString() }
  await writer.put('memo', note) // Local save does not wait for another device.
  assert.deepEqual(await writer.get('memo'), note)
  const key = writer.key
  await writer.close(); writer = null
  writer = await openCollection({ storage: writerStorage, nodeOptions })
  assert.equal(writer.key, key)
  assert.deepEqual(await writer.get('memo'), note)
  console.log('Saved note survives a full storage reopen.')

  await writer.network.ready({ timeoutMs: 15_000 })
  // A dataset key permits reads. Share key + checkpoint only with intended readers.
  reader = await openCollection({ storage: readerStorage, key, nodeOptions })
  const checkpoint = writer.version
  await reader.sync({ version: checkpoint, timeoutMs: 30_000 })
  assert.deepEqual(await reader.get('memo'), note)
  await writer.close(); writer = null
  await reader.close(); reader = null
  reader = await openCollection({ storage: readerStorage, nodeOptions })
  assert.deepEqual(await reader.get('memo'), note)
  console.log('Synced note remains readable after reader restart with its source offline.')
  console.log('PASS: local persistence and single-writer text-note replication over isolated loopback.')
  console.log('No physical-device, public-network, audio, AI or release-readiness claim.')
} finally {
  try { await reader?.close() } finally {
    try { await writer?.close() } finally {
      try { await bootstrapper?.destroy() } finally {
        await rm(directory, { recursive: true, force: true })
      }
    }
  }
}
