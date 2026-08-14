const MAX_COMMAND_BYTES = 64 * 1024

export const ALLOWED_COMMANDS = new Set([
  'unpair',
  'pair-approve',
  'pair-deny',
  'forget-trust',
  'promote-trust',
  'refresh-status',
  'get-config',
  'update-config',
  'export-state',
  'preview-import',
  'import-state',
  'pause-app',
  'resume-app',
  'set-app-quota',
  'set-app-grant',
  'peek-core',
  'peek-drive',
  'enable-ai',
  'disable-ai',
  'shutdown'
])

export function validateRendererCommand (message) {
  if (!message || typeof message !== 'object' || Array.isArray(message)) {
    throw new TypeError('Node command must be an object')
  }

  const prototype = Object.getPrototypeOf(message)
  if (prototype !== Object.prototype && prototype !== null) {
    throw new TypeError('Node command must be a plain object')
  }

  if (!ALLOWED_COMMANDS.has(message.type)) {
    throw new Error(`Renderer command is not allowed: ${String(message.type)}`)
  }

  const encoded = JSON.stringify(message)
  if (Buffer.byteLength(encoded) > MAX_COMMAND_BYTES) {
    throw new Error(`Renderer command exceeds ${MAX_COMMAND_BYTES} bytes`)
  }

  return JSON.parse(encoded)
}

export function sanitizeLaunchArgs (args = []) {
  const allowed = []

  for (let index = 0; index < args.length; index++) {
    const arg = args[index]
    if (arg === '--ai' || arg === '--ai-mock') {
      allowed.push(arg)
      continue
    }
    if (arg === '--ai-model' && typeof args[index + 1] === 'string') {
      allowed.push(arg, args[index + 1])
      index++
    }
  }

  return allowed
}
