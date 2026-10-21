# Pear OTA worker pattern

Pear OTA starts a Bare worker from the Electron main process. The renderer
never imports P2P or native modules.

## Electron main process

```js
const pear = new PearRuntime(options)
await pear.ready()

const worker = pear.run(workerPath, [pear.storage])
worker.on('data', (chunk) => window.webContents.send('worker:message', chunk.toString()))

ipcMain.handle('worker:send', (_event, message) => {
  worker.write(JSON.stringify(message) + '\n')
})
```

Register IPC handlers before loading the renderer. Validate that IPC messages
come from the expected `webContents` and validate their shape before forwarding
them to privileged worker code.

## Preload

```js
contextBridge.exposeInMainWorld('unstoppable', {
  sendToWorker: (message) => ipcRenderer.invoke('worker:send', message),
  onWorkerMessage: (listener) => {
    const wrapped = (_event, chunk) => listener(chunk)
    ipcRenderer.on('worker:message', wrapped)
    return () => ipcRenderer.removeListener('worker:message', wrapped)
  }
})
```

## Worker

```js
const pipe = Bare.IPC
const storagePath = Bare.argv[2]
let buffer = ''

function send(message) {
  pipe.write(JSON.stringify(message) + '\n')
}

pipe.on('data', (chunk) => {
  buffer += chunk.toString()
  const lines = buffer.split('\n')
  buffer = lines.pop() || ''
  for (const line of lines) {
    if (line.trim()) handleMessage(JSON.parse(line))
  }
})

send({ type: 'workerReady' })
```

Keep resources in module scope so shutdown can close them in reverse order:
managed P2P sessions/datasets via their `close()` methods, then any separately
owned database/store. Managed helpers close their own resources; do not add a
second swarm owner. Finish with `Bare.exit()`.

## Renderer

Buffer chunks because a transport chunk is not guaranteed to contain one
complete JSON message. Register message listeners before starting the worker so
the synchronous `workerReady` event cannot be missed.
