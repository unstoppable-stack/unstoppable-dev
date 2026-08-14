import Corestore from 'corestore'
import { AppRegistry, validateImportedApp } from './registry.js'
import { loadConfig, migrateConfig, saveConfig, validateConfig } from './config.js'
import { atomicWriteFile, runtimeFs, runtimePath } from './runtime-files.js'

const { mkdir, readFile, stat } = runtimeFs
const { join } = runtimePath

const EXPORT_VERSION = 1
const MAX_BUNDLE_BYTES = 10 * 1024 * 1024

export async function exportNodeState ({ storagePath, outPath }) {
  if (!storagePath) throw new Error('storagePath is required')
  if (!outPath) throw new Error('outPath is required')

  const store = new Corestore(storagePath)
  await store.ready()
  try {
    const registryCore = store.get({ name: 'node-registry' })
    await registryCore.ready()
    const registry = new AppRegistry(registryCore)
    await registry.ready()
    const apps = await registry.listApps()
    await registry.close()

    const config = await loadConfig(storagePath)
    return writeNodeStateBundle({ storagePath, outPath, config, apps })
  } finally {
    await store.close()
  }
}

export async function writeNodeStateBundle ({ storagePath, outPath, config, apps }) {
  const trust = await readJson(join(storagePath, 'trust-registry.json'), null)
  const bundle = {
    version: EXPORT_VERSION,
    kind: 'unstoppable-node-settings',
    exportedAt: new Date().toISOString(),
    config,
    trust,
    apps
  }

  await atomicWriteFile(outPath, JSON.stringify(bundle, null, 2) + '\n', { encoding: 'utf8' })
  return bundle
}

export async function importNodeState ({ storagePath, inPath }) {
  if (!storagePath) throw new Error('storagePath is required')
  if (!inPath) throw new Error('inPath is required')
  const bundle = await readNodeStateBundle(inPath)

  await mkdir(storagePath, { recursive: true })
  const store = new Corestore(storagePath)
  await store.ready()
  try {
    const registryCore = store.get({ name: 'node-registry' })
    await registryCore.ready()
    const registry = new AppRegistry(registryCore)
    await registry.ready()
    await registry.importApps(bundle.apps || [])
    await registry.close()
  } finally {
    await store.close()
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
  const apps = Array.isArray(bundle.apps) ? bundle.apps : []
  return {
    version: bundle.version,
    exportedAt: bundle.exportedAt || null,
    appCount: apps.length,
    apps: apps.map((app) => ({ appId: app.appId, appName: app.appName || app.appId })),
    hasConfig: !!bundle.config,
    hasTrust: !!bundle.trust,
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
  if (bundle.apps != null && !Array.isArray(bundle.apps)) throw new Error('Settings bundle apps must be an array')
  if (bundle.apps?.length > 10_000) throw new Error('Settings bundle contains too many apps')
  if (bundle.apps) bundle.apps = bundle.apps.map(validateImportedApp)
  if (bundle.config != null) bundle.config = validateConfig(migrateConfig(bundle.config))
  validateTrustShape(bundle.trust)
  return bundle
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
