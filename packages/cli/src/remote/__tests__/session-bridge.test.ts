import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { EventEmitter } from 'events'
import { SessionBridge } from '../session-bridge.js'
import { encode } from '../protocol.js'
import { MSG } from '../types.js'

describe('SessionBridge', () => {
  it('generates a unique hex id', () => {
    const a = new SessionBridge('echo', ['hello'])
    const b = new SessionBridge('echo', ['world'])
    expect(a.id).toMatch(/^[a-f0-9]{16}$/)
    expect(a.id).not.toBe(b.id)
  })

  it('stores command and args', () => {
    const bridge = new SessionBridge('claude', ['--model', 'opus'])
    expect(bridge.command).toBe('claude')
    expect(bridge.args).toEqual(['--model', 'opus'])
  })

  describe('getInfo', () => {
    it('returns session metadata', () => {
      const bridge = new SessionBridge('opencode', [])
      const info = bridge.getInfo()
      expect(info.id).toBe(bridge.id)
      expect(info.command).toBe('opencode ')
      expect(info.peers).toBe(0)
    })
  })

  describe('addPeer', () => {
    it('sends session info to new peer', () => {
      const bridge = new SessionBridge('echo', ['test'])
      const mockStream = new EventEmitter() as any
      mockStream.write = vi.fn()
      mockStream.destroy = vi.fn()

      bridge.addPeer('peer1', mockStream)

      expect(mockStream.write).toHaveBeenCalledTimes(1)
      const written = mockStream.write.mock.calls[0][0]
      const msg = JSON.parse(written.toString().trim())
      expect(msg.type).toBe(MSG.SESSION_INFO)
      expect(msg.payload.sessionId).toBe(bridge.id)
    })

    it('removes peer on stream close', () => {
      const bridge = new SessionBridge('echo', ['test'])
      const mockStream = new EventEmitter() as any
      mockStream.write = vi.fn()
      mockStream.destroy = vi.fn()

      bridge.addPeer('peer1', mockStream)
      expect(bridge.getInfo().peers).toBe(1)

      mockStream.emit('close')
      expect(bridge.getInfo().peers).toBe(0)
    })

    it('removes peer on stream error', () => {
      const bridge = new SessionBridge('echo', ['test'])
      const mockStream = new EventEmitter() as any
      mockStream.write = vi.fn()
      mockStream.destroy = vi.fn()

      bridge.addPeer('peer1', mockStream)
      mockStream.emit('error', new Error('connection lost'))
      expect(bridge.getInfo().peers).toBe(0)
    })
  })

  describe('destroy', () => {
    it('destroys all peer streams', () => {
      const bridge = new SessionBridge('echo', ['test'])
      const mockStream = new EventEmitter() as any
      mockStream.write = vi.fn()
      mockStream.destroy = vi.fn()

      bridge.addPeer('peer1', mockStream)
      bridge.destroy()

      expect(mockStream.destroy).toHaveBeenCalled()
      expect(bridge.getInfo().peers).toBe(0)
    })
  })
})
