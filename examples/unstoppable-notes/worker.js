import { openNotebook } from './src/notebook.js'

const pipe = Bare.IPC
let notebook,
  buffer = '',
  stopping = false
const send = (message) => {
  if (!stopping) pipe.write(JSON.stringify(message) + '\n')
}
const publish = () => {
  if (notebook) send({ type: 'state', state: notebook.state() })
}

async function command(message) {
  if (message.type === 'shutdown') {
    if (stopping) return
    stopping = true
    await notebook?.close()
    Bare.exit(0)
    return
  }
  if (message.type !== 'notes' || typeof message.id !== 'string') return
  try {
    if (!notebook) throw new Error('Local storage is not ready yet')
    let result
    switch (message.action) {
      case 'state':
        result = notebook.state()
        break
      case 'save':
        result = await notebook.save(message.value)
        break
      case 'invite':
        result = await notebook.invite()
        break
      case 'pair':
        result = await notebook.pair(message.value)
        break
      case 'sync':
        result = await notebook.sync()
        break
      case 'cancel':
        notebook.cancel()
        break
      default:
        throw new Error('Unknown notes operation')
    }
    send({ type: 'reply', id: message.id, result })
  } catch (error) {
    send({ type: 'reply', id: message.id, error: error.message })
  }
}
pipe.on('data', (bytes) => {
  buffer += bytes.toString()
  const lines = buffer.split('\n')
  buffer = lines.pop() || ''
  for (const line of lines) {
    try {
      command(JSON.parse(line)).catch((error) =>
        send({ type: 'fatal', error: error.message }),
      )
    } catch {
      send({ type: 'fatal', error: 'Invalid desktop message' })
    }
  }
})
try {
  const bootstrap = Bare.argv[3] ? JSON.parse(Bare.argv[3]) : undefined
  notebook = await openNotebook({
    directory: Bare.argv[2],
    swarm: bootstrap ? { bootstrap } : undefined,
    onChange: publish,
  })
  send({ type: 'ready', state: notebook.state() })
} catch (error) {
  send({ type: 'fatal', error: error.message })
}
