import Hyperswarm from 'hyperswarm'
// @ts-ignore — no types for hypercore-crypto
import crypto from 'hypercore-crypto'
// @ts-ignore — no types for b4a
import b4a from 'b4a'
import { encode, createMessageParser } from './protocol.js'
import { MSG } from './types.js'
import { loadConfig, saveKeypair, addTrustedDevice } from './config.js'
import type { SessionBridge } from './session-bridge.js'

export interface P2PServerOptions {
  bootstrap?: Array<{ host: string; port: number }>
}

export class P2PServer {
  private swarm: InstanceType<typeof Hyperswarm> | null = null
  private sessions: Map<string, SessionBridge> = new Map()
  private pairingTopic: Buffer | null = null
  private sessionTopic: Buffer | null = null
  private keypair: { publicKey: Buffer; secretKey: Buffer }
  private onPaired: ((deviceName: string) => void) | null = null
  private bootstrap?: string[]

  constructor(opts?: P2PServerOptions) {
    this.bootstrap = opts?.bootstrap
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

  get publicKey(): Buffer {
    return this.keypair.publicKey
  }

  async start(): Promise<void> {
    const swarmOpts: any = { keyPair: this.keypair }
    if (this.bootstrap) {
      // @ts-ignore — pass bootstrap to the underlying DHT
      swarmOpts.bootstrap = this.bootstrap
    }
    this.swarm = new Hyperswarm(swarmOpts)

    // Derive a stable session topic from our public key
    // so trusted phones can always find us
    this.sessionTopic = crypto.discoveryKey(this.keypair.publicKey)

    this.swarm.on('connection', (stream: any, info: any) => {
      const remoteKey = b4a.toString(stream.remotePublicKey, 'hex')
      const config = loadConfig()
      const isTrusted = config.trustedDevices.some((d) => d.publicKey === remoteKey)

      if (isTrusted) {
        this.handleTrustedConnection(remoteKey, stream)
      } else if (this.pairingTopic) {
        this.handlePairingConnection(remoteKey, stream)
      } else {
        stream.destroy()
      }
    })

    // Join our session topic so trusted devices can find us
    this.swarm.join(this.sessionTopic, { server: true, client: false })
    await this.swarm.flush()
  }

  private handleTrustedConnection(remoteKey: string, stream: any) {
    const parser = createMessageParser((msg) => {
      switch (msg.type) {
        case MSG.SESSIONS_LIST: {
          const list = Array.from(this.sessions.values()).map((s) => s.getInfo())
          stream.write(encode(MSG.SESSIONS_LIST_RESPONSE, { sessions: list }))
          break
        }
        case MSG.SESSION_INPUT: {
          const sid = msg.payload.sessionId as string
          const session = this.sessions.get(sid)
          if (session) {
            // Forward to the session bridge
            const fakeStream = {
              write: () => {},
              on: () => {},
              destroy: () => {},
            }
            // Actually just pipe the input
            session.addPeer(remoteKey, stream)
          }
          break
        }
      }
    })

    stream.on('data', parser)

    // Auto-subscribe to all sessions
    for (const session of this.sessions.values()) {
      session.addPeer(remoteKey, stream)
    }
  }

  private handlePairingConnection(remoteKey: string, stream: any) {
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

        this.onPaired?.(deviceName)

        // Stop pairing mode after successful pair
        setTimeout(() => this.stopPairing(), 1000)
      }
    })

    stream.on('data', parser)
  }

  registerSession(session: SessionBridge): void {
    this.sessions.set(session.id, session)
  }

  unregisterSession(sessionId: string): void {
    this.sessions.delete(sessionId)
  }

  /**
   * Start pairing mode. Returns the topic hex that goes into the QR code.
   */
  async startPairing(onPaired?: (deviceName: string) => void): Promise<string> {
    this.onPaired = onPaired || null
    this.pairingTopic = crypto.randomBytes(32)
    this.swarm!.join(this.pairingTopic, { server: true, client: false })
    await this.swarm!.flush()
    return b4a.toString(this.pairingTopic, 'hex')
  }

  stopPairing(): void {
    if (this.pairingTopic && this.swarm) {
      this.swarm.leave(this.pairingTopic)
      this.pairingTopic = null
    }
  }

  /**
   * Get the QR code payload: topic + our public key.
   */
  getPairingPayload(pairingTopicHex: string): string {
    return JSON.stringify({
      type: 'unstoppable-remote',
      version: 1,
      pairingTopic: pairingTopicHex,
      publicKey: b4a.toString(this.keypair.publicKey, 'hex'),
      sessionTopic: b4a.toString(this.sessionTopic!, 'hex'),
    })
  }

  async destroy(): Promise<void> {
    for (const session of this.sessions.values()) {
      session.destroy()
    }
    this.sessions.clear()
    await this.swarm?.destroy()
  }
}
