import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { openCollection } from '@unstoppable-stack/p2p/data'

// Two app instances. In real apps retain their separate storage directories.
const directory = await mkdtemp(join(tmpdir(), 'p2p-mirror-'))
let writer, reader
try {
  writer = await openCollection({ storage: join(directory, 'writer') })
  await writer.network.ready() // Wait for public announcement before sharing.
  await writer.put('note', { text: 'Hello from another app' })

  // Transfer key + version using your app's trusted sharing channel.
  reader = await openCollection({ storage: join(directory, 'reader'), key: writer.key })
  await reader.sync({ version: writer.version, timeoutMs: 60_000 })
  console.log(await reader.get('note'))
} catch (error) {
  console.error(error.code || 'ERROR', error.message)
  if (error.network) console.error('Network status:', JSON.stringify(error.network))
  process.exitCode = 1
} finally {
  try { await reader?.close() } finally {
    try { await writer?.close() } finally { await rm(directory, { recursive: true, force: true }) }
  }
}
