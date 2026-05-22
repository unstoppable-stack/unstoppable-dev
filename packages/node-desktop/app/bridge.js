import run from 'pear-run'

const workerPath = Pear.key
  ? `${Pear.config.applink || ''}/worker.js`
  : `${Pear.config.dir || ''}/worker.js`

// Forward the launch args (e.g. `--ai`, `--ai-mock`, `--ai-model`) so the
// worker can read them from `Pear.config.args`. Without this, the worker
// always boots with an empty args list and AI never turns on regardless
// of how the user invoked `pear run`.
const pipe = run(workerPath, Pear.config.args || [])

const handlers = new Set()
let messageBuffer = ''

pipe.on('data', (data) => {
  messageBuffer += Buffer.from(data).toString()
  const lines = messageBuffer.split('\n')
  messageBuffer = lines.pop() || ''
  for (const line of lines) {
    if (!line.trim()) continue
    try {
      const msg = JSON.parse(line)
      for (const handler of handlers) handler(msg)
    } catch {}
  }
})

export function sendToWorker (msg) {
  pipe.write(JSON.stringify(msg) + '\n')
}

export function onWorkerMessage (handler) {
  handlers.add(handler)
  return () => handlers.delete(handler)
}

export function destroyWorker () {
  try {
    sendToWorker({ type: 'shutdown' })
    setTimeout(() => { try { pipe.destroy() } catch {} }, 500)
  } catch {}
  handlers.clear()
}

export const workerReady = new Promise((resolve, reject) => {
  const timeout = setTimeout(() => reject(new Error('Worker init timeout (30s)')), 30000)
  const unsub = onWorkerMessage((msg) => {
    if (msg.type === 'workerReady') {
      clearTimeout(timeout)
      unsub()
      resolve(msg)
    }
  })
})
