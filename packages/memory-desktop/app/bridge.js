import run from 'pear-run'

const workerPath = Pear.key
  ? `${Pear.config.applink || ''}/worker.js`
  : `${Pear.config.dir || ''}/worker.js`

const worker = run(workerPath, Pear.config.args || [])
const listeners = new Set()
let buffer = ''

worker.on('data', (data) => {
  buffer += Buffer.from(data).toString()
  const lines = buffer.split('\n')
  buffer = lines.pop() || ''
  for (const line of lines) {
    if (!line.trim()) continue
    try {
      const msg = JSON.parse(line)
      for (const listener of listeners) listener(msg)
    } catch {}
  }
})

export function sendToWorker (msg) {
  worker.write(JSON.stringify(msg) + '\n')
}

export function onWorkerMessage (listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function destroyWorker () {
  try {
    sendToWorker({ type: 'shutdown' })
    setTimeout(() => { try { worker.destroy() } catch {} }, 500)
  } catch {}
  listeners.clear()
}

export const workerReady = new Promise((resolve, reject) => {
  const timeout = setTimeout(() => reject(new Error('Worker init timeout (30s)')), 30000)
  const unsubscribe = onWorkerMessage((msg) => {
    if (msg.type !== 'workerReady') return
    clearTimeout(timeout)
    unsubscribe()
    resolve(msg)
  })
})
