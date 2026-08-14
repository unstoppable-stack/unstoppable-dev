import { atomicWriteFile, runtimeFs, runtimePath } from './runtime-files.js'

const { readFile } = runtimeFs
const { join } = runtimePath

export const CONFIG_FILE = 'node-config.json'
export const CONFIG_VERSION = 1

export const DEFAULT_CONFIG = Object.freeze({
  configVersion: CONFIG_VERSION,
  ai: {
    enabled: false,
    mode: 'mock',
    modelSrc: ''
  },
  storage: {
    globalQuotaBytes: null,
    perAppQuotaBytes: null
  },
  pairing: {
    requireApproval: true,
    autoApproveLocal: false
  },
  notifications: {
    pairRequests: true,
    pairRequestSound: false,
    pairRequestAutoRestore: false
  },
  ui: {
    showWelcome: true
  }
})

export function configPath (storagePath) {
  return join(storagePath, CONFIG_FILE)
}

export async function loadConfig (storagePath, { seed } = {}) {
  const file = configPath(storagePath)
  try {
    const parsed = JSON.parse(await readFile(file, 'utf8'))
    return validateConfig(migrateConfig(parsed))
  } catch (err) {
    if (err.code !== 'ENOENT') throw err
    const config = validateConfig(mergeConfigPatch(DEFAULT_CONFIG, seed || {}))
    await saveConfig(storagePath, config)
    return config
  }
}

export async function saveConfig (storagePath, config) {
  const file = configPath(storagePath)
  await atomicWriteFile(file, JSON.stringify(validateConfig(config), null, 2) + '\n', { encoding: 'utf8' })
}

export function migrateConfig (config) {
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    throw new Error('Node config must be an object')
  }

  const version = config.configVersion == null ? 0 : config.configVersion
  if (!Number.isInteger(version) || version < 0) throw new Error('configVersion must be a non-negative integer')
  if (version > CONFIG_VERSION) {
    throw new Error(`Node config version ${version} is newer than this app supports (${CONFIG_VERSION})`)
  }

  // Version 0 was the unversioned beta format. Its fields already match v1;
  // recording the version makes all future migrations explicit and testable.
  return mergeConfigPatch(DEFAULT_CONFIG, { ...config, configVersion: CONFIG_VERSION })
}

export function mergeConfigPatch (base, patch = {}) {
  if (!isPlainObject(base)) throw new Error('Base node config must be an object')
  if (!isPlainObject(patch)) throw new Error('Node config patch must be an object')
  const next = clone(base)
  for (const [section, value] of Object.entries(patch || {})) {
    if (!Object.hasOwn(next, section)) throw new Error(`Unknown node config option: ${section}`)
    if (isPlainObject(value) && isPlainObject(next[section])) {
      for (const key of Object.keys(value)) {
        if (!Object.hasOwn(next[section], key)) throw new Error(`Unknown node config option: ${section}.${key}`)
      }
      next[section] = { ...next[section], ...value }
    } else {
      next[section] = value
    }
  }
  return next
}

export function validateConfig (config) {
  const next = mergeConfigPatch(DEFAULT_CONFIG, config)
  if (next.configVersion !== CONFIG_VERSION) throw new Error(`configVersion must be ${CONFIG_VERSION}`)
  if (typeof next.ai.enabled !== 'boolean') throw new Error('ai.enabled must be a boolean')
  if (!['mock', 'qvac'].includes(next.ai.mode)) throw new Error('ai.mode must be "mock" or "qvac"')
  if (typeof next.ai.modelSrc !== 'string') throw new Error('ai.modelSrc must be a string')
  if (next.ai.modelSrc.length > 4096) throw new Error('ai.modelSrc must be at most 4096 characters')
  validateQuota(next.storage.globalQuotaBytes, 'storage.globalQuotaBytes')
  validateQuota(next.storage.perAppQuotaBytes, 'storage.perAppQuotaBytes')
  if (typeof next.pairing.requireApproval !== 'boolean') throw new Error('pairing.requireApproval must be a boolean')
  if (typeof next.pairing.autoApproveLocal !== 'boolean') throw new Error('pairing.autoApproveLocal must be a boolean')
  if (typeof next.notifications.pairRequests !== 'boolean') throw new Error('notifications.pairRequests must be a boolean')
  if (typeof next.notifications.pairRequestSound !== 'boolean') throw new Error('notifications.pairRequestSound must be a boolean')
  if (typeof next.notifications.pairRequestAutoRestore !== 'boolean') throw new Error('notifications.pairRequestAutoRestore must be a boolean')
  if (typeof next.ui.showWelcome !== 'boolean') throw new Error('ui.showWelcome must be a boolean')
  return next
}

function validateQuota (value, name) {
  if (value === null) return
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`${name} must be a non-negative integer or null`)
}

function clone (value) {
  return JSON.parse(JSON.stringify(value))
}

function isPlainObject (value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}
