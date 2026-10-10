import { PeerRegistry } from '@unstoppable-stack/node-core'
import { loadConfig, migrateConfig, saveConfig, validateConfig } from './config.js'
import { atomicWriteFile, runtimeFs, runtimePath } from './runtime-files.js'

const { mkdir, readFile, stat } = runtimeFs
const { join } = runtimePath

const EXPORT_VERSION = 2
const MAX_BUNDLE_BYTES = 10 * 1024 * 1024

export async function exportNodeState ({ storagePath, outPath }) {
  if (!storagePath) throw new Error('storagePath is required')
  if (!outPath) throw new Error('outPath is required')

  const registry = new PeerRegistry(storagePath)
  await registry.ready()
  const peers = registry.list()

  const config = await loadConfig(storagePath)
  return writeNodeStateBundle({ storagePath, outPath, config, peers })
}

export async function writeNodeStateBundle ({ storagePath, outPath, config, peers, identity }) {
  const trust = await readJson(join(storagePath, 'trust-registry.json'), null)
  // The identity seed is part of the backup on purpose: without it a restored
  // node comes back under a new public key and every paired peer has to pair
  // again. It is also the most sensitive thing in the bundle.
  const seed = identity ?? await readJson(join(storagePath, 'identity.json'), null)
  const bundle = {
    version: EXPORT_VERSION,
    kind: 'unstoppable-node-settings',
    exportedAt: new Date().toISOString(),
    config,
    trust,
    identity: seed,
    revokedKeys: (await readJson(join(storagePath, 'peers.json'), null))?.denied || [],
    peers
  }

  await atomicWriteFile(outPath, JSON.stringify(bundle, null, 2) + '\n', { encoding: 'utf8' })
  return bundle
}

export async function importNodeState ({ storagePath, inPath }) {
  if (!storagePath) throw new Error('storagePath is required')
  if (!inPath) throw new Error('inPath is required')
  const bundle = await readNodeStateBundle(inPath)

  await mkdir(storagePath, { recursive: true })

  const registry = new PeerRegistry(storagePath)
  await registry.ready()
  for (const peer of bundle.peers || []) await registry.put(peer)
  for (const key of bundle.revokedKeys || []) await registry.deny(key)

  if (bundle.identity) {
    await atomicWriteFile(
      join(storagePath, 'identity.json'),
      JSON.stringify(bundle.identity, null, 2) + '\n',
      { encoding: 'utf8' }
    )
  }
  if (bundle.config) await saveConfig(storagePath, bundle.config)
  if (bundle.trust) {
    await atomicWriteFile(
      join(storagePath, 'trust-registry.json'),
      JSON.stringify(bundle.trust, null, 2) + '\n',
      { encoding: 'utf8' }
    )
  }
  return bundle
}

export async function previewNodeStateImport ({ inPath }) {
  if (!inPath) throw new Error('inPath is required')
  const bundle = await readNodeStateBundle(inPath)
  const peers = Array.isArray(bundle.peers) ? bundle.peers : []
  return {
    version: bundle.version,
    exportedAt: bundle.exportedAt || null,
    peerCount: peers.length,
    peers: peers.map((peer) => ({
      publicKey: peer.publicKey,
      appId: peer.appId || null,
      appName: peer.appName || peer.appId || peer.publicKey.slice(0, 12)
    })),
    hasConfig: !!bundle.config,
    hasTrust: !!bundle.trust,
    hasIdentity: !!bundle.identity,
    config: bundle.config || null,
    trustCounts: bundle.trust
      ? {
          approved: Object.keys(bundle.trust.approved || {}).length,
          denied: Object.keys(bundle.trust.denied || {}).length
        }
      : { approved: 0, denied: 0 }
  }
}

