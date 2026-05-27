import { NodeDaemon } from 'unstoppable-node/src/node.js'
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
    approvePairing: (req) => approvalGate.request(req)
  })

  node.on('ready', (info) => send({
    type: 'ready',
    ...info,
    services: node.services,
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
  node.on('inference', (info) => send({ type: 'inference', ...info }))
  node.on('unpaired', (info) => send({ type: 'unpaired', ...info }))

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
