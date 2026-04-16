const USER_AGENTS = [
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
]

const MAX_CONTENT_LENGTH = 50_000
const MIN_CONTENT_LENGTH = 50
const FETCH_TIMEOUT = 10_000

export class ContentExtractor {
  static getRandomUserAgent(): string {
    return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)]
  }

  async fetchHtml(url: string): Promise<string> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT)
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': ContentExtractor.getRandomUserAgent(),
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        redirect: 'follow',
        signal: controller.signal,
      })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      return await response.text()
    } finally {
      clearTimeout(timeout)
    }
  }

  async extractFromHtml(html: string, url: string): Promise<any> {
    try {
      let content: string | null = null
      let title = ''

      try {
        const { extractFromHtml } = await import('@extractus/article-extractor')
        const article = await extractFromHtml(html, url)
        if (article?.content) {
          content = article.content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
          title = article.title || ''
        }
      } catch {}

      if (!content || content.length < MIN_CONTENT_LENGTH) {
        try {
          const { JSDOM } = await import('jsdom')
          const { Readability } = await import('@mozilla/readability')
          const dom = new JSDOM(html, { url })
          const reader = new Readability(dom.window.document)
          const article = reader.parse()
          if (article?.textContent) {
            content = article.textContent.replace(/\s+/g, ' ').trim()
            title = title || article.title || ''
          }
        } catch {}
      }

      if (!title) {
        const m = html.match(/<title[^>]*>(.*?)<\/title>/is)
        title = m ? m[1].trim() : ''
      }

      if (!content || content.length < MIN_CONTENT_LENGTH) {
        return { url, error: 'Extraction failed: content too short or empty' }
      }

      if (content.length > MAX_CONTENT_LENGTH) {
        content = content.slice(0, MAX_CONTENT_LENGTH) + '\n\n[Content truncated]'
      }

      const heading = title || 'Untitled'
      const markdown = `# ${heading}\n\nSource: ${url}\n\n---\n\n${content}`

      return { url, title, content, markdown, byteLength: Buffer.byteLength(markdown, 'utf-8') }
    } catch (err: any) {
      return { url, error: `Extraction error: ${err.message}` }
    }
  }

  async extractBatch(urls: string[]): Promise<any[]> {
    return Promise.all(urls.map(url => this.extract(url)))
  }

  private async extract(url: string): Promise<any> {
    try {
      const html = await this.fetchHtml(url)
      return this.extractFromHtml(html, url)
    } catch (err: any) {
      return { url, error: `Fetch error: ${err.message}` }
    }
  }
}