export async function readNodeStateBundle (path) {
  const info = await stat(path)
  if (info.size > MAX_BUNDLE_BYTES) {
    throw new Error(`Settings bundle is too large (${info.size} bytes; maximum ${MAX_BUNDLE_BYTES})`)
  }

  const bundle = JSON.parse(await readFile(path, 'utf8'))
  if (!bundle || typeof bundle !== 'object' || Array.isArray(bundle)) {
    throw new Error('Settings bundle must be an object')
  }
  if (bundle.version !== EXPORT_VERSION) throw new Error(`Unsupported export version: ${bundle.version}`)
  if (bundle.kind != null && bundle.kind !== 'unstoppable-node-settings') {
    throw new Error(`Unsupported settings bundle kind: ${bundle.kind}`)
  }
  if (bundle.peers != null && !Array.isArray(bundle.peers)) throw new Error('Settings bundle peers must be an array')
  if (bundle.peers?.length > 10_000) throw new Error('Settings bundle contains too many peers')
  if (bundle.peers) bundle.peers = bundle.peers.map(validateImportedPeer)
  if (bundle.revokedKeys != null && (!Array.isArray(bundle.revokedKeys) || bundle.revokedKeys.length > 10_000 ||
      bundle.revokedKeys.some(key => typeof key !== 'string' || !/^[0-9a-f]{64}$/.test(key)))) {
    throw new Error('Settings bundle revokedKeys must be an array of public keys')
  }
  validateIdentityShape(bundle.identity)
  if (bundle.config != null) bundle.config = validateConfig(migrateConfig(bundle.config))
  validateTrustShape(bundle.trust)
  return bundle
}

export function validateImportedPeer (peer) {
  if (!isPlainObject(peer)) throw new Error('Imported peer records must be objects')
  if (typeof peer.publicKey !== 'string' || !/^[0-9a-f]{64}$/.test(peer.publicKey)) {
    throw new Error('Imported peer publicKey must be 32 bytes of hex')
  }
  if (peer.appId != null && (typeof peer.appId !== 'string' || peer.appId.length > 256)) {
    throw new Error(`Imported peer ${peer.publicKey.slice(0, 12)} has an invalid appId`)
  }
  return JSON.parse(JSON.stringify(peer))
}

function validateIdentityShape (identity) {
  if (identity == null) return
  if (!isPlainObject(identity)) throw new Error('Settings bundle identity must be an object')
  if (typeof identity.seed !== 'string' || !/^[0-9a-f]{64}$/i.test(identity.seed)) {
    throw new Error('Settings bundle identity seed must be 32 bytes of hex')
  }
}

function validateTrustShape (trust) {
  if (trust == null) return
  if (!isPlainObject(trust)) throw new Error('Settings bundle trust data must be an object')
  if (trust.version != null && trust.version !== 1) {
    throw new Error(`Unsupported trust registry version: ${trust.version}`)
  }
  for (const field of ['approved', 'denied']) {
    if (trust[field] != null && !isPlainObject(trust[field])) {
      throw new Error(`Settings bundle trust.${field} must be an object`)
    }
    const entries = trust[field] || {}
    const keys = Object.keys(entries)
    if (keys.length > 10_000) throw new Error(`Settings bundle contains too many trust.${field} entries`)
    for (const publicKey of keys) {
      if (!/^[A-Za-z0-9_-]{1,256}$/.test(publicKey) || ['__proto__', 'prototype', 'constructor'].includes(publicKey)) {
        throw new Error(`Settings bundle contains an invalid trust key: ${publicKey}`)
      }
      if (!isPlainObject(entries[publicKey])) throw new Error(`Settings bundle trust entry ${publicKey} must be an object`)
    }
  }
  for (const publicKey of Object.keys(trust.approved || {})) {
    if (Object.hasOwn(trust.denied || {}, publicKey)) {
      throw new Error(`Settings bundle trust key cannot be both approved and denied: ${publicKey}`)
    }
  }
}

function isPlainObject (value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

async function readJson (path, fallback) {
  try {
    return JSON.parse(await readFile(path, 'utf8'))
  } catch (err) {
    if (err.code === 'ENOENT') return fallback
    throw err
  }
}
