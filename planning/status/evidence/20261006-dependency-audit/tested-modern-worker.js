/* global Bare */
import Corestore from 'corestore'
import Hyperswarm from 'hyperswarm'
import Hyperbee from 'hyperbee'
import crypto from 'hypercore-crypto'

const pipe = Bare.IPC
const storagePath = Bare.argv[2]

// Module-scope state (populated during init, used by handleCommand + cleanup)
let store = null
let swarm = null
let db = null
let peerCount = 0
let sdk = null
let modelId = null
let qvacPluginRegistered = false
let activeChatRequestId = null
const CTX_SIZE = 4096
let modelLoading = false
const MOCK_AI = (
  (typeof globalThis.Bare !== 'undefined' && globalThis.Bare.env && globalThis.Bare.env.QVAC_MOCK === '1') ||
  (typeof globalThis.process !== 'undefined' && globalThis.process.env && globalThis.process.env.QVAC_MOCK === '1')
)

function send(msg) {
  pipe.write(JSON.stringify(msg) + '\n')
}

let buffer = ''
pipe.on('data', (data) => {
  buffer += data.toString()
  const lines = buffer.split('\n')
  buffer = lines.pop() || ''
  for (const line of lines) {
    if (!line.trim()) continue
    try {
      handleCommand(JSON.parse(line)).catch(err => send({ type: 'peer-error', error: String(err.message || err) }))
    } catch (err) { send({ type: 'peer-error', error: String(err.message || err) }) }
  }
})

