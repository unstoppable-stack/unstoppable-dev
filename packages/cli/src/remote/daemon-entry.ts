#!/usr/bin/env node

/**
 * Daemon entry point — started by `us remote start`.
 * Runs as a background process with persistent P2P + IPC.
 */

import { Daemon } from './daemon.js'

const args = process.argv.slice(2)
let bootstrap: Array<{ host: string; port: number }> | undefined
let testPort: number | undefined

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--bootstrap') {
    const val = args[++i]
    if (val) {
      bootstrap = val.split(',').map((s) => {
        const [host, portStr] = s.trim().split(':')
        return { host, port: parseInt(portStr) }
      })
    }
  } else if (args[i] === '--test-port') {
    testPort = parseInt(args[++i])
  }
}

const daemon = new Daemon({ bootstrap, testPort })
daemon.start().catch((err) => {
  console.error('Daemon failed to start:', err.message)
  process.exit(1)
})
