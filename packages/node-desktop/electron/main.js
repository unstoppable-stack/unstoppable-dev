import { createRequire } from 'node:module'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { app, BrowserWindow, dialog, ipcMain, Menu, nativeImage, net, protocol, session, shell, Tray } from 'electron'
import { APP_ENTRY_URL, APP_SCHEME, resolveAppRequest } from './app-protocol.js'
import { sanitizeLaunchArgs, validateRendererCommand } from './command-policy.js'
import { ApprovedPathPolicy } from './path-policy.js'
import { createSidecarHost } from './sidecar-host.js'

const require = createRequire(import.meta.url)
const channels = require('./channels.cjs')
const MAX_BUFFERED_EVENTS = 100
const hasSingleInstanceLock = app.requestSingleInstanceLock()

let mainWindow = null
let sidecar = null
let tray = null
let rendererReady = false
let quitting = false
let shutdownStarted = false
const pendingEvents = []
const smokeMode = process.argv.includes('--smoke-test')
const qvacSmokeMode = smokeMode && process.argv.includes('--qvac-smoke')
let smokeNodeKey = null
let smokeQvacReady = false
let smokeTimer = null
const approvedPaths = new ApprovedPathPolicy()

protocol.registerSchemesAsPrivileged([{
  scheme: APP_SCHEME,
  privileges: {
    standard: true,
    secure: true,
    supportFetchAPI: true,
    codeCache: true
  }
}])

if (!hasSingleInstanceLock) app.quit()

function isTrustedRenderer (event) {
  return Boolean(mainWindow && !mainWindow.isDestroyed() && event.sender === mainWindow.webContents)
}

function showWindow () {
  if (!mainWindow || mainWindow.isDestroyed()) return
  mainWindow.show()
  if (mainWindow.isMinimized()) mainWindow.restore()
  mainWindow.focus()
}

function sendToRenderer (message) {
  if (smokeMode && message?.type === 'ready') {
    smokeNodeKey = message.publicKey
    if (qvacSmokeMode) sidecar?.send({ type: 'qvac-runtime-check' })
    maybeCompleteSmokeTest()
  }
  if (smokeMode && message?.type === 'qvacRuntimeReady') {
    smokeQvacReady = true
    console.info(`PERSONAL_NODE_QVAC_READY ${message.version}`)
    maybeCompleteSmokeTest()
  }
  if (rendererReady && mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channels.NODE_EVENT, message)
    return
  }

  pendingEvents.push(message)
  if (pendingEvents.length > MAX_BUFFERED_EVENTS) pendingEvents.shift()
}

function maybeCompleteSmokeTest () {
  if (!smokeMode || !rendererReady || !smokeNodeKey || (qvacSmokeMode && !smokeQvacReady)) return
  clearTimeout(smokeTimer)
  console.info(`PERSONAL_NODE_SMOKE_READY ${smokeNodeKey}`)
  setTimeout(stopAndQuit, 50)
}

function flushPendingEvents () {
  if (!mainWindow || mainWindow.isDestroyed()) return
  rendererReady = true
  for (const message of pendingEvents.splice(0)) {
    mainWindow.webContents.send(channels.NODE_EVENT, message)
  }
  maybeCompleteSmokeTest()
}

function trayIcon () {
  const svg = [
    '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18">',
    '<rect x="2" y="2" width="14" height="14" rx="4" fill="#ffffff"/>',
    '<path d="M5 6v4.2C5 12.6 6.5 14 9 14s4-1.4 4-3.8V6h-2v4.1c0 1.3-.6 2-2 2s-2-.7-2-2V6H5z" fill="#111827"/>',
    '</svg>'
  ].join('')
  const image = nativeImage.createFromDataURL(`data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`)
  image.setTemplateImage?.(true)
  return image
}

function sendTrayAction (action) {
  if (!mainWindow || mainWindow.isDestroyed()) return
  mainWindow.webContents.send(channels.TRAY_ACTION, action)
}

function createTray () {
  if (tray) return tray
  tray = new Tray(trayIcon())
  tray.setToolTip('Unstoppable Personal Node')
  if (process.platform === 'darwin') tray.setTitle('UN')
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Show Personal Node', click: () => sendTrayAction('show') },
    { type: 'separator' },
    { label: 'Pause all apps', click: () => sendTrayAction('pauseAll') },
    { label: 'Resume all apps', click: () => sendTrayAction('resumeAll') },
    { type: 'separator' },
    { label: 'Quit Personal Node', click: () => sendTrayAction('quit') }
  ]))
  tray.on('click', () => sendTrayAction('click'))
  return tray
}

async function stopAndQuit () {
  if (shutdownStarted) return
  shutdownStarted = true
  quitting = true
  try {
    await sidecar?.close()
  } finally {
    app.quit()
  }
}

function startSidecar () {
  const workerEntry = join(app.getAppPath(), 'electron', 'worker.js')
  const storagePath = join(app.getPath('userData'), 'node')
  sidecar = createSidecarHost({
    entry: workerEntry,
    storagePath,
    args: sanitizeLaunchArgs(process.argv.slice(1)),
    onMessage: sendToRenderer,
    onError: (error) => sendToRenderer({ type: 'fatal', error: error.message }),
    onExit: ({ code, signal }) => {
      if (quitting) return
      sendToRenderer({
        type: 'fatal',
        error: `Personal Node worker stopped unexpectedly (${signal || (code ?? 'unknown')}). Restart the app to recover.`
      })
    }
  })
}

