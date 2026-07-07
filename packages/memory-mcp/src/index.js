#!/usr/bin/env node

import { homedir } from 'node:os'
import { join } from 'node:path'
import { startMemoryMcpServer } from './server.js'

export { startMemoryMcpServer } from './server.js'

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2)
  const storageIndex = args.indexOf('--storage')
  const portIndex = args.indexOf('--port')
  const storagePath = storageIndex >= 0 && args[storageIndex + 1]
    ? args[storageIndex + 1]
    : join(homedir(), '.unstoppable', 'memory', 'storage')
  const port = portIndex >= 0 && args[portIndex + 1]
    ? Number(args[portIndex + 1])
    : 8787

  const server = await startMemoryMcpServer({ storagePath, port })
  console.log(`unstoppable-memory-mcp listening on ${server.url}`)

  async function shutdown () {
    await server.close()
    process.exit(0)
  }

  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}
