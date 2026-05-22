/**
 * E2E test harness.
 *
 * Spawns real node daemon and app processes as child processes,
 * communicates via stdout NDJSON, and provides helpers for assertions.
 */

import { fork, spawn } from 'child_process'
import { mkdtemp, rm } from 'fs/promises'
import { tmpdir } from 'os'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { createServer } from 'net'
import DHT from 'hyperdht'
import { createHash, randomBytes } from 'crypto'

const __dirname = dirname(fileURLToPath(import.meta.url))
const NODE_ENTRY = join(__dirname, '..', '..', 'src', 'index.js')
const APP_ENTRY = join(__dirname, 'test-app-process.js')

function getFreePort () {
  return new Promise((resolve, reject) => {
    const srv = createServer()
    srv.listen(0, '127.0.0.1', () => {
      const port = srv.address().port
      srv.close(() => resolve(port))
    })
    srv.on('error', reject)
  })
}

export async function createE2EEnv () {
  const port = await getFreePort()
  const bootstrapNode = DHT.bootstrapper(port, '127.0.0.1')
  await bootstrapNode.ready()
  const bootstrap = [{ host: '127.0.0.1', port: bootstrapNode.address().port }]

  const topic = createHash('sha256').update('e2e:' + randomBytes(16).toString('hex')).digest()
  const topicHex = topic.toString('hex')

  const dirs = []
  const processes = []

  async function tmpDir (prefix = 'e2e-') {
    const dir = await mkdtemp(join(tmpdir(), prefix))
    dirs.push(dir)
    return dir
  }

  /**
   * Spawn the node daemon as a real child process.
   * Returns an object with event stream and control methods.
   */
  async function spawnNode (opts = {}) {
    const dir = opts.storagePath || await tmpDir('e2e-node-')

    const env = {
      ...process.env,
      NODE_BOOTSTRAP: JSON.stringify(bootstrap),
      NODE_TOPIC: topicHex
    }

    const child = spawn('node', [NODE_ENTRY, 'start', '--storage', dir], {
      env,
      stdio: ['pipe', 'pipe', 'pipe']
    })

    processes.push(child)

    const nodeObj = {
      process: child,
      storagePath: dir,
      events: [],
      stdout: '',
      stderr: '',
      exited: false,
      exitCode: null,

      waitForOutput (pattern, timeoutMs = 15000) {
        return new Promise((resolve, reject) => {
          const timer = setTimeout(() => reject(new Error(`Node: timed out waiting for "${pattern}"`)), timeoutMs)

          if (nodeObj.stdout.includes(pattern)) {
            clearTimeout(timer)
            resolve()
            return
          }

          const onData = () => {
            if (nodeObj.stdout.includes(pattern)) {
              clearTimeout(timer)
              child.stdout.off('data', onData)
              resolve()
            }
          }
          child.stdout.on('data', onData)
        })
      },

      async kill () {
        if (nodeObj.exited) return
        return new Promise((resolve) => {
          child.once('exit', () => resolve())
          child.kill('SIGTERM')
          setTimeout(() => {
            if (!nodeObj.exited) child.kill('SIGKILL')
          }, 3000)
        })
      }
    }

    child.stdout.on('data', (data) => {
      nodeObj.stdout += data.toString()
    })
    child.stderr.on('data', (data) => {
      nodeObj.stderr += data.toString()
    })
    child.on('exit', (code) => {
      nodeObj.exited = true
      nodeObj.exitCode = code
    })

    return nodeObj
  }

  /**
   * Spawn a simulated app as a child process.
   * Communicates via stdin (commands) and stdout (events) using NDJSON.
   */
  async function spawnApp (opts = {}) {
    const dir = await tmpDir('e2e-app-')

    const config = {
      appId: opts.appId || 'e2e-test-app',
      appName: opts.appName || 'E2E Test App',
      storagePath: dir,
      bootstrap,
      topic: topicHex,
      timeout: opts.timeout || 15000
    }

    const child = fork(APP_ENTRY, [JSON.stringify(config)], {
      stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
      silent: true
    })

    processes.push(child)

    const appObj = {
      process: child,
      storagePath: dir,
      events: [],
      stderr: '',
      exited: false,
      coreKey: null,

      waitForEvent (eventName, timeoutMs = 20000) {
        return new Promise((resolve, reject) => {
          const timer = setTimeout(() => {
            reject(new Error(`App ${config.appId}: timed out waiting for event "${eventName}". Events so far: ${appObj.events.map(e => e.event).join(', ')}`))
          }, timeoutMs)

          const existing = appObj.events.find(e => e.event === eventName)
          if (existing) {
            clearTimeout(timer)
            resolve(existing)
            return
          }

          const check = (ev) => {
            if (ev.event === eventName) {
              clearTimeout(timer)
              resolve(ev)
            }
          }
          appObj._pendingWaits = appObj._pendingWaits || []
          appObj._pendingWaits.push(check)
        })
      },

      waitForEventAfterNow (eventName, timeoutMs = 20000) {
        return new Promise((resolve, reject) => {
          const timer = setTimeout(() => {
            reject(new Error(`App ${config.appId}: timed out waiting for new event "${eventName}"`))
          }, timeoutMs)

          const check = (ev) => {
            if (ev.event === eventName) {
              clearTimeout(timer)
              resolve(ev)
            }
          }
          appObj._pendingWaits = appObj._pendingWaits || []
          appObj._pendingWaits.push(check)
        })
      },

      sendCommand (cmd) {
        child.stdin.write(JSON.stringify(cmd) + '\n')
      },

      async put (key, value) {
        const promise = appObj.waitForEventAfterNow('putDone')
        appObj.sendCommand({ type: 'put', key, value })
        return promise
      },

      async get (key) {
        const promise = appObj.waitForEventAfterNow('getValue')
        appObj.sendCommand({ type: 'get', key })
        return promise
      },

      async getAll () {
        const promise = appObj.waitForEventAfterNow('allEntries')
        appObj.sendCommand({ type: 'getAll' })
        return promise
      },

      async reconnect () {
        const promise = appObj.waitForEventAfterNow('connected')
        appObj.sendCommand({ type: 'reconnect' })
        return promise
      },

      async close () {
        if (appObj.exited) return
        return new Promise((resolve) => {
          child.once('exit', () => resolve())
          appObj.sendCommand({ type: 'close' })
          setTimeout(() => {
            if (!appObj.exited) child.kill('SIGKILL')
          }, 5000)
        })
      }
    }

    let buffer = ''
    child.stdout.on('data', (data) => {
      buffer += data.toString()
      const lines = buffer.split('\n')
      buffer = lines.pop()
      for (const line of lines) {
        if (!line.trim()) continue
        try {
          const ev = JSON.parse(line)
          appObj.events.push(ev)
          if (ev.event === 'ready') appObj.coreKey = ev.coreKey
          if (appObj._pendingWaits) {
            for (const check of appObj._pendingWaits) check(ev)
          }
        } catch {}
      }
    })

    child.stderr.on('data', (data) => {
      appObj.stderr += data.toString()
    })

    child.on('exit', (code) => {
      appObj.exited = true
      appObj.exitCode = code
    })

    return appObj
  }

  /**
   * Verify replicated data by starting the node programmatically,
   * checking the replication engine stats, and optionally reading
   * from the replicated Hyperbee via the node's own Corestore.
   */
  async function verifyNodeData (nodeStoragePath, coreKeyHex) {
    const { NodeDaemon } = await import('../../src/node.js')
    const { default: Hyperbee } = await import('hyperbee')
    const { default: b4a } = await import('b4a')

    const node = new NodeDaemon(nodeStoragePath, {
      swarm: { bootstrap },
      topic
    })
    await node.start()

    const core = node.store.get({ key: b4a.from(coreKeyHex, 'hex') })
    await core.ready()

    const bee = new Hyperbee(core, { keyEncoding: 'utf-8', valueEncoding: 'json' })
    await bee.ready()

    const entries = []
    for await (const n of bee.createReadStream()) {
      entries.push({ key: n.key, value: n.value })
    }

    const status = await node.getStatus()

    await bee.close()
    await node.close()

    return { entries, status }
  }

  async function cleanup () {
    for (const proc of processes) {
      try {
        if (!proc.killed && !proc.exitCode) proc.kill('SIGKILL')
      } catch {}
    }
    await new Promise(r => setTimeout(r, 500))
    await bootstrapNode.destroy()
    for (const dir of dirs) {
      await rm(dir, { recursive: true, force: true }).catch(() => {})
    }
  }

  return { bootstrap, topic, topicHex, tmpDir, spawnNode, spawnApp, verifyNodeData, cleanup }
}
