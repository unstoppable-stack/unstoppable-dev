import { test } from 'node:test'
import assert from 'node:assert/strict'
import { runtimeFs } from '../src/runtime-files.js'
import { createTestEnv, echoPack } from './helpers.js'

test('close waits for an in-flight pairing record before storage can be removed', async () => {
  const env = await createTestEnv()
  const rename = runtimeFs.rename
  let release
  const blocked = new Promise(resolve => { release = resolve })
  let entered
  const writing = new Promise(resolve => { entered = resolve })
  try {
    const host = await env.makeNode({ capabilities: [echoPack()] })
    const joiner = await env.makeNode({})
    await host.listen()
    runtimeFs.rename = async (source, destination) => {
      if (destination === host.peerRegistry.file) {
        entered()
        await blocked
      }
      return rename(source, destination)
    }
    const connecting = joiner.connect(host.publicKey).catch(() => null)
    await writing
    let closed = false
    const closing = host.close().then(() => { closed = true })
    await new Promise(resolve => setTimeout(resolve, 25))
    assert.equal(closed, false, 'shutdown must wait for the persisted identity of the paired peer')
    release()
    await closing
    await connecting
    const persisted = JSON.parse(await runtimeFs.readFile(host.peerRegistry.file, 'utf8'))
    assert.equal(persisted.peers[joiner.publicKey].publicKey, joiner.publicKey)
  } finally {
    release()
    runtimeFs.rename = rename
    await env.cleanup()
  }
})
