import { NodeDaemon } from 'unstoppable-node/node'
import { importNodeState } from 'unstoppable-node/export'
import { ApprovalGate } from './approval.js'

const STATUS_INTERVAL_MS = 2_000

function parseArgs (args = []) {
  const aiMock = args.includes('--ai-mock')
  const aiEnabled = aiMock || args.includes('--ai') || args.includes('--ai-model')
  const modelIndex = args.indexOf('--ai-model')
  const aiModelSrc = modelIndex >= 0 ? args[modelIndex + 1] : null
  return { aiEnabled, aiMock, aiModelSrc }
}

export function createDaemonHost ({ storagePath, args = [], send, approvalMode = 'prompt', exit } = {}) {
  if (!storagePath) throw new Error('createDaemonHost requires storagePath')
  if (typeof send !== 'function') throw new Error('createDaemonHost requires send(msg)')

  const { aiEnabled, aiMock, aiModelSrc } = parseArgs(args)
  const approvalGate = new ApprovalGate({
    registryPath: `${storagePath}/trust-registry.json`
  })

  if (approvalMode === 'auto') {
    approvalGate.on('pending', (info) => {
      approvalGate.approve(info.publicKey, { remember: false }).catch((err) => {
        send({ type: 'error', phase: 'approval-auto', error: err.message })
      })
    })
  }

  approvalGate.on('pending', (info) => send({ type: 'pairAwaitingApproval', ...info }))
  approvalGate.on('autoDecided', (info) => send({ type: 'pairAutoDecided', ...info }))
  approvalGate.on('decided', (info) => send({ type: 'pairDecisionRecorded', ...info }))
  approvalGate.on('revoked', (info) => send({ type: 'pairRevoked', ...info }))
  approvalGate.on('forgot', (info) => send({ type: 'pairForgotten', ...info }))
  approvalGate.on('promoted', (info) => send({ type: 'pairPromoted', ...info }))

  const ai = aiEnabled
    ? { mock: aiMock, ...(aiModelSrc ? { modelSrc: aiModelSrc } : {}) }
    : undefined

  const node = new NodeDaemon(storagePath, {
    ai,
    discoveryWarmupMs: 2_000,
    approvePairing: async (req) => {
      const config = await node.getConfig()
      if (config.pairing.requireApproval === false) return 'approve'
      return approvalGate.request(req)
    }
  })

  node.on('ready', async (info) => send({
    type: 'ready',
    ...info,
    services: node.services,
    config: await node.getConfig(),
    trust: approvalGate.snapshot()
  }))
  node.on('restored', (info) => send({ type: 'restored', ...info }))
  node.on('pairRequest', (info) => send({ type: 'pairRequest', ...info }))
  node.on('paired', (info) => send({ type: 'paired', ...info }))
  node.on('pairDenied', (info) => send({ type: 'pairDenied', ...info }))
  node.on('appRegistered', (info) => send({ type: 'appRegistered', ...info }))
  node.on('peerConnected', (info) => send({ type: 'peerConnected', ...info }))
  node.on('peerDisconnected', (info) => send({ type: 'peerDisconnected', ...info }))
  node.on('heartbeat', (info) => send({ type: 'heartbeat', ...info }))
  node.on('error', (info) => send({ type: 'error', ...info }))
  node.on('aiReady', (info) => send({ type: 'aiReady', ...info }))
  node.on('aiError', (info) => send({ type: 'aiError', ...info }))
  node.on('aiProgress', (info) => send({ type: 'aiProgress', ...info }))
  node.on('servicesChanged', (info) => send({ type: 'servicesChanged', ...info }))
  node.on('configChanged', (info) => send({ type: 'config', ...info }))
  node.on('quotaExceeded', (info) => send({ type: 'quotaExceeded', ...info }))
  node.on('appQuotaChanged', (info) => send({ type: 'appQuotaChanged', ...info }))
  node.on('inference', (info) => send({ type: 'inference', ...info }))
  node.on('unpaired', (info) => send({ type: 'unpaired', ...info }))
  node.on('appPaused', (info) => send({ type: 'appPaused', ...info }))
  node.on('appResumed', (info) => send({ type: 'appResumed', ...info }))

  const statusTimer = setInterval(async () => {
    try {
      const status = await node.getStatus()
      send({ type: 'status', ...status, trust: approvalGate.snapshot() })
    } catch (err) {
      send({ type: 'error', phase: 'status', error: err.message })
    }
  }, STATUS_INTERVAL_MS)

  async function handleCommand (msg) {
    switch (msg.type) {
      case 'unpair':
        if (msg.publicKey) {
          await approvalGate.revoke(msg.publicKey, {
            appId: msg.appId,
            appName: msg.appName,
            reason: 'unpaired by user'
          })
        }
        await node.unpairApp(msg.appId)
        break

      case 'pair-approve':
        await approvalGate.approve(msg.publicKey, { remember: msg.remember !== false })
        break

      case 'pair-deny':
        await approvalGate.deny(msg.publicKey, {
          remember: msg.remember !== false,
          reason: msg.reason || 'denied by user'
        })
        break

      case 'forget-trust':
        await approvalGate.forget(msg.publicKey)
        break

      case 'promote-trust':
        await approvalGate.promote(msg.publicKey, {
          appId: msg.appId,
          appName: msg.appName
        })
        break

      case 'refresh-status': {
        const status = await node.getStatus()
        send({ type: 'status', ...status, trust: approvalGate.snapshot() })
        break
      }

      case 'get-config':
        send({ type: 'config', config: await node.getConfig() })
        break

      case 'update-config':
        try {
          const config = await node.updateConfig(msg.patch || {})
          send({ type: 'config', config })
        } catch (err) {
          send({ type: 'config-error', error: err.message })
        }
        break

      case 'export-state':
        try {
          const bundle = await node.exportState(msg.path)
          send({ type: 'export-result', path: msg.path, apps: bundle.apps.length })
        } catch (err) {
          send({ type: 'export-error', error: err.message })
        }
        break

      case 'import-state':
        try {
          const bundle = await importNodeState({ storagePath, inPath: msg.path })
          send({ type: 'import-result', path: msg.path, apps: bundle.apps.length })
          send({ type: 'config', config: await node.getConfig() })
          const status = await node.getStatus()
          send({ type: 'status', ...status, trust: approvalGate.snapshot() })
        } catch (err) {
          send({ type: 'import-error', error: err.message })
        }
        break

      case 'pause-app':
        await node.pauseApp(msg.appId)
        break

      case 'resume-app':
        await node.resumeApp(msg.appId)
        break

      case 'set-app-quota':
        try {
          await node.setAppQuota(msg.appId, msg.quotaBytes)
          const status = await node.getStatus()
          send({ type: 'status', ...status, trust: approvalGate.snapshot() })
        } catch (err) {
          send({ type: 'error', phase: 'set-app-quota', error: err.message })
        }
        break

      case 'peek-core': {
        const result = node.replication
          ? await node.replication.peekCore(msg.key, { limit: msg.limit })
          : null
        send({ type: 'peek-core-result', requestId: msg.requestId, result })
        break
      }

      case 'peek-drive': {
        const result = node.replication
          ? await node.replication.peekDrive(msg.key, { dir: msg.dir, limit: msg.limit })
          : null
        send({ type: 'peek-drive-result', requestId: msg.requestId, result })
        break
      }

      case 'enable-ai':
        try {
          await node.enableAI({ mock: msg.mock === true, modelSrc: msg.modelSrc })
        } catch (err) {
          send({ type: 'error', phase: 'enable-ai', error: err.message })
        }
        break

      case 'disable-ai':
        await node.disableAI()
        break

      case 'shutdown':
        await cleanup()
        break

      default:
        send({ type: 'error', phase: 'command', error: `Unknown command: ${msg.type}` })
    }
  }

  async function cleanup () {
    clearInterval(statusTimer)
    await node.close()
    if (typeof exit === 'function') exit()
  }

  async function start () {
    send({ type: 'workerReady', aiEnabled, aiMock })
    try {
      await approvalGate.ready()
      await node.start()
    } catch (err) {
      send({ type: 'fatal', error: err.message })
    }
  }

  return { node, approvalGate, handleCommand, cleanup, start }
}
