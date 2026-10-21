const handlers = new Set()
let lastWorkerReady = null
let sendMessage
let destroy

function dispatch (message) {
  if (['workerReady', 'ready', 'status'].includes(message?.type)) lastWorkerReady = message
  for (const handler of handlers) handler(message)
}

if (globalThis.personalNode) {
  const unsubscribe = globalThis.personalNode.onWorkerMessage(dispatch)
  sendMessage = (message) => globalThis.personalNode.sendCommand(message)
  destroy = () => {
    try { sendMessage({ type: 'shutdown' }) } catch {}
    unsubscribe()
  }
  queueMicrotask(() => globalThis.personalNode.rendererReady())
} else {
  const { default: run } = await import('pear-run')
  const workerPath = Pear.key
    ? `${Pear.config.applink || ''}/worker.js`
    : `${Pear.config.dir || ''}/worker.js`
  const pipe = run(workerPath, Pear.config.args || [])
  let messageBuffer = ''

  pipe.on('data', (data) => {
    messageBuffer += Buffer.from(data).toString()
    const lines = messageBuffer.split('\n')
    messageBuffer = lines.pop() || ''
    for (const line of lines) {
      if (!line.trim()) continue
      try { dispatch(JSON.parse(line)) } catch {}
    }
  })

  sendMessage = (message) => pipe.write(JSON.stringify(message) + '\n')
  destroy = () => {
    try {
      sendMessage({ type: 'shutdown' })
      setTimeout(() => { try { pipe.destroy() } catch {} }, 500)
    } catch {}
  }
}

export function sendToWorker (msg) {
  sendMessage(msg)
}

export function onWorkerMessage (handler) {
  handlers.add(handler)
  return () => handlers.delete(handler)
}

export function destroyWorker () {
  destroy()
  handlers.clear()
}

export async function selectSettingsPath (mode, suggestedPath) {
  if (!globalThis.personalNode?.selectSettingsPath) return suggestedPath
  return globalThis.personalNode.selectSettingsPath(mode, suggestedPath)
}

export const workerReady = new Promise((resolve, reject) => {
  if (lastWorkerReady) return resolve(lastWorkerReady)
  const timeout = setTimeout(() => reject(new Error('Worker init timeout (30s)')), 30000)
  const unsub = onWorkerMessage((msg) => {
    if (['workerReady', 'ready', 'status'].includes(msg.type)) {
      clearTimeout(timeout)
      unsub()
      resolve(msg)
    }
  })
})
