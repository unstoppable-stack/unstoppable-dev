import { createServer, type Server, type Socket } from 'net'
import { join } from 'path'
import { homedir } from 'os'
import { existsSync, mkdirSync, writeFileSync, unlinkSync, readFileSync, createWriteStream, readdirSync } from 'fs'
import Hyperswarm from 'hyperswarm'
// @ts-ignore
import crypto from 'hypercore-crypto'
// @ts-ignore
import b4a from 'b4a'
import { encode, createMessageParser } from './protocol.js'
import { MSG } from './types.js'
import { loadConfig, saveKeypair, addTrustedDevice } from './config.js'
import { SessionBridge } from './session-bridge.js'

const REMOTE_DIR = join(homedir(), '.unstoppable', 'remote')
const SOCK_PATH = join(REMOTE_DIR, 'daemon.sock')
const PID_PATH = join(REMOTE_DIR, 'daemon.pid')
const LOG_DIR = join(REMOTE_DIR, 'logs')

export function getSockPath() { return SOCK_PATH }
export function getPidPath() { return PID_PATH }

/**
 * IPC protocol between CLI ↔ Daemon (over Unix socket).
 * Each message is a JSON line terminated by \n.
 */
interface IpcMessage {
  cmd: string
  [key: string]: unknown
}

export class Daemon {
  private ipcServer: Server | null = null
  private testServer: Server | null = null
  private swarm: InstanceType<typeof Hyperswarm> | null = null
  private keypair: { publicKey: Buffer; secretKey: Buffer }
  private sessionTopic: Buffer | null = null
  private pairingTopic: Buffer | null = null
  private sessions: Map<string, SessionBridge> = new Map()
  private phoneStreams: Map<string, any> = new Map()
  private bootstrap?: Array<{ host: string; port: number }>
  private testPort?: number
  private log: (msg: string) => void

  constructor(opts?: { bootstrap?: Array<{ host: string; port: number }>; testPort?: number }) {
    this.bootstrap = opts?.bootstrap
    this.testPort = opts?.testPort
    this.log = (msg: string) => {
      const ts = new Date().toISOString().slice(11, 19)
      process.stdout.write(`[${ts}] ${msg}\n`)
    }

    const config = loadConfig()
    if (config.keypair) {
      this.keypair = {
        publicKey: Buffer.from(config.keypair.publicKey, 'hex'),
        secretKey: Buffer.from(config.keypair.secretKey, 'hex'),
      }
    } else {
      this.keypair = crypto.keyPair()
      saveKeypair(this.keypair.publicKey, this.keypair.secretKey)
    }
  }

  async start(): Promise<void> {
    if (!existsSync(REMOTE_DIR)) mkdirSync(REMOTE_DIR, { recursive: true })
    if (!existsSync(LOG_DIR)) mkdirSync(LOG_DIR, { recursive: true })

    // Clean up stale socket
    if (existsSync(SOCK_PATH)) unlinkSync(SOCK_PATH)

    // Write PID
    writeFileSync(PID_PATH, String(process.pid))

    // Start P2P
    const swarmOpts: any = { keyPair: this.keypair }
    if (this.bootstrap) swarmOpts.bootstrap = this.bootstrap
    this.swarm = new Hyperswarm(swarmOpts)
    this.sessionTopic = crypto.discoveryKey(this.keypair.publicKey)

    this.swarm.on('connection', (stream: any) => {
      const remoteKey = b4a.toString(stream.remotePublicKey, 'hex')
      const config = loadConfig()
      const isTrusted = config.trustedDevices.some((d) => d.publicKey === remoteKey)

      this.log(`Connection from ${remoteKey.slice(0, 12)}... (trusted: ${isTrusted}, pairing: ${!!this.pairingTopic})`)

      if (isTrusted) {
        this.handleTrustedPhone(remoteKey, stream)
      } else if (this.pairingTopic) {
        this.handlePairingConnection(remoteKey, stream)
      } else {
        this.log(`Rejected untrusted connection: ${remoteKey.slice(0, 12)}...`)
        stream.destroy()
      }
    })

    this.swarm.join(this.sessionTopic, { server: true, client: true })
    await this.swarm.flush()

    this.log(`P2P listening (pubkey: ${b4a.toString(this.keypair.publicKey, 'hex').slice(0, 12)}...)`)

    // Start IPC server
    this.ipcServer = createServer((socket) => this.handleIpcClient(socket))
    await new Promise<void>((resolve) => {
      this.ipcServer!.listen(SOCK_PATH, resolve)
    })

    this.log(`IPC listening on ${SOCK_PATH}`)

    // Local test port: plain TCP that speaks the same protocol as Hyperswarm streams.
    // This bypasses DHT/holepunching so same-machine testing works reliably.
    if (this.testPort) {
      this.testServer = createServer((socket) => {
        const fakeKey = crypto.randomBytes(32)
        const remoteKey = b4a.toString(fakeKey, 'hex')
        this.log(`Test connection from TCP (assigned key: ${remoteKey.slice(0, 12)}...)`)

        if (this.pairingTopic) {
          this.handlePairingConnectionTcp(remoteKey, socket)
        } else {
          const config = loadConfig()
          const anyTrusted = config.trustedDevices.length > 0
          if (anyTrusted) {
            this.handleTrustedPhone(remoteKey, socket)
          } else {
            this.log('No pairing mode active and no trusted devices — rejecting TCP')
            socket.destroy()
          }
        }
      })
      await new Promise<void>((resolve) => {
        this.testServer!.listen(this.testPort, '127.0.0.1', resolve)
      })
      this.log(`Test port listening on 127.0.0.1:${this.testPort}`)
    }

    process.on('SIGINT', () => this.shutdown())
    process.on('SIGTERM', () => this.shutdown())
  }

