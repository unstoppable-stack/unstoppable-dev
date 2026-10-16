import { createEnvironment, until } from './test/helpers.js'

// A bounded local-network demonstration; no public bootstrap, models or wallet.
const env = await createEnvironment()
try {
  const writer = await env.open('writer')
  const reader = await env.open('reader')
  await writer.notes.put('morning', { coffee: 'oat latte' })
  const invitation = await reader.node.createInvite({ grants: { sync: ['manifest.replace', 'status'] } })
  const peer = await writer.node.pair(invitation.code)
  await peer.call('sync', 'manifest.replace', { manifest: writer.manifest() })
  await until(async () => (await peer.call('sync', 'status')).cores[0]?.protection.state === 'protected')
  const key = writer.manifest().resources[0].key
  await env.close(writer)
  console.log('Source offline; replicated note:', await reader.readReplica(key, 'morning'))
} finally { await env.cleanup() }
