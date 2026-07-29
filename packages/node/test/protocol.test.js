import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import b4a from 'b4a'
import { localDiscoveryTopic, parseMessages, encodeMessage, buildCapabilities, requestedCapabilityGrants } from '../src/protocol.js'

describe('protocol', () => {
  describe('localDiscoveryTopic', () => {
    it('returns a 32-byte buffer', () => {
      const topic = localDiscoveryTopic()
      assert.ok(Buffer.isBuffer(topic) || b4a.isBuffer(topic))
      assert.equal(topic.length, 32)
    })

    it('returns consistent results', () => {
      const a = localDiscoveryTopic()
      const b = localDiscoveryTopic()
      assert.deepEqual(a, b)
    })
  })

  describe('encodeMessage', () => {
    it('encodes to newline-terminated JSON buffer', () => {
      const msg = { type: 'hello', data: 42 }
      const encoded = encodeMessage(msg)
      assert.ok(b4a.isBuffer(encoded))
      const str = b4a.toString(encoded)
      assert.ok(str.endsWith('\n'))
      assert.deepEqual(JSON.parse(str.trim()), msg)
    })

    it('handles nested objects', () => {
      const msg = { type: 'register', cores: [{ key: 'abc', name: 'data' }] }
      const encoded = encodeMessage(msg)
      const decoded = JSON.parse(b4a.toString(encoded).trim())
      assert.deepEqual(decoded, msg)
    })
  })

  describe('parseMessages', () => {
    it('parses single NDJSON line', () => {
      const data = b4a.from('{"type":"hello"}\n')
      const msgs = parseMessages(data)
      assert.equal(msgs.length, 1)
      assert.deepEqual(msgs[0], { type: 'hello' })
    })

    it('parses multiple NDJSON lines', () => {
      const data = b4a.from('{"type":"a"}\n{"type":"b"}\n')
      const msgs = parseMessages(data)
      assert.equal(msgs.length, 2)
      assert.equal(msgs[0].type, 'a')
      assert.equal(msgs[1].type, 'b')
    })

    it('returns empty array for invalid data', () => {
      const msgs = parseMessages(b4a.from('not json'))
      assert.deepEqual(msgs, [])
    })
  })

  describe('requestedCapabilityGrants', () => {
    it('grants only requested methods that are currently available', () => {
      const grants = requestedCapabilityGrants(buildCapabilities({ data: true, files: true, ai: true }), {
        resources: ['register', 'peek', 'not-real'],
        ai: ['completion.stream'],
        config: ['update']
      })
      assert.deepEqual(grants.resources, ['register', 'peek'])
      assert.deepEqual(grants.ai, ['completion.stream'])
      assert.deepEqual(grants.config, [])
      assert.deepEqual(grants.storage, [])
    })
  })
})
