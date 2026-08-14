import { runDaemonWorker } from '../lib/run-daemon-worker.js'

const [storagePath, rawArgs = '[]'] = Bare.argv.slice(2)
let args = []

try {
  const parsed = JSON.parse(rawArgs)
  if (Array.isArray(parsed)) args = parsed.filter((arg) => typeof arg === 'string')
} catch {}

runDaemonWorker({
  pipe: Bare.IPC,
  storagePath,
  args,
  exit: () => Bare.exit()
})
