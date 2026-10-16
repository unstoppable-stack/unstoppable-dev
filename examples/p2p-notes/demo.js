import { createEnvironment, until } from './test/helpers.js'
import { notesContract } from './src/contract.js'

// A bounded local-network demonstration; no public bootstrap, models or wallet.
const env = await createEnvironment()
try {
  const writer = await env.open('writer')
  const reader = await env.open('reader')
  await writer.notes.put('morning', { coffee: 'oat latte' })
  const readInvitation = await writer.node.createInvite({ grants: { notes: ['get', 'list'] } })
  const notes = (await reader.node.pair(readInvitation.code)).client(notesContract)
  console.log('RPC note:', await notes.get({ name: 'morning' }))
  for await (const entry of notes.list()) console.log('Streamed note:', entry)
  // The replica explicitly grants the already paired writer sync administration.
  await reader.node.setPeerGrants(writer.node.publicKey, { sync: ['manifest.replace', 'status'] })
  const peer = writer.node.peer(reader.node.publicKey)
  await peer.call('sync', 'manifest.replace', { manifest: writer.manifest() })
  await until(async () => (await peer.call('sync', 'status')).cores[0]?.protection.state === 'protected')
  const key = writer.manifest().resources[0].key
  await env.close(writer)
  console.log('Source offline; replicated note:', await reader.readReplica(key, 'morning'))
} finally { await env.cleanup() }
