#!/usr/bin/env node

import os from 'os'
import path from 'path'
import chalk from 'chalk'
import { NodeDaemon } from './node.js'
import { exportNodeState, importNodeState } from './export.js'

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

if (command === 'start') {
  await startNode(storagePath, { aiEnabled, aiMock, aiModelSrc })
} else if (command === 'export') {
  if (!commandTarget) usageAndExit('Missing output path for export')
  const bundle = await exportNodeState({ storagePath, outPath: commandTarget })
  console.log(chalk.green(`Exported ${bundle.apps.length} app(s) to ${commandTarget}`))
} else if (command === 'import') {
  if (!commandTarget) usageAndExit('Missing input path for import')
  const bundle = await importNodeState({ storagePath, inPath: commandTarget })
  console.log(chalk.green(`Imported ${bundle.apps.length} app(s) from ${commandTarget}`))
} else if (command === 'help') {
  console.log(`
${chalk.bold('unstoppable-node')} — Personal sync node for Unstoppable Stack apps

${chalk.bold('Usage:')}
  unstoppable-node start [options]
  unstoppable-node export <out.uns> [--storage <path>]
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
${chalk.dim('With --ai it also offers on-demand inference to paired apps.')}
`)
} else {
  usageAndExit(`Unknown command: ${command}`)
}

function usageAndExit (message) {
  console.error(chalk.red(message))
  console.error(`Run ${chalk.bold('unstoppable-node help')} for usage.`)
  process.exit(1)
}

async function startNode (storagePath, cli = {}) {
  console.log()
  console.log(chalk.bold('  Unstoppable Node'))
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

  const node = new NodeDaemon(storagePath, opts)

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

  node.on('inference', ({ appId }) => {
    console.log(chalk.dim(`  🧠 Inference served${appId ? ` for ${appId}` : ''}`))
  })

  node.on('ready', ({ topic, publicKey }) => {
    console.log(chalk.green('  ✓ Node is running'))
    console.log(chalk.dim(`  Topic:      ${topic.slice(0, 16)}...`))
    console.log(chalk.dim(`  Public key: ${publicKey.slice(0, 16)}...`))
    const services = Object.entries(node.services)
      .map(([k, v]) => v ? chalk.green(`+${k}`) : chalk.dim(`-${k}`))
      .join(' ')
    console.log(chalk.dim('  Services:   ') + services)
    console.log()
    console.log(chalk.dim('  Waiting for apps to connect...'))
    console.log()
  })

  node.on('restored', ({ appCount }) => {
    console.log(chalk.blue(`  ↻ Restored ${appCount} app(s) from registry`))
  })

  node.on('pairRequest', ({ appId, appName }) => {
    console.log(chalk.yellow(`  ⟵ Pair request from ${chalk.bold(appName)} (${appId})`))
  })

  node.on('paired', ({ appId, appName }) => {
    console.log(chalk.green(`  ✓ Paired with ${chalk.bold(appName)} (${appId})`))
  })

  node.on('appRegistered', ({ appId, coreCount, driveCount }) => {
    console.log(chalk.green(`  ✓ Registered ${chalk.bold(appId)}: ${coreCount} core(s), ${driveCount} drive(s)`))
  })

  node.on('peerConnected', ({ publicKey }) => {
    console.log(chalk.dim(`  + Peer connected: ${publicKey.slice(0, 12)}...`))
  })

  node.on('peerDisconnected', ({ publicKey }) => {
    console.log(chalk.dim(`  - Peer disconnected: ${publicKey.slice(0, 12)}...`))
  })

  node.on('heartbeat', ({ appId }) => {
    console.log(chalk.dim(`  ♥ Heartbeat from ${appId}`))
  })

  node.on('error', ({ type, appId, error }) => {
    console.log(chalk.red(`  ✗ Error (${type}): ${appId} — ${error}`))
  })

  const statusInterval = setInterval(async () => {
    const status = await node.getStatus()
    if (status.apps.length === 0) return
    console.log()
    console.log(chalk.bold('  ── Status ──'))
    for (const app of status.apps) {
      const cores = status.cores.filter(c => c.appId === app.appId)
      const drives = status.drives.filter(d => d.appId === app.appId)
      const totalEntries = cores.reduce((sum, c) => sum + c.length, 0)
      const totalPeers = cores.reduce((sum, c) => sum + c.peers, 0)
      console.log(`  ${chalk.cyan(app.appName)} (${app.appId})`)
      const parts = [`Cores: ${cores.length}`, `Entries: ${totalEntries}`, `Peers: ${totalPeers}`]
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
