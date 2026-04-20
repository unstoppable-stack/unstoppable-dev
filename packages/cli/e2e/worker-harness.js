/**
 * Worker harness — lets us run a generated Pear Desktop `worker.js` in plain
 * Node so the E2E runner can spawn it and assert on its NDJSON output.
 *
 * The generated worker uses two Pear-runtime globals:
 *   - `Pear.worker.pipe()`  — bidirectional stream to the renderer
 *   - `Pear.config.storage` — a directory for Corestore/Hyperbee
 *   - `Pear.exit()`         — graceful shutdown
 *
 * We replace `Pear.worker.pipe()` with a Duplex that bridges to this process's
 * stdin/stdout, so the test harness can write NDJSON commands and read the
 * NDJSON responses exactly as the real bridge does.
 *
 * Usage:
 *   node worker-harness.js /path/to/generated/worker.js [storage-dir]
 *
 * Env vars are passed through (QVAC_MOCK=1 in particular).
 */

import { Duplex } from 'stream'
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

// Inject the Pear global BEFORE importing the worker. The worker calls
// `Pear.worker.pipe()` and `Pear.config.storage` at module top level.
globalThis.Pear = {
  worker: { pipe: () => pipe },
  config: { storage: storageDir },
  exit: () => {
    // Give the worker a tick to flush any final NDJSON before exiting
    setImmediate(() => process.exit(0))
  },
  teardown: () => {
    /* no-op in harness */
  },
  key: null,
}

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
