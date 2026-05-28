import Corestore from 'corestore'
import { mkdir, readFile, writeFile } from 'fs/promises'
import { dirname, join } from 'path'
import { AppRegistry } from './registry.js'
import { loadConfig, saveConfig } from './config.js'

const EXPORT_VERSION = 1

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
    exportedAt: new Date().toISOString(),
    config,
    trust,
    apps
  }

  await mkdir(dirname(outPath), { recursive: true })
  await writeFile(outPath, JSON.stringify(bundle, null, 2) + '\n')
  return bundle
}

export async function importNodeState ({ storagePath, inPath }) {
  if (!storagePath) throw new Error('storagePath is required')
  if (!inPath) throw new Error('inPath is required')
  const bundle = JSON.parse(await readFile(inPath, 'utf8'))
  if (bundle.version !== EXPORT_VERSION) throw new Error(`Unsupported export version: ${bundle.version}`)

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
  if (bundle.trust) await writeFile(join(storagePath, 'trust-registry.json'), JSON.stringify(bundle.trust, null, 2) + '\n')
  return bundle
}

async function readJson (path, fallback) {
  try {
    return JSON.parse(await readFile(path, 'utf8'))
  } catch (err) {
    if (err.code === 'ENOENT') return fallback
    throw err
  }
}
