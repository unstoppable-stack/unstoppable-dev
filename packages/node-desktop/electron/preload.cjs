'use strict'

const { contextBridge, ipcRenderer } = require('electron')

const channels = Object.freeze({
  COMMAND: 'personal-node:command',
  NODE_EVENT: 'personal-node:event',
  RENDERER_READY: 'personal-node:renderer-ready',
  TRAY_READY: 'personal-node:tray-ready',
  TRAY_ACTION: 'personal-node:tray-action',
  WINDOW_ACTION: 'personal-node:window-action',
  SETTINGS_PATH: 'personal-node:settings-path'
})

function subscribe (channel, callback) {
  if (typeof callback !== 'function') throw new TypeError('Listener must be a function')
  const listener = (_event, payload) => callback(payload)
  ipcRenderer.on(channel, listener)
  return () => ipcRenderer.removeListener(channel, listener)
}

contextBridge.exposeInMainWorld('personalNode', Object.freeze({
  sendCommand: (message) => ipcRenderer.send(channels.COMMAND, message),
  onWorkerMessage: (callback) => subscribe(channels.NODE_EVENT, callback),
  rendererReady: () => ipcRenderer.send(channels.RENDERER_READY),
  onTrayAction: (callback) => subscribe(channels.TRAY_ACTION, callback),
  trayReady: () => ipcRenderer.send(channels.TRAY_READY),
  windowAction: (action, value) => ipcRenderer.invoke(channels.WINDOW_ACTION, action, value),
  selectSettingsPath: (mode, suggestedPath) => ipcRenderer.invoke(channels.SETTINGS_PATH, mode, suggestedPath)
}))

window.addEventListener('DOMContentLoaded', () => {
  document.body.classList.add('electron-shell')
})
