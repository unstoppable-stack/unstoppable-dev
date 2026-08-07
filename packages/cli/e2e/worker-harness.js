/**
 * Worker harness — lets us run a generated Pear Desktop `worker.js` in plain
 * Node so the E2E runner can spawn it and assert on its NDJSON output.
 *
 * The generated worker uses the Bare globals supplied by pear-runtime:
 *   - `Bare.IPC`     — bidirectional stream to the Electron host
 *   - `Bare.argv[2]` — a directory for Corestore/Hyperbee
 *   - `Bare.exit()`  — graceful shutdown
 *
 * We replace `Bare.IPC` with a Duplex that bridges to this process's
 * stdin/stdout, so the test harness can write NDJSON commands and read the
 * NDJSON responses exactly as the real bridge does.
 *
 * Usage:
 *   node worker-harness.js /path/to/generated/worker.js [storage-dir]
 *
 * Env vars are passed through (QVAC_MOCK=1 in particular).
 */

import { Duplex } from 'stream'
import { EventEmitter } from 'events'
import { mkdirSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import path from 'path'
import { pathToFileURL } from 'url'

const workerPath = process.argv[2]
if (!workerPath) {
  console.error('Usage: node worker-harness.js <path-to-worker.js> [storage-dir]')
  process.exit(2)
}

const storageDir =
  process.argv[3] ||
  path.join(tmpdir(), `us-worker-harness-${process.pid}-${Date.now()}`)

try {
  rmSync(storageDir, { recursive: true, force: true })
} catch {
  /* ignore */
}
mkdirSync(storageDir, { recursive: true })

// Duplex that connects stdin (incoming commands) to stdout (outgoing events).
// The worker uses `pipe.write(...)` for output and listens to `pipe.on('data',
// ...)` for input. We shuttle data between this Duplex and the actual stdio.
const pipe = new Duplex({
  read() {
    /* pushed externally from stdin */
  },
  write(chunk, _enc, cb) {
    process.stdout.write(chunk)
    cb()
  },
})

process.stdin.on('data', (chunk) => {
  pipe.push(chunk)
})
process.stdin.on('end', () => {
  pipe.push(null)
})

// Inject the Bare global BEFORE importing the worker.
globalThis.Bare = Object.assign(new EventEmitter(), {
  IPC: pipe,
  argv: ['bare', workerPath, storageDir],
  env: process.env,
  exit: () => {
    // Give the worker a tick to flush any final NDJSON before exiting
    setImmediate(() => process.exit(0))
  },
})

// Dynamically import the worker. Use file:// URL so absolute paths work on
// every platform and ESM semantics match the real runtime.
try {
  await import(pathToFileURL(path.resolve(workerPath)).href)
} catch (err) {
  process.stdout.write(
    JSON.stringify({
      type: 'harness-error',
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    }) + '\n',
  )
  process.exit(1)
}

// Safety net — if the worker doesn't exit on its own after 60s, force exit so
// CI doesn't hang.
setTimeout(() => {
  process.stdout.write(
    JSON.stringify({ type: 'harness-timeout', message: '60s elapsed' }) + '\n',
  )
  process.exit(124)
}, 60_000).unref()
