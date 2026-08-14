import { resolve } from 'node:path'

const DEFAULT_TTL_MS = 10 * 60 * 1_000

export class ApprovedPathPolicy {
  constructor ({ ttlMs = DEFAULT_TTL_MS, now = () => Date.now() } = {}) {
    this.ttlMs = ttlMs
    this.now = now
    this.entries = new Map()
  }

  approve (path, mode) {
    if (mode !== 'export' && mode !== 'import') throw new Error(`Unsupported settings path mode: ${mode}`)
    if (typeof path !== 'string' || path.length === 0) throw new Error('Settings path is required')
    const normalized = resolve(path)
    this.entries.set(normalized, { mode, expiresAt: this.now() + this.ttlMs })
    return normalized
  }

  authorizeCommand (message) {
    const mode = message.type === 'export-state'
      ? 'export'
      : (message.type === 'preview-import' || message.type === 'import-state' ? 'import' : null)
    if (!mode) return message

    const path = typeof message.path === 'string' ? resolve(message.path) : ''
    const approval = this.entries.get(path)
    if (!approval || approval.mode !== mode || approval.expiresAt < this.now()) {
      this.entries.delete(path)
      throw new Error(`Choose the ${mode} file using the system file dialog before continuing`)
    }

    if (message.type === 'export-state' || message.type === 'import-state') this.entries.delete(path)
    return { ...message, path }
  }
}
