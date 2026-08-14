import Hyperbee from 'hyperbee'
import b4a from 'b4a'
import { validateResourceManifest } from './resource-manifest.js'

export class AppRegistry {
  constructor (core) {
    this.bee = new Hyperbee(core, {
      keyEncoding: 'utf-8',
      valueEncoding: 'json'
    })
  }

  async ready () {
    await this.bee.ready()
  }

  async registerApp ({ appId, appName, publicKey, deviceName, requestedCapabilities, grants, quotaBytes, cores, drives, resourceManifest }) {
    const existing = await this.getApp(appId)
    const record = {
      appId,
      appName,
      publicKey,
      // Free-form, user-shown label like `my-laptop.local`. Helps the
      // dashboard differentiate two devices that share an appId.
      deviceName: deviceName || existing?.deviceName || null,
      requestedCapabilities: requestedCapabilities || existing?.requestedCapabilities || null,
      grants: grants || existing?.grants || null,
      quotaBytes: quotaBytes === undefined ? (existing?.quotaBytes ?? null) : quotaBytes,
      // Pairing updates identity and grants before resource registration. Do
      // not erase the last known resource set during that intermediate step.
      cores: cores === undefined ? (existing?.cores || []) : cores,
      drives: drives === undefined ? (existing?.drives || []) : drives,
      resourceManifest: resourceManifest === undefined
        ? (existing?.resourceManifest || null)
        : resourceManifest,
      pairedAt: existing?.pairedAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      pairingMethod: 'local',
      permissions: {
        dataSync: true,
        fileSync: true,
        aiDelegation: true
      }
    }
    await this.bee.put(`apps/${appId}`, record)
    return record
  }

  async getApp (appId) {
    const node = await this.bee.get(`apps/${appId}`)
    return node?.value || null
  }

  async listApps () {
    const apps = []
    for await (const node of this.bee.createReadStream({ gte: 'apps/', lt: 'apps0' })) {
      apps.push(node.value)
    }
    return apps
  }

  async importApps (apps = []) {
    if (!Array.isArray(apps)) throw new Error('Imported apps must be an array')
    if (apps.length > 10_000) throw new Error('Settings bundle contains too many apps')
    for (const app of apps) {
      const record = validateImportedApp(app)
      await this.bee.put(`apps/${record.appId}`, record)
    }
  }

  async removeApp (appId) {
    await this.bee.del(`apps/${appId}`)
  }

  async isTrustedKey (publicKeyHex) {
    const apps = await this.listApps()
    return apps.some(app => app.publicKey === publicKeyHex)
  }

  async close () {
    await this.bee.close()
  }
}

export function validateImportedApp (app) {
  if (!isPlainObject(app)) throw new Error('Imported app records must be objects')
  if (typeof app.appId !== 'string' || app.appId.length === 0 || app.appId.length > 256 || /[\u0000-\u001f]/.test(app.appId)) {
    throw new Error('Imported appId must be a non-empty string of at most 256 characters')
  }
  if (app.publicKey != null && (
    typeof app.publicKey !== 'string' ||
    !/^[A-Za-z0-9_-]{1,256}$/.test(app.publicKey) ||
    ['__proto__', 'prototype', 'constructor'].includes(app.publicKey)
  )) {
    throw new Error(`Imported app ${app.appId} has an invalid public key`)
  }
  validateResources(app.cores, app.appId, 'cores')
  validateResources(app.drives, app.appId, 'drives')
  const copy = JSON.parse(JSON.stringify(app))
  if (copy.resourceManifest != null) copy.resourceManifest = validateResourceManifest(copy.resourceManifest)
  return copy
}

function validateResources (resources, appId, name) {
  if (resources == null) return
  if (!Array.isArray(resources) || resources.length > 10_000) {
    throw new Error(`Imported app ${appId} has invalid ${name}`)
  }
  for (const resource of resources) {
    if (!isPlainObject(resource)) throw new Error(`Imported app ${appId} has an invalid ${name} record`)
    if (resource.key != null && (typeof resource.key !== 'string' || resource.key.length > 256)) {
      throw new Error(`Imported app ${appId} has an invalid ${name} key`)
    }
  }
}

function isPlainObject (value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}
