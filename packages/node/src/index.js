#!/usr/bin/env node

import os from 'os'
import path from 'path'
import chalk from 'chalk'
import { PersonalNode } from './personal-node.js'
import { exportNodeState, importNodeState, previewNodeStateImport } from './export.js'

const DEFAULT_STORAGE = path.join(os.homedir(), '.unstoppable-node')

const args = process.argv.slice(2)

let command = 'start'
let storagePath = DEFAULT_STORAGE
let aiEnabled = false
let aiMock = false
let aiModelSrc = null
const positional = []

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--storage' && args[i + 1]) {
    storagePath = args[++i]
  } else if (args[i] === '--ai') {
    aiEnabled = true
  } else if (args[i] === '--ai-mock') {
    aiEnabled = true
    aiMock = true
  } else if (args[i] === '--ai-model' && args[i + 1]) {
    aiEnabled = true
    aiModelSrc = args[++i]
  } else if (!args[i].startsWith('-')) {
    positional.push(args[i])
  }
}
command = positional[0] || command
const commandTarget = positional[1]

// Also honor env vars (useful in docker/launchd/systemd setups where
// flipping command-line flags is awkward).
if (process.env.UNSTOPPABLE_AI === '1') aiEnabled = true
if (process.env.UNSTOPPABLE_AI_MOCK === '1') { aiEnabled = true; aiMock = true }

try {
  if (command === 'start') {
    await startNode(storagePath, { aiEnabled, aiMock, aiModelSrc })
  } else if (command === 'export') {
    if (!commandTarget) usageAndExit('Missing output path for export')
    const bundle = await exportNodeState({ storagePath, outPath: commandTarget })
    console.log(chalk.green(`Exported ${bundle.peers.length} peer(s) to ${commandTarget}`))
  } else if (command === 'import') {
    if (!commandTarget) usageAndExit('Missing input path for import')
    const bundle = await importNodeState({ storagePath, inPath: commandTarget })
    console.log(chalk.green(`Imported ${bundle.peers.length} peer(s) from ${commandTarget}`))
  } else if (command === 'inspect') {
    if (!commandTarget) usageAndExit('Missing input path for inspect')
    const preview = await previewNodeStateImport({ inPath: commandTarget })
    printImportPreview(commandTarget, preview)
  } else if (command === 'help') {
    console.log(`
${chalk.bold('unstoppable-node')} — Personal Node for Unstoppable Stack apps

${chalk.bold('Usage:')}
  unstoppable-node start [options]
  unstoppable-node export <out.uns> [--storage <path>]
  unstoppable-node inspect <in.uns>
  unstoppable-node import <in.uns> [--storage <path>]

${chalk.bold('Options:')}
  --storage <path>     Storage directory (default: ~/.unstoppable-node)
  --ai                 Enable AI provider (loads a model via @qvac/sdk)
  --ai-mock            Enable AI provider in mock mode (for tests/demos)
  --ai-model <src>     QVAC model source to load (default: llama-3.2-1B)

${chalk.bold('Environment:')}
  UNSTOPPABLE_AI=1          Same as --ai
  UNSTOPPABLE_AI_MOCK=1     Same as --ai-mock

${chalk.dim('The node replicates, backs up, and seeds data from your P2P apps.')}
${chalk.dim('With --ai it also offers on-demand inference to paired peers.')}
`)
  } else {
    usageAndExit(`Unknown command: ${command}`)
  }
} catch (err) {
  console.error(chalk.red(err.message || err))
  process.exit(1)
}

function usageAndExit (message) {
  console.error(chalk.red(message))
  console.error(`Run ${chalk.bold('unstoppable-node help')} for usage.`)
  process.exit(1)
}

function shortKey (key) {
  return key ? `${key.slice(0, 12)}…` : 'unknown'
}

function peerLabel (peer) {
  return peer.appName || peer.appId || shortKey(peer.publicKey)
}

function printImportPreview (target, preview) {
  console.log(chalk.bold(`Backup: ${target}`))
  console.log(chalk.dim(`  Version:  ${preview.version}`))
  console.log(chalk.dim(`  Exported: ${preview.exportedAt || 'unknown'}`))
  console.log(chalk.dim(`  Config:   ${preview.hasConfig ? 'included' : 'not included'}`))
  console.log(chalk.dim(`  Identity: ${preview.hasIdentity ? 'included' : 'not included'}`))
  console.log(chalk.dim(`  Trust:    ${preview.hasTrust ? `${preview.trustCounts.approved} approved, ${preview.trustCounts.denied} denied` : 'not included'}`))
  console.log(chalk.dim(`  Peers:    ${preview.peerCount}`))
  for (const peer of preview.peers) {
    console.log(`  - ${peer.appName} ${chalk.dim(`(${shortKey(peer.publicKey)})`)}`)
  }
}

