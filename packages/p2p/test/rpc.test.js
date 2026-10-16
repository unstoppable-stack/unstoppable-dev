import { it } from 'node:test'
import assert from 'node:assert/strict'
import { Peer } from '../src/peer.js'
import { CapabilityRegistry } from '../src/capabilities.js'
import { DEFAULT_LIMITS } from '../src/limits.js'
import { defineCapability, procedure, createClient } from '../src/rpc.js'

const idSchema = value => {
  if (typeof value?.id !== 'string') throw new Error('Expected id')
  return { id: value.id }
}
const noteSchema = { parse (value) {
  if (typeof value?.id !== 'string' || typeof value?.text !== 'string') throw new Error('Expected note')
  return { id: value.id, text: value.text } // Strip server-private properties.
} }
function makePair (pack) {
  const nodes = [[], [pack]].map(packs => ({ limits: DEFAULT_LIMITS, capabilities: new CapabilityRegistry(packs), _activeRequests: 0, emit () {} }))
  const peers = nodes.map(node => new Peer({ node, remotePublicKey: 'a'.repeat(64) }))
  const frames = []
  peers.forEach((peer, index) => {
    peer.paired = true
    peer.grantsGiven = { notes: Object.keys(pack.methods) }
    peer.grantsReceived = { notes: Object.keys(pack.methods) }
    peer.capabilities = nodes[1 - index].capabilities.describe()
    peer.attachMessage({ send (frame) {
      // Mirror the production JSON wire boundary, including undefined handling.
      const encoded = JSON.stringify(frame)
      frames.push(JSON.parse(encoded))
      queueMicrotask(() => peers[1 - index].onmessage(JSON.parse(encoded)))
      return true
    } })
  })
  return { peer: peers[0], host: peers[1], frames }
}

it('binds real Promise/AsyncIterable methods with runtime validation and no retries', async () => {
  let calls = 0
  const pack = defineCapability({ name: 'notes', version: 1, methods: {
    get: procedure.input(idSchema).output(noteSchema).query(({ input, signal }) => {
      assert.equal(signal.aborted, false)
      calls++
      return { id: input.id, text: 'hello', secret: 'server-only' }
    }),
    watch: procedure.input(idSchema).output(noteSchema).stream(function * ({ input }) {
      yield { id: input.id, text: 'updated', secret: 'private' }
    })
  } })
  const { peer, frames } = makePair(pack)
  const client = peer.client(pack.contract)
  const result = client.get({ id: 'n1' })
  assert.ok(result instanceof Promise)
  assert.deepEqual(await result, { id: 'n1', text: 'hello' })
  assert.equal(calls, 1)
  const stream = client.watch({ id: 'n1' })
  assert.equal(stream.then, undefined)
  const chunks = []
  for await (const chunk of stream) chunks.push(chunk)
  assert.deepEqual(chunks, [{ id: 'n1', text: 'updated' }])
  assert.equal(JSON.stringify(frames).includes('server-only'), false)
  assert.equal(JSON.stringify(frames).includes('private'), false)
  // Even low-level consumers receive only the sanitized wire shape.
  assert.deepEqual(await peer.call('notes', 'get', { id: 'n1' }), { id: 'n1', text: 'hello' })
  await assert.rejects(() => client.get({ id: 1 }), { code: 'INVALID_INPUT' })
  assert.equal(calls, 2)
  assert.ok(Object.isFrozen(pack) && Object.isFrozen(pack.contract) && Object.isFrozen(client))
})

it('supports immutable builders, async Standard Schema and one input transformation', async () => {
  let parses = 0
  const schema = { '~standard': { version: 1, vendor: 'test', async validate (value) {
    parses++
    return typeof value === 'string' ? { value: Number(value) + 1 } : { issues: [{ message: 'string' }] }
  } } }
  const base = procedure.output(value => {
    if (typeof value !== 'number') throw new Error('number')
    return value
  })
  const pack = defineCapability({ name: 'notes', version: 1, methods: {
    get: base.input(schema).query(({ input }) => input),
    other: base.query(() => 4)
  } })
  const { peer } = makePair(pack)
  assert.equal(await peer.client(pack).get('4'), 5)
  assert.equal(parses, 1)
  assert.equal(await peer.client(pack).other({}), 4)
})

