const MAX_RETRIES = 3
const BASE_DELAY_MS = 2000

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function isRateLimited(err: any): boolean {
  const msg = String(err?.message || '')
  return msg.includes('anomaly') || msg.includes('too quickly') || msg.includes('rate')
}

export class LiveWebBackend {
  private lastRequestAt = 0

  async search(query: string, options: any = {}): Promise<any[]> {
    const { maxResults = 10, includeDomains, excludeDomains } = options

    let modifiedQuery = query
    if (includeDomains?.length) {
      modifiedQuery += ' ' + includeDomains.map((d: string) => `site:${d}`).join(' OR ')
    }
    if (excludeDomains?.length) {
      modifiedQuery += ' ' + excludeDomains.map((d: string) => `-site:${d}`).join(' ')
    }

    const ddg = await import('duck-duck-scrape')

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      const sinceLast = Date.now() - this.lastRequestAt
      const minGap = 1500 + Math.random() * 1000
      if (sinceLast < minGap) {
        await sleep(minGap - sinceLast)
      }

      try {
        this.lastRequestAt = Date.now()
        const response = await ddg.search(modifiedQuery, {
          safeSearch: ddg.SafeSearchType.OFF,
        })

        if (!response.results || response.results.length === 0) return []

        return response.results
          .slice(0, maxResults)
          .map((r: any, i: number) => ({
            title: r.title || '',
            url: r.url || r.href || '',
            snippet: r.description || r.body || '',
            score: Math.max(0.1, 1.0 - i * 0.05),
          }))
      } catch (err: any) {
        if (isRateLimited(err) && attempt < MAX_RETRIES) {
          const delay = BASE_DELAY_MS * Math.pow(2, attempt) + Math.random() * 1000
          console.error(`[LiveWeb] Rate-limited by DDG, retrying in ${(delay / 1000).toFixed(1)}s (attempt ${attempt + 1}/${MAX_RETRIES})...`)
          await sleep(delay)
          continue
        }
        console.error('[LiveWeb] DuckDuckGo search failed:', err.message || err)
        return []
      }
    }

    return []
  }
}
