import { it } from 'node:test'
import assert from 'node:assert/strict'
import { AIProvider } from '../src/ai/provider.js'

function provider (sdk) {
  const p = new AIProvider()
  p._qvac = sdk
  p._ready = true
  p.modelId = 'owned-model'
  return p
}
const request = { messages: [{ role: 'user', content: 'hello' }] }

it('cancels an unfinished native request on early return and reuses the provider', async () => {
  const cancellations = []
  const p = provider({
    completion () { return { requestId: 'native-request', events: (async function * () { yield { type: 'contentDelta', text: 'first' }; yield { type: 'contentDelta', text: 'second' } })() } },
    async cancel (args) { cancellations.push(args) }
  })
  for await (const _token of p.runStreaming(request)) break
  assert.deepEqual(cancellations, [{ requestId: 'native-request' }])
  let text = ''
  for await (const token of p.runStreaming(request)) text += token
  assert.equal(text, 'firstsecond')
  assert.equal(cancellations.length, 1, 'natural completion must not cancel')
})

it('peer abort cancels native work even while waiting for the first token', async () => {
  let release
  const stopped = new Promise(resolve => { release = resolve })
  let calls = 0
  const p = provider({
    completion () { return { requestId: 'waiting', events: (async function * () { await stopped; yield { type: 'completionDone', stopReason: 'cancelled' } })() } },
    async cancel () { calls++; release() }
  })
  const controller = new AbortController()
  const iterator = p.runStreaming({ ...request, signal: controller.signal })
  const next = iterator.next()
  controller.abort()
  assert.equal((await next).done, true)
  assert.equal(calls, 1)
  assert.equal(p._active, false)
})

it('rejects overlapping work without cancelling another peer’s request', async () => {
  let cancellations = 0
  const p = provider({
    completion () { return { requestId: 'active', events: (async function * () { yield { type: 'contentDelta', text: 'hello' } })() } },
    async cancel () { cancellations++ }
  })
  const first = p.runStreaming(request)
  await first.next()
  await assert.rejects(p.runStreaming(request).next(), /busy/)
  assert.equal(cancellations, 0)
  await first.return()
  assert.equal(cancellations, 1)
})

it('propagates native terminal errors instead of reporting a successful empty stream', async () => {
  const p = provider({
    completion () { return { events: (async function * () { yield { type: 'completionDone', stopReason: 'error', error: { message: 'context overflow' } } })() } },
    async cancel () { throw new Error('completed request must not be cancelled') }
  })
  await assert.rejects(p.runStreaming(request).next(), /context overflow/)
  assert.equal(p._active, false)
})