  // ── Phone connections ────────────────────────────────────────────

  private handleTrustedPhone(remoteKey: string, stream: any) {
    this.log(`Phone connected: ${remoteKey.slice(0, 12)}...`)
    this.phoneStreams.set(remoteKey, stream)

    stream.on('close', () => {
      this.phoneStreams.delete(remoteKey)
      this.log(`Phone disconnected: ${remoteKey.slice(0, 12)}...`)
    })
    stream.on('error', () => {
      this.phoneStreams.delete(remoteKey)
    })

    const parser = createMessageParser((msg) => {
      this.handlePhoneMessage(remoteKey, stream, msg)
    })
    stream.on('data', parser)

    // Subscribe phone to all existing sessions
    for (const session of this.sessions.values()) {
      session.addPeer(remoteKey, stream)
    }

    // Send current session list
    const list = Array.from(this.sessions.values()).map((s) => s.getInfo())
    stream.write(encode(MSG.SESSIONS_LIST_RESPONSE, { sessions: list }))
  }

  private handlePhoneMessage(remoteKey: string, stream: any, msg: any) {
    switch (msg.type) {
      case MSG.SESSIONS_LIST: {
        const list = Array.from(this.sessions.values()).map((s) => s.getInfo())
        stream.write(encode(MSG.SESSIONS_LIST_RESPONSE, { sessions: list }))
        break
      }
      // SESSION_INPUT and TERMINAL_RESIZE are handled by SessionBridge.handlePeerMessage (via addPeer)
      case 'session:start': {
        const cmd = msg.payload.command as string
        if (cmd) {
          const parts = cmd.split(' ')
          this.spawnSession(parts[0], parts.slice(1))
        }
        break
      }
    }
  }

  private handlePairingConnection(remoteKey: string, stream: any) {
    this.log(`Pairing attempt from: ${remoteKey.slice(0, 12)}...`)

    const parser = createMessageParser((msg) => {
      if (msg.type === MSG.PAIR_REQUEST) {
        const deviceName = (msg.payload.deviceName as string) || 'Unknown Phone'

        addTrustedDevice({
          publicKey: remoteKey,
          name: deviceName,
          pairedAt: new Date().toISOString(),
        })

        stream.write(
          encode(MSG.PAIR_ACCEPT, {
            deviceName: loadConfig().deviceName,
            sessionTopic: b4a.toString(this.sessionTopic!, 'hex'),
          })
        )

        this.log(`Paired with: ${deviceName}`)

        // After pairing, treat as trusted
        setTimeout(() => {
          this.stopPairing()
          this.handleTrustedPhone(remoteKey, stream)
        }, 500)
      }
    })

    stream.on('data', parser)
  }

  private handlePairingConnectionTcp(remoteKey: string, socket: Socket) {
    this.log(`Pairing attempt from TCP: ${remoteKey.slice(0, 12)}...`)

    const parser = createMessageParser((msg) => {
      if (msg.type === MSG.PAIR_REQUEST) {
        const deviceName = (msg.payload.deviceName as string) || 'Unknown Phone'

        addTrustedDevice({
          publicKey: remoteKey,
          name: deviceName,
          pairedAt: new Date().toISOString(),
        })

        socket.write(
          encode(MSG.PAIR_ACCEPT, {
            deviceName: loadConfig().deviceName,
            sessionTopic: b4a.toString(this.sessionTopic!, 'hex'),
          })
        )

        this.log(`Paired with: ${deviceName}`)

        setTimeout(() => {
          this.stopPairing()
          this.handleTrustedPhone(remoteKey, socket)
        }, 500)
      }
    })

    socket.on('data', (chunk: Buffer) => parser(chunk))
  }

  // ── Session management ───────────────────────────────────────────

