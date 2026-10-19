import { runtimePath, runtimeFs, atomicWriteFile } from './runtime-files.js'
import Corestore from 'corestore'
import Hyperbee from 'hyperbee'
import b4a from 'b4a'
import crypto from 'hypercore-crypto'
import { dataNetwork } from './data-network.js'
import { createNode } from './node.js'
import { openDatabase, autobaseAdapter } from './db/index.js'

function keyBytes (key) {
  if (typeof key !== 'string' || !/^[a-fA-F0-9]{64}$/.test(key)) throw new TypeError('key must be a 64-character hex string')
  return b4a.from(key, 'hex')
}
function checkKey (key) {
  if (typeof key !== 'string' || key.length === 0 || key.length > 1024) throw new TypeError('Entry key must contain 1–1024 characters')
}
function jsonValue (value) {
  // Reject values JSON would silently change, including undefined and NaN.
  const seen = new Set()
  function visit (v) {
    if (v === null || typeof v === 'string' || typeof v === 'boolean') return
    if (typeof v === 'number' && Number.isFinite(v)) return
    if (typeof v !== 'object' || seen.has(v) || (!Array.isArray(v) && Object.getPrototypeOf(v) !== Object.prototype && Object.getPrototypeOf(v) !== null)) throw new TypeError('Value must be JSON data')
    seen.add(v)
    for (const item of Array.isArray(v) ? v : Object.values(v)) visit(item)
    seen.delete(v)
  }
  visit(value)
  return JSON.parse(JSON.stringify(value))
}
async function resources ({ storage, nodeOptions = {}, kind, key }) {
  if (typeof storage !== 'string' || !storage) throw new TypeError('storage must be a directory')
  const node = createNode({ ...nodeOptions, storage: runtimePath.join(storage, 'identity'), capabilities: [], reconnect: false })
  let store
  try {
    await node.ready()
    const descriptorPath = runtimePath.join(storage, 'dataset.json')
    let saved
    try { saved = JSON.parse(await runtimeFs.readFile(descriptorPath, 'utf8')) } catch (error) {
      if (error.code !== 'ENOENT') throw error
    }
    if (saved) {
      keyBytes(saved.key)
      if (saved.kind !== kind || (key !== undefined && key.toLowerCase() !== saved.key)) throw new Error('Storage belongs to a different dataset')
      key = saved.key
    }
    store = new Corestore(runtimePath.join(storage, 'data'))
    await store.ready()
    return { node, store, key, save: key => atomicWriteFile(descriptorPath, JSON.stringify({ kind, key })) }
  } catch (error) {
    await node.close().catch(() => {})
    await store?.close().catch(() => {})
    throw error
  }
}

