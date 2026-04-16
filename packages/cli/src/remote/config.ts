import { join } from 'path'
import { homedir } from 'os'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import type { RemoteConfig, DeviceInfo } from './types.js'
import { REMOTE_DIR, CONFIG_FILE } from './types.js'

let configDirOverride: string | null = null

/** Override the config directory (for testing). Pass null to reset. */
export function setConfigDir(dir: string | null): void {
  configDirOverride = dir
}

function getConfigDir(): string {
  const dir = configDirOverride || join(homedir(), REMOTE_DIR)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return dir
}

function getConfigPath(): string {
  return join(getConfigDir(), CONFIG_FILE)
}

export function loadConfig(): RemoteConfig {
  const path = getConfigPath()
  if (!existsSync(path)) {
    return { deviceName: `${homedir().split('/').pop()}-desktop`, keypair: null, trustedDevices: [] }
  }
  return JSON.parse(readFileSync(path, 'utf-8'))
}

export function saveConfig(config: RemoteConfig): void {
  writeFileSync(getConfigPath(), JSON.stringify(config, null, 2))
}

export function getOrCreateKeypair(): { publicKey: Buffer; secretKey: Buffer } {
  const config = loadConfig()
  if (config.keypair) {
    return {
      publicKey: Buffer.from(config.keypair.publicKey, 'hex'),
      secretKey: Buffer.from(config.keypair.secretKey, 'hex'),
    }
  }

  // Dynamically import to avoid top-level await
  // We'll generate on first use in the command handler
  throw new Error('NEEDS_KEYPAIR')
}

export function saveKeypair(publicKey: Buffer, secretKey: Buffer): void {
  const config = loadConfig()
  config.keypair = {
    publicKey: publicKey.toString('hex'),
    secretKey: secretKey.toString('hex'),
  }
  saveConfig(config)
}

export function addTrustedDevice(device: DeviceInfo): void {
  const config = loadConfig()
  const existing = config.trustedDevices.findIndex((d) => d.publicKey === device.publicKey)
  if (existing >= 0) {
    config.trustedDevices[existing] = device
  } else {
    config.trustedDevices.push(device)
  }
  saveConfig(config)
}

export function getTrustedDevices(): DeviceInfo[] {
  return loadConfig().trustedDevices
}

export function removeTrustedDevice(publicKey: string): boolean {
  const config = loadConfig()
  const before = config.trustedDevices.length
  config.trustedDevices = config.trustedDevices.filter((d) => d.publicKey !== publicKey)
  if (config.trustedDevices.length < before) {
    saveConfig(config)
    return true
  }
  return false
}
