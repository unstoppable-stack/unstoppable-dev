import Corestore from 'corestore'
import Hyperbee from 'hyperbee'
import b4a from 'b4a'
import { createHash } from 'node:crypto'

const DEFAULT_CONTAINER = 'default'
const DEFAULT_APP_ID = 'unstoppable-memory'
const DEFAULT_APP_NAME = 'Unstoppable Memory'

export class MemoryEngine {
  constructor (storagePath, opts = {}) {
    if (!storagePath) throw new Error('MemoryEngine requires a storage path')
    this.storagePath = storagePath
    this.appId = opts.appId || DEFAULT_APP_ID
    this.appName = opts.appName || DEFAULT_APP_NAME
    this.store = opts.store || new Corestore(storagePath)
    this.core = null
    this.bee = null
  }

  async ready () {
    await this.store.ready()
    this.core = this.store.get({ name: 'memory-store' })
    await this.core.ready()
    this.bee = new Hyperbee(this.core, {
      keyEncoding: 'utf-8',
      valueEncoding: 'json'
    })
    await this.bee.ready()
  }

  async add ({ content, customId, containerTag = DEFAULT_CONTAINER, metadata = {}, sourceType = 'text' }) {
    assertContent(content)
    const now = new Date().toISOString()
    const existing = customId ? await this.getDocumentByCustomId({ customId, containerTag }) : null
    const documentId = existing?.id || idFor('doc', `${containerTag}:${customId || content}:${now}`)
    const documentRecord = {
      id: documentId,
      customId: customId || null,
      containerTag,
      contentHash: sha256(content),
      content,
      sourceType,
      metadata,
      status: 'done',
      version: existing ? existing.version + 1 : 1,
      createdAt: existing?.createdAt || now,
      updatedAt: now
    }

    await this.bee.put(documentKey(documentId), documentRecord)
    if (customId) await this.bee.put(customDocumentKey(containerTag, customId), documentId)
    if (existing) await this._markDocumentMemoriesNotLatest({ documentId, containerTag, now })

    const memory = await this._createMemory({
      content,
      containerTag,
      documentId,
      metadata,
      isStatic: false,
      now
    })

    return {
      id: documentId,
      documentId,
      status: 'done',
      memories: [memory]
    }
  }

  async createMemories ({ memories = [], containerTag = DEFAULT_CONTAINER, documentId = null }) {
    if (!Array.isArray(memories) || memories.length === 0) throw new Error('memories must be a non-empty array')
    const now = new Date().toISOString()
    const sourceDocumentId = documentId || idFor('doc', `${containerTag}:direct:${now}`)
    const documentRecord = {
      id: sourceDocumentId,
      customId: null,
      containerTag,
      contentHash: sha256(memories.map((m) => m.content).join('\n')),
      content: memories.map((m) => m.content).join('\n'),
      sourceType: 'direct-memory',
      metadata: { sm_source: 'direct' },
      status: 'done',
      version: 1,
      createdAt: now,
      updatedAt: now
    }
    await this.bee.put(documentKey(sourceDocumentId), documentRecord)

    const created = []
    for (const item of memories) {
      assertContent(item.content)
      created.push(await this._createMemory({
        content: item.content,
        containerTag,
        documentId: sourceDocumentId,
        metadata: item.metadata || {},
        isStatic: item.isStatic === true,
        now
      }))
    }
    return { documentId: sourceDocumentId, memories: created }
  }

  async search ({ query, containerTag = DEFAULT_CONTAINER, searchMode = 'hybrid', limit = 10, threshold = 0 }) {
    if (!query || typeof query !== 'string') throw new Error('query is required')
    const started = Date.now()
    const queryTokens = tokenize(query)
    const results = []

    for await (const node of this.bee.createReadStream({ gte: memoryContainerPrefix(containerTag), lt: memoryContainerEnd(containerTag) })) {
      const memoryId = node.value
      const memory = await this.getMemory(memoryId)
      if (!memory || memory.isForgotten || !memory.isLatest) continue
      const score = scoreText(queryTokens, memory.memory)
      if (score <= threshold) continue
      results.push({
        id: memory.id,
        memory: memory.memory,
        similarity: score,
        metadata: memory.metadata || null,
        updatedAt: memory.updatedAt,
        version: memory.version
      })
    }

    if (searchMode === 'hybrid') {
      for await (const node of this.bee.createReadStream({ gte: documentContainerPrefix(containerTag), lt: documentContainerEnd(containerTag) })) {
        const documentId = node.value
        const doc = await this.getDocument(documentId)
        if (!doc) continue
        const score = scoreText(queryTokens, doc.content)
        if (score <= threshold) continue
        results.push({
          id: doc.id,
          chunk: doc.content,
          similarity: score * 0.9,
          metadata: doc.metadata || null,
          updatedAt: doc.updatedAt,
          version: doc.version
        })
      }
    }

    results.sort((a, b) => b.similarity - a.similarity)
    const finalResults = results.slice(0, limit)
    return {
      results: finalResults,
      total: finalResults.length,
      timing: Date.now() - started
    }
  }

  async forget ({ content, containerTag = DEFAULT_CONTAINER }) {
    if (!content || typeof content !== 'string') throw new Error('content is required')
    const matches = await this.search({ query: content, containerTag, searchMode: 'memories', limit: 1 })
    const match = matches.results[0]
    if (!match) return { forgotten: false, message: 'No matching memory found', containerTag }

    const memory = await this.getMemory(match.id)
    const updated = {
      ...memory,
      isForgotten: true,
      forgetReason: 'user-requested',
      updatedAt: new Date().toISOString()
    }
    await this.bee.put(memoryKey(memory.id), updated)
    return { forgotten: true, id: memory.id, containerTag }
  }

