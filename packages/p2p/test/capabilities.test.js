import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { CapabilityRegistry, isAsyncGeneratorFunction, validatePack } from '../src/capabilities.js'

const pack = {
  name: 'notes',
  version: 2,
  methods: {
    search: async () => ({ hits: [] }),
    watch: async function * () { yield 1 }
  },
  defaultGrants: ['search']
}

describe('capability registry', () => {
  it('detects streaming handlers by async generator', () => {
    assert.equal(isAsyncGeneratorFunction(pack.methods.watch), true)
    assert.equal(isAsyncGeneratorFunction(pack.methods.search), false)
  })

  it('describes packs for the handshake', () => {
    const registry = new CapabilityRegistry([pack])
    assert.deepEqual(registry.describe(), { notes: { version: 2, methods: ['search', 'watch'] } })
  })

  it('resolves methods and flags streaming', () => {
    const registry = new CapabilityRegistry([pack])
    assert.equal(registry.resolve('notes', 'watch').streaming, true)
    assert.equal(registry.resolve('notes', 'search').streaming, false)
  })

  it('throws typed errors for unknown capability and method', () => {
    const registry = new CapabilityRegistry([pack])
    assert.throws(() => registry.resolve('nope', 'x'), { code: 'UNKNOWN_CAPABILITY' })
    assert.throws(() => registry.resolve('notes', 'nope'), { code: 'UNKNOWN_METHOD' })
  })

  it('falls back to pack defaults when nothing is requested', () => {
    const registry = new CapabilityRegistry([pack])
    assert.deepEqual(registry.grantsFor(null), { notes: ['search'] })
  })

  it('grants only the intersection of requested and hosted methods', () => {
    const registry = new CapabilityRegistry([pack])
    assert.deepEqual(
      registry.grantsFor({ notes: ['search', 'watch', 'invented'], ghost: ['x'] }),
      { notes: ['search', 'watch'] }
    )
  })

  it('rejects malformed packs', () => {
    assert.throws(() => validatePack({ name: 'Notes', methods: {} }), { code: 'INVALID_OPTION' })
    assert.throws(() => validatePack({ name: 'notes' }), { code: 'INVALID_OPTION' })
    assert.throws(() => validatePack({ name: 'notes', methods: { a: 1 } }), { code: 'INVALID_OPTION' })
    assert.throws(
      () => validatePack({ name: 'notes', methods: {}, defaultGrants: ['ghost'] }),
      { code: 'INVALID_OPTION' }
    )
  })

  it('refuses duplicate capability names', () => {
    const registry = new CapabilityRegistry([pack])
    assert.throws(() => registry.add(pack), { code: 'INVALID_OPTION' })
  })
})
