import { createHash } from 'crypto'
import { ContentExtractor } from './extractor.js'
import { KeywordIndexer } from './keyword-indexer.js'
import { QueryEngine } from './query-engine.js'
import { LiveWebBackend } from './live-web.js'

interface ExtractionResultShape {
  url: string
  title: string
  content: string
  markdown: string
  byteLength: number
  error?: undefined
}

interface ExtractionErrorShape {
  url: string
  error: string
}

type ExtractionOutcome = ExtractionResultShape | ExtractionErrorShape

function isExtractionSuccess(o: ExtractionOutcome): o is ExtractionResultShape {
  return o.error === undefined
}

export class SearchHandler {
  private extractor = new ContentExtractor()
  private indexer = new KeywordIndexer()
  private queryEngine: QueryEngine
  private liveWeb = new LiveWebBackend()

  constructor(private store: any) {
    this.queryEngine = new QueryEngine(store)
  }

  async search(request: any) {
    const startTime = performance.now()
    const {
      query, search_depth = 'basic', max_results = 5,
      include_raw_content = false,
      include_domains, exclude_domains, time_range,
    } = request

    const results: any[] = []

    const localResults = await this.queryEngine.search(query, max_results)
    for (const r of localResults) {
      let rawContent: string | null = null
      if (include_raw_content) {
        const page = await this.store.getPage(r.urlHash)
        if (page) rawContent = await this.store.getContent(page.contentHash) ?? null
      }
      results.push({ title: r.title, url: r.url, content: r.content, score: r.score, raw_content: rawContent })
    }

    if (search_depth === 'advanced') {
      try {
        const webResults = await this.liveWeb.search(query, {
          maxResults: max_results, includeDomains: include_domains,
          excludeDomains: exclude_domains, timeRange: time_range,
        })
        const existingUrls = new Set(results.map((r: any) => r.url))
        const newWebResults = webResults.filter((r: any) => !existingUrls.has(r.url))
        for (const wr of newWebResults) {
          results.push({ title: wr.title, url: wr.url, content: wr.snippet, score: wr.score * 0.8, raw_content: null })
        }
        this.autoIngest(newWebResults).catch(() => {})
      } catch (err: any) {
        console.error('[Search] Live web search failed:', err.message || err)
      }
    }

    results.sort((a: any, b: any) => b.score - a.score)
    const finalResults = results.slice(0, max_results)
    const responseTime = (performance.now() - startTime) / 1000

    const answer: string | null = null

    return {
      query, answer, results: finalResults, images: [],
      response_time: parseFloat(responseTime.toFixed(3)),
    }
  }

  private async autoIngest(webResults: any[]) {
    for (const wr of webResults) {
      await this.ingestPage(wr.url).catch(() => {})
    }
  }

  async ingestUrl(url: string): Promise<{ success: boolean; error?: string }> {
    return this.ingestPage(url)
  }

  private async ingestPage(url: string): Promise<{ success: boolean; error?: string }> {
    try {
      const urlHash = createHash('sha256').update(url).digest('hex').slice(0, 16)

      const existing = await this.store.getPage(urlHash)
      if (existing) {
        return { success: true }
      }

      const html = await this.extractor.fetchHtml(url)
      const extraction = await this.extractor.extractFromHtml(html, url) as ExtractionOutcome
      if (!isExtractionSuccess(extraction)) {
        return { success: false, error: extraction.error }
      }

      const contentHash = createHash('sha256').update(extraction.content).digest('hex').slice(0, 16)
      const domain = new URL(url).hostname
      const wordCount = KeywordIndexer.tokenize(extraction.content).length

      await this.store.putContent(contentHash, extraction.markdown)
      const keywords = this.indexer.extractKeywords(extraction.content, url, urlHash)
      await this.store.putPage({
        url, urlHash, domain, title: extraction.title,
        description: extraction.content.slice(0, 200), contentHash,
        keywords: keywords.map((k: any) => k.word),
        crawledAt: Date.now(),
        byteLength: extraction.byteLength,
        wordCount,
        crawledBy: 'local',
        freshness: Date.now(),
      })
      for (const kw of keywords) await this.store.putKeyword(kw)
      const existingDomain = await this.store.getDomain(domain)
      await this.store.putDomain({ domain, urlCount: (existingDomain?.urlCount ?? 0) + 1, lastCrawl: Date.now() })
      await this.store.appendCrawlLog({
        url, domain, timestamp: Date.now(), contentHash,
        status: 'ok', byteLength: extraction.byteLength, title: extraction.title,
      })

      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  }
}
