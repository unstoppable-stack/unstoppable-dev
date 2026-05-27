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

import { EventEmitter } from 'bare-events'
import { loadRegistry, saveRegistry, recordApproval, recordDenial, decisionFor } from './registry.js'

export class ApprovalGate extends EventEmitter {
  constructor ({ registryPath }) {
    super()
    if (!registryPath) throw new Error('ApprovalGate requires registryPath')
    this.registryPath = registryPath
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

    // First time we see this key. Block until the UI decides.
    return new Promise((resolve) => {
      const info = {
        appId,
        appName,
        publicKey,
        deviceName: typeof deviceName === 'string' ? deviceName : null,
        remoteKey: typeof remoteKey === 'string' ? remoteKey : null,
        receivedAt: new Date().toISOString()
      }
      this._pending.set(publicKey, { resolve, info })
      this.emit('pending', info)
    })
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
