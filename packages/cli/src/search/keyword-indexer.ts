const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'but', 'by', 'for', 'from',
  'had', 'has', 'have', 'he', 'her', 'his', 'how', 'i', 'if', 'in', 'into',
  'is', 'it', 'its', 'just', 'me', 'my', 'no', 'nor', 'not', 'of', 'on',
  'or', 'our', 'own', 'say', 'she', 'so', 'some', 'than', 'that', 'the',
  'their', 'them', 'then', 'there', 'these', 'they', 'this', 'to', 'too',
  'us', 'very', 'was', 'we', 'what', 'when', 'which', 'who', 'whom', 'why',
  'will', 'with', 'would', 'you', 'your', 'about', 'after', 'all', 'also',
  'am', 'any', 'because', 'been', 'before', 'being', 'between', 'both',
  'can', 'could', 'did', 'do', 'does', 'doing', 'down', 'during', 'each',
  'few', 'get', 'got', 'here', 'him', 'himself', 'herself', 'itself',
  'let', 'like', 'make', 'more', 'most', 'much', 'must', 'need', 'only',
  'other', 'over', 'same', 'should', 'such', 'take', 'through', 'under',
  'until', 'up', 'upon', 'used', 'using', 'well', 'were', 'where', 'while',
])

const SNIPPET_RADIUS = 60

export class KeywordIndexer {
  static tokenize(text: string): string[] {
    return text.toLowerCase().replace(/[^\w\s-]/g, ' ').split(/\s+/)
      .filter(t => t.length >= 2 && !STOP_WORDS.has(t))
  }

  extractKeywords(content: string, url: string, urlHash: string, maxKeywords = 100): any[] {
    const tokens = KeywordIndexer.tokenize(content)
    if (tokens.length === 0) return []

    const freq = new Map<string, { count: number; positions: number[] }>()
    for (let i = 0; i < tokens.length; i++) {
      const word = tokens[i]
      const entry = freq.get(word)
      if (entry) { entry.count++; entry.positions.push(i) }
      else freq.set(word, { count: 1, positions: [i] })
    }

    const lowerContent = content.toLowerCase()
    return [...freq.entries()]
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, maxKeywords)
      .map(([word, { count, positions }]) => {
        const tf = count
        const snippet = this.extractSnippet(lowerContent, word)
        return { word, urlHash, url, tf, positions, snippet }
      })
  }

  private extractSnippet(content: string, word: string): string {
    const idx = content.indexOf(word)
    if (idx === -1) return ''
    const start = Math.max(0, idx - SNIPPET_RADIUS)
    const end = Math.min(content.length, idx + word.length + SNIPPET_RADIUS)
    let snippet = content.slice(start, end).replace(/\s+/g, ' ').trim()
    if (start > 0) snippet = '...' + snippet
    if (end < content.length) snippet += '...'
    return snippet
  }

  static bm25Score(params: { tf: number; docLength: number; avgDocLength: number; totalDocs: number; docsWithTerm: number }): number {
    const { tf, docLength, avgDocLength, totalDocs, docsWithTerm } = params
    const k1 = 1.2, b = 0.75
    const idf = Math.log((totalDocs - docsWithTerm + 0.5) / (docsWithTerm + 0.5) + 1)
    if (idf <= 0) return 0
    const safeAvg = avgDocLength || 1
    const tfNorm = (tf * (k1 + 1)) / (tf + k1 * (1 - b + b * (docLength / safeAvg)))
    return idf * tfNorm
  }
}
