import Sidecar from 'bare-sidecar'

const SHUTDOWN_TIMEOUT_MS = 5_000

export function createSidecarHost ({
  entry,
  storagePath,
  args = [],
  onMessage = () => {},
  onError = () => {},
  onExit = () => {},
  SidecarClass = Sidecar
} = {}) {
  if (!entry) throw new Error('createSidecarHost requires a worker entry')
  if (!storagePath) throw new Error('createSidecarHost requires a storage path')

  const child = new SidecarClass(entry, [storagePath, JSON.stringify(args)])
  let messageBuffer = ''
  let exited = false
  let closePromise = null

  child.stdout?.on('data', (data) => {
    const output = data.toString().trimEnd()
    if (output) console.info(`[node-worker] ${output}`)
  })
  child.stderr?.on('data', (data) => {
    const output = data.toString().trimEnd()
    if (output) console.warn(`[node-worker] ${output}`)
  })

  child.on('data', (data) => {
    messageBuffer += Buffer.from(data).toString()
    const lines = messageBuffer.split('\n')
    messageBuffer = lines.pop() || ''

    for (const line of lines) {
      if (!line.trim()) continue
      try {
        onMessage(JSON.parse(line))
      } catch (error) {
        onError(new Error(`Invalid node worker message: ${error.message}`))
      }
    }
  })
  child.on('error', onError)

  const exitPromise = new Promise((resolve) => {
    child.once('exit', (code, signal) => {
      exited = true
      onExit({ code, signal })
      resolve({ code, signal })
    })
  })

  function send (message) {
    if (exited) throw new Error('Node worker is not running')
    child.write(JSON.stringify(message) + '\n')
  }

  function close () {
    if (closePromise) return closePromise
    if (exited) return Promise.resolve()

    closePromise = new Promise((resolve) => {
      const timer = setTimeout(() => {
        if (!exited) child._process?.kill()
        resolve()
      }, SHUTDOWN_TIMEOUT_MS)
      timer.unref?.()

      exitPromise.finally(() => {
        clearTimeout(timer)
        resolve()
      })

      try {
        send({ type: 'shutdown' })
      } catch {
        clearTimeout(timer)
        resolve()
      }
    })

    return closePromise
  }

  return { child, close, exit: exitPromise, send }
}
