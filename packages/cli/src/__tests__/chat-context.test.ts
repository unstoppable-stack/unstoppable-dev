import { describe, expect, it } from 'vitest'
import { Buffer } from 'node:buffer'
import { chatContextSource } from '../generators/chat-context.js'

const { prepareChatHistory, streamChat } = new Function('b4a',
  chatContextSource.replace("import b4a from 'b4a'", '').replaceAll('export ', '') + '\nreturn { prepareChatHistory, streamChat }',
)({ byteLength: Buffer.byteLength })
const collect = async (tokens: AsyncIterable<string>) => {
  const output = []
  for await (const token of tokens) output.push(token)
  return output.join('')
}

describe('generated chat context', () => {
  it('drops whole old turns without changing the latest message or original history', () => {
    const history = [{ role: 'user', content: 'old'.repeat(50) }, { role: 'assistant', content: 'reply' }, { role: 'user', content: 'new' }]
    expect(prepareChatHistory(history, 80)).toEqual(history.slice(-1))
    expect(history).toHaveLength(3)
  })
  it('rejects an oversized Unicode request by UTF-8 size instead of silently truncating it', () => {
    expect(() => prepareChatHistory([{ role: 'user', content: '☕'.repeat(20) }], 80)).toThrow('Shorten it')
    expect(() => prepareChatHistory([], 80)).toThrow('Chat history')
  })
  it('retries an SDK overflow once with only the latest user message and signals context loss', async () => {
    const calls: any[] = []
    let notices = 0
    const sdk = { completion: (args: any) => {
      calls.push(args)
      return { tokenStream: (async function* () {
        if (calls.length === 1) throw Object.assign(new Error('full'), { name: 'ContextOverflowError' })
        yield 'ready'
      })() }
    } }
    const history = [{ role: 'user', content: 'old' }, { role: 'assistant', content: 'reply' }, { role: 'user', content: 'new' }]
    expect(await collect(streamChat(sdk, 'model', history, 2048, () => notices++))).toBe('ready')
    expect(calls[1].history).toEqual(history.slice(-1))
    expect(notices).toBe(1)
  })
  it('does not replay a partially streamed answer or retry unrelated errors', async () => {
    let calls = 0
    const sdk = { completion: () => { calls++; return { tokenStream: (async function* () {
      yield 'partial'
      throw Object.assign(new Error('full'), { name: 'ContextOverflowError' })
    })() } } }
    await expect(collect(streamChat(sdk, 'model', [{ role: 'user', content: 'old' }, { role: 'user', content: 'new' }], 2048))).rejects.toThrow('full')
    expect(calls).toBe(1)
  })
  it('does not loop when the latest message alone overflows the model', async () => {
    let calls = 0
    const sdk = { completion: () => { calls++; throw Object.assign(new Error('full'), { name: 'ContextOverflowError' }) } }
    await expect(collect(streamChat(sdk, 'model', [{ role: 'user', content: 'new' }], 2048))).rejects.toThrow('full')
    expect(calls).toBe(1)
  })
})
