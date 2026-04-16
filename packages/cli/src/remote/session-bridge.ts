import { encode, createMessageParser } from './protocol.js'
import { MSG, type ProtocolMessage } from './types.js'
import { randomBytes } from 'crypto'

let pty: typeof import('node-pty') | null = null

async function loadPty() {
  if (pty) return pty
  try {
    pty = await import('node-pty')
    return pty
  } catch {
    return null
  }
}

interface PeerConnection {
  stream: any
  parser: ReturnType<typeof createMessageParser>
}

export class SessionBridge {
  readonly id: string
  readonly command: string
  readonly args: string[]
  private ptyProcess: import('node-pty').IPty | null = null
  private peers: Map<string, PeerConnection> = new Map()
  private outputBuffer: string[] = []
  private readonly maxBufferLines = 500
  private startedAt: string = ''
  private outputListeners: Array<(data: string) => void> = []
  private active = true

  constructor(command: string, args: string[]) {
    this.id = randomBytes(8).toString('hex')
    this.command = command
    this.args = args
  }

  async start(opts?: { interactive?: boolean; cols?: number; rows?: number }): Promise<{ on: (event: string, cb: (...args: any[]) => void) => void }> {
    const interactive = opts?.interactive ?? false
    this.startedAt = new Date().toISOString()

    const ptyMod = await loadPty()
    if (!ptyMod) {
      throw new Error('node-pty not available — install it with: npm install node-pty')
    }

    const cols = opts?.cols || parseInt(process.env.COLUMNS || '120')
    const rows = opts?.rows || parseInt(process.env.LINES || '40')

    // Run through a login shell so PATH and env are resolved correctly
    const shell = process.env.SHELL || '/bin/bash'
    const fullCmd = [this.command, ...this.args].join(' ')

    this.ptyProcess = ptyMod.spawn(shell, ['-l', '-c', fullCmd], {
      name: process.env.TERM || 'xterm-256color',
      cols,
      rows,
      cwd: process.cwd(),
      env: {
        ...process.env as Record<string, string>,
        FORCE_COLOR: '1',
        TERM: process.env.TERM || 'xterm-256color',
      },
    })

    this.ptyProcess.onData((data: string) => {
      if (interactive) process.stdout.write(data)
      this.bufferOutput(data)
      this.broadcastOutput(data)
    })

    if (interactive) {
      process.stdin.setRawMode?.(true)
      process.stdin.resume()
      process.stdin.on('data', (data: Buffer) => {
        this.ptyProcess?.write(data.toString())
      })
    }

    this.ptyProcess.onExit(({ exitCode }) => {
      this.active = false
      this.broadcastEnd(exitCode)
      if (interactive) {
        process.stdin.setRawMode?.(false)
        process.stdin.pause()
      }
    })

    // Return an event-emitter-like object for compatibility with daemon
    const exitCallbacks: Array<(code: number) => void> = []
    this.ptyProcess.onExit(({ exitCode }) => {
      for (const cb of exitCallbacks) cb(exitCode)
    })

    return {
      on: (event: string, cb: (...args: any[]) => void) => {
        if (event === 'exit') exitCallbacks.push(cb)
      },
    }
  }

  private bufferOutput(text: string) {
    const lines = text.split('\n')
    this.outputBuffer.push(...lines)
    if (this.outputBuffer.length > this.maxBufferLines) {
      this.outputBuffer = this.outputBuffer.slice(-this.maxBufferLines)
    }
    for (const listener of this.outputListeners) {
      listener(text)
    }
  }

  private broadcastOutput(text: string) {
    const msg = encode(MSG.SESSION_OUTPUT, {
      sessionId: this.id,
      data: text,
      timestamp: Date.now(),
    })
    for (const peer of this.peers.values()) {
      try { peer.stream.write(msg) } catch {}
    }
  }

  private broadcastEnd(exitCode: number) {
    const msg = encode(MSG.SESSION_END, {
      sessionId: this.id,
      exitCode,
    })
    for (const peer of this.peers.values()) {
      try { peer.stream.write(msg) } catch {}
    }
  }

  addPeer(publicKey: string, stream: any): void {
    const parser = createMessageParser((msg) => this.handlePeerMessage(publicKey, msg))
    stream.on('data', parser)
    stream.on('close', () => this.peers.delete(publicKey))
    stream.on('error', () => this.peers.delete(publicKey))

    this.peers.set(publicKey, { stream, parser })

    stream.write(
      encode(MSG.SESSION_INFO, {
        sessionId: this.id,
        command: `${this.command} ${this.args.join(' ')}`,
        startedAt: this.startedAt,
        bufferedOutput: this.outputBuffer.join('\n'),
      })
    )
  }

  private handlePeerMessage(publicKey: string, msg: ProtocolMessage): void {
    switch (msg.type) {
      case MSG.SESSION_INPUT: {
        const text = msg.payload.text as string
        if (text && this.ptyProcess) {
          this.ptyProcess.write(text)
        }
        break
      }
      case MSG.TERMINAL_RESIZE: {
        const cols = msg.payload.cols as number
        const rows = msg.payload.rows as number
        if (cols && rows && this.ptyProcess) {
          this.ptyProcess.resize(cols, rows)
        }
        break
      }
      case MSG.HEARTBEAT:
        break
      default:
        break
    }
  }

  writeInput(text: string): void {
    if (this.ptyProcess) {
      this.ptyProcess.write(text)
    }
  }

  onOutput(listener: (data: string) => void): void {
    this.outputListeners.push(listener)
  }

  getInfo() {
    return {
      id: this.id,
      command: `${this.command} ${this.args.join(' ')}`,
      startedAt: this.startedAt,
      peers: this.peers.size,
      active: this.active,
    }
  }

  destroy(): void {
    this.ptyProcess?.kill()
    for (const peer of this.peers.values()) {
      try { peer.stream.destroy() } catch {}
    }
    this.peers.clear()
  }
}
