import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import {
  loadConfig,
  saveConfig,
  saveKeypair,
  addTrustedDevice,
  getTrustedDevices,
  removeTrustedDevice,
  setConfigDir,
} from '../config.js'
import type { RemoteConfig } from '../types.js'

describe('config', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'us-remote-test-'))
    setConfigDir(tmpDir)
  })

  afterEach(() => {
    setConfigDir(null)
    rmSync(tmpDir, { recursive: true, force: true })
  })

  describe('loadConfig', () => {
    it('returns defaults when no config file exists', () => {
      const config = loadConfig()
      expect(config.keypair).toBeNull()
      expect(config.trustedDevices).toEqual([])
      expect(config.deviceName).toContain('-desktop')
    })

    it('returns saved config after saveConfig', () => {
      const custom: RemoteConfig = {
        deviceName: 'test-machine',
        keypair: { publicKey: 'aabb', secretKey: 'ccdd' },
        trustedDevices: [],
      }
      saveConfig(custom)

      const loaded = loadConfig()
      expect(loaded.deviceName).toBe('test-machine')
      expect(loaded.keypair?.publicKey).toBe('aabb')
    })
  })

  describe('saveKeypair', () => {
    it('persists a keypair to config', () => {
      const pub = Buffer.from('aa'.repeat(32), 'hex')
      const sec = Buffer.from('bb'.repeat(32), 'hex')

      saveKeypair(pub, sec)

      const config = loadConfig()
      expect(config.keypair).not.toBeNull()
      expect(config.keypair!.publicKey).toBe('aa'.repeat(32))
      expect(config.keypair!.secretKey).toBe('bb'.repeat(32))
    })

    it('preserves existing config fields when saving keypair', () => {
      saveConfig({
        deviceName: 'my-desktop',
        keypair: null,
        trustedDevices: [{ publicKey: 'abc', name: 'phone', pairedAt: '2026-01-01' }],
      })

      const pub = Buffer.from('ff'.repeat(32), 'hex')
      const sec = Buffer.from('ee'.repeat(32), 'hex')
      saveKeypair(pub, sec)

      const config = loadConfig()
      expect(config.deviceName).toBe('my-desktop')
      expect(config.trustedDevices).toHaveLength(1)
      expect(config.keypair).not.toBeNull()
    })
  })

  describe('addTrustedDevice', () => {
    it('adds a new device', () => {
      addTrustedDevice({ publicKey: 'key1', name: 'Phone A', pairedAt: '2026-03-18' })

      const devices = getTrustedDevices()
      expect(devices).toHaveLength(1)
      expect(devices[0].name).toBe('Phone A')
    })

    it('adds multiple devices', () => {
      addTrustedDevice({ publicKey: 'key1', name: 'Phone A', pairedAt: '2026-03-18' })
      addTrustedDevice({ publicKey: 'key2', name: 'Phone B', pairedAt: '2026-03-18' })

      const devices = getTrustedDevices()
      expect(devices).toHaveLength(2)
    })

    it('updates an existing device with same publicKey', () => {
      addTrustedDevice({ publicKey: 'key1', name: 'Phone A', pairedAt: '2026-03-18' })
      addTrustedDevice({ publicKey: 'key1', name: 'Phone A (updated)', pairedAt: '2026-03-19' })

      const devices = getTrustedDevices()
      expect(devices).toHaveLength(1)
      expect(devices[0].name).toBe('Phone A (updated)')
      expect(devices[0].pairedAt).toBe('2026-03-19')
    })
  })

  describe('removeTrustedDevice', () => {
    it('removes a device by publicKey', () => {
      addTrustedDevice({ publicKey: 'key1', name: 'Phone A', pairedAt: '2026-03-18' })
      addTrustedDevice({ publicKey: 'key2', name: 'Phone B', pairedAt: '2026-03-18' })

      const removed = removeTrustedDevice('key1')
      expect(removed).toBe(true)

      const devices = getTrustedDevices()
      expect(devices).toHaveLength(1)
      expect(devices[0].publicKey).toBe('key2')
    })

    it('returns false for non-existent device', () => {
      const removed = removeTrustedDevice('nonexistent')
      expect(removed).toBe(false)
    })

    it('does not modify config when device not found', () => {
      addTrustedDevice({ publicKey: 'key1', name: 'Phone A', pairedAt: '2026-03-18' })
      removeTrustedDevice('nonexistent')

      const devices = getTrustedDevices()
      expect(devices).toHaveLength(1)
    })
  })
})
