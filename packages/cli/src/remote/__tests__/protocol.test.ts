import { describe, it, expect, vi } from 'vitest'
import { encode, createMessageParser } from '../protocol.js'
import { PROTOCOL_VERSION } from '../types.js'

describe('protocol', () => {
  describe('encode', () => {
    it('produces a newline-terminated JSON buffer', () => {
      const buf = encode('test:msg', { foo: 'bar' })
      const str = buf.toString()
      expect(str.endsWith('\n')).toBe(true)
      const parsed = JSON.parse(str.trim())
      expect(parsed).toEqual({
        type: 'test:msg',
        version: PROTOCOL_VERSION,
        payload: { foo: 'bar' },
      })
    })

    it('defaults to empty payload', () => {
      const buf = encode('heartbeat')
      const parsed = JSON.parse(buf.toString().trim())
      expect(parsed.payload).toEqual({})
    })

    it('includes the current protocol version', () => {
      const parsed = JSON.parse(encode('x').toString().trim())
      expect(parsed.version).toBe(1)
    })
  })

  describe('createMessageParser', () => {
    it('parses a single complete message', () => {
      const handler = vi.fn()
      const parser = createMessageParser(handler)

      parser(encode('session:output', { data: 'hello' }))

      expect(handler).toHaveBeenCalledTimes(1)
      expect(handler).toHaveBeenCalledWith({
        type: 'session:output',
        version: PROTOCOL_VERSION,
        payload: { data: 'hello' },
      })
    })

    it('handles multiple messages in one chunk', () => {
      const handler = vi.fn()
      const parser = createMessageParser(handler)

      const combined = Buffer.concat([
        encode('msg:a', { n: 1 }),
        encode('msg:b', { n: 2 }),
        encode('msg:c', { n: 3 }),
      ])
      parser(combined)

      expect(handler).toHaveBeenCalledTimes(3)
      expect(handler.mock.calls[0][0].type).toBe('msg:a')
      expect(handler.mock.calls[1][0].type).toBe('msg:b')
      expect(handler.mock.calls[2][0].type).toBe('msg:c')
    })

    it('handles messages split across chunks', () => {
      const handler = vi.fn()
      const parser = createMessageParser(handler)

      const full = encode('split:test', { value: 42 })
      const str = full.toString()
      const mid = Math.floor(str.length / 2)

      parser(Buffer.from(str.slice(0, mid)))
      expect(handler).not.toHaveBeenCalled()

      parser(Buffer.from(str.slice(mid)))
      expect(handler).toHaveBeenCalledTimes(1)
      expect(handler.mock.calls[0][0].payload.value).toBe(42)
    })

    it('skips malformed JSON lines', () => {
      const handler = vi.fn()
      const parser = createMessageParser(handler)

      parser(Buffer.from('not valid json\n'))
      expect(handler).not.toHaveBeenCalled()
    })

    it('skips messages without type or version', () => {
      const handler = vi.fn()
      const parser = createMessageParser(handler)

      parser(Buffer.from(JSON.stringify({ foo: 'bar' }) + '\n'))
      expect(handler).not.toHaveBeenCalled()

      parser(Buffer.from(JSON.stringify({ type: 'x' }) + '\n'))
      expect(handler).not.toHaveBeenCalled()
    })

    it('skips empty lines', () => {
      const handler = vi.fn()
      const parser = createMessageParser(handler)

      parser(Buffer.from('\n\n\n'))
      expect(handler).not.toHaveBeenCalled()
    })

    it('handles rapid sequential chunks correctly', () => {
      const handler = vi.fn()
      const parser = createMessageParser(handler)

      for (let i = 0; i < 50; i++) {
        parser(encode('rapid', { i }))
      }
      expect(handler).toHaveBeenCalledTimes(50)
    })
  })
})