  private spawnSession(command: string, args: string[]): SessionBridge {
    const bridge = new SessionBridge(command, args)
    this.sessions.set(bridge.id, bridge)

    this.log(`Session ${bridge.id.slice(0, 8)} starting: ${command} ${args.join(' ')}`)

    // Subscribe all connected phones to this session
    for (const [key, stream] of this.phoneStreams) {
      bridge.addPeer(key, stream)
    }

    // Start asynchronously (node-pty loads lazily)
    bridge.start().then((child) => {
      const logFile = join(LOG_DIR, `${bridge.id}.log`)
      const logStream = createWriteStream(logFile, { flags: 'a' })

      bridge.onOutput((data: string) => {
        logStream.write(data)
      })

      child.on('exit', (code) => {
        logStream.end()
        this.log(`Session ${bridge.id.slice(0, 8)} ended (exit: ${code ?? '?'})`)
      })
    }).catch((err) => {
      this.log(`Session ${bridge.id.slice(0, 8)} failed: ${err.message}`)
    })

    return bridge
  }

  // ── Pairing ──────────────────────────────────────────────────────

  private async startPairing(): Promise<string> {
    // Leave old pairing topic if any
    if (this.pairingTopic && this.swarm) {
      this.swarm.leave(this.pairingTopic)
    }
    this.pairingTopic = crypto.randomBytes(32)
    this.swarm!.join(this.pairingTopic, { server: true, client: true })
    await this.swarm!.flush()
    const topicHex = b4a.toString(this.pairingTopic, 'hex')
    this.log(`Pairing mode active (topic: ${topicHex.slice(0, 12)}...)`)
    return topicHex
  }

  private stopPairing() {
    if (this.pairingTopic && this.swarm) {
      this.swarm.leave(this.pairingTopic)
      this.pairingTopic = null
      this.log('Pairing mode stopped')
    }
  }

  // ── IPC (CLI ↔ Daemon) ──────────────────────────────────────────

  private handleIpcClient(socket: Socket) {
    let buffer = ''

    socket.on('data', (chunk) => {
      buffer += chunk.toString()
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (!line.trim()) continue
        try {
          const msg = JSON.parse(line) as IpcMessage
          this.handleIpcCommand(socket, msg)
        } catch {}
      }
    })
  }

  private async handleIpcCommand(socket: Socket, msg: IpcMessage) {
    const reply = (data: Record<string, unknown>) => {
      socket.write(JSON.stringify(data) + '\n')
    }

    switch (msg.cmd) {
      case 'ping':
        reply({ ok: true, pid: process.pid, uptime: process.uptime() })
        break

      case 'pair': {
        const topicHex = await this.startPairing()
        const payloadObj: Record<string, any> = {
          type: 'unstoppable-remote',
          version: 1,
          pairingTopic: topicHex,
          publicKey: b4a.toString(this.keypair.publicKey, 'hex'),
          sessionTopic: b4a.toString(this.sessionTopic!, 'hex'),
        }
        if (this.testPort) {
          payloadObj.testPort = this.testPort
        }
        const payload = JSON.stringify(payloadObj)
        reply({ ok: true, payload, topic: topicHex })
        break
      }

      case 'run': {
        const command = msg.command as string
        const cmdArgs = (msg.args as string[]) || []
        if (!command) {
          reply({ ok: false, error: 'Missing command' })
          break
        }
        const session = this.spawnSession(command, cmdArgs)
        reply({ ok: true, sessionId: session.id, command: session.getInfo().command })
        break
      }

      case 'sessions': {
        const list = Array.from(this.sessions.values()).map((s) => s.getInfo())
        reply({ ok: true, sessions: list })
        break
      }

      case 'logs': {
        const sessionId = msg.sessionId as string
        if (!sessionId) {
          reply({ ok: false, error: 'Missing sessionId' })
          break
        }
        const logFile = join(LOG_DIR, `${sessionId}.log`)
        let content = ''
        try {
          content = readFileSync(logFile, 'utf-8')
        } catch {
          // Check by prefix
          const files = readdirSync(LOG_DIR) as string[]
          const match = files.find((f: string) => f.startsWith(sessionId))
          if (match) {
            content = readFileSync(join(LOG_DIR, match), 'utf-8')
          } else {
            reply({ ok: false, error: 'Session log not found' })
            break
          }
        }
        const tail = (msg.tail as number) || 100
        const lines = content.split('\n')
        const output = lines.slice(-tail).join('\n')
        reply({ ok: true, output, totalLines: lines.length })
        break
      }

      case 'phones': {
        const phones = Array.from(this.phoneStreams.keys()).map((k) => ({
          publicKey: k,
          short: k.slice(0, 16) + '...',
        }))
        reply({ ok: true, phones })
        break
      }

      case 'stop':
        reply({ ok: true })
        setTimeout(() => this.shutdown(), 200)
        break

      default:
        reply({ ok: false, error: `Unknown command: ${msg.cmd}` })
    }
  }

  // ── Cleanup ──────────────────────────────────────────────────────

  private async shutdown() {
    this.log('Shutting down...')
    for (const session of this.sessions.values()) {
      session.destroy()
    }
    this.sessions.clear()
    this.ipcServer?.close()
    this.testServer?.close()
    if (existsSync(SOCK_PATH)) unlinkSync(SOCK_PATH)
    if (existsSync(PID_PATH)) unlinkSync(PID_PATH)
    await this.swarm?.destroy()
    process.exit(0)
  }
}