function createWindow () {
  mainWindow = new BrowserWindow({
    title: 'Unstoppable Personal Node',
    backgroundColor: '#0d1117',
    width: 1100,
    height: 720,
    minWidth: 780,
    minHeight: 560,
    show: false,
    webPreferences: {
      preload: join(import.meta.dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      webviewTag: false,
      safeDialogs: true,
      spellcheck: false
    }
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    let external = null
    try { external = new URL(url) } catch {}
    if (
      external?.protocol === 'https:' &&
      (external.hostname === 'unstoppable.dev' || external.hostname === 'github.com')
    ) shell.openExternal(external.href)
    return { action: 'deny' }
  })
  mainWindow.webContents.on('will-navigate', (event, url) => {
    let target = null
    try { target = new URL(url) } catch {}
    if (target?.href !== APP_ENTRY_URL) event.preventDefault()
  })
  mainWindow.webContents.on('will-attach-webview', (event) => event.preventDefault())
  mainWindow.on('close', (event) => {
    if (quitting) return
    event.preventDefault()
    mainWindow.hide()
  })
  mainWindow.once('ready-to-show', () => mainWindow?.show())
  mainWindow.loadURL(APP_ENTRY_URL)
}

function configureAppProtocol () {
  protocol.handle(APP_SCHEME, (request) => {
    try {
      const target = resolveAppRequest(request.url, app.getAppPath())
      return net.fetch(pathToFileURL(target).href)
    } catch {
      return new Response('Not found', { status: 404 })
    }
  })
}

function configureSessionSecurity () {
  const allowedPermission = (webContents, permission) => (
    permission === 'notifications' &&
    mainWindow &&
    !mainWindow.isDestroyed() &&
    webContents === mainWindow.webContents
  )

  session.defaultSession.setPermissionCheckHandler((webContents, permission) => {
    return allowedPermission(webContents, permission)
  })
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    callback(allowedPermission(webContents, permission))
  })
  session.defaultSession.webRequest.onBeforeRequest(
    { urls: ['http://*/*', 'https://*/*', 'ws://*/*', 'wss://*/*'] },
    (_details, callback) => callback({ cancel: true })
  )
}

function registerIpc () {
  ipcMain.on(channels.COMMAND, (event, rawMessage) => {
    if (!isTrustedRenderer(event)) return
    try {
      const message = approvedPaths.authorizeCommand(validateRendererCommand(rawMessage))
      if (message.type === 'shutdown') {
        stopAndQuit()
        return
      }
      sidecar?.send(message)
    } catch (error) {
      sendToRenderer({ type: 'error', phase: 'desktop-ipc', error: error.message })
    }
  })

  ipcMain.on(channels.RENDERER_READY, (event) => {
    if (isTrustedRenderer(event)) flushPendingEvents()
  })
  ipcMain.on(channels.TRAY_READY, (event) => {
    if (isTrustedRenderer(event)) createTray()
  })
  ipcMain.handle(channels.WINDOW_ACTION, (event, action, value) => {
    if (!isTrustedRenderer(event)) throw new Error('Untrusted renderer')
    if (action === 'show' || action === 'restore' || action === 'focus') {
      showWindow()
      return true
    }
    if (action === 'isMinimized') return mainWindow?.isMinimized() || false
    if (action === 'badge') {
      const count = Number.isFinite(value) ? Math.max(0, Math.min(999, Math.trunc(value))) : 0
      app.setBadgeCount?.(count)
      return true
    }
    throw new Error(`Window action is not allowed: ${String(action)}`)
  })
  ipcMain.handle(channels.SETTINGS_PATH, async (event, mode, suggestedPath) => {
    if (!isTrustedRenderer(event)) throw new Error('Untrusted renderer')
    if (mode === 'export') {
      const result = await dialog.showSaveDialog(mainWindow, {
        title: 'Export Personal Node settings',
        defaultPath: typeof suggestedPath === 'string' && suggestedPath ? suggestedPath : 'personal-node-settings.uns',
        filters: [{ name: 'Personal Node settings', extensions: ['uns'] }],
        properties: ['createDirectory', 'showOverwriteConfirmation']
      })
      if (result.canceled || !result.filePath) return null
      return approvedPaths.approve(result.filePath, mode)
    }
    if (mode === 'import') {
      const result = await dialog.showOpenDialog(mainWindow, {
        title: 'Import Personal Node settings',
        filters: [{ name: 'Personal Node settings', extensions: ['uns', 'json'] }],
        properties: ['openFile']
      })
      if (result.canceled || result.filePaths.length !== 1) return null
      return approvedPaths.approve(result.filePaths[0], mode)
    }
    throw new Error(`Unsupported settings path mode: ${String(mode)}`)
  })
}

if (hasSingleInstanceLock) {
  app.on('second-instance', showWindow)
  app.on('before-quit', (event) => {
    if (quitting) return
    event.preventDefault()
    stopAndQuit()
  })
  app.on('window-all-closed', () => {})

  app.whenReady().then(() => {
    app.setName('Unstoppable Personal Node')
    if (process.platform === 'win32') app.setAppUserModelId('dev.unstoppable.personal-node')
    configureAppProtocol()
    registerIpc()
    createWindow()
    configureSessionSecurity()
    startSidecar()
    if (smokeMode) {
      smokeTimer = setTimeout(() => {
        console.error('PERSONAL_NODE_SMOKE_TIMEOUT')
        app.exit(1)
      }, 15_000)
    }
  }).catch((error) => {
    console.error(error)
    app.exit(1)
  })
}
