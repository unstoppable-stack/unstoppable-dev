const pending = new Map()
const listeners = new Set()
let sequence = 0,
  buffer = ''
let readyResolve, readyReject
export const ready = new Promise((resolve, reject) => {
  readyResolve = resolve
  readyReject = reject
})
const startupTimer = setTimeout(
  () =>
    readyReject(
      new Error('Local storage did not start. Close the app and try again.'),
    ),
  60000,
)

function failed(error) {
  clearTimeout(startupTimer)
  readyReject(error)
  for (const request of pending.values()) {
    clearTimeout(request.timer)
    request.reject(error)
  }
  pending.clear()
  for (const listener of listeners) listener({ fatal: error.message })
}
window.unstoppable.onWorkerExit(() =>
  failed(
    new Error(
      'The notes worker stopped. Reopen the app; saved notes remain on this device.',
    ),
  ),
)
window.unstoppable.onWorkerMessage((chunk) => {
  buffer += chunk
  const lines = buffer.split('\n')
  buffer = lines.pop() || ''
  for (const line of lines) {
    if (!line.trim()) continue
    const message = JSON.parse(line)
    if (message.type === 'fatal') {
      failed(new Error(message.error))
      continue
    }
    if (message.type === 'ready') {
      clearTimeout(startupTimer)
      readyResolve(message.state)
    }
    if (message.type === 'state' || message.type === 'ready')
      for (const listener of listeners) listener(message.state)
    if (message.type === 'reply') {
      const request = pending.get(message.id)
      if (!request) continue
      clearTimeout(request.timer)
      pending.delete(message.id)
      message.error
        ? request.reject(new Error(message.error))
        : request.resolve(message.result)
    }
  }
})
export function watch(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
export function request(action, value) {
  const id = `notes-${++sequence}`
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id)
      reject(
        new Error(
          'The operation timed out. Your saved notes remain on this device.',
        ),
      )
    }, 55000)
    pending.set(id, { resolve, reject, timer })
    window.unstoppable
      .sendToWorker({ type: 'notes', action, value, id })
      .catch((error) => {
        clearTimeout(timer)
        pending.delete(id)
        reject(error)
      })
  })
}
window.unstoppable.startWorker().catch(failed)
