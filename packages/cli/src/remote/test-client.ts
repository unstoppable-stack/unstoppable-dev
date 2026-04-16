#!/usr/bin/env node

/**
 * Phone simulator for Unstoppable Remote.
 * Connects to the daemon and acts as a transparent terminal proxy.
 */

import Hyperswarm from 'hyperswarm'
// @ts-ignore
import crypto from 'hypercore-crypto'
// @ts-ignore
import b4a from 'b4a'
import { connect as tcpConnect } from 'net'
import { encode, createMessageParser } from './protocol.js'
import { MSG } from './types.js'
import { createInterface } from 'readline'
import chalk from 'chalk'

const accent = chalk.hex('#00d4aa')
const muted = chalk.hex('#71717a')
const dim = chalk.dim

const rawArgs = process.argv.slice(2)

if (rawArgs.length === 0) {
  console.log(`
  ${chalk.bold('Unstoppable Remote')} — Phone Simulator
  ${'─'.repeat(40)}

  ${accent('Usage:')}
    node dist/remote/test-client.js '<paste QR JSON>'

  ${accent('Steps:')}
    1. us remote start --test-port 9900
    2. us remote pair
    3. node dist/remote/test-client.js '<paste JSON>'

  Once connected, type ${accent('/run claude')} to start a session.
  Press Ctrl+C or type ${accent('/quit')} to exit.
  `)
  process.exit(0)
}

let bootstrap: Array<{ host: string; port: number }> | undefined
let pairingTopic: string | undefined
let sessionTopic: string | undefined
let testPort: number | undefined
const args: string[] = []

for (let i = 0; i < rawArgs.length; i++) {
  if (rawArgs[i] === '--bootstrap' || rawArgs[i] === '-b') {
    const val = rawArgs[++i]
    if (val) {
      bootstrap = val.split(',').map((s) => {
        const [host, portStr] = s.trim().split(':')
        return { host, port: parseInt(portStr) }
      })
    }
  } else {
    args.push(rawArgs[i])
  }
}

if (args.length > 0) {
  try {
    const payload = JSON.parse(args[0])
    if (payload.type !== 'unstoppable-remote') {
      console.error('Invalid payload — expected type "unstoppable-remote"')
      process.exit(1)
    }
    pairingTopic = payload.pairingTopic
    sessionTopic = payload.sessionTopic
    testPort = payload.testPort
  } catch {
    console.error('Could not parse argument as JSON. Pass the full QR code payload.')
    process.exit(1)
  }
}

let activeSessionId: string | null = null
let rawMode = false
let currentStream: any = null
let rl: ReturnType<typeof createInterface> | null = null

function statusLine(text: string) {
  process.stderr.write(dim(`  ${text}\n`))
}

function showPrompt() {
  if (rawMode) return
  if (rl) {
    rl.prompt()
  }
}

function sendResize(stream: any) {
  if (!process.stdout.isTTY) return
  const cols = process.stdout.columns || 120
  const rows = process.stdout.rows || 40
  stream.write(encode(MSG.TERMINAL_RESIZE, { cols, rows }))
}

function enterRawMode(stream: any) {
  if (rawMode) return
  if (!process.stdin.isTTY) return

  // Close readline so it doesn't interfere
  if (rl) {
    rl.close()
    rl = null
  }

  process.stdin.setRawMode(true)
  rawMode = true
  sendResize(stream)
}

function enterCommandMode() {
  if (!rawMode) return
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(false)
  }
  rawMode = false

  statusLine(dim('─ command mode ─ type /help, /run <cmd>, /list, /quit'))
  startReadline()
}

function startReadline() {
  if (rl) return
  rl = createInterface({
    input: process.stdin,
    output: process.stderr,
    prompt: accent('  ❯ '),
  })
  rl.on('line', (line) => {
    if (currentStream) handleLine(currentStream, line)
    showPrompt()
  })
  rl.on('close', () => {
    if (currentStream) currentStream.destroy()
    process.exit(0)
  })
  showPrompt()
}