it('rejects invalid output, invalid stream chunks and non-idempotent output transforms', async () => {
  for (const method of ['get', 'watch', 'transform']) {
    const pack = defineCapability({ name: 'notes', version: 1, methods: {
      get: procedure.output(noteSchema).query(() => ({ id: 1 })),
      watch: procedure.output(noteSchema).stream(async function * () { yield { id: 'x', text: 4 } }),
      transform: procedure.output(value => value + 1).query(() => 1)
    } })
    const { peer } = makePair(pack)
    const client = peer.client(pack)
    if (method === 'watch') await assert.rejects(() => client.watch({}).next(), { code: 'INVALID_OUTPUT' })
    else await assert.rejects(() => client[method]({}), { code: 'INVALID_OUTPUT' })
  }
})

it('validates remote outputs on clients even when the host is untrusted', async () => {
  const pack = defineCapability({ name: 'notes', version: 1, methods: {
    get: procedure.output(noteSchema).query(() => ({})),
    watch: procedure.output(noteSchema).stream(async function * () {})
  } })
  const { peer } = makePair(pack)
  peer.call = async () => ({ id: 1 })
  peer.stream = async function * () { yield { id: 'x', text: false } }
  const client = createClient(peer, pack)
  await assert.rejects(() => client.get({}), { code: 'INVALID_OUTPUT' })
  await assert.rejects(() => client.watch({}).next(), { code: 'INVALID_OUTPUT' })
})

it('checks shared versions, methods and kinds before binding and versions again on dispatch', async () => {
  const pack = defineCapability({ name: 'notes', version: 1, methods: { get: procedure.query(() => 1) } })
  const { peer } = makePair(pack)
  const advertised = peer.capabilities.notes
  for (const descriptor of [{ ...advertised, version: 2 }, { ...advertised, methods: [] }, { ...advertised, methodKinds: { get: 'stream' } }]) {
    peer.capabilities.notes = descriptor
    assert.throws(() => peer.client(pack), { code: 'INCOMPATIBLE_CAPABILITY' })
  }
  peer.capabilities.notes = advertised
  assert.throws(() => peer.client({ name: 'notes', version: 1, methods: {} }), { code: 'INVALID_OPTION' })
  await assert.rejects(() => peer.call('notes', 'get', {}, { version: 2 }), { code: 'INCOMPATIBLE_CAPABILITY' })
  peer.capabilities.notes = { version: 1, methods: ['get'] } // legacy kind advertisement
  assert.equal(await peer.client(pack).get({}), 1)
})

it('cancels typed streams and runs generator cleanup', async () => {
  let cleaned = false
  const pack = defineCapability({ name: 'notes', version: 1, methods: {
    watch: procedure.stream(async function * ({ signal }) {
      try {
        yield 1
        if (!signal.aborted) await new Promise(resolve => signal.addEventListener('abort', resolve, { once: true }))
      } finally { cleaned = true }
    })
  } })
  const { peer } = makePair(pack)
  const controller = new AbortController()
  const iterator = peer.client(pack).watch({}, { signal: controller.signal })
  await iterator.next()
  controller.abort()
  await assert.rejects(() => iterator.next(), { code: 'CANCELLED' })
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(cleaned, true)
})

it('rejects invalid procedures and contracts at definition time', () => {
  assert.throws(() => procedure.input({}), { code: 'INVALID_OPTION' })
  assert.throws(() => procedure.query(null), { code: 'INVALID_OPTION' })
  assert.throws(() => defineCapability({ name: 'notes', version: 0, methods: {} }), { code: 'INVALID_OPTION' })
  assert.throws(() => defineCapability({ name: 'notes', version: 1, methods: { get () {} } }), { code: 'INVALID_OPTION' })
})

it('rejects typed outputs which JSON would silently change', async () => {
  const cycle = {}; cycle.self = cycle
  for (const output of [undefined, new Date(), new Map(), NaN, Infinity, 1n, { [Symbol('hidden')]: 1 }, { missing: undefined }, cycle]) {
    const pack = defineCapability({ name: 'notes', version: 1, methods: { get: procedure.query(() => output) } })
    const { peer } = makePair(pack)
    await assert.rejects(() => peer.client(pack).get(), { code: 'INVALID_OUTPUT' })
  }
})

