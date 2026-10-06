const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('unstoppable', {
  startWorker: () => ipcRenderer.invoke('worker:start'),
  sendToWorker: (message) => ipcRenderer.invoke('worker:send', message),
  onWorkerMessage: (listener) => {
    const wrapped = (_event, chunk) => listener(chunk)
    ipcRenderer.on('worker:message', wrapped)
    return () => ipcRenderer.removeListener('worker:message', wrapped)
  },
  onWorkerExit: (listener) => {
    const wrapped = (_event, code) => listener(code)
    ipcRenderer.on('worker:exit', wrapped)
    return () => ipcRenderer.removeListener('worker:exit', wrapped)
  },
})