function setupStreamHandlers(stream: any, mode: string) {
  currentStream = stream

  const parser = createMessageParser((msg) => {
    switch (msg.type) {
      case MSG.PAIR_ACCEPT:
        statusLine(`${accent('✓')} Paired with ${msg.payload.deviceName}`)
        statusLine('')
        statusLine(`Type ${accent('/run claude')} to start a session, or ${accent('/help')} for commands`)
        statusLine('')
        startReadline()
        break

      case MSG.SESSION_INFO: {
        const cmd = (msg.payload.command as string).trim()
        const id = msg.payload.sessionId as string
        activeSessionId = id
        statusLine(`${accent('▶')} ${chalk.bold(cmd)} ${dim(`(${id.slice(0, 8)})`)}`)
        if (msg.payload.bufferedOutput) {
          const buf = (msg.payload.bufferedOutput as string).trim()
          if (buf) process.stdout.write(buf + '\n')
        }
        enterRawMode(stream)
        break
      }

      case MSG.SESSION_OUTPUT:
        process.stdout.write(msg.payload.data as string)
        break

      case MSG.SESSION_END:
        statusLine(`${dim('■')} Session ended (exit ${msg.payload.exitCode})`)
        if (activeSessionId === msg.payload.sessionId) {
          activeSessionId = null
          enterCommandMode()
        }
        break

      case MSG.SESSIONS_LIST_RESPONSE: {
        const sessions = msg.payload.sessions as any[]
        if (!sessions?.length) {
          statusLine('No sessions running')
        } else {
          statusLine(`Sessions (${sessions.length}):`)
          for (const s of sessions) {
            const dot = s.active !== false ? chalk.green('●') : chalk.gray('○')
            const cur = s.id === activeSessionId ? accent(' ← active') : ''
            statusLine(`  ${dot} ${s.command} ${dim(`(${s.id.slice(0, 8)})`)}${cur}`)
          }
        }
        break
      }

      default:
        break
    }
  })

  stream.on('data', (chunk: Buffer) => parser(chunk))
  stream.on('close', () => {
    if (rawMode && process.stdin.isTTY) process.stdin.setRawMode(false)
    statusLine('Connection closed')
    process.exit(0)
  })
  stream.on('error', (err: any) => {
    if (rawMode && process.stdin.isTTY) process.stdin.setRawMode(false)
    statusLine(chalk.red(`Connection error: ${err.message}`))
  })
  stream.on('end', () => {
    if (rawMode && process.stdin.isTTY) process.stdin.setRawMode(false)
    statusLine('Connection ended')
    process.exit(0)
  })

  if (mode === 'pair') {
    stream.write(encode(MSG.PAIR_REQUEST, { deviceName: 'Test Client (Phone Simulator)' }))
  }

  // Sync terminal size on resize
  if (process.stdout.isTTY) {
    process.stdout.on('resize', () => {
      if (activeSessionId) sendResize(stream)
    })
  }

  // Raw stdin handler — active when in a session
  process.stdin.resume()
  process.stdin.on('data', (data: Buffer) => {
    if (!rawMode) return // readline handles line mode

    if (!activeSessionId) {
      enterCommandMode()
      return
    }

    // ESC → enter command mode
    if (data.length === 1 && data[0] === 0x1b) {
      enterCommandMode()
      return
    }

    // Everything else → forward to session
    stream.write(encode(MSG.SESSION_INPUT, { sessionId: activeSessionId, text: data.toString() }))
  })
}

function handleLine(stream: any, line: string) {
  const trimmed = line.trim()
  if (!trimmed) return

  if (trimmed === '/quit' || trimmed === '/q') {
    stream.destroy()
    process.exit(0)
  }

  if (trimmed === '/help' || trimmed === '/h') {
    statusLine('')
    statusLine(chalk.bold('Commands:'))
    statusLine(`  ${accent('/run <cmd>')}   Start a session (e.g. /run claude)`)
    statusLine(`  ${accent('/list')}        List sessions`)
    statusLine(`  ${accent('/use <id>')}    Switch active session`)
    statusLine(`  ${accent('/quit')}        Disconnect`)
    statusLine('')
    statusLine(chalk.bold('In a session:'))
    statusLine(`  Everything you type goes directly to the session.`)
    statusLine(`  Press ${accent('ESC')} to enter command mode.`)
    statusLine(`  Ctrl+C is sent to the session (not the simulator).`)
    statusLine('')
    return
  }

  if (trimmed === '/list' || trimmed === '/ls') {
    stream.write(encode(MSG.SESSIONS_LIST, {}))
    return
  }

  if (trimmed.startsWith('/run ') || trimmed.startsWith('/start ')) {
    const cmd = trimmed.replace(/^\/(run|start)\s+/, '').trim()
    if (!cmd) {
      statusLine('Usage: /run <command>')
      return
    }
    statusLine(dim(`Starting: ${cmd}`))
    stream.write(encode('session:start', { command: cmd }))
    return
  }

  if (trimmed.startsWith('/use ')) {
    activeSessionId = trimmed.slice(5).trim()
    statusLine(`Switched to session ${activeSessionId.slice(0, 8)}`)
    enterRawMode(stream)
    return
  }

  // Not a command — send as session input if there's an active session
  if (activeSessionId) {
    stream.write(encode(MSG.SESSION_INPUT, { sessionId: activeSessionId, text: line + '\n' }))
  } else {
    statusLine('No active session. Type /run <command> to start one.')
  }
}

// ── Main ──────────────────────────────────────────────────────────

console.clear()
statusLine(chalk.bold('📱 Unstoppable Remote'))
statusLine('')

if (testPort) {
  statusLine(dim(`Connecting to localhost:${testPort}...`))

  const socket = tcpConnect(testPort, '127.0.0.1')
  socket.on('connect', () => {
    statusLine(`${accent('✓')} Connected`)
    setupStreamHandlers(socket, pairingTopic ? 'pair' : 'session')
  })
  socket.on('error', (err: any) => {
    statusLine(chalk.red(`Connection failed: ${err.message}`))
    process.exit(1)
  })
} else {
  statusLine(dim('Connecting via Hyperswarm P2P...'))
  if (bootstrap) statusLine(dim(`Bootstrap: ${bootstrap.map((b) => `${b.host}:${b.port}`).join(', ')}`))

  const phoneKeypair = crypto.keyPair()
  const swarmOpts: any = { keyPair: phoneKeypair }
  if (bootstrap) swarmOpts.bootstrap = bootstrap
  const swarm = new Hyperswarm(swarmOpts)

  swarm.on('connection', (stream: any) => {
    statusLine(`${accent('✓')} Connected to desktop`)
    setupStreamHandlers(stream, pairingTopic ? 'pair' : 'session')
  })

  if (pairingTopic) {
    swarm.join(Buffer.from(pairingTopic, 'hex'), { client: true, server: true })
  }

  swarm.flush().then(() => {
    statusLine(dim('Searching for desktop...'))
  })

  process.on('SIGINT', async () => {
    await swarm.destroy()
    process.exit(0)
  })
}
