#!/usr/bin/env node
// Headless smoke test. Spawns `bin/headless.js` under Bare (no Pear UI),
// then opens a NodeClient against it from this Node.js process and exercises
// the data + AI paths end to end. Used by .github/workflows/node-smoke.yml
// and runnable locally with `npm run test:smoke`.
//
// All this needs in CI is: Node 20+, bare-runtime, npm install in the four
// packages listed in the workflow. No Pear UI, no sandbox apps, no models —
// `--ai-mock` covers AI.

import { spawn } from 'child_process'
import { mkdtemp, rm } from 'fs/promises'
import { tmpdir } from 'os'
import path from 'path'
import { fileURLToPath } from 'url'

import { connectToNode } from '../../node-client/src/index.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const nodeDesktopRoot = path.resolve(__dirname, '..')
const runtime = process.env.BARE_BIN || 'bare'
const readyTimeoutMs = Number(process.env.NODE_SMOKE_READY_TIMEOUT_MS || 30_000)
const pairTimeoutMs = Number(process.env.NODE_SMOKE_PAIR_TIMEOUT_MS || 20_000)

const storagePath = await mkdtemp(path.join(tmpdir(), 'unstoppable-node-smoke-'))
let daemon
let client

try {
  daemon = spawn(
    runtime,
    [path.join(nodeDesktopRoot, 'bin/headless.js'), '--storage', storagePath, '--ai-mock'],
    { cwd: nodeDesktopRoot, stdio: ['ignore', 'pipe', 'pipe'], detached: true }
  )
  daemon.stderr.on('data', (data) => process.stderr.write(data))

  const ready = await waitForReady(daemon, readyTimeoutMs)
  console.log('[smoke] daemon ready:', JSON.stringify(ready.services))
  if (!ready.services?.ai) {
    throw new Error(`Daemon ready without services.ai=true: ${JSON.stringify(ready.services)}`)
  }
  if (!ready.services?.data || !ready.services?.files) {
    throw new Error(`Daemon ready without core services: ${JSON.stringify(ready.services)}`)
  }

  client = await connectToNode({
    appId: 'smoke',
    appName: 'Smoke Test',
    timeout: pairTimeoutMs,
    requireServices: ['data', 'files', 'ai']
  })
  console.log('[smoke] client paired')

  const status = await client.getNodeStatus()
  console.log('[smoke] status:', JSON.stringify({
    apps: status.pairedApps,
    services: status.services,
    aiReady: status.ai?.ready
  }))
  if (status.pairedApps < 1) throw new Error('Expected at least one paired app')
  if (!status.ai?.ready) throw new Error('Status reports AI not ready')

  let tokens = ''
  for await (const token of client.requestInference({
    messages: [{ role: 'user', content: 'hello' }]
  })) {
    tokens += token
  }
  if (tokens.length === 0) throw new Error('Expected non-empty inference output from mock provider')
  console.log('[smoke] inference returned', tokens.length, 'chars')

  console.log('[smoke] PASS')
} catch (err) {
  console.error('[smoke] FAIL:', err.message)
  process.exitCode = 1
} finally {
  if (client) await client.close().catch(() => {})
  terminateDaemon(daemon)
  await rm(storagePath, { recursive: true, force: true }).catch(() => {})
}

function terminateDaemon (child) {
  if (!child || child.exitCode !== null) return
  try {
    process.kill(-child.pid, 'SIGTERM')
  } catch {
    try { child.kill('SIGTERM') } catch {}
  }
}

function waitForReady (child, timeoutMs) {
  return new Promise((resolve, reject) => {
    let buffer = ''
    const timer = setTimeout(() => {
      cleanup()
      reject(new Error(`Headless daemon did not report ready within ${timeoutMs}ms`))
    }, timeoutMs)

    function cleanup () {
      clearTimeout(timer)
      child.stdout.off('data', onData)
      child.off('exit', onExit)
      child.off('error', onError)
    }

    function onError (err) { cleanup(); reject(err) }
    function onExit (code, signal) {
      cleanup()
      reject(new Error(`Headless daemon exited before ready (code=${code}, signal=${signal})`))
    }

    function onData (data) {
      process.stdout.write(data)
      buffer += data.toString()
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''
      for (const line of lines) {
        if (!line.trim()) continue
        let msg
        try { msg = JSON.parse(line) } catch { continue }
        if (msg.type === 'fatal') {
          cleanup()
          reject(new Error(`Headless daemon fatal: ${msg.error}`))
          return
        }
        if (msg.type === 'aiReady' && msg.mock) {
          // services.ai not flipped on `ready` if ai started after — emit
          // a synthetic ready snapshot once we see aiReady.
        }
        if (msg.type === 'ready') {
          cleanup()
          resolve(msg)
          return
        }
      }
    }

    child.on('error', onError)
    child.on('exit', onExit)
    child.stdout.on('data', onData)
  })
}
