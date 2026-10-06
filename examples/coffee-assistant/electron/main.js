import { app, BrowserWindow, ipcMain, shell } from 'electron'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import PearRuntime from 'pear-runtime'

const require = createRequire(import.meta.url)
const pkg = require('../package.json')

let mainWindow = null
let pear = null
let worker = null
let closing = false

function storageOverride() {
  const index = process.argv.indexOf('--storage')
  return index >= 0 ? process.argv[index + 1] : null
}

function getPear() {
  if (pear) return pear
  const customStorage = storageOverride()
  pear = new PearRuntime({
    name: pkg.name,
    version: pkg.version,
    upgrade: pkg.upgrade,
    dir: customStorage || join(app.getPath('userData'), 'pear'),
    app: app.isPackaged ? process.execPath : null,
    updates: app.isPackaged || process.argv.includes('--updates'),
  })
  pear.on('error', (err) => console.error('[pear-runtime]', err))
  return pear
}

async function startWorker() {
  if (worker) return true
  const runtime = getPear()
  await runtime.ready()
  worker = runtime.run(join(import.meta.dirname, '..', 'worker.js'), [runtime.storage, process.env.COFFEE_P2P_BOOTSTRAP || ''])
  worker.on('data', (data) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('worker:message', data.toString())
    }
  })
  worker.stderr?.on('data', (data) => console.error('[worker]', data.toString().trimEnd()))
  worker.once('exit', (code) => {
    worker = null
    if (!closing && mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('worker:exit', code)
    }
  })
  return true
}

async function shutdown() {
  if (closing) return
  closing = true
  try { worker?.write(JSON.stringify({ type: 'shutdown' }) + '\n') } catch {}
  const currentWorker = worker
  if (currentWorker) {
    await Promise.race([
      new Promise((resolve) => currentWorker.once('exit', resolve)),
      new Promise((resolve) => setTimeout(resolve, 1500)),
    ])
    try { currentWorker.kill() } catch {}
  }
  await pear?.close().catch(() => {})
}

function assertTrusted(event) {
  if (!mainWindow || mainWindow.isDestroyed() || event.sender !== mainWindow.webContents) {
    throw new Error('Untrusted renderer')
  }
}

ipcMain.handle('worker:start', (event) => {
  assertTrusted(event)
  return startWorker()
})
ipcMain.handle('worker:send', (event, message) => {
  assertTrusted(event)
  if (!worker) throw new Error('Worker is not running')
  if (!message || typeof message !== 'object' || Array.isArray(message)) {
    throw new Error('Worker message must be an object')
  }
  worker.write(JSON.stringify(message) + '\n')
})

async function createWindow() {
  mainWindow = new BrowserWindow({
    title: 'coffee-assistant',
    backgroundColor: '#1a1a2e',
    width: 1100,
    height: 720,
    webPreferences: {
      preload: join(import.meta.dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) shell.openExternal(url)
    return { action: 'deny' }
  })
  await mainWindow.loadFile(join(import.meta.dirname, '..', 'index.html'))
  if (!app.isPackaged) mainWindow.webContents.openDevTools({ mode: 'detach' })
}

app.whenReady().then(createWindow)
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})
app.on('before-quit', (event) => {
  if (closing) return
  event.preventDefault()
  shutdown().finally(() => app.quit())
})
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
