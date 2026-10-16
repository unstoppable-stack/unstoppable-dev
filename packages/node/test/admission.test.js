import { it } from 'node:test'
import assert from 'node:assert/strict'
import { aiPack } from '../src/ai/index.js'

function context () { return { peer: { remotePublicKey: 'test-peer' }, signal: new AbortController().signal } }
async function packFor (runStreaming) {
  const pack = aiPack({ provider: { isReady: true, runStreaming, async close () {} } })
  await pack.onAttach({ emit () {} })
  return pack
}
async function drain (iterator) { for await (const token of iterator) { /* consume */ } }

it('rejects oversized UTF-8 prompts and message count before invoking inference', async () => {
  let calls = 0
  const pack = await packFor(async function * () { calls++; yield 'bad' })
  const run = messages => drain(pack.methods['completion.stream']({ messages }, context()))
  await assert.rejects(() => run([{ role: 'user', content: '💻'.repeat(17000) }]), { code: 'RESOURCE_LIMIT' })
  await assert.rejects(() => run(Array.from({ length: 65 }, () => ({ role: 'user', content: 'x' }))), { code: 'RESOURCE_LIMIT' })
  assert.equal(calls, 0)
})

it('limits output and releases admission after iterator cleanup', async () => {
  let oversized = true
  const pack = await packFor(async function * () { yield oversized ? 'x'.repeat(256 * 1024 + 1) : 'ok' })
  const run = () => drain(pack.methods['completion.stream']({ messages: [{ role: 'user', content: 'hi' }] }, context()))
  await assert.rejects(run, { code: 'RESOURCE_LIMIT' })
  oversized = false
  await run()
})

it('enforces one completion even for custom/mock providers and refuses before starting overlap', async () => {
  let calls = 0
  const pack = await packFor(async function * () { calls++; yield 'first'; yield 'last' })
  const params = { messages: [{ role: 'user', content: 'hi' }] }
  const first = pack.methods['completion.stream'](params, context())
  await first.next()
  await assert.rejects(() => drain(pack.methods['completion.stream'](params, context())), { code: 'RESOURCE_LIMIT' })
  assert.equal(calls, 1)
  await first.return()
  await drain(pack.methods['completion.stream'](params, context()))
  assert.equal(calls, 2)
})

it('aborts timed-out inference before its first token and reports the host deadline', async (t) => {
  const pack = await packFor(async function * ({ signal }) {
    await new Promise(resolve => signal.addEventListener('abort', resolve, { once: true }))
  })
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const iterator = pack.methods['completion.stream']({ messages: [{ role: 'user', content: 'hi' }] }, context())
  const rejected = assert.rejects(() => iterator.next(), { code: 'REQUEST_TIMEOUT' })
  t.mock.timers.tick(60_000)
  await rejected
})
