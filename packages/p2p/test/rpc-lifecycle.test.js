import { it } from 'node:test'
import assert from 'node:assert/strict'
import { Peer } from '../src/peer.js'
import { CapabilityRegistry } from '../src/capabilities.js'
import { DEFAULT_LIMITS } from '../src/limits.js'

function makePeer (methods = {}, overrides = {}) {
  const frames = []
  const node = {
    limits: { ...DEFAULT_LIMITS, ...overrides },
    capabilities: new CapabilityRegistry([{ name: 'notes', methods }]),
    _activeRequests: 0,
    emit () {}
  }
  const peer = new Peer({ node, remotePublicKey: 'a'.repeat(64) })
  peer.paired = true
  peer.grantsGiven = { notes: Object.keys(methods) }
  peer.attachMessage({ send (frame) { frames.push(frame); return true } })
  return { peer, node, frames }
}
const delay = ms => new Promise(resolve => setTimeout(resolve, ms))

it('executes a proxy handle once across await, catch, finally and Promise.all', async () => {
  const { peer } = makePeer()
  let calls = 0
  peer.call = async () => ++calls
  const handle = peer._invoke('notes', 'create')
  assert.deepEqual(await Promise.all([handle, handle]), [1, 1])
  assert.equal(await handle.catch(() => 0), 1)
  assert.equal(await handle.finally(() => {}), 1)
  assert.equal(calls, 1)
  assert.throws(() => handle[Symbol.asyncIterator](), { code: 'CLOSED' })
})

it('rejects promise consumption after stream consumption without a second call', async () => {
  const { peer } = makePeer()
  peer.stream = async function * () { yield 1 }
  const handle = peer._invoke('notes', 'changes')
  const iterator = handle[Symbol.asyncIterator]()
  assert.deepEqual(await iterator.next(), { done: false, value: 1 })
  await assert.rejects(() => handle.then(), { code: 'CLOSED' })
  await iterator.return()
})

it('rejects mismatched advertised kinds locally and legacy response kinds on receipt', async () => {
  const { peer, frames } = makePeer()
  peer.capabilities = { notes: { methodKinds: { get: 'unary', changes: 'stream' } } }
  await assert.rejects(() => peer.call('notes', 'changes'), { code: 'METHOD_KIND_MISMATCH' })
  await assert.rejects(() => peer.stream('notes', 'get').next(), { code: 'METHOD_KIND_MISMATCH' })
  assert.equal(frames.length, 0)
  peer.capabilities = {} // older descriptor without methodKinds
  const stream = peer.stream('notes', 'get')
  const result = stream.next()
  peer.onmessage({ type: 'result', requestId: frames.at(-1).requestId, value: 1 })
  await assert.rejects(() => result, { code: 'METHOD_KIND_MISMATCH' })
  assert.equal(peer._outbound.size, 0)
  const unary = peer.call('notes', 'changes')
  peer.onmessage({ type: 'chunk', requestId: frames.at(-1).requestId, value: 1 })
  await assert.rejects(() => unary, { code: 'METHOD_KIND_MISMATCH' })
  assert.equal(frames.at(-1).type, 'cancel')
})

it('rejects wrong request kinds before executing a handler', async () => {
  let calls = 0
  const { peer, frames } = makePeer({ get: async () => { calls++; return 1 } })
  await peer._onCall({ requestId: '1', capability: 'notes', method: 'get', kind: 'stream' })
  assert.equal(calls, 0)
  assert.equal(frames[0].code, 'METHOD_KIND_MISMATCH')
})

it('bounds a caller stream deadline and cancels remote work', async () => {
  const { peer, frames } = makePeer()
  await assert.rejects(() => peer.stream('notes', 'changes', {}, { timeout: 5 }).next(), { code: 'REQUEST_TIMEOUT' })
  assert.equal(peer._outbound.size, 0)
  assert.deepEqual(frames.map(frame => frame.type), ['call', 'cancel'])
})

it('cleans logical requests on timeout but retains capacity for noncooperative work', async () => {
  let finish
  const { peer, node, frames } = makePeer({ hang: () => new Promise(resolve => { finish = resolve }) }, {
    requestTimeoutMs: 5, maxRequests: 1, maxRequestsPerPeer: 1
  })
  const work = peer._onCall({ requestId: '1', capability: 'notes', method: 'hang' })
  await delay(15)
  assert.equal(peer._inbound.size, 0)
  assert.equal(peer._runningInbound.size, 1)
  assert.equal(node._activeRequests, 1)
  await peer._onCall({ requestId: '2', capability: 'notes', method: 'hang' })
  assert.equal(frames.at(-1).code, 'RESOURCE_LIMIT')
  finish(1)
  await work
  assert.equal(node._activeRequests, 0)
  assert.equal(peer._runningInbound.size, 0)
  assert.equal(frames.filter(frame => frame.requestId === '1').length, 1)
})

it('normalizes arbitrary handler throws into a single bounded error', async () => {
  for (const thrown of [null, 'oops', new Error('x'.repeat(10000))]) {
    const { peer, frames, node } = makePeer({ fail: () => { throw thrown } })
    await peer._onCall({ requestId: '1', capability: 'notes', method: 'fail' })
    assert.equal(frames.length, 1)
    assert.equal(frames[0].code, 'REQUEST_FAILED')
    assert.ok(frames[0].message.length <= 512)
    assert.equal(node._activeRequests, 0)
  }
})

it('falls back to a small error when error serialization fails', async () => {
  const { peer, node } = makePeer({ fail: () => { throw new Error('x'.repeat(10000)) } })
  const sent = []
  peer.attachMessage({ send (frame) {
    if (JSON.stringify(frame).length > 200) throw new Error('frame too large')
    sent.push(frame)
    return true
  } })
  await peer._onCall({ requestId: '1', capability: 'notes', method: 'fail' })
  assert.equal(sent.length, 1)
  assert.equal(sent[0].message, 'Request failed')
  assert.equal(node._activeRequests, 0)
})
