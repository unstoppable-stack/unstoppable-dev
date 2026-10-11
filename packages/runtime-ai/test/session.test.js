import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createAISession, createMockAdapter, createNodeAdapter, prepareChatHistory, streamChat } from '../src/index.js'

const message = content => [{ role: 'user', content }]
async function collect(tokens) { let result = ''; for await (const token of tokens) result += token; return result }
function deferred() { let resolve; const promise = new Promise(r => { resolve = r }); return { promise, resolve } }
function controlledAdapter() {
  let waiting = null
  const calls = []
  const entered = deferred()
  return {
    calls, entered,
    async load() { calls.push('load'); return 'model' },
    async *stream() {
      calls.push('stream')
      yield 'first'
      waiting = deferred()
      entered.resolve()
      await waiting.promise
      yield 'late'
    },
    async cancel() { calls.push('cancel'); waiting?.resolve() },
    async unload() { calls.push('unload') },
  }
}

test('lazy adapter maps profile options and native cancel without importing a host SDK at construction', async () => {
  const calls = []
  const engine = {
    MODEL: '/model',
    async loadModel(args) { calls.push(args); return 'model' },
    completion(args) { calls.push(args); return { tokenStream: (async function* () { yield 'answer' })() } },
    async cancel(args) { calls.push(args) },
    async unloadModel(args) { calls.push(args) },
  }
  const adapter = createNodeAdapter({ loadEngine: async () => { calls.push('import'); return engine } })
  assert.equal(calls.length, 0)
  await adapter.load({ modelConstant: 'MODEL', modelConfig: { ctx_size: 4096 } })
  assert.deepEqual(calls[1], { modelSrc: '/model', modelConfig: { ctx_size: 4096 } })
  assert.equal(await collect(adapter.stream('model', message('hi'))), 'answer')
  await adapter.cancel('model')
  assert.deepEqual(calls.at(-1), { operation: 'inference', modelId: 'model' })
})

test('load deduplicates, retries failures and unloads once on close', async () => {
  let loads = 0; let unloads = 0
  const adapter = { async load() { if (++loads === 1) throw new Error('missing addon'); return 'model' }, async unload() { unloads++ } }
  const ai = createAISession({ adapter })
  await assert.rejects(ai.load(), { code: 'LOAD_FAILED' })
  assert.equal(ai.state, 'error')
  assert.deepEqual(await Promise.all([ai.load(), ai.load()]), ['model', 'model'])
  assert.equal(loads, 2)
  await Promise.all([ai.close(), ai.close()])
  assert.equal(unloads, 1)
  await assert.rejects(ai.load(), { code: 'CLOSED' })
})

test('abort wakes native inference, suppresses late tokens, holds busy until settlement and allows reuse', async () => {
  const adapter = controlledAdapter(); const ai = createAISession({ adapter }); await ai.load()
  const abort = new AbortController()
  const iterator = ai.stream(message('hello'), { requestId: 1, signal: abort.signal })[Symbol.asyncIterator]()
  assert.equal((await iterator.next()).value, 'first')
  const pending = iterator.next()
  await adapter.entered.promise
  await assert.rejects(collect(ai.stream(message('other'), { requestId: 2 })), { code: 'BUSY' })
  abort.abort()
  assert.equal((await pending).done, true)
  assert.equal(ai.state, 'ready')
  assert.equal(adapter.calls.filter(c => c === 'cancel').length, 1)
  // A second real adapter operation can start after cancellation settlement.
  const next = ai.stream(message('again'), { requestId: 3 })[Symbol.asyncIterator]()
  assert.equal((await next.next()).value, 'first')
  await next.return()
  await ai.close()
})

test('a stale cancel does not stop the active request; breaking consumption cancels native work', async () => {
  const adapter = controlledAdapter(); const ai = createAISession({ adapter }); await ai.load()
  for await (const token of ai.stream(message('hello'), { requestId: 1 })) {
    assert.equal(token, 'first')
    assert.equal(await ai.cancel(99), false)
    break
  }
  assert.deepEqual(adapter.calls, ['load', 'stream', 'cancel'])
  assert.equal(ai.state, 'ready')
  await ai.close()
})

test('close during active inference waits for native cancel before unloading', async () => {
  const adapter = controlledAdapter(); const ai = createAISession({ adapter }); await ai.load()
  const iterator = ai.stream(message('hello'), { requestId: 1 })[Symbol.asyncIterator]()
  await iterator.next()
  const pending = iterator.next(); await adapter.entered.promise
  await ai.close()
  assert.equal((await pending).done, true)
  assert.deepEqual(adapter.calls, ['load', 'stream', 'cancel', 'unload'])
  assert.equal(ai.state, 'closed')
})

test('close while loading unloads the loaded model; it cannot be revived', async () => {
  const loading = deferred(); const calls = []
  const ai = createAISession({ adapter: { load: () => loading.promise, async unload(id) { calls.push(id) } } })
  const started = ai.load(); const closed = ai.close()
  loading.resolve('model'); await started; await closed
  assert.deepEqual(calls, ['model'])
  await assert.rejects(ai.load(), { code: 'CLOSED' })
})

test('failed native cancellation is reported instead of claiming successful Stop', async () => {
  const ai = createAISession({ adapter: { ...createMockAdapter({ delay: 0 }), async cancel() { throw new Error('engine cannot cancel') } } })
  await ai.load()
  const iterator = ai.stream(message('hi'), { requestId: 1 })[Symbol.asyncIterator]()
  await iterator.next()
  await assert.rejects(iterator.return(), { code: 'CANCEL_FAILED' })
  assert.equal(ai.lastError.code, 'CANCEL_FAILED')
})

test('history preserves latest Unicode content and drops whole turns without mutating caller data', () => {
  const history = [...message('old'.repeat(50)), { role: 'assistant', content: 'reply' }, ...message('☕')]
  assert.deepEqual(prepareChatHistory(history, 80), message('☕'))
  assert.equal(history.length, 3)
  assert.throws(() => prepareChatHistory(message('☕'.repeat(20)), 80), /Shorten it/)
  assert.throws(() => prepareChatHistory(message('hi'), NaN), /budget/)
})

test('overflow recovery retries only before output, with latest message, and announces trimming', async () => {
  const calls = []; let notices = 0
  const adapter = { async *stream(_id, history) { calls.push(history); if (calls.length === 1) throw Object.assign(new Error('full'), { name: 'ContextOverflowError' }); yield 'ok' } }
  assert.equal(await collect(streamChat(adapter, 'model', [...message('old'), ...message('new')], 2048, () => notices++)), 'ok')
  assert.deepEqual(calls[1], message('new')); assert.equal(notices, 1)
  calls.length = 0
  adapter.stream = async function* () { calls.push(true); yield 'partial'; throw Object.assign(new Error('full'), { name: 'ContextOverflowError' }) }
  await assert.rejects(collect(streamChat(adapter, 'model', [...message('old'), ...message('new')], 2048)), /full/)
  assert.equal(calls.length, 1)
})

test('oversized and pre-aborted requests leave the session usable and mock output identified', async () => {
  const ai = createAISession({ adapter: createMockAdapter({ delay: 0 }), byteBudget: 80 }); await ai.load()
  await assert.rejects(collect(ai.stream(message('☕'.repeat(20)), { requestId: 1 })), /Shorten it/)
  const abort = new AbortController(); abort.abort()
  await assert.rejects(collect(ai.stream(message('hi'), { requestId: 2, signal: abort.signal })), { code: 'ABORTED' })
  assert.equal(await collect(ai.stream(message('again'), { requestId: 3 })), 'Mock: again')
  await ai.close()
})
