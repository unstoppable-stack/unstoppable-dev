import { join } from 'path'
import Fastify from 'fastify'
import type { FastifyInstance } from 'fastify'

export async function createSearchNode(storageDir: string, port: number) {
  const Corestore = (await import('corestore')).default
  const Hyperbee = (await import('hyperbee')).default
  const Hyperdrive = (await import('hyperdrive')).default
  const Hypercore = (await import('hypercore')).default

  // Initialize storage
  const corestore = new Corestore(join(storageDir, 'corestore'))
  await corestore.ready()

  const indexCore = corestore.get({ name: 'search-index' })
  const indexBee = new Hyperbee(indexCore, {
    keyEncoding: 'utf-8',
    valueEncoding: 'json',
  })
  await indexBee.ready()

  const drive = new Hyperdrive(corestore.namespace('content'))
  await drive.ready()

  const crawlLog = new Hypercore(join(storageDir, 'crawl-log'), {
    valueEncoding: 'json',
  })
  await crawlLog.ready()

  const store = await createStoreInterface(indexBee, drive, crawlLog)

  // Create HTTP server
  const app = Fastify({ logger: false })

  const { SearchHandler } = await import('./handler.js')
  const handler = new SearchHandler(store)
  const startedAt = Date.now()

  app.post('/search', {
    schema: {
      body: {
        type: 'object',
        required: ['query'],
        properties: {
          query: { type: 'string', minLength: 1 },
          search_depth: { type: 'string', enum: ['basic', 'advanced'] },
          topic: { type: 'string', enum: ['general', 'news'] },
          max_results: { type: 'integer', minimum: 1, maximum: 20, default: 5 },
          include_answer: { type: 'boolean', default: false },
          include_raw_content: { type: 'boolean', default: false },
          include_images: { type: 'boolean', default: false },
          include_domains: { type: 'array', items: { type: 'string' } },
          exclude_domains: { type: 'array', items: { type: 'string' } },
          time_range: { type: ['string', 'null'], enum: ['day', 'week', 'month', 'year', null] },
        },
      },
    },
  }, async (request: any) => handler.search(request.body))

  app.post('/extract', {
    schema: {
      body: {
        type: 'object',
        required: ['urls'],
        properties: {
          urls: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 20 },
          extract_depth: { type: 'string', enum: ['basic', 'advanced'] },
          format: { type: 'string', enum: ['markdown', 'text'] },
        },
      },
    },
  }, async (request: any) => {
    const startTime = performance.now()
    const { ContentExtractor } = await import('./extractor.js')
    const extractor = new ContentExtractor()
    const outcomes = await extractor.extractBatch(request.body.urls)

    const results: any[] = []
    const failed: any[] = []
    for (const o of outcomes) {
      if (o.error) failed.push({ url: o.url, error: o.error })
      else results.push({ url: o.url, raw_content: request.body.format === 'text' ? o.content : o.markdown })
    }
    return { results, failed_results: failed, response_time: parseFloat(((performance.now() - startTime) / 1000).toFixed(3)) }
  })

  app.post('/ingest', {
    schema: {
      body: {
        type: 'object',
        required: ['url'],
        properties: {
          url: { type: 'string', minLength: 1 },
        },
      },
    },
  }, async (request: any) => {
    const result = await handler.ingestUrl(request.body.url)
    return result
  })

  app.get('/health', async () => {
    const stats = await store.getStats()
    return { status: 'ok', uptime: Math.floor((Date.now() - startedAt) / 1000), index: stats }
  })

  app.get('/tool-schema', async () => ({
    name: 'web_search',
    description: 'Search the web using the local Unstoppable Search index.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'The search query string' },
        search_depth: { type: 'string', enum: ['basic', 'advanced'] },
        max_results: { type: 'integer', default: 5 },
        include_answer: { type: 'boolean', default: false },
        include_domains: { type: 'array', items: { type: 'string' } },
        exclude_domains: { type: 'array', items: { type: 'string' } },
      },
      required: ['query'],
    },
  }))

  await app.listen({ port, host: '127.0.0.1' })

  const stats = await store.getStats()

  return {
    store,
    app,
    stats,
    close: async () => {
      await app.close()
      await crawlLog.close()
      await drive.close()
      await indexBee.close()
      await corestore.close()
    },
  }
}

const END = '\xff'

async function createStoreInterface(indexBee: any, drive: any, crawlLog: any) {
  interface StatsCounter { pages: number; keywords: number; domains: number }
  let statsCache: StatsCounter | null = null

  async function loadStatsCache() {
    const entry = await indexBee.get('/meta/stats')
    statsCache = entry?.value ?? { pages: 0, keywords: 0, domains: 0 }
  }

  async function persistStats() {
    if (statsCache) await indexBee.put('/meta/stats', statsCache)
  }

  await loadStatsCache()

  return {
    async ready() {},
    async close() {},

    async putPage(page: any) {
      const existing = await indexBee.get(`/pages/${page.urlHash}`)
      await indexBee.put(`/pages/${page.urlHash}`, page)
      if (!existing && statsCache) {
        statsCache.pages++
        await persistStats()
      }
    },
    async getPage(urlHash: string) { const e = await indexBee.get(`/pages/${urlHash}`); return e?.value ?? null },

    async getPages(urlHashes: string[]) {
      const pages: any[] = []
      for (const hash of urlHashes) {
        const e = await indexBee.get(`/pages/${hash}`)
        if (e?.value) pages.push(e.value)
      }
      return pages
    },

    async getPageCount() {
      return statsCache?.pages ?? 0
    },

    async putKeyword(entry: any) {
      const key = `/keywords/${entry.word}/${entry.urlHash}`
      const existing = await indexBee.get(key)
      await indexBee.put(key, entry)
      if (!existing && statsCache) {
        statsCache.keywords++
        await persistStats()
      }
    },
    async getKeywordsForWord(word: string) {
      const entries: any[] = []
      for await (const e of indexBee.createReadStream({ gte: `/keywords/${word}/`, lt: `/keywords/${word}/${END}` })) entries.push(e.value)
      return entries
    },

    async putDomain(entry: any) {
      const existing = await indexBee.get(`/domains/${entry.domain}`)
      await indexBee.put(`/domains/${entry.domain}`, entry)
      if (!existing && statsCache) {
        statsCache.domains++
        await persistStats()
      }
    },
    async getDomain(domain: string) { const e = await indexBee.get(`/domains/${domain}`); return e?.value ?? null },

    async putContent(contentHash: string, markdown: string) { await drive.put(`/content/${contentHash}.md`, Buffer.from(markdown, 'utf-8')) },
    async getContent(contentHash: string) {
      try { const buf = await drive.get(`/content/${contentHash}.md`); return buf ? buf.toString('utf-8') : null } catch { return null }
    },

    async appendCrawlLog(entry: any) { await crawlLog.append(entry) },
    async getCrawlLogLength() { return crawlLog.length },

    async getStats() {
      return {
        pages: statsCache?.pages ?? 0,
        keywords: statsCache?.keywords ?? 0,
        domains: statsCache?.domains ?? 0,
        crawlEntries: crawlLog.length,
      }
    },
  }
}
