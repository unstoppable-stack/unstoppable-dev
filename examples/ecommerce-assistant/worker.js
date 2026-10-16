import { createAISession, createBareAdapter, createMockAdapter } from './.unstoppable/runtime-ai/index.js'
/* global Bare */
import Corestore from 'corestore'
import Hyperswarm from 'hyperswarm'
import Hyperbee from 'hyperbee'
import crypto from 'hypercore-crypto'
import { cartSummary, shoppingPrompt } from './catalog.js'

const pipe = Bare.IPC
const storagePath = Bare.argv[2]

// Module-scope state (populated during init, used by handleCommand + cleanup)
let store = null
let swarm = null
let db = null
let peerCount = 0
let commerceQueue = Promise.resolve()
const MOCK_AI = (typeof globalThis.Bare !== 'undefined' && globalThis.Bare.env?.QVAC_MOCK === '1') ||
  (typeof globalThis.process !== 'undefined' && globalThis.process.env?.QVAC_MOCK === '1')
const ai = createAISession({ adapter: MOCK_AI ? createMockAdapter() : createBareAdapter(), byteBudget: 2048 })
let activeChatRequestId = null

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
      const msg = JSON.parse(line)
      if (['cart-get', 'cart-set', 'checkout'].includes(msg.type)) {
        commerceQueue = commerceQueue.then(() => handleCommand(msg)).catch(err => send({ type: 'commerce-error', error: String(err.message || err) }))
      } else {
        handleCommand(msg).catch(err => send({ type: 'peer-error', error: String(err.message || err) }))
      }
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
    case 'cart-get': {
      const cart = (await db.get('_cart'))?.value || []
      send({ type: 'cart', cart, ...cartSummary(cart) })
      break
    }
    case 'cart-set': {
      const summary = cartSummary(msg.cart)
      await db.put('_cart', msg.cart)
      send({ type: 'cart', cart: msg.cart, ...summary })
      break
    }
    case 'checkout': {
      if (typeof msg.orderName !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9-]{0,79}$/.test(msg.orderName)) {
        throw new Error('Use an order reference of 1–80 letters, numbers or hyphens')
      }
      if (await db.get(msg.orderName)) throw new Error('That order reference already exists; choose another')
      const summary = cartSummary((await db.get('_cart'))?.value || [])
      if (!summary.items.length) throw new Error('Add a product before checking out')
      const order = { ...summary, id: msg.orderName, status: 'demo — no payment or fulfillment', createdAt: new Date().toISOString() }
      const batch = db.batch()
      await batch.put(msg.orderName, order)
      await batch.put('_cart', [])
      await batch.flush()
      send({ type: 'order-saved', order })
      send({ type: 'cart', cart: [], ...cartSummary([]) })
      break
    }
    case 'db-get': {
      const entry = await db.get(msg.key)
      send({ type: 'db-get-ok', key: msg.key, value: entry?.value ?? null })
      break
    }
    case 'load-ai': {
      send({ type: 'status', service: 'ai', status: 'loading', mock: ai.mock })
      try {
        const modelId = await ai.load({
          modelSrc: msg.modelSrc,
          modelConstant: 'QWEN3_5_0_8B_MULTIMODAL_Q4_K_M',
          modelChecksum: 'bd258782e35f7f458f8aced1adc053e6e92e89bc735ba3be89d38a06121dc517',
          modelType: 'llm',
          modelConfig: {
            "ctx_size": 4096,
            "reasoning_budget": 0,
            "system_prompt": shoppingPrompt
          },
          onProgress: (p) => send({ type: 'model-progress', ...p }),
        })
        send({ type: 'status', service: 'ai', status: 'ready', modelId, mock: ai.mock })
      } catch (err) {
        send({ type: 'status', service: 'ai', status: 'error', code: err.code, error: err.message })
      }
      break
    }
    case 'chat': {
      const requestId = msg.requestId
      if (activeChatRequestId !== null) { send({ type: 'chat-error', requestId, error: 'Another response is already running.' }); break }
      activeChatRequestId = requestId
      try {
        for await (const token of ai.stream(msg.history, {
          requestId,
          onTrim: () => send({ type: 'chat-context', requestId }),
        })) {
          if (activeChatRequestId === requestId) send({ type: 'chat-token', requestId, token })
        }
        if (activeChatRequestId === requestId) send({ type: 'chat-done', requestId })
      } catch (err) {
        if (activeChatRequestId === requestId) send({ type: 'chat-error', requestId, code: err.code, error: err.message })
      } finally {
        if (activeChatRequestId === requestId) activeChatRequestId = null
      }
      break
    }
    case 'cancel-chat': {
      const requestId = msg.requestId
      if (activeChatRequestId === requestId) activeChatRequestId = null
      try {
        await ai.cancel(requestId)
        send({ type: 'chat-cancelled', requestId })
      } catch (err) {
        send({ type: 'chat-error', requestId, code: err.code, error: 'Cancellation failed: ' + err.message })
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
  activeChatRequestId = null
  try { await ai.close() } catch (err) { send({ type: 'peer-error', error: err.message }) }
  if (swarm) await swarm.destroy()
  if (db) await db.close()
  if (store) await store.close()
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
