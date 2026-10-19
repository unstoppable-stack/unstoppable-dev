import { it } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { createTestEnv } from './helpers.js'

it('runs the documented host/reader and founder/joiner commands in separate processes', async t => {
  const env = await createTestEnv()
  const cleanup = []
  const transcripts = []
  t.after(async () => {
    for (const close of cleanup) await close()
    await env.cleanup()
  })
  const example = await readFile(process.env.P2P_DEVICE_EXAMPLE || new URL('../../../examples/p2p-data/device.js', import.meta.url), 'utf8')
  // Include transport evidence only in captured failure transcripts. The
  // example itself remains unchanged, including in installed-consumer checks.
  const script = `
import { UnstoppableNode } from '@unstoppable-stack/p2p'
import DHT from 'hyperdht'
// Keep the isolated test network on loopback. Wildcard sockets can advertise
// another runner interface and complete discovery without delivering UDP data.
const originalOpen = UnstoppableNode.prototype._open
UnstoppableNode.prototype._open = function () {
  this._swarmOpts.dht = new DHT({
    bootstrap: JSON.parse(process.env.P2P_BOOTSTRAP), host: '127.0.0.1', firewalled: false
  })
  return originalOpen.call(this)
}
const originalConnection = UnstoppableNode.prototype._onConnection
UnstoppableNode.prototype._onConnection = function (socket, info) {
  const result = originalConnection.call(this, socket, info)
  const stream = socket.noiseStream || socket
  const peer = this._peers.get(Buffer.from(socket.remotePublicKey).toString('hex'))
  const diagnostic = () => console.error('TRANSPORT', JSON.stringify({
    corked: stream.userData?.corked, hello: !!peer?.publicKey,
    read: stream.rawBytesRead, written: stream.rawBytesWritten, closed: peer?.closed
  }))
  const timer = setInterval(diagnostic, 10000); timer.unref()
  socket.on('error', error => console.error('TRANSPORT_ERROR', error.message))
  socket.once('close', () => { diagnostic(); clearInterval(timer) })
  return result
}
` + example
  function run (...args) {
    const process = spawn(globalThis.process.execPath, ['--input-type=module', '-e', script, 'device.js', ...args], {
      cwd: globalThis.process.env.P2P_CONSUMER_CWD || fileURLToPath(new URL('..', import.meta.url)),
      env: { ...globalThis.process.env, P2P_BOOTSTRAP: JSON.stringify(env.bootstrap), P2P_DEBUG: '1' }, stdio: ['pipe', 'pipe', 'pipe']
    })
    let output = ''
    transcripts.push(() => `${args[0]}:\n${output}`)
    process.stdout.on('data', chunk => { output += chunk })
    process.stderr.on('data', chunk => { output += chunk })
    const exit = new Promise(resolve => process.once('exit', code => resolve(code)))
    cleanup.push(async () => {
      process.kill('SIGTERM')
      const timer = setTimeout(() => process.kill('SIGKILL'), 5000)
      await exit
      clearTimeout(timer)
    })
    return { process, exit, async wait (pattern) {
      return env.until(() => output.match(pattern), { timeout: 60000 }).catch(error => {
        throw new Error(`${error.message}\n${transcripts.map(read => read()).join('\n')}`)
      })
    } }
  }
  const host = run('mirror-host', await env.tmpDir())
  const shared = JSON.parse((await host.wait(/SHARE (.+)\n/))[1])
  const reader = run('mirror-read', await env.tmpDir(), shared.key, String(shared.version))
  await reader.wait(/DOWNLOADED {"text":"Hello from another device"}/)
  assert.equal(await reader.exit, 0)
  const founder = run('db-host', await env.tmpDir())
  const key = (await founder.wait(/DATABASE ([a-f0-9]{64})/))[1]
  const joiner = run('db-join', await env.tmpDir(), key)
  const writerKey = (await joiner.wait(/WRITER ([a-f0-9]{64})/))[1]
  founder.process.stdin.write(writerKey + '\n')
  await founder.wait(/Writer approved/)
  await joiner.wait(/Written locally/)
  await founder.wait(/OBSERVED {"text":"Written on another device"}/)
})
