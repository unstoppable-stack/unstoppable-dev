import { join } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import Corestore from 'corestore'
import Hyperbee from 'hyperbee'
import { createNode } from '@unstoppable-stack/p2p'
import { syncPack } from '@unstoppable-stack/p2p/sync'

export const beeOptions = { keyEncoding: 'utf-8', valueEncoding: 'json' }

// Infrastructure only; each app owns a different dataset and domain logic.
export async function openRuntime({ storage, swarm, appId, capabilities = [] }) {
  const store = new Corestore(join(storage, 'data'))
  const local = new Hyperbee(store.get({ name: appId }), beeOptions)
  const node = createNode({
    storage: join(storage, 'identity'), swarm, reconnect: false,
    profile: { appId, appName: appId === 'ecosystem-notebook' ? 'Notebook' : 'Briefing' },
    pairing: { approve: async () => 'Use a scoped invitation' },
    capabilities: [...capabilities, syncPack({ store })],
  })
  let closing
  const close = () => closing ||= (async () => {
    try { await node.close() } finally {
      try { await local.close() } finally { await store.close() }
    }
  })()
  try {
    await local.ready()
    await node.ready()
    return { store, local, node, close }
  } catch (error) { await close(); throw error }
}

export function manifest(bee, id, name) {
  return { schemaVersion: 1, resources: [{
    id, name, kind: 'hyperbee', key: Buffer.from(bee.core.key).toString('hex'),
    protection: { mode: 'mirror' },
  }] }
}

export async function connectNode(app, { invite, publicKey, signal } = {}) {
  if (invite) return app.node.pair(invite, { signal, timeout: 15_000 })
  if (publicKey) return app.node.connect(publicKey, { signal, timeout: 15_000 })
  throw new Error('Provide a Personal Node invitation or previously paired public key')
}

export async function until(check, { timeout = 15_000, signal } = {}) {
  const deadline = Date.now() + timeout
  while (Date.now() < deadline) {
    signal?.throwIfAborted()
    const result = await check()
    if (result) return result
    await delay(25, undefined, { signal })
  }
  throw new Error('Timed out waiting for the requested checkpoint')
}

export async function protect(peer, resourceManifest, length) {
  await peer.call('sync', 'manifest.replace', { manifest: resourceManifest })
  const key = resourceManifest.resources[0].key
  return until(async () => {
    const status = await peer.call('sync', 'status')
    return status.cores.find(core => core.key === key &&
      core.length >= length && core.protection?.state === 'protected')
  })
}

export async function download(core, length, { timeout = 10_000, signal } = {}) {
  signal?.throwIfAborted()
  if (!Number.isFinite(timeout) || timeout <= 0 || timeout > 120_000) throw new Error('Invalid timeout')
  const range = core.download({ start: 0, end: length })
  let timer, onAbort
  try {
    await Promise.race([
      range.done(),
      new Promise((resolve, reject) => {
        timer = setTimeout(() => reject(new Error('Replica unavailable: checkpoint download timed out')), timeout)
        onAbort = () => reject(signal.reason || new Error('Download cancelled'))
        signal?.addEventListener('abort', onAbort, { once: true })
      }),
    ])
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', onAbort)
    range.destroy()
  }
}
