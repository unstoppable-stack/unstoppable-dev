/* global Pear */
// Worker for the Unstoppable Node dashboard.
//
// This is the *real* node daemon, just embedded inside a Pear Desktop app so
// the user gets a visual dashboard alongside the P2P runtime. The worker
// process lives in Bare; NodeDaemon happens to run fine there because:
//   1. protocol.js lazily loads `os` (Bare has no `os` module by default)
//   2. ai-provider.js only imports `@qvac/sdk` dynamically when --ai is on
//   3. Hyperswarm/Corestore/Hyperdrive are all Bare-native
//
// Communication with the renderer uses the standard Pear worker pipe with
// newline-delimited JSON. We don't hand-roll request/response framing for
// this dashboard because all messages are either status snapshots (node →
// UI) or simple commands (UI → node: unpair, toggle-ai).

import { NodeDaemon } from 'unstoppable-node/src/node.js'
import { ApprovalGate } from './lib/approval.js'

const pipe = Pear.worker.pipe()
const storagePath = Pear.config.storage

function send (msg) {
  pipe.write(JSON.stringify(msg) + '\n')
}

const aiMock = Pear.config.args?.includes('--ai-mock') || false
const aiEnabled = aiMock || Pear.config.args?.includes('--ai') || false

// Trust gate. Lives next to the corestore so it survives restarts.
const approvalGate = new ApprovalGate({
  registryPath: `${storagePath}/trust-registry.json`
})

approvalGate.on('pending', (info) => send({ type: 'pairAwaitingApproval', ...info }))
approvalGate.on('autoDecided', (info) => send({ type: 'pairAutoDecided', ...info }))
approvalGate.on('decided', (info) => send({ type: 'pairDecisionRecorded', ...info }))
approvalGate.on('revoked', (info) => send({ type: 'pairRevoked', ...info }))
approvalGate.on('forgot', (info) => send({ type: 'pairForgotten', ...info }))

const node = new NodeDaemon(storagePath, {
  ai: aiEnabled ? { mock: aiMock } : undefined,
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

// Periodically ship a full status snapshot so the UI can stay in sync even
// if it missed an event during startup.
const STATUS_INTERVAL_MS = 2_000
const statusTimer = setInterval(async () => {
  try {
    const status = await node.getStatus()
    send({ type: 'status', ...status, trust: approvalGate.snapshot() })
  } catch (err) {
    send({ type: 'error', phase: 'status', error: err.message })
  }
}, STATUS_INTERVAL_MS)

let buffer = ''
pipe.on('data', async (data) => {
  buffer += data.toString()
  const lines = buffer.split('\n')
  buffer = lines.pop() || ''
  for (const line of lines) {
    if (!line.trim()) continue
    try {
      await handleCommand(JSON.parse(line))
    } catch (err) {
      send({ type: 'error', phase: 'command', error: err.message })
    }
  }
})

async function handleCommand (msg) {
  switch (msg.type) {
    case 'unpair':
      // Revoke trust at the same time as unpairing so a malicious
      // app can't silently re-pair on the next connection. The UI
      // is expected to send the publicKey alongside the appId; if
      // it's missing (older renderer), we still unpair but the
      // key remains in "approved" state — better than losing data.
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
  Pear.exit()
}

send({ type: 'workerReady', aiEnabled, aiMock })

;(async () => {
  try {
    // Hydrate the trust registry from disk before the daemon
    // starts accepting connections. Otherwise a fast inbound peer
    // could trigger a "first time we see this key" prompt for a
    // key we already trusted in a previous session.
    await approvalGate.ready()
    await node.start()
  } catch (err) {
    send({ type: 'fatal', error: err.message })
  }
})()
