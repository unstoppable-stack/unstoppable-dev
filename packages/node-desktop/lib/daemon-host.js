import { PersonalNode } from 'unstoppable-node/personal-node'
import { previewNodeStateImport } from 'unstoppable-node/export'
import { ApprovalGate } from './approval.js'

const STATUS_INTERVAL_MS = 2_000

function parseArgs (args = []) {
  const aiMock = args.includes('--ai-mock')
  const aiEnabled = aiMock || args.includes('--ai') || args.includes('--ai-model')
  const modelIndex = args.indexOf('--ai-model')
  const aiModelSrc = modelIndex >= 0 ? args[modelIndex + 1] : null
  return { aiEnabled, aiMock, aiModelSrc }
}

export function createDaemonHost ({ storagePath, args = [], send, approvalMode = 'prompt', exit, nodeOptions = {} } = {}) {
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

  const node = new PersonalNode(storagePath, {
    ...nodeOptions,
    ai,
    isDenied: async (key) => { await approvalGate.ready(); return Object.hasOwn(approvalGate.snapshot().denied, key) },
    approvePairing: async (req) => {
      const config = await node.getConfig()
      if (config.pairing.requireApproval === false) return 'approve'
      // The trust gate is keyed on public key and predates the registry
      // re-keying; the profile fields are flattened for it.
      return approvalGate.request({
        publicKey: req.publicKey,
        appId: req.profile?.appId || null,
        appName: req.profile?.appName || null,
        deviceName: req.profile?.deviceName || null,
        remoteKey: req.publicKey
      })
    }
  })

  node.on('listening', async (info) => send({
    type: 'ready',
    ...info,
    capabilities: node.node.capabilities.describe(),
    config: await node.getConfig(),
    trust: approvalGate.snapshot()
  }))
  node.on('restored', (info) => send({ type: 'restored', ...info }))
  node.on('pairRequest', (info) => send({ type: 'pairRequest', ...info }))
  node.on('paired', (info) => send({ type: 'paired', ...info }))
  node.on('pairDenied', (info) => send({ type: 'pairDenied', ...info }))
  node.on('connection', (info) => send({ type: 'peerConnected', ...info }))
  node.on('peerDisconnected', (info) => {
    approvalGate.cancel(info.publicKey)
    send({ type: 'peerDisconnected', ...info })
  })
  node.on('error', (info) => send({ type: 'error', ...info }))
  node.on('requestError', (info) => send({ type: 'requestError', ...info }))
  node.on('aiReady', (info) => send({ type: 'aiReady', ...info }))
  node.on('aiError', (info) => send({ type: 'aiError', ...info }))
  node.on('aiProgress', (info) => send({ type: 'aiProgress', ...info }))
  node.on('aiDisabled', (info) => send({ type: 'aiDisabled', ...info }))
  node.on('configChanged', (info) => send({ type: 'config', ...info }))
  node.on('quotaExceeded', (info) => send({ type: 'quotaExceeded', ...info }))
  node.on('peerQuotaChanged', (info) => send({ type: 'peerQuotaChanged', ...info }))
  node.on('peerGrantChanged', (info) => send({ type: 'peerGrantChanged', ...info }))
  node.on('grantsChanged', (info) => send({ type: 'grantsChanged', ...info }))
  node.on('inference', (info) => send({ type: 'inference', ...info }))
  node.on('inviteCreated', (info) => send({ type: 'inviteCreated', ...info }))
  node.on('inviteRedeemed', (info) => send({ type: 'inviteRedeemed', ...info }))
  node.on('inviteRevoked', (info) => send({ type: 'inviteRevoked', ...info }))
  node.on('unpaired', (info) => send({ type: 'unpaired', ...info }))
  node.on('peerPaused', (info) => send({ type: 'peerPaused', ...info }))
  node.on('peerResumed', (info) => send({ type: 'peerResumed', ...info }))

  const statusTimer = setInterval(async () => {
    try {
      const status = await node.getStatus()
      send({ type: 'status', ...status, trust: approvalGate.snapshot() })
    } catch (err) {
      send({ type: 'error', phase: 'status', error: err.message })
    }
  }, STATUS_INTERVAL_MS)

  async function sendStatus () {
    const status = await node.getStatus()
    send({ type: 'status', ...status, trust: approvalGate.snapshot() })
  }

  // Peers are addressed by public key throughout. The old commands carried
  // both a publicKey (for the trust gate) and an appId (for the node); the
  // registry re-keying collapsed that into one identifier.
  async function handleCommand (msg) {
    switch (msg.type) {
      case 'unpair':
        if (msg.publicKey) {
          await approvalGate.revoke(msg.publicKey, {
            appId: msg.appId,
            appName: msg.appName,
            reason: 'unpaired by user'
          })
          await node.unpairPeer(msg.publicKey)
        }
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
        await node.node.peerRegistry.forgetDenial(msg.publicKey)
        break

      case 'promote-trust':
        await approvalGate.promote(msg.publicKey, {
          appId: msg.appId,
          appName: msg.appName
        })
        break

      case 'refresh-status':
        await sendStatus()
        break

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
          send({ type: 'export-result', path: msg.path, peers: bundle.peers.length })
        } catch (err) {
          send({ type: 'export-error', error: err.message })
        }
        break

      case 'import-state':
        try {
          const bundle = await node.importState(msg.path)
          if (bundle.trust) await approvalGate.importSnapshot(bundle.trust)
          send({ type: 'import-result', path: msg.path, peers: (bundle.peers || []).length })
          send({ type: 'config', config: await node.getConfig() })
          await sendStatus()
        } catch (err) {
          send({ type: 'import-error', error: err.message })
        }
        break

      case 'preview-import':
        try {
          const preview = await previewNodeStateImport({ inPath: msg.path })
          send({ type: 'import-preview', path: msg.path, preview })
        } catch (err) {
          send({ type: 'import-error', error: err.message })
        }
        break

      case 'pause-peer':
        await node.pausePeer(msg.publicKey)
        break

      case 'resume-peer':
        await node.resumePeer(msg.publicKey)
        break

      case 'set-peer-quota':
        try {
          await node.setPeerQuota(msg.publicKey, msg.quotaBytes)
          await sendStatus()
        } catch (err) {
          send({ type: 'error', phase: 'set-peer-quota', error: err.message })
        }
        break

      case 'set-peer-grant':
        try {
          await node.setPeerGrant(msg.publicKey, msg.capability, msg.methods || [])
          await sendStatus()
        } catch (err) {
          send({ type: 'error', phase: 'set-peer-grant', error: err.message })
        }
        break

      case 'create-invite':
        try {
          const invite = await node.createInvite({
            grants: msg.grants || null,
            uses: msg.uses === undefined ? 1 : msg.uses,
            expiresIn: msg.expiresIn === undefined ? 15 * 60_000 : msg.expiresIn,
            label: msg.label || null
          })
          send({ type: 'invite-result', invite })
          await sendStatus()
        } catch (err) {
          send({ type: 'invite-error', error: err.message })
        }
        break

      case 'revoke-invite':
        try {
          await node.revokeInvite(msg.id)
          await sendStatus()
        } catch (err) {
          send({ type: 'invite-error', error: err.message })
        }
        break

      case 'peek-core': {
        const result = await node.peekCore(msg.key, { limit: msg.limit, readable: msg.readable === true })
        send({ type: 'peek-core-result', requestId: msg.requestId, result })
        break
      }

      case 'peek-drive': {
        const result = await node.peekDrive(msg.key, { dir: msg.dir, limit: msg.limit })
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

      // Internal package smoke check. This command is deliberately absent
      // from the renderer allowlist and can only be sent by the main process.
      case 'qvac-runtime-check': {
        try {
          const { loadQvacRuntime } = await import('unstoppable-node/internal/qvac-runtime')
          const sdk = await loadQvacRuntime()
          if (typeof sdk.loadModel !== 'function' || typeof sdk.completion !== 'function') {
            throw new Error('Required QVAC SDK exports are unavailable')
          }
          const packageJson = await import('@qvac/inference/package', { with: { type: 'json' } })
          let text
          if (msg.modelSrc) {
            const { AIProvider } = await import('unstoppable-node/internal/ai')
            const provider = new AIProvider({ modelSrc: msg.modelSrc })
            provider.on('error', error => send({ type: 'error', ...error }))
            try {
              await provider.start()
              let interrupted = ''
              for await (const token of provider.runStreaming({ messages: [{ role: 'user', content: 'Write a detailed essay about coffee.' }] })) {
                interrupted += token
                if (interrupted.length >= 40) break
              }
              if (!interrupted.trim()) throw new Error('Real inference did not produce output before cancellation')
              text = ''
              for await (const token of provider.runStreaming({ messages: [{ role: 'user', content: 'Reply with one short sentence about coffee.' }] })) text += token
              if (!text.trim()) throw new Error('Real inference did not recover after cancellation')
            } finally { await provider.close() }
          }
          send({ type: 'qvacRuntimeReady', version: packageJson.default.version, text })
        } catch (err) {
          send({ type: 'fatal', phase: 'qvac-runtime-check', error: err.message })
        }
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
    approvalGate.close()
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
