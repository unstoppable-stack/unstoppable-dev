let ui

if (globalThis.personalNode) {
  const bridge = globalThis.personalNode
  ui = {
    app: {
      tray: async (_options, callback) => {
        const unsubscribe = bridge.onTrayAction(callback)
        bridge.trayReady()
        return unsubscribe
      },
      show: () => bridge.windowAction('show'),
      restore: () => bridge.windowAction('restore'),
      focus: () => bridge.windowAction('focus'),
      isMinimized: () => bridge.windowAction('isMinimized'),
      badge: (count) => bridge.windowAction('badge', count)
    }
  }
} else {
  ui = (await import('pear-electron')).default
}

export default ui
