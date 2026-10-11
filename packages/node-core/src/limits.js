import b4a from 'b4a'
import c from 'compact-encoding'
import { InvalidOptionError, NodeError } from './errors.js'

export const DEFAULT_LIMITS = Object.freeze({
  maxPeers: 128,
  maxFrameBytes: 256 * 1024,
  maxRequestsPerPeer: 8,
  maxRequests: 64,
  requestTimeoutMs: 120_000,
  maxBufferedChunks: 64,
  maxBufferedBytes: 1024 * 1024,
  maxStreamBytes: 1024 * 1024
})

export function normalizeLimits (opts = {}) {
  const limits = { ...DEFAULT_LIMITS, ...opts }
  for (const [key, value] of Object.entries(limits)) {
    if (!Object.hasOwn(DEFAULT_LIMITS, key) || !Number.isSafeInteger(value) || value < 1) {
      throw new InvalidOptionError(`limits.${key} must be a positive safe integer`)
    }
  }
  return limits
}

export function resourceError (message) { return new NodeError('RESOURCE_LIMIT', message) }
export function jsonBytes (value) { return b4a.byteLength(JSON.stringify(value)) }

// Check the encoded frame before JSON parsing, not after allocating its object.
export function boundedJson (maxBytes) {
  return {
    preencode (state, value) {
      const start = state.end
      c.json.preencode(state, value)
      if (state.end - start > maxBytes) throw resourceError('Control frame exceeds byte limit')
    },
    encode: c.json.encode,
    decode (state) {
      if (state.end - state.start > maxBytes) throw resourceError('Control frame exceeds byte limit')
      return c.json.decode(state)
    }
  }
}
