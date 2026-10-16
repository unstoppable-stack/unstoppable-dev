
const handlers = new Set()
let messageBuffer = ''

window.unstoppable.onWorkerMessage((data) => {
  messageBuffer += data
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

export function sendToWorker(msg) {
  return window.unstoppable.sendToWorker(msg)
}

export function onWorkerMessage(handler) {
  handlers.add(handler)
  return () => handlers.delete(handler)
}

export function destroyWorker() {
  try {
    sendToWorker({ type: 'shutdown' })
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
  window.unstoppable.startWorker().catch((err) => {
    clearTimeout(timeout)
    unsub()
    reject(err)
  })
})
