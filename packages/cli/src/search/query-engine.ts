import { KeywordIndexer } from './keyword-indexer.js'

export class QueryEngine {
  constructor(private store: any) {}

  async search(query: string, maxResults = 10): Promise<any[]> {
    const queryTokens = KeywordIndexer.tokenize(query)
    if (queryTokens.length === 0) return []

    const keywordResults = await Promise.all(
      queryTokens.map((token: string) => this.store.getKeywordsForWord(token))
    )

    const urlHashSet = new Set<string>()
    for (const entries of keywordResults) {
      for (const entry of entries) {
        urlHashSet.add(entry.urlHash)
      }
    }

    if (urlHashSet.size === 0) return []

    const pages = await this.store.getPages([...urlHashSet])
    if (pages.length === 0) return []

    const pageMap = new Map<string, any>(pages.map((p: any) => [p.urlHash, p]))
    const totalDocs = await this.store.getPageCount() || pages.length
    const avgDocLength = pages.reduce((sum: number, p: any) => sum + (p.wordCount ?? 0), 0) / pages.length || 1

    const docScores = new Map<string, number>()
    for (let i = 0; i < queryTokens.length; i++) {
      const entries = keywordResults[i]
      const docsWithTerm = entries.length
      for (const entry of entries) {
        const page = pageMap.get(entry.urlHash)
        if (!page) continue
        const score = KeywordIndexer.bm25Score({
          tf: entry.tf,
          docLength: page.wordCount || 1,
          avgDocLength,
          totalDocs,
          docsWithTerm,
        })
        docScores.set(entry.urlHash, (docScores.get(entry.urlHash) || 0) + score)
      }
    }

    if (docScores.size === 0) return []

    const results = [...docScores.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, maxResults)
      .map(([urlHash, score]) => {
        const page = pageMap.get(urlHash)!
        return {
          urlHash, url: page.url, title: page.title,
          content: page.description || page.keywords.join(', '),
          score, source: 'index',
        }
      })

    const maxScore = results[0]?.score || 1
    if (maxScore > 0) for (const r of results) r.score = r.score / maxScore

    return results
  }
}