  async profile ({ containerTag = DEFAULT_CONTAINER, query = null } = {}) {
    const staticFacts = []
    const dynamicFacts = []
    const memories = []

    for await (const node of this.bee.createReadStream({ gte: memoryContainerPrefix(containerTag), lt: memoryContainerEnd(containerTag) })) {
      const memory = await this.getMemory(node.value)
      if (!memory || memory.isForgotten || !memory.isLatest) continue
      memories.push(memory)
    }

    memories.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))
    for (const memory of memories) {
      if (memory.isStatic) staticFacts.push(memory.memory)
      else dynamicFacts.push(memory.memory)
    }

    const result = {
      profile: {
        static: staticFacts.slice(0, 20),
        dynamic: dynamicFacts.slice(0, 20)
      }
    }
    if (query) result.searchResults = await this.search({ query, containerTag, searchMode: 'hybrid' })
    return result
  }

  async listDocuments ({ containerTag = DEFAULT_CONTAINER } = {}) {
    const documents = []
    for await (const node of this.bee.createReadStream({ gte: documentContainerPrefix(containerTag), lt: documentContainerEnd(containerTag) })) {
      const doc = await this.getDocument(node.value)
      if (doc) documents.push(doc)
    }
    documents.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))
    return documents
  }

  async listProjects () {
    const projects = []
    for await (const node of this.bee.createReadStream({ gte: 'containers/', lt: 'containers0' })) {
      projects.push(node.value)
    }
    return projects.sort()
  }

  async getDocument (documentId) {
    const node = await this.bee.get(documentKey(documentId))
    return node?.value || null
  }

  async getDocumentByCustomId ({ customId, containerTag = DEFAULT_CONTAINER }) {
    const node = await this.bee.get(customDocumentKey(containerTag, customId))
    if (!node?.value) return null
    return this.getDocument(node.value)
  }

  async getMemory (memoryId) {
    const node = await this.bee.get(memoryKey(memoryId))
    return node?.value || null
  }

  async getNodeRegistration () {
    await this.core.ready()
    return {
      appId: this.appId,
      appName: this.appName,
      cores: [{
        key: b4a.toString(this.core.key, 'hex'),
        type: 'hyperbee',
        name: 'memory-store'
      }],
      drives: []
    }
  }

  async close () {
    if (this.bee) await this.bee.close()
    if (this.store) await this.store.close()
  }

  async _createMemory ({ content, containerTag, documentId, metadata, isStatic, now }) {
    await this.bee.put(containerKey(containerTag), containerTag)
    const id = idFor('mem', `${containerTag}:${documentId}:${content}:${now}`)
    const record = {
      id,
      documentId,
      containerTag,
      memory: content,
      isStatic,
      isLatest: true,
      isForgotten: false,
      version: 1,
      parentMemoryId: null,
      rootMemoryId: id,
      relationshipType: null,
      metadata,
      createdAt: now,
      updatedAt: now
    }
    await this.bee.put(memoryKey(id), record)
    await this.bee.put(memoryContainerKey(containerTag, id), id)
    await this.bee.put(documentContainerKey(containerTag, documentId), documentId)
    return record
  }

  async _markDocumentMemoriesNotLatest ({ documentId, containerTag, now }) {
    for await (const node of this.bee.createReadStream({ gte: memoryContainerPrefix(containerTag), lt: memoryContainerEnd(containerTag) })) {
      const memory = await this.getMemory(node.value)
      if (!memory || memory.documentId !== documentId || !memory.isLatest) continue
      await this.bee.put(memoryKey(memory.id), {
        ...memory,
        isLatest: false,
        updatedAt: now
      })
    }
  }
}

function assertContent (content) {
  if (!content || typeof content !== 'string') throw new Error('content is required')
}

function tokenize (text) {
  return String(text)
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .filter((token) => token.length > 1)
}

function scoreText (queryTokens, text) {
  if (queryTokens.length === 0) return 0
  const tokens = tokenize(text)
  if (tokens.length === 0) return 0
  const counts = new Map()
  for (const token of tokens) counts.set(token, (counts.get(token) || 0) + 1)
  let hits = 0
  for (const token of queryTokens) hits += counts.get(token) || 0
  if (hits === 0) return 0
  return Math.min(1, hits / queryTokens.length)
}

function idFor (prefix, input) {
  return `${prefix}_${sha256(input).slice(0, 24)}`
}

function sha256 (input) {
  return createHash('sha256').update(String(input)).digest('hex')
}

function containerKey (containerTag) {
  return `containers/${containerTag}`
}

function documentKey (documentId) {
  return `documents/${documentId}`
}

function customDocumentKey (containerTag, customId) {
  return `custom-documents/${containerTag}/${customId}`
}

function documentContainerKey (containerTag, documentId) {
  return `${documentContainerPrefix(containerTag)}${documentId}`
}

function documentContainerPrefix (containerTag) {
  return `container-documents/${containerTag}/`
}

function documentContainerEnd (containerTag) {
  return `container-documents/${containerTag}0`
}

function memoryKey (memoryId) {
  return `memories/${memoryId}`
}

function memoryContainerKey (containerTag, memoryId) {
  return `${memoryContainerPrefix(containerTag)}${memoryId}`
}

function memoryContainerPrefix (containerTag) {
  return `container-memories/${containerTag}/`
}

function memoryContainerEnd (containerTag) {
  return `container-memories/${containerTag}0`
}