async function startNode (storagePath, cli = {}) {
  console.log()
  console.log(chalk.bold('  Unstoppable Personal Node'))
  console.log(chalk.dim(`  Storage: ${storagePath}`))
  console.log()

  const opts = {}

  if (process.env.NODE_BOOTSTRAP) {
    opts.swarm = { bootstrap: JSON.parse(process.env.NODE_BOOTSTRAP) }
  }
  if (process.env.NODE_TOPIC) {
    opts.topic = Buffer.from(process.env.NODE_TOPIC, 'hex')
  }

  if (cli.aiEnabled) {
    opts.ai = { mock: !!cli.aiMock }
    if (cli.aiModelSrc) opts.ai.modelSrc = cli.aiModelSrc
  }

  const node = new PersonalNode(storagePath, opts)

  node.on('aiProgress', (p) => {
    if (typeof p.percentage === 'number') {
      process.stdout.write(`\r${chalk.dim('  Downloading AI model: ')}${Math.round(p.percentage)}% `)
    }
  })

  node.on('aiReady', ({ mock, modelId }) => {
    console.log(chalk.green(`  ✓ AI provider ready ${mock ? chalk.dim('(mock)') : chalk.dim(`(${modelId})`)}`))
  })

  node.on('aiError', ({ phase, error }) => {
    console.log(chalk.red(`  ✗ AI ${phase} error: ${error}`))
  })

  node.on('inference', ({ appId, publicKey }) => {
    console.log(chalk.dim(`  🧠 Inference served for ${appId || shortKey(publicKey)}`))
  })

  node.on('listening', ({ publicKey, topic }) => {
    console.log(chalk.green('  ✓ Node is running'))
    console.log(chalk.dim(`  Public key: ${publicKey}`))
    if (topic) console.log(chalk.dim(`  Topic:      ${topic.slice(0, 16)}…`))
    const caps = Object.keys(node.node.capabilities.describe()).join(' ')
    console.log(chalk.dim('  Capabilities: ') + chalk.green(caps))
    console.log()
    console.log(chalk.dim('  Share the public key to pair an app with this node.'))
    console.log(chalk.dim('  Waiting for apps to connect...'))
    console.log()
  })

  node.on('restored', ({ resourceCount }) => {
    console.log(chalk.blue(`  ↻ Restored ${resourceCount} replicated resource(s)`))
  })

  node.on('pairRequest', ({ publicKey, profile }) => {
    console.log(chalk.yellow(`  ⟵ Pair request from ${chalk.bold(profile?.appName || shortKey(publicKey))}`))
  })

  node.on('paired', ({ publicKey, appName, appId }) => {
    console.log(chalk.green(`  ✓ Paired with ${chalk.bold(appName || appId || shortKey(publicKey))}`))
  })

  node.on('pairDenied', ({ publicKey, reason }) => {
    console.log(chalk.red(`  ✗ Denied ${shortKey(publicKey)}: ${reason}`))
  })

  node.on('peerDisconnected', ({ publicKey }) => {
    console.log(chalk.dim(`  - Peer disconnected: ${shortKey(publicKey)}`))
  })

  node.on('quotaExceeded', ({ publicKey, reason, used, limit }) => {
    console.log(chalk.yellow(`  ⚠ Quota (${reason}) exceeded by ${shortKey(publicKey)}: ${used}/${limit} bytes — paused`))
  })

  node.on('error', ({ type, error }) => {
    console.log(chalk.red(`  ✗ Error (${type}): ${error}`))
  })

  const statusInterval = setInterval(async () => {
    const status = await node.getStatus()
    if (status.peers.length === 0) return
    console.log()
    console.log(chalk.bold('  ── Status ──'))
    for (const peer of status.peers) {
      const cores = status.cores.filter((core) => core.owner === peer.publicKey)
      const drives = status.drives.filter((drive) => drive.owner === peer.publicKey)
      const entries = cores.reduce((sum, core) => sum + core.length, 0)
      const peers = cores.reduce((sum, core) => sum + core.peers, 0)
      const dot = peer.online ? chalk.green('●') : chalk.dim('○')
      console.log(`  ${dot} ${chalk.cyan(peerLabel(peer))} ${chalk.dim(shortKey(peer.publicKey))}`)
      const parts = [`Cores: ${cores.length}`, `Entries: ${entries}`, `Peers: ${peers}`]
      if (drives.length > 0) parts.push(`Drives: ${drives.length}`)
      console.log(chalk.dim(`    ${parts.join(' | ')}`))
    }
    console.log()
  }, 30_000)

  async function shutdown () {
    console.log()
    console.log(chalk.dim('  Shutting down...'))
    clearInterval(statusInterval)
    await node.close()
    console.log(chalk.dim('  Node stopped.'))
    process.exit(0)
  }

  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)

  await node.start()
}