/** One writer, checkpointed read-only mirrors. Dataset keys are read capabilities. */
export async function openCollection ({ storage, key, nodeOptions } = {}) {
  if (key !== undefined) keyBytes(key)
  const owned = await resources({ storage, nodeOptions, key, kind: 'collection' })
  const { node, store } = owned
  const remoteKey = owned.key === undefined ? null : keyBytes(owned.key)
  let bee, discovery, closing, closed = false
  const waits = new Set()
  const attach = socket => store.replicate(socket)
  function assertOpen () { if (closed) throw new Error('Collection is closed') }
  function close () {
    if (closing) return closing
    closed = true
    closing = (async () => {
      for (const cancel of waits) cancel(new Error('Collection is closed'))
      node.swarm.removeListener('connection', attach)
      try { await discovery?.close() } finally {
        try { await node.close() } finally {
          try { await bee?.close() } finally { await store.close() }
        }
      }
    })()
    return closing
  }
  try {
    bee = new Hyperbee(store.get(remoteKey ? { key: remoteKey } : { name: 'collection' }), { keyEncoding: 'utf-8', valueEncoding: 'json' })
    await bee.ready()
    await owned.save(b4a.toString(bee.core.key, 'hex'))
    node.swarm.on('connection', attach)
    discovery = dataNetwork(node.swarm, bee.core.discoveryKey)
    return {
      network: discovery,
      get key () { return b4a.toString(bee.core.key, 'hex') },
      get version () { return bee.core.length },
      get writable () { return !closed && bee.core.writable },
      async put (key, value) {
        assertOpen(); checkKey(key)
        if (!bee.core.writable) throw new Error('Collection is read-only on this device')
        await bee.put(key, jsonValue(value))
      },
      async del (key) {
        assertOpen(); checkKey(key)
        if (!bee.core.writable) throw new Error('Collection is read-only on this device')
        await bee.del(key)
      },
      async get (key) {
        assertOpen(); checkKey(key)
        return (await bee.get(key, { wait: false }))?.value ?? null
      },
      // Download a known writer version; completion means this device has those
      // blocks, not that another device has backed up subsequent writes.
      async sync ({ version, timeoutMs = 10_000, signal } = {}) {
        assertOpen()
        if (!Number.isSafeInteger(version) || version < 0) throw new TypeError('sync needs a non-negative writer version')
        if (!Number.isFinite(timeoutMs) || timeoutMs <= 0 || timeoutMs > 120_000) throw new TypeError('timeoutMs must be between 0 and 120000')
        if (signal?.aborted) throw signal.reason || new Error('Sync aborted')
        const range = bee.core.download({ start: 0, end: version })
        let timer, cancel
        const onAbort = () => cancel(signal.reason || new Error('Sync aborted'))
        try {
          await Promise.race([range.done(), new Promise((resolve, reject) => {
            cancel = reject
            waits.add(cancel)
            timer = setTimeout(() => cancel(discovery.timeoutError('Sync timed out')), timeoutMs)
            signal?.addEventListener('abort', onAbort, { once: true })
          })])
          return { scope: 'local-downloaded', version }
        } finally {
          clearTimeout(timer)
          waits.delete(cancel)
          signal?.removeEventListener('abort', onAbort)
          range.destroy()
        }
      },
      close
    }
  } catch (error) { await close().catch(() => {}); throw error }
}

const adapter = autobaseAdapter({
  openView: views => new Hyperbee(views.get('key-value'), { keyEncoding: 'utf-8', valueEncoding: 'json' }),
  validate (op) {
    try {
      checkKey(op?.key)
      if (op.type === 'del') return true
      if (op.type !== 'put') return false
      jsonValue(op.value)
      return true
    } catch { return false }
  },
  async apply (op, view) {
    if (op.type === 'put') await view.put(op.key, op.value)
    else await view.del(op.key)
  }
})

/** Experimental ordered JSON key-value database with explicit writer admission. */
export async function openCollaborativeDatabase ({ storage, key, encryptionKey, nodeOptions, signal } = {}) {
  if (key !== undefined) keyBytes(key)
  if (signal?.aborted) throw signal.reason || new Error('Database open aborted')
  const owned = await resources({ storage, nodeOptions, key, kind: 'collaborative' })
  const { node, store } = owned
  let db, network, closing
  function close () {
    if (!closing) closing = (async () => {
      try { await network?.close() } finally {
        try { await db?.close() } finally {
          try { await node.close() } finally { await store.close() }
        }
      }
    })()
    return closing
  }
  try {
    db = await openDatabase({ node, store, adapter, key: owned.key ?? null, encryptionKey, signal, discovery: false })
    await owned.save(db.key)
    network = dataNetwork(node.swarm, crypto.discoveryKey(keyBytes(db.key)))
    return {
      experimental: true,
      network,
      get key () { return db.key },
      get writerKey () { return db.writerKey },
      get writable () { return db.writable },
      async get (key) {
        checkKey(key)
        await db.update()
        return (await db.view.get(key, { wait: false }))?.value ?? null
      },
      async put (key, value, options) { checkKey(key); return db.append({ type: 'put', key, value: jsonValue(value) }, options) },
      async del (key, options) { checkKey(key); return db.append({ type: 'del', key }, options) },
      members: db.members,
      update: db.update,
      watch: db.watch,
      async waitFor (predicate, options) {
        try { return await db.waitFor(predicate, options) } catch (error) {
          if (error.message === 'Database wait timed out') throw network.timeoutError('Database wait timed out')
          throw error
        }
      },
      state: db.state,
      close
    }
  } catch (error) { await close().catch(() => {}); throw error }
}
