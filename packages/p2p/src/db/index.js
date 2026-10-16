import b4a from 'b4a'

const MAX_OPERATION_BYTES = 64 * 1024

/** Experimental Autobase integration. Application reducers must be deterministic. */
export function autobaseAdapter ({ openView, apply, validate = () => true, closeView = async view => { await view?.close?.() } } = {}) {
  if (typeof openView !== 'function' || typeof apply !== 'function' || typeof validate !== 'function' || typeof closeView !== 'function') {
    throw new TypeError('autobaseAdapter needs synchronous openView, deterministic apply and validate functions')
  }
  return Object.freeze({ kind: 'autobase-v1', openView, apply, validate, closeView })
}

function decodeKey (key, name) {
  if (typeof key === 'string' && /^[a-fA-F0-9]{64}$/.test(key)) return b4a.from(key, 'hex')
  if (b4a.isBuffer(key) && key.byteLength === 32) return b4a.from(key)
  throw new TypeError(`${name} must be a 32-byte key or 64-character hex string`)
}

function aborted (signal) {
  if (signal?.aborted) throw signal.reason || new Error('Database operation aborted')
}

/**
 * Open a local database; networking only adds replication. This does not expose
 * queries through RPC, recover secret keys, or implement a backup service.
 */
export async function openDatabase ({ node, store, adapter, key = null, encryptionKey, discovery = true, signal } = {}) {
  aborted(signal)
  if (!node?.swarm || !store?.session || adapter?.kind !== 'autobase-v1') throw new TypeError('openDatabase needs a P2P node, Corestore and autobaseAdapter')
  const bootstrap = key === null ? null : decodeKey(key, 'Database key')
  const secret = encryptionKey === undefined ? undefined : decodeKey(encryptionKey, 'Encryption key')
  // Optional engine is loaded only by consumers opening this entry point.
  const { default: Autobase } = await import('autobase')
  aborted(signal)
  const session = store.session()
  let base
  let closed = false
  let closing = null
  let lastError = null
  let lastConnectionError = null
  let discoverySession = null
  const sockets = new WeakSet()
  const watchers = new Set()
  const waiting = new Set()

  const validOperation = value => {
    try { return adapter.validate(value) === true } catch { return false }
  }

  function state () {
    return {
      experimental: true,
      closed,
      writable: !closed && !!base?.writable,
      indexer: !!base?.isIndexer,
      localLength: base?.local?.length || 0,
      // A system checkpoint describes Autobase ordering, not a complete backup
      // nor confirmation that every app view is present on another device.
      checkpoint: base?.core?.key
        ? { scope: 'autobase-system', key: b4a.toString(base.core.key, 'hex'), fork: base.core.fork, length: base.core.length, signedLength: base.core.signedLength }
        : null,
      error: lastError?.message || null,
      connectionError: lastConnectionError?.message || null
    }
  }

  function notify () {
    for (const watcher of watchers) {
      try { watcher(state()) } catch {}
    }
  }

  function attach (socket) {
    if (closed || sockets.has(socket)) return
    sockets.add(socket)
    try {
      base.replicate(socket)
      lastConnectionError = null
    } catch (error) {
      // One failed connection must not disable ordinary local database use.
      lastConnectionError = error
      notify()
    }
  }

  function assertOpen () {
    if (closed) throw new Error('Database is closed')
    if (lastError) throw lastError
  }

  function serialize (envelope) {
    const bytes = b4a.from(JSON.stringify(envelope))
    if (bytes.byteLength > MAX_OPERATION_BYTES) throw new RangeError('Database operation exceeds 64 KiB')
    return bytes
  }

  async function appendEnvelope (envelope, options = {}) {
    assertOpen()
    aborted(options.signal)
    if (!base.writable) throw new Error('This device is not an authorized database writer')
    const bytes = serialize(envelope)
    // Cancellation can stop admission, not erase an immutable append already
    // admitted. No automatic retries: callers must not duplicate side effects.
    aborted(options.signal)
    await base.append(bytes)
    await base.update()
    return { scope: 'local-applied', writerKey: b4a.toString(base.local.key, 'hex'), length: base.local.length }
  }

  function close () {
    if (closing) return closing
    closed = true
    // Publish the close promise before any asynchronous discovery teardown.
    closing = (async () => {
      node.swarm.removeListener('connection', attach)
      if (discoverySession) {
        try { await discoverySession.destroy() } catch {}
        discoverySession = null
      }
      for (const reject of waiting) reject(new Error('Database is closed'))
      watchers.clear()
      try { if (base) await base.close() } finally { await session.close() }
    })()
    return closing
  }

  try {
    base = new Autobase(session, bootstrap, {
      optimistic: false,
      encryptionKey: secret,
      encrypted: !!secret,
      open (views) {
        const view = adapter.openView(views)
        if (view?.then) throw new TypeError('openView must be synchronous')
        return view
      },
      close: adapter.closeView,
      async apply (nodes, view, host) {
        for (const entry of nodes) {
          if (!entry.value || entry.value.byteLength > MAX_OPERATION_BYTES) continue
          let envelope
          try { envelope = JSON.parse(b4a.toString(entry.value)) } catch { continue }
          if (!envelope || envelope.schema !== 1) continue
          const writerKey = b4a.toString(entry.from.key, 'hex')
          if (envelope.type === 'membership.add' || envelope.type === 'membership.remove') {
            // Bootstrap writer is the sole membership administrator in this
            // prototype. Writer grants never implicitly grant administration.
            if (writerKey !== b4a.toString(host.key, 'hex') || typeof envelope.key !== 'string' || !/^[a-f0-9]{64}$/.test(envelope.key)) continue
            const member = b4a.from(envelope.key, 'hex')
            if (envelope.type === 'membership.add') await host.addWriter(member, { indexer: false })
            else if (envelope.key !== writerKey && host.removeable(member)) await host.removeWriter(member)
            continue
          }
          if (envelope.type !== 'operation' || !validOperation(envelope.value)) continue
          await adapter.apply(envelope.value, view, { writerKey, length: entry.length })
        }
      }
    })
    base.on('error', error => { lastError = error; notify() })
    base.on('update', notify)
    base.on('writable', notify)
    base.on('unwritable', notify)
    node.swarm.on('connection', attach)
    for (const socket of node.swarm.connections || []) attach(socket)
    await base.ready()
    aborted(signal)
    if (discovery) discoverySession = node.swarm.join(base.discoveryKey)
  } catch (error) {
    await close().catch(() => {})
    throw error
  }

  return {
    experimental: true,
    get key () { return b4a.toString(base.key, 'hex') },
    get writerKey () { return b4a.toString(base.local.key, 'hex') },
    get writable () { return !closed && base.writable },
    // Read-only by contract: writes to this view must happen inside apply.
    get view () { assertOpen(); return base.view },
    state,
    async append (value, options) {
      const bytes = serialize({ schema: 1, type: 'operation', value })
      const envelope = JSON.parse(b4a.toString(bytes))
      if (!Object.hasOwn(envelope, 'value') || !validOperation(envelope.value)) throw new TypeError('Invalid database operation')
      return appendEnvelope(envelope, options)
    },
    async update (options = {}) {
      assertOpen()
      aborted(options.signal)
      await base.update()
      return state()
    },
    members: {
      async add (writerKey, options = {}) {
        assertOpen()
        const key = b4a.toString(decodeKey(writerKey, 'Writer key'), 'hex')
        if (!b4a.equals(base.local.key, base.key)) throw new Error('Only the founding writer may manage database membership')
        return appendEnvelope({ schema: 1, type: 'membership.add', key }, options)
      },
      async remove (writerKey, options = {}) {
        assertOpen()
        const key = b4a.toString(decodeKey(writerKey, 'Writer key'), 'hex')
        if (!b4a.equals(base.local.key, base.key)) throw new Error('Only the founding writer may manage database membership')
        if (key === b4a.toString(base.key, 'hex')) throw new Error('Cannot remove the founding writer')
        return appendEnvelope({ schema: 1, type: 'membership.remove', key }, options)
      }
    },
    watch (callback) {
      assertOpen()
      if (typeof callback !== 'function') throw new TypeError('watch needs a callback')
      watchers.add(callback)
      return () => watchers.delete(callback)
    },
    waitFor (predicate, { timeoutMs = 10_000, signal } = {}) {
      assertOpen()
      aborted(signal)
      if (typeof predicate !== 'function' || !Number.isFinite(timeoutMs) || timeoutMs <= 0 || timeoutMs > 120_000) throw new TypeError('waitFor needs a predicate and a timeout between 0 and 120000 ms')
      return new Promise((resolve, reject) => {
        let timer
        const finish = (error, value) => {
          clearTimeout(timer)
          signal?.removeEventListener('abort', onAbort)
          watchers.delete(check)
          waiting.delete(cancel)
          if (error) reject(error); else resolve(value)
        }
        const cancel = error => finish(error)
        const onAbort = () => finish(signal.reason || new Error('Database wait aborted'))
        const check = current => {
          try {
            if (current.error) finish(new Error(current.error))
            else if (predicate(current)) finish(null, current)
          } catch (error) { finish(error) }
        }
        waiting.add(cancel)
        watchers.add(check)
        signal?.addEventListener('abort', onAbort, { once: true })
        timer = setTimeout(() => finish(new Error('Database wait timed out')), timeoutMs)
        check(state())
      })
    },
    close
  }
}
