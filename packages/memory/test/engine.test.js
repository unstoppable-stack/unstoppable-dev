import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { MemoryEngine } from '../src/engine.js'

describe('MemoryEngine', () => {
  let dir
  let engine

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'unstoppable-memory-'))
    engine = new MemoryEngine(dir)
    await engine.ready()
  })

  afterEach(async () => {
    await engine.close()
    await rm(dir, { recursive: true, force: true })
  })

  it('creates a raw document and immediately searchable memory', async () => {
    const result = await engine.add({
      content: 'Simon prefers concise engineering updates and uses TypeScript.',
      customId: 'conv-1',
      containerTag: 'project:unstoppable',
      metadata: { source: 'test' }
    })

    assert.equal(result.status, 'done')
    assert.equal(result.memories.length, 1)
    assert.equal(result.memories[0].memory, 'Simon prefers concise engineering updates and uses TypeScript.')

    const search = await engine.search({
      query: 'TypeScript preferences',
      containerTag: 'project:unstoppable',
      searchMode: 'memories'
    })

    assert.equal(search.total, 1)
    assert.equal(search.results[0].id, result.memories[0].id)
    assert.equal(search.results[0].memory, 'Simon prefers concise engineering updates and uses TypeScript.')
    assert.ok(search.results[0].similarity > 0)
  })

  it('updates a custom document without duplicating the document record', async () => {
    const first = await engine.add({
      content: 'The memory app starts with keyword search.',
      customId: 'design-note',
      containerTag: 'project:memory'
    })
    const second = await engine.add({
      content: 'The memory app starts with keyword search and later adds embeddings.',
      customId: 'design-note',
      containerTag: 'project:memory'
    })

    assert.equal(second.documentId, first.documentId)

    const documents = await engine.listDocuments({ containerTag: 'project:memory' })
    assert.equal(documents.length, 1)
    assert.equal(documents[0].customId, 'design-note')
    assert.equal(documents[0].version, 2)
  })

  it('marks old memories from an updated custom document as not latest', async () => {
    await engine.add({
      content: 'The memory app only supports keyword search.',
      customId: 'design-note',
      containerTag: 'project:memory'
    })
    await engine.add({
      content: 'The memory app supports keyword search now and embeddings later.',
      customId: 'design-note',
      containerTag: 'project:memory'
    })

    const search = await engine.search({
      query: 'keyword search embeddings',
      containerTag: 'project:memory',
      searchMode: 'memories'
    })

    assert.equal(search.total, 1)
    assert.equal(search.results[0].memory, 'The memory app supports keyword search now and embeddings later.')
  })

  it('soft-forgets matching memories and excludes them from search', async () => {
    await engine.add({
      content: 'The user prefers Puma sneakers now.',
      containerTag: 'user:simon'
    })

    const forget = await engine.forget({
      content: 'prefers Puma sneakers',
      containerTag: 'user:simon'
    })
    assert.equal(forget.forgotten, true)

    const search = await engine.search({
      query: 'sneaker preference',
      containerTag: 'user:simon'
    })
    assert.equal(search.total, 0)
  })

  it('builds a compact profile from static and recent memories', async () => {
    await engine.createMemories({
      containerTag: 'user:simon',
      memories: [
        { content: 'Simon is a software engineer.', isStatic: true },
        { content: 'Simon is currently designing Unstoppable Memory.', isStatic: false }
      ]
    })

    const profile = await engine.profile({ containerTag: 'user:simon' })

    assert.deepEqual(profile.profile.static, ['Simon is a software engineer.'])
    assert.deepEqual(profile.profile.dynamic, ['Simon is currently designing Unstoppable Memory.'])
  })

  it('returns core descriptors that can be registered with Unstoppable Node', async () => {
    const descriptors = await engine.getNodeRegistration()

    assert.equal(descriptors.appId, 'unstoppable-memory')
    assert.equal(descriptors.appName, 'Unstoppable Memory')
    assert.equal(descriptors.cores.length, 1)
    assert.equal(descriptors.cores[0].type, 'hyperbee')
    assert.equal(descriptors.cores[0].name, 'memory-store')
    assert.match(descriptors.cores[0].key, /^[0-9a-f]+$/)
  })
})
