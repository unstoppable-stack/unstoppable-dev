import Hyperbee from 'hyperbee'
import b4a from 'b4a'

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

  async registerApp ({ appId, appName, publicKey, deviceName, requestedCapabilities, grants, quotaBytes, cores = [], drives = [] }) {
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
      cores,
      drives,
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
    for (const app of apps) {
      if (!app?.appId) continue
      await this.bee.put(`apps/${app.appId}`, app)
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
