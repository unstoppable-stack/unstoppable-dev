#!/usr/bin/env node
// Runs the embedded NodeDaemon without any Pear UI. Output is NDJSON on
// stdout so a parent process (CI, `us node start`, etc.) can ingest it.
//
// Works under both Bare (preferred, matches Pear runtime) and Node:
//   - argv:  `Bare.argv` in Bare, `process.argv` in Node
//   - exit:  `Bare.exit()` / `process.exit()`
//   - signals: Node only; Bare keeps the process alive until exit()

const _bare = typeof Bare !== 'undefined' ? Bare : null // eslint-disable-line no-undef
const _proc = typeof process !== 'undefined' ? process : null

const argv = _bare?.argv || _proc?.argv || []
const args = argv.slice(_bare ? 1 : 2)

const storageIndex = args.indexOf('--storage')
const storagePath = storageIndex >= 0 && args[storageIndex + 1]
  ? args[storageIndex + 1]
  : './.unstoppable-node-headless'

const { createDaemonHost } = await import('../lib/daemon-host.js')

function send (msg) {
  const line = JSON.stringify(msg) + '\n'
  if (_proc?.stdout?.write) _proc.stdout.write(line)
  else console.log(line.trimEnd())
}

function exit (code = 0) {
  if (_bare && typeof _bare.exit === 'function') _bare.exit(code)
  else if (_proc && typeof _proc.exit === 'function') _proc.exit(code)
}

const host = createDaemonHost({
  storagePath,
  args,
  send,
  approvalMode: 'auto',
  exit
})

if (_proc?.stdin) {
  let buffer = ''
  _proc.stdin.setEncoding?.('utf8')
  _proc.stdin.on('data', async (data) => {
    buffer += data.toString()
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''
    for (const line of lines) {
      if (!line.trim()) continue
      try {
        await host.handleCommand(JSON.parse(line))
      } catch (err) {
        send({ type: 'error', phase: 'stdin-command', error: err.message })
      }
    }
  })
}

async function shutdown () {
  await host.cleanup()
}

if (_proc?.on) {
  _proc.on('SIGINT', shutdown)
  _proc.on('SIGTERM', shutdown)
}

await host.start()
