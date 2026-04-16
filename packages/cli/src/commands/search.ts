import { Command } from 'commander'
import chalk from 'chalk'

export function registerSearchCommand(program: Command) {
  const search = program
    .command('search')
    .description('Unstoppable Search — local Tavily-compatible search node')

  // ── us search start ─────────────────────────────────────────────────

  search
    .command('start')
    .description('Start the search daemon on localhost:7700')
    .option('-p, --port <port>', 'Port to listen on', '7700')
    .option('--storage <path>', 'Storage directory', '.us-search')
    .action(async (options) => {
      const { join } = await import('path')
      const { createSearchNode } = await import('../search/node.js')

      const storageDir = join(process.cwd(), options.storage)
      const port = parseInt(options.port, 10)

      console.log(chalk.dim('  Starting Unstoppable Search...'))

      const { store, app, stats } = await createSearchNode(storageDir, port)

      console.log(chalk.green('  ✓ ') + `Node running on ${chalk.bold(`http://127.0.0.1:${port}`)}`)
      if (stats.pages === 0) {
        console.log(chalk.dim('  ✓ No content indexed yet. Search with --live or run \'us search ingest\'.'))
      } else {
        console.log(chalk.dim(`  ✓ ${stats.pages} pages indexed`))
      }
      console.log()

      process.on('SIGINT', async () => {
        console.log(chalk.dim('\n  Shutting down...'))
        await app.close()
        await store.close()
        process.exit(0)
      })
    })

  // ── us search stop ─────────────────────────────────────────────────

  search
    .command('stop')
    .description('How to stop a running search daemon')
    .action(() => {
      console.log()
      console.log(chalk.dim('  Unstoppable Search runs in the terminal where you ran ') + chalk.bold('us search start') + chalk.dim('.'))
      console.log(chalk.dim('  To stop it: press ') + chalk.bold('Ctrl+C') + chalk.dim(' in that terminal.'))
      console.log(chalk.dim('  If it is running in the background, find the process (e.g. ') + chalk.bold('lsof -i :7700') + chalk.dim(') and ') + chalk.bold('kill') + chalk.dim(' it.'))
      console.log()
    })

  // ── us search query ─────────────────────────────────────────────────

  search
    .command('query <query>')
    .description('Search the local index (and optionally the live web)')
    .option('--live', 'Include live web results (DuckDuckGo)')
    .option('-n, --max-results <n>', 'Maximum results', '5')
    .option('--json', 'Output as JSON')
    .option('-p, --port <port>', 'Daemon port', '7700')
    .action(async (query, options) => {
      const port = parseInt(options.port, 10)
      const maxResults = parseInt(options.maxResults, 10)
      const searchDepth = options.live ? 'advanced' : 'basic'

      try {
        const response = await fetch(`http://127.0.0.1:${port}/search`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query,
            search_depth: searchDepth,
            max_results: maxResults,
          }),
        })

        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const data = await response.json() as any

        if (options.json) {
          console.log(JSON.stringify(data, null, 2))
          return
        }

        console.log()
        if (data.results.length === 0) {
          console.log(chalk.yellow('  No results found.'))
          if (!options.live) {
            console.log(chalk.dim('  Try --live to include web results.'))
          }
        } else {
          for (const result of data.results) {
            const score = (result.score * 100).toFixed(0)
            const preview = (result.content || result.title || '').slice(0, 150)
            console.log(chalk.bold(`  ${result.title}`))
            console.log(chalk.hex('#00d4aa')(`  ${result.url}`))
            console.log(chalk.dim(`  ${preview}${preview.length === 150 ? '...' : ''}`))
            console.log(chalk.dim(`  Score: ${score}%`))
            console.log()
          }
        }
        console.log(chalk.dim(`  ${data.results.length} results in ${data.response_time}s`))
        console.log()
      } catch (err: any) {
        if (err.cause?.code === 'ECONNREFUSED') {
          console.log(chalk.red('  No search node running.'))
          console.log(chalk.dim('  Start one with: us search start'))
        } else {
          console.log(chalk.red(`  Error: ${err.message}`))
        }
        process.exit(1)
      }
    })

  // ── us search ingest ────────────────────────────────────────────────

  search
    .command('ingest <url>')
    .description('Index a URL into the local search index')
    .option('-p, --port <port>', 'Daemon port', '7700')
    .action(async (url, options) => {
      const port = parseInt(options.port, 10)

      try {
        const response = await fetch(`http://127.0.0.1:${port}/ingest`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url }),
        })

        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const data = await response.json() as any

        if (data.success) {
          console.log(chalk.green('  ✓ ') + `Indexed: ${url}`)
        } else {
          console.log(chalk.red('  ✗ ') + `Failed: ${data.error || 'Unknown error'}`)
        }
      } catch (err: any) {
        if (err.cause?.code === 'ECONNREFUSED') {
          console.log(chalk.red('  No search node running.'))
          console.log(chalk.dim('  Start one with: us search start'))
        } else {
          console.log(chalk.red(`  Error: ${err.message}`))
        }
        process.exit(1)
      }
    })

  // ── us search status ────────────────────────────────────────────────

  search
    .command('status')
    .description('Show search node status and index statistics')
    .option('-p, --port <port>', 'Daemon port', '7700')
    .action(async (options) => {
      const port = parseInt(options.port, 10)

      try {
        const response = await fetch(`http://127.0.0.1:${port}/health`)
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const data = await response.json() as any

        console.log()
        console.log(chalk.bold('  Unstoppable Search'))
        console.log(chalk.green('  Status: ') + 'running')
        console.log(chalk.dim(`  Uptime: ${formatUptime(data.uptime)}`))
        console.log()
        console.log(chalk.bold('  Index'))
        console.log(chalk.dim(`  Pages:    ${data.index.pages}`))
        console.log(chalk.dim(`  Keywords: ${data.index.keywords}`))
        console.log(chalk.dim(`  Domains:  ${data.index.domains}`))
        console.log(chalk.dim(`  Crawls:   ${data.index.crawlEntries}`))
        console.log()
      } catch (err: any) {
        if (err.cause?.code === 'ECONNREFUSED') {
          console.log()
          console.log(chalk.bold('  Unstoppable Search'))
          console.log(chalk.red('  Status: ') + 'not running')
          console.log(chalk.dim('  Start with: us search start'))
          console.log()
        } else {
          console.log(chalk.red(`  Error: ${err.message}`))
        }
      }
    })
}

function formatUptime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  return `${h}h ${m}m`
}
