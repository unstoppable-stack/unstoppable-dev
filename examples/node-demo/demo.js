#!/usr/bin/env node
//
// Tiny end-to-end demo: prove a basic app can interact with the
// Unstoppable Node (CLI daemon or node-desktop dashboard).
//
// What it does:
//   1. Stand up a Hyperbee, write a few entries, announce its core on
//      the replication DHT (so the Node can fetch the bytes — the
//      handshake alone is not enough).
//   2. Pair with the Node via @unstoppable-stack/node-core (discover the
//      machine-local topic, then hand it a resource manifest).
//   3. Stream a one-shot prompt through the Node's AI provider
//      (requires the node to be started with --ai-mock or --ai).
//
// Both halves run by default; pass --store-only or --infer-only to
// scope the demo down. Useful when the Node is launched without AI.
//
// Usage:
//   Terminal 1 (one of):
//     node packages/node/src/index.js --ai-mock          # CLI daemon
//     pear run -d packages/node-desktop -- --ai-mock     # Pear dashboard
//
//   Terminal 2:
//     node examples/node-demo/demo.js
//

import Corestore from 'corestore'
import Hyperbee from 'hyperbee'
import Hyperswarm from 'hyperswarm'
import b4a from 'b4a'
import { createNode } from '@unstoppable-stack/node-core'

const args = new Set(process.argv.slice(2))
const STORE_ONLY = args.has('--store-only')
const INFER_ONLY = args.has('--infer-only')
const DO_STORE = !INFER_ONLY
const DO_INFER = !STORE_ONLY

const APP_ID = 'node-demo-' + Math.random().toString(36).slice(2, 8)
const APP_NAME = 'Node Demo'
const STORAGE = './tmp-storage'
const PROMPT = 'Reply with one short sentence: what year is it?'
const PAIR_TIMEOUT_MS = 15_000
const INFER_TIMEOUT_MS = 30_000

function log (kind, ...rest) {
  const tag = {
    info: '\x1b[2m·\x1b[0m',
    ok: '\x1b[32m✓\x1b[0m',
    fail: '\x1b[31m✗\x1b[0m',
    section: '\x1b[36m▸\x1b[0m'
  }[kind] || ' '
  console.log(tag, ...rest)
}

console.log()
log('section', `Node Demo (${APP_ID})`)
console.log()

let store
let bee
let swarm
let appNode
let exitCode = 0

try {
  // --------------------------------------------------------------------
  // 1. Hyperbee + replication swarm
  // --------------------------------------------------------------------
  if (DO_STORE) {
    log('section', 'Phase 1 — local Hyperbee')

    store = new Corestore(STORAGE)
    await store.ready()
    bee = new Hyperbee(store.get({ name: 'notes' }), {
      keyEncoding: 'utf-8',
      valueEncoding: 'json'
    })
    await bee.ready()

    const coreKey = b4a.toString(bee.core.key, 'hex').slice(0, 16)
    log('info', `core ${coreKey}…  entries before: ${bee.version - 1}`)

    const now = new Date().toISOString()
    await bee.put('note:1', { title: 'First', body: 'Hello from the demo', at: now })
    await bee.put('note:2', { title: 'Second', body: 'Replicate me, please', at: now })
    await bee.put('note:3', { title: 'Third', body: 'Tagged for Node sync', at: now })

    log('ok', `wrote 3 entries  (version: ${bee.version})`)

    swarm = new Hyperswarm()
    swarm.on('connection', (socket) => store.replicate(socket))
    swarm.join(bee.core.discoveryKey, { server: true, client: false })
    await swarm.flush()
    log('ok', 'announced core on DHT (replication ready)')
    console.log()
  }

  // --------------------------------------------------------------------
  // 2. Pair with the Node + register the bee
  // --------------------------------------------------------------------
  log('section', 'Phase 2 — pair with the Node')

  const t0 = Date.now()
  appNode = createNode({
    storage: STORAGE + '/app-node',
    profile: { appId: APP_ID, appName: APP_NAME },
    capabilities: []
  })
  await appNode.ready()

  // Finds the Personal Node on this machine (or the topic UNSTOPPABLE_NODE_TOPIC
  // points at, which is how the smoke harness isolates itself).
  const peer = await appNode.discover({ timeout: PAIR_TIMEOUT_MS })
  log('ok', `paired in ${Date.now() - t0}ms`)
  log('info', `node key: ${peer.publicKey.slice(0, 16)}…`)
  log('info', `capabilities: ${Object.keys(peer.capabilities).join(', ') || '(none)'}`)

  if (DO_STORE) {
    await peer.call('sync', 'manifest.replace', {
      manifest: {
        schemaVersion: 1,
        resources: [{
          id: 'notes',
          kind: 'hyperbee',
          key: b4a.toString(bee.core.key, 'hex'),
          name: 'Notes',
          protection: { mode: 'mirror' }
        }]
      }
    })
    log('info', `registered core: notes (${b4a.toString(bee.core.key, 'hex').slice(0, 12)}…)`)
  }
  console.log()

  // --------------------------------------------------------------------
  // 3. Remote inference (if node has AI)
  // --------------------------------------------------------------------
  if (DO_INFER) {
    log('section', 'Phase 3 — remote inference')

    if (!peer.capabilities?.ai) {
      log('fail', 'node does not advertise the ai capability — start it with --ai-mock or --ai')
      exitCode = 1
    } else {
      log('info', `prompt: "${PROMPT}"`)
      const t1 = Date.now()
      let collected = ''
      let tokenCount = 0

      const inferTimer = setTimeout(() => {
        log('fail', `no inference-done within ${INFER_TIMEOUT_MS}ms`)
        exitCode = 1
      }, INFER_TIMEOUT_MS)

      try {
        for await (const token of peer.stream('ai', 'completion.stream', {
          messages: [{ role: 'user', content: PROMPT }]
        })) {
          tokenCount++
          collected += token
          process.stdout.write(token)
        }
        clearTimeout(inferTimer)
        if (collected) console.log()
        log('ok', `streamed ${tokenCount} tokens in ${Date.now() - t1}ms`)
      } catch (err) {
        clearTimeout(inferTimer)
        log('fail', `inference failed: ${err.message}`)
        exitCode = 1
      }
    }
  }

  // --------------------------------------------------------------------
  // 4. Hold open briefly so replication has a chance to actually move bytes
  // --------------------------------------------------------------------
  if (DO_STORE) {
    console.log()
    log('section', 'Phase 4 — hold open 5s for byte replication')
    await new Promise(r => setTimeout(r, 5_000))
    log('ok', 'replication window elapsed')
  }
} catch (err) {
  log('fail', err.message)
  exitCode = 1
} finally {
  if (appNode) await appNode.close().catch(() => {})
  if (swarm) await swarm.destroy().catch(() => {})
  if (store) await store.close().catch(() => {})
  console.log()
  log(exitCode === 0 ? 'ok' : 'fail', exitCode === 0 ? 'demo PASSED' : 'demo FAILED')
  process.exit(exitCode)
}
