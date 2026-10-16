import { createDaemonHost } from './daemon-host.js'

export function runDaemonWorker ({ pipe, storagePath, args = [], exit, nodeOptions } = {}) {
  if (!pipe || typeof pipe.on !== 'function' || typeof pipe.write !== 'function') {
    throw new Error('runDaemonWorker requires a duplex pipe')
  }

  function send (msg) {
    pipe.write(JSON.stringify(msg) + '\n')
  }

  const host = createDaemonHost({ storagePath, args, send, exit, nodeOptions })
  let buffer = ''

  pipe.on('data', async (data) => {
    buffer += Buffer.from(data).toString()
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''

    for (const line of lines) {
      if (!line.trim()) continue
      try {
        await host.handleCommand(JSON.parse(line))
      } catch (err) {
        send({
          type: 'error',
          phase: 'command',
          error: err instanceof Error ? err.message : String(err)
        })
      }
    }
  })

  Promise.resolve(host.start()).catch((err) => {
    send({
      type: 'fatal',
      error: err instanceof Error ? err.message : String(err)
    })
  })

  return host
}
