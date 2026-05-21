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

const pipe = Pear.worker.pipe()
const storagePath = Pear.config.storage

function send (msg) {
  pipe.write(JSON.stringify(msg) + '\n')
}

const aiMock = Pear.config.args?.includes('--ai-mock') || false
const aiEnabled = aiMock || Pear.config.args?.includes('--ai') || false

const node = new NodeDaemon(storagePath, {
  ai: aiEnabled ? { mock: aiMock } : undefined
})

node.on('ready', (info) => send({ type: 'ready', ...info, services: node.services }))
node.on('restored', (info) => send({ type: 'restored', ...info }))
node.on('pairRequest', (info) => send({ type: 'pairRequest', ...info }))
node.on('paired', (info) => send({ type: 'paired', ...info }))
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
    send({ type: 'status', ...status })
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
      await node.unpairApp(msg.appId)
      break
    case 'refresh-status': {
      const status = await node.getStatus()
      send({ type: 'status', ...status })
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

node.start().catch((err) => {
  send({ type: 'fatal', error: err.message })
})
