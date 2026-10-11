// Trust-on-First-Use pair-approval gate for the dashboard.
//
// The dashboard wires `gate.request` into `NodeDaemon`'s
// `approvePairing` constructor option. For every `pairRequest` the
// daemon receives:
//
//   1. Look up the app's public key in the persisted registry.
//      - If denied → return 'deny' immediately. Daemon sends
//        `pairDenied` to the client. App never gets registered.
//      - If approved → return 'approve' immediately. The user is
//        not prompted for a key they've already trusted.
//   2. Otherwise this is the first time we've seen this key.
//      Emit 'pending' (the worker forwards it to the UI which
//      shows a modal) and return a Promise that the modal will
//      resolve via `gate.approve(publicKey, ...)` or
//      `gate.deny(publicKey, ...)`.
//
// `revoke()` is the Unpair button's deeper sibling: it not only
// drops the app from the registry but also writes a denial entry
// keyed by `publicKey`, so a malicious app can't silently re-pair
// after being revoked.

import { loadRegistry, saveRegistry, recordApproval, recordDenial, decisionFor, validateRegistry } from './registry.js'

// The approval gate is shared by the Bare sidecar and Node-based integration
// tests. Resolve the emitter from the active runtime so importing this module
// does not require node-desktop's dependencies to be installed beside a
// standalone unstoppable-node checkout.
const { EventEmitter } = typeof globalThis.Bare !== 'undefined'
  ? await import('bare-events')
  : await import('node:events')

export class ApprovalGate extends EventEmitter {
  constructor ({ registryPath, maxPending = 32, timeoutMs = 30_000 }) {
    super()
    if (!registryPath) throw new Error('ApprovalGate requires registryPath')
    this.registryPath = registryPath
    this.maxPending = maxPending
    this.timeoutMs = timeoutMs
    this._cache = { version: 1, approved: {}, denied: {} }
    this._pending = new Map() // publicKey → { resolve, info }
    this._ready = false
  }

  async ready () {
    if (this._ready) return
    this._cache = await loadRegistry(this.registryPath)
    this._ready = true
  }

  // Called by the daemon for each pairRequest.
  async request ({ appId, appName, publicKey, deviceName, remoteKey }) {
    await this.ready()

    const { decision } = decisionFor(this._cache, publicKey)
    if (decision === 'deny') {
      this.emit('autoDecided', { decision: 'deny', publicKey, appId, appName, deviceName })
      return 'deny'
    }
    if (decision === 'approve') {
      this.emit('autoDecided', { decision: 'approve', publicKey, appId, appName, deviceName })
      return 'approve'
    }

    if (this._pending.has(publicKey)) return this._pending.get(publicKey).promise
    if (this._pending.size >= this.maxPending) return 'deny'
    let resolve
    const promise = new Promise(r => { resolve = r })
    {
      const info = {
        appId,
        appName,
        publicKey,
        deviceName: typeof deviceName === 'string' ? deviceName : null,
        remoteKey: typeof remoteKey === 'string' ? remoteKey : null,
        receivedAt: new Date().toISOString()
      }
      const timer = setTimeout(() => this.cancel(publicKey), this.timeoutMs)
      timer.unref?.()
      this._pending.set(publicKey, { resolve, info, promise, timer })
      this.emit('pending', info)
    }
    return promise
  }

  // Called by the UI bridge when the user clicks an approval button.
  // `remember=true` persists the decision so future pair attempts
  // from the same key skip the modal.
  async approve (publicKey, { remember = true } = {}) {
    const entry = this._pending.get(publicKey)
    if (!entry) return false

    if (remember) {
      this._cache = await recordApproval(this.registryPath, publicKey, {
        appId: entry.info.appId,
        appName: entry.info.appName,
        remember: true
      })
    }

    clearTimeout(entry.timer)
    this._pending.delete(publicKey)
    entry.resolve(remember ? 'approve-remember' : 'approve')
    this.emit('decided', {
      publicKey,
      appId: entry.info.appId,
      appName: entry.info.appName,
      decision: remember ? 'approve-remember' : 'approve'
    })
    return true
  }

  async deny (publicKey, { remember = true, reason = 'denied' } = {}) {
    const entry = this._pending.get(publicKey)

    if (remember) {
      const appId = entry?.info.appId || 'unknown'
      const appName = entry?.info.appName || 'unknown'
      this._cache = await recordDenial(this.registryPath, publicKey, {
        appId,
        appName,
        reason
      })
    }

    if (entry) {
      clearTimeout(entry.timer)
      this._pending.delete(publicKey)
      entry.resolve('deny')
      this.emit('decided', {
        publicKey,
        appId: entry.info.appId,
        appName: entry.info.appName,
        decision: 'deny',
        reason
      })
    }
    return !!entry
  }

  // Unpair + remember. Drops any approval, writes a denial keyed by
  // public key. Future pairRequests from this key auto-deny.
  async revoke (publicKey, { appId, appName, reason = 'revoked by user' } = {}) {
    this._cache = await recordDenial(this.registryPath, publicKey, {
      appId: appId || 'unknown',
      appName: appName || 'unknown',
      reason
    })
    this.emit('revoked', { publicKey, appId, appName, reason })
  }

  // Promote a key the daemon auto-paired (no user gate at the time of
  // pairing — e.g. paired before the trust gate existed, or paired in
  // CLI mode without an `approvePairing` callback) to "user-approved"
  // status. Writes an approval entry so it shows the `trusted` badge.
  async promote (publicKey, { appId, appName } = {}) {
    this._cache = await recordApproval(this.registryPath, publicKey, {
      appId: appId || 'unknown',
      appName: appName || 'unknown',
      remember: true
    })
    this.emit('promoted', { publicKey, appId, appName })
  }

  // Forget a decision entirely (returns key to "unknown" state).
  // Useful for "Reset trust" if we add it later.
  async forget (publicKey) {
    delete this._cache.approved[publicKey]
    delete this._cache.denied[publicKey]
    await saveRegistry(this.registryPath, this._cache)
    this.emit('forgot', { publicKey })
  }

  async importSnapshot (snapshot) {
    await this.ready()
    const imported = validateRegistry(snapshot)
    this._cache = imported
    await saveRegistry(this.registryPath, this._cache)
    this.emit('imported', this.snapshot())
    return this.snapshot()
  }

  cancel (publicKey) {
    const entry = this._pending.get(publicKey)
    if (!entry) return false
    clearTimeout(entry.timer)
    this._pending.delete(publicKey)
    entry.resolve('deny')
    this.emit('decided', { publicKey, appId: entry.info.appId, appName: entry.info.appName, decision: 'deny', reason: 'request expired or disconnected' })
    return true
  }

  close () { for (const key of this._pending.keys()) this.cancel(key) }

  listPending () {
    return Array.from(this._pending.values()).map((e) => e.info)
  }

  snapshot () {
    return {
      approved: { ...this._cache.approved },
      denied: { ...this._cache.denied },
      pending: this.listPending()
    }
  }
}
