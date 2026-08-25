#!/usr/bin/env node
// Headless smoke test. Spawns `bin/headless.js` under Bare (no Pear UI),
// then opens a NodeClient against it from this Node.js process and runs the
// sandbox demo fixture. Used by .github/workflows/node-smoke.yml and runnable
// locally with `npm run test:smoke`.
//
// All this needs in CI is: Node 20+, bare-runtime, npm install in the package
// directories listed in the workflow. No Pear UI and no models — `--ai-mock`
// covers AI.

import { spawn } from 'child_process'
import { randomBytes } from 'crypto'
import { mkdtemp, rm } from 'fs/promises'
import { tmpdir } from 'os'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '../../..')
const nodeDesktopRoot = path.resolve(__dirname, '..')
const demoRoot = path.join(repoRoot, 'sandbox/node-demo')
const runtime = process.env.BARE_BIN || 'bare'
const readyTimeoutMs = Number(process.env.NODE_SMOKE_READY_TIMEOUT_MS || 30_000)
const demoTimeoutMs = Number(process.env.NODE_SMOKE_DEMO_TIMEOUT_MS || 45_000)
const runs = Number(process.env.NODE_SMOKE_RUNS || 1)
const topicMode = process.env.NODE_SMOKE_TOPIC === 'default' ? 'default' : 'isolated'
const topic = topicMode === 'default'
  ? null
  : (process.env.UNSTOPPABLE_NODE_TOPIC || randomBytes(32).toString('hex'))

const storagePath = await mkdtemp(path.join(tmpdir(), 'unstoppable-node-smoke-'))
let daemon

try {
  daemon = spawn(
    runtime,
    [path.join(nodeDesktopRoot, 'bin/headless.js'), '--storage', storagePath, '--ai-mock'],
    {
      cwd: nodeDesktopRoot,
      stdio: ['pipe', 'pipe', 'pipe'],
      detached: true,
      env: smokeEnv()
    }
  )
  daemon.stderr.on('data', (data) => process.stderr.write(data))

  const ready = await waitForReady(daemon, readyTimeoutMs)
  const capabilities = Object.keys(ready.capabilities || {})
  console.log('[smoke] daemon ready:', JSON.stringify({ capabilities, topicMode }))
  // v2 has no services flags: capabilities are the single answer to "what can
  // you do". The mock provider is enabled by the launch args, so `ai` must be
  // hosted; `sync` covers what used to be the separate data + files services.
  if (!ready.capabilities?.ai) {
    throw new Error(`Daemon ready without the ai capability: ${JSON.stringify(capabilities)}`)
  }
  if (!ready.capabilities?.sync) {
    throw new Error(`Daemon ready without the sync capability: ${JSON.stringify(capabilities)}`)
  }

  for (let i = 1; i <= runs; i++) {
    console.log(`[smoke] demo run ${i}/${runs}`)
    await runDemo(demoTimeoutMs)
  }

  console.log('[smoke] PASS')
} catch (err) {
  console.error('[smoke] FAIL:', err.message)
  process.exitCode = 1
} finally {
  await terminateDaemon(daemon)
  await rm(storagePath, { recursive: true, force: true }).catch(() => {})
}

async function terminateDaemon (child) {
  if (!child || child.exitCode !== null) return
  try { child.stdin.write(JSON.stringify({ type: 'shutdown' }) + '\n') } catch {}
  const exited = await waitForExit(child, 2_000)
  if (exited) return
  try {
    process.kill(-child.pid, 'SIGTERM')
  } catch {
    try { child.kill('SIGTERM') } catch {}
  }
}

function waitForExit (child, timeoutMs) {
  return new Promise((resolve) => {
    if (child.exitCode !== null) {
      resolve(true)
      return
    }
    const timer = setTimeout(() => {
      child.off('exit', onExit)
      resolve(false)
    }, timeoutMs)
    function onExit () {
      clearTimeout(timer)
      resolve(true)
    }
    child.on('exit', onExit)
  })
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

function runDemo (timeoutMs) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['demo.js'], {
      cwd: demoRoot,
      stdio: ['ignore', 'inherit', 'inherit'],
      env: smokeEnv()
    })
    const timer = setTimeout(() => {
      child.kill('SIGTERM')
      reject(new Error(`Demo did not finish within ${timeoutMs}ms`))
    }, timeoutMs)
    child.on('error', (err) => {
      clearTimeout(timer)
      reject(err)
    })
    child.on('exit', (code, signal) => {
      clearTimeout(timer)
      if (code === 0) resolve()
      else reject(new Error(`Demo failed (code=${code}, signal=${signal})`))
    })
  })
}

function smokeEnv () {
  const env = { ...process.env }
  if (topicMode === 'default') delete env.UNSTOPPABLE_NODE_TOPIC
  else env.UNSTOPPABLE_NODE_TOPIC = topic
  return env
}
