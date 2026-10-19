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
  const script = await readFile(process.env.P2P_DEVICE_EXAMPLE || new URL('../../../examples/p2p-data/device.js', import.meta.url), 'utf8')
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