it('binds partial grants without authorizing the rest of the contract', async () => {
  const pack = defineCapability({ name: 'notes', version: 1, methods: {
    get: procedure.query(() => 1), create: procedure.mutation(() => 2)
  } })
  const { peer, host } = makePair(pack)
  host.grantsGiven = { notes: ['get'] }
  peer.grantsReceived = { notes: ['get'] }
  const client = peer.client(pack)
  assert.equal(await client.get(), 1)
  await assert.rejects(() => client.create(), { code: 'NOT_GRANTED' })
})

it('reserves then and rejects malformed method kind advertisements', () => {
  assert.throws(() => defineCapability({ name: 'notes', version: 1, methods: { then: procedure.query(() => 1) } }), { code: 'INVALID_OPTION' })
  const pack = defineCapability({ name: 'notes', version: 1, methods: { get: procedure.query(() => 1) } })
  const { peer } = makePair(pack)
  for (const methodKinds of ['unary', [], {}, { get: null }, { get: 'bogus' }]) {
    peer.capabilities.notes.methodKinds = methodKinds
    assert.throws(() => peer.client(pack), { code: 'INCOMPATIBLE_CAPABILITY' })
  }
})

it('runs the typed API through real local Noise/Protomux transport', async () => {
  const { createTestEnv } = await import('./helpers.js')
  const env = await createTestEnv()
  try {
    const pack = defineCapability({ name: 'notes', version: 1, methods: {
      get: procedure.input(idSchema).output(noteSchema).query(({ input }) => ({ id: input.id, text: 'network' })),
      watch: procedure.stream(async function * () { yield 1; yield 2 })
    }, defaultGrants: ['get', 'watch'] })
    const host = await env.makeNode({ capabilities: [pack] })
    await host.listen()
    const client = await env.makeNode()
    const peer = await client.connect(host.publicKey)
    const api = peer.client(pack.contract)
    assert.deepEqual(await api.get({ id: 'n1' }), { id: 'n1', text: 'network' })
    const chunks = []
    for await (const value of api.watch()) chunks.push(value)
    assert.deepEqual(chunks, [1, 2])
  } finally { await env.cleanup() }
})

it('preserves nullable, optional and default inputs through real transport', async () => {
  const { createTestEnv } = await import('./helpers.js')
  const env = await createTestEnv()
  const nullable = value => {
    if (value !== null) throw new Error('Expected null')
    return value
  }
  const optional = value => {
    if (value !== undefined) throw new Error('Expected undefined')
    return value
  }
  const withDefault = value => value === undefined ? 'default' : value
  try {
    const methods = {}
    for (const [name, parser] of Object.entries({ nullable, optional, withDefault })) {
      methods[name] = procedure.input(parser).query(({ input }) => input === undefined ? 'omitted' : input)
      methods[`${name}Stream`] = procedure.input(parser).stream(function * ({ input }) {
        yield input === undefined ? 'omitted' : input
      })
    }
    const pack = defineCapability({ name: 'notes', version: 1, methods, defaultGrants: Object.keys(methods) })
    const host = await env.makeNode({ capabilities: [pack] })
    await host.listen()
    const caller = await env.makeNode()
    const peer = await caller.connect(host.publicKey)
    const api = peer.client(pack)
    for (const [name, input, expected] of [
      ['nullable', null, null], ['optional', undefined, 'omitted'], ['withDefault', undefined, 'default']
    ]) {
      assert.equal(await api[name](input), expected)
      const chunks = []
      for await (const chunk of api[`${name}Stream`](input)) chunks.push(chunk)
      assert.deepEqual(chunks, [expected])
    }
    assert.equal(await api.optional(), 'omitted')
    assert.equal(await api.withDefault(), 'default')
    // Legacy callers and packs keep their established empty-object default.
    let legacyInput
    const legacyHost = await env.makeNode({ capabilities: [{
      name: 'legacy', methods: { get: params => { legacyInput = params; return true } }, defaultGrants: ['get']
    }] })
    await legacyHost.listen()
    const legacyPeer = await caller.connect(legacyHost.publicKey)
    await legacyPeer.call('legacy', 'get')
    assert.deepEqual(legacyInput, {})
    await legacyPeer.call('legacy', 'get', null)
    assert.deepEqual(legacyInput, {})
  } finally { await env.cleanup() }
})
