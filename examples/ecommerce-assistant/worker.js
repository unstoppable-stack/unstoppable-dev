import { createAISession, createBareAdapter, createMockAdapter } from './.unstoppable/runtime-ai/index.js'
/* global Bare */
import Corestore from 'corestore'
import { createNode, decodeInvite } from '@unstoppable-stack/p2p'
import { join } from 'bare-path'
import { createOrdersCapability, ordersContract, orderReference } from './orders.js'
import Hyperbee from 'hyperbee'
import { cartSummary, shoppingPrompt } from './catalog.js'

const pipe = Bare.IPC
const storagePath = Bare.argv[2]

// Module-scope state (populated during init, used by handleCommand + cleanup)
let store = null
let node = null
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
      if (!db || !node) throw new Error('Storage is not ready')
      const invite = await node.createInvite({ grants: { orders: ['get'] }, uses: 1, expiresIn: 15 * 60_000 })
      send({ type: 'orders-shared', key: invite.code })
      send({ type: 'sharing-ready' })
      break
    }
    case 'fetch-peer-order': {
      const input = orderReference({ id: msg.orderName })
      const { publicKey } = decodeInvite(msg.peerKey)
      // The first use approves one device. Later calls reconnect by its saved
      // identity and grants; expiry does not revoke that existing pairing.
      const peer = node.peer(publicKey) || (node.peerRegistry.has(publicKey)
        ? await node.connect(publicKey, { requested: { orders: ['get'] }, timeout: 30000, reconnect: false })
        : await node.pair(msg.peerKey, { timeout: 30000, reconnect: false }))
      const order = await peer.client(ordersContract).get(input, { timeout: 30000 })
      send({ type: 'peer-order', key: input.id, value: order })
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
  if (node) await node.close()
  if (db) await db.close()
  if (store) await store.close()
  Bare.exit()
}

send({ type: 'workerReady' })

async function init() {
  store = new Corestore(storagePath)

  // Preserve the existing main-db; RPC never attaches this private store to
  // network replication. Identity/grants use a separate persistent directory.
  const core = store.get({ name: 'main-db' })
  db = new Hyperbee(core, { keyEncoding: 'utf-8', valueEncoding: 'json' })
  await db.ready()
  node = createNode({
    storage: join(storagePath, 'p2p-identity'),
    profile: { appId: 'local-goods', appName: 'Local Goods' },
    swarm: Bare.argv[3] ? { bootstrap: JSON.parse(Bare.argv[3]) } : {},
    pairing: { approve: async () => 'deny' },
    reconnect: false,
    capabilities: [createOrdersCapability(async id => (await db.get(id))?.value ?? null)],
  })
  node.on('peer', () => { peerCount = node.peers.length; send({ type: 'peer-count', count: peerCount }) })
  node.on('peerDisconnected', () => { peerCount = node.peers.length; send({ type: 'peer-count', count: peerCount }) })
  await node.listen()
  swarm = node.swarm
  send({ type: 'status', service: 'p2p', status: 'ready' })

  send({ type: 'status', service: 'storage', status: 'ready' })

  send({ type: 'status', service: 'ai', status: 'idle', mock: MOCK_AI })

  send({ type: 'init-complete' })
}

init().catch(async err => {
  send({ type: 'fatal', error: err.message })
  await node?.close().catch(() => {})
  await db?.close().catch(() => {})
  await store?.close().catch(() => {})
})
