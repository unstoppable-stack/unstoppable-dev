import { mkdir, readFile, writeFile } from 'fs/promises'
import { dirname, join } from 'path'

export const CONFIG_FILE = 'node-config.json'

export const DEFAULT_CONFIG = Object.freeze({
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
    pairRequests: true
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
    return validateConfig(mergeConfigPatch(DEFAULT_CONFIG, parsed))
  } catch (err) {
    if (err.code !== 'ENOENT') throw err
    const config = validateConfig(mergeConfigPatch(DEFAULT_CONFIG, seed || {}))
    await saveConfig(storagePath, config)
    return config
  }
}

export async function saveConfig (storagePath, config) {
  const file = configPath(storagePath)
  await mkdir(dirname(file), { recursive: true })
  await writeFile(file, JSON.stringify(validateConfig(config), null, 2) + '\n')
}

export function mergeConfigPatch (base, patch = {}) {
  const next = clone(base)
  for (const [section, value] of Object.entries(patch || {})) {
    if (value && typeof value === 'object' && !Array.isArray(value) && next[section] && typeof next[section] === 'object') {
      next[section] = { ...next[section], ...value }
    } else {
      next[section] = value
    }
  }
  return next
}

export function validateConfig (config) {
  const next = mergeConfigPatch(DEFAULT_CONFIG, config)
  if (typeof next.ai.enabled !== 'boolean') throw new Error('ai.enabled must be a boolean')
  if (!['mock', 'qvac'].includes(next.ai.mode)) throw new Error('ai.mode must be "mock" or "qvac"')
  if (typeof next.ai.modelSrc !== 'string') throw new Error('ai.modelSrc must be a string')
  validateQuota(next.storage.globalQuotaBytes, 'storage.globalQuotaBytes')
  validateQuota(next.storage.perAppQuotaBytes, 'storage.perAppQuotaBytes')
  if (typeof next.pairing.requireApproval !== 'boolean') throw new Error('pairing.requireApproval must be a boolean')
  if (typeof next.pairing.autoApproveLocal !== 'boolean') throw new Error('pairing.autoApproveLocal must be a boolean')
  if (typeof next.notifications.pairRequests !== 'boolean') throw new Error('notifications.pairRequests must be a boolean')
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