async function handleCommand(msg) {
  switch (msg.type) {
    case 'network-info': {
      send({ type: 'network-info', routingNodes: swarm.dht.toArray().length, connecting: swarm.connecting, connected: peerCount, stats: swarm.stats })
      break
    }
    case 'share-orders': {
      if (!db) throw new Error('Storage is not ready')
      const discovery = swarm.join(crypto.discoveryKey(db.key), { server: true, client: false })
      discovery.flushed().then(() => send({ type: 'sharing-ready' }), err => send({ type: 'peer-error', error: String(err.message || err) }))
      send({ type: 'orders-shared', key: db.key.toString('hex') })
      break
    }
    case 'fetch-peer-order': {
      if (!/^[a-f0-9]{64}$/i.test(msg.peerKey || '')) throw new Error('Enter a valid 64-character order-sharing key')
      if (!msg.orderName || msg.orderName.length > 200) throw new Error('Enter an order name of at most 200 characters')
      const key = Buffer.from(msg.peerKey, 'hex')
      const discovery = swarm.join(crypto.discoveryKey(key), { server: false, client: true })
      const remote = new Hyperbee(store.get({ key }), { keyEncoding: 'utf-8', valueEncoding: 'json' })
      const doneFinding = remote.core.findingPeers()
      discovery.flushed().then(doneFinding, doneFinding)
      let timer
      let cancelled = false
      try {
        const entry = await Promise.race([
          (async () => {
            await remote.ready()
            // Finish discovery and connection attempts before accepting a read.
            // A prior downloaded copy must not be mistaken for a fresh peer fetch.
            await discovery.flushed()
            await swarm.flush()
            while (!cancelled && !remote.core.peers.length) {
              await new Promise(resolve => setTimeout(resolve, 100))
            }
            if (cancelled) throw new Error('Peer request cancelled')
            await remote.core.update({ wait: true })
            if (cancelled) throw new Error('Peer request cancelled')
            return remote.get(msg.orderName)
          })(),
          new Promise((_, reject) => {
            timer = setTimeout(() => {
              cancelled = true
              reject(new Error('Peer unavailable after 30 seconds; confirm both apps are online and sharing'))
            }, 30000)
          }),
        ])
        send({ type: 'peer-order', key: msg.orderName, value: entry?.value ?? null })
      } finally {
        cancelled = true
        clearTimeout(timer)
        await remote.close()
        await discovery.destroy()
      }
      break
    }
    case 'join-topic': {
      const topic = crypto.discoveryKey(Buffer.from(msg.topic))
      swarm.join(topic, { server: true, client: true })
      send({ type: 'joined', topic: msg.topic })
      break
    }
    case 'db-put': {
      await db.put(msg.key, msg.value)
      send({ type: 'db-put-ok', key: msg.key })
      break
    }
    case 'db-get': {
      const entry = await db.get(msg.key)
      send({ type: 'db-get-ok', key: msg.key, value: entry?.value ?? null })
      break
    }
    case 'load-ai': {
      if (modelId) { send({ type: 'status', service: 'ai', status: 'ready', modelId }); break }
      if (modelLoading) { send({ type: 'status', service: 'ai', status: 'loading' }); break }
      modelLoading = true
      if (MOCK_AI) {
        await new Promise((r) => setTimeout(r, 200))
        modelId = 'mock-model'
        modelLoading = false
        send({ type: 'status', service: 'ai', status: 'ready', modelId, mock: true })
        break
      }
      try {
        send({ type: 'status', service: 'ai', status: 'loading' })
        const { default: process } = await import('bare-process')
        globalThis.process = process
        const [loadedSdk, { llmPlugin }, { registerPlugin }] = await Promise.all([
          import('@qvac/inference'),
          import('@qvac/inference/llamacpp-completion/plugin'),
          import('@qvac/inference/plugins'),
        ])
        if (!qvacPluginRegistered) {
          registerPlugin(llmPlugin)
          qvacPluginRegistered = true
        }
        sdk = loadedSdk
        modelId = await sdk.loadModel({
          modelSrc: msg.modelSrc || sdk.QWEN3_5_0_8B_MULTIMODAL_Q4_K_M,
          modelType: 'llm',
          modelConfig: {
            ctx_size: CTX_SIZE,
            // 0 = no reasoning, -1 = unlimited. Engine-level, so no prompt hacks
            // and no stripping reasoning blocks back out of the token stream.
            reasoning_budget: 0,
            system_prompt: 'You are a coffee assistant. Help users choose drinks and explain brewing. You cannot save orders yourself; ask users to use the saved coffee orders controls.',
          },
          onProgress: (p) => send({ type: 'model-progress', ...p }),
        })
        send({ type: 'status', service: 'ai', status: 'ready', modelId })
      } catch (err) {
        send({ type: 'status', service: 'ai', status: 'error', error: String(err && err.message || err) })
      } finally {
        modelLoading = false
      }
      break
    }
    case 'chat': {
      const requestId = msg.requestId
      if (!modelId) { send({ type: 'chat-error', requestId, error: 'Model not loaded. Click Load Assistant first.' }); break }
      if (activeChatRequestId !== null) { send({ type: 'chat-error', requestId, error: 'Another response is already running.' }); break }
      activeChatRequestId = requestId
      if (MOCK_AI) {
        const last = msg.history[msg.history.length - 1]
        const reply = `Mock: ${last?.content ?? '(empty)'}`
        for (const ch of reply) {
          if (activeChatRequestId !== requestId) break
          send({ type: 'chat-token', requestId, token: ch })
          await new Promise((r) => setTimeout(r, 5))
        }
        if (activeChatRequestId === requestId) {
          activeChatRequestId = null
          send({ type: 'chat-done', requestId })
        }
        break
      }
      try {
        // Reasoning is disabled at load time via `reasoning_budget: 0`, so
        // tokens arrive as plain content — no reasoning-block filtering needed.
        const result = sdk.completion({ modelId, history: msg.history, stream: true })
        for await (const token of result.tokenStream) {
          if (activeChatRequestId !== requestId) break
          send({ type: 'chat-token', requestId, token })
        }
        if (activeChatRequestId === requestId) {
          activeChatRequestId = null
          send({ type: 'chat-done', requestId })
        }
      } catch (err) {
        if (activeChatRequestId === requestId) {
          activeChatRequestId = null
          send({ type: 'chat-error', requestId, error: String(err && err.message || err) })
        }
      }
      break
    }
    case 'cancel-chat': {
      const requestId = msg.requestId
      if (activeChatRequestId !== requestId) {
        send({ type: 'chat-cancelled', requestId })
        break
      }
      activeChatRequestId = null
      try {
        if (!MOCK_AI) await sdk.cancel({ operation: 'inference', modelId })
        send({ type: 'chat-cancelled', requestId })
      } catch (err) {
        send({ type: 'chat-error', requestId, error: `Cancellation failed: ${String(err && err.message || err)}` })
      }
      break
    }
    case 'shutdown':
      await cleanup()
      break
    default:
      send({ type: 'error', error: `Unknown command: ${msg.type}` })
  }
}

async function cleanup() {
  if (swarm) await swarm.destroy()
  if (db) await db.close()
  if (store) await store.close()
  if (activeChatRequestId !== null && modelId && modelId !== 'mock-model' && sdk) {
    activeChatRequestId = null
    await sdk.cancel({ operation: 'inference', modelId }).catch(() => {})
  }
  if (modelId && modelId !== 'mock-model' && sdk) await sdk.unloadModel({ modelId })
  Bare.exit()
}

send({ type: 'workerReady' })

async function init() {
  store = new Corestore(storagePath)

  swarm = new Hyperswarm(Bare.argv[3] ? { bootstrap: JSON.parse(Bare.argv[3]) } : {})
  swarm.on('connection', (conn) => {
    store.replicate(conn)
    peerCount++
    send({ type: 'peer-count', count: peerCount })
    conn.once('close', () => { peerCount--; send({ type: 'peer-count', count: peerCount }) })
    conn.on('error', () => {})
  })
  send({ type: 'status', service: 'p2p', status: 'ready' })

  const core = store.get({ name: 'main-db' })
  db = new Hyperbee(core, { keyEncoding: 'utf-8', valueEncoding: 'json' })
  await db.ready()
  send({ type: 'status', service: 'storage', status: 'ready' })

  send({ type: 'status', service: 'ai', status: 'idle', mock: MOCK_AI })

  send({ type: 'init-complete' })
}

init().catch((err) => send({ type: 'fatal', error: err.message }))
