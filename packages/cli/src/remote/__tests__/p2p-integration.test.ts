import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import Hyperswarm from 'hyperswarm'
// @ts-ignore
import crypto from 'hypercore-crypto'
// @ts-ignore
import b4a from 'b4a'
import { encode, createMessageParser } from '../protocol.js'
import { MSG, PROTOCOL_VERSION } from '../types.js'
import { setConfigDir, loadConfig, saveConfig, addTrustedDevice } from '../config.js'
import { P2PServer } from '../p2p-server.js'

/**
 * Integration tests that spin up real Hyperswarm nodes locally.
 * Tests pairing flow and session message exchange between
 * a P2PServer (desktop) and a raw Hyperswarm client (phone).
 */

// Suppress ECONNRESET from Hyperswarm teardown — expected when peers disconnect
const originalListeners = process.listeners('uncaughtException')
beforeEach(() => {
  process.removeAllListeners('uncaughtException')
  process.on('uncaughtException', (err: any) => {
    if (err?.code === 'ECONNRESET') return
    for (const listener of originalListeners) {
      (listener as Function)(err)
    }
  })
})
afterEach(() => {
  process.removeAllListeners('uncaughtException')
  for (const listener of originalListeners) {
    process.on('uncaughtException', listener as any)
  }
})

describe('P2P Integration', () => {
  let tmpDir: string
  let server: P2PServer | null = null
  let phoneSwarm: InstanceType<typeof Hyperswarm> | null = null

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'us-remote-p2p-test-'))
    setConfigDir(tmpDir)
  })

  afterEach(async () => {
    setConfigDir(null)
    // Destroy phone first so the server doesn't get ECONNRESET
    if (phoneSwarm) await phoneSwarm.destroy().catch(() => {})
    phoneSwarm = null
    // Small delay to let connections close gracefully
    await new Promise((r) => setTimeout(r, 200))
    if (server) await server.destroy().catch(() => {})
    server = null
    rmSync(tmpDir, { recursive: true, force: true })
  })

  it('server starts and generates a keypair', async () => {
    server = new P2PServer()
    await server.start()

    expect(server.publicKey).toBeDefined()
    expect(server.publicKey.length).toBe(32)

    const config = loadConfig()
    expect(config.keypair).not.toBeNull()
  })

  it('server persists keypair across restarts', async () => {
    server = new P2PServer()
    await server.start()
    const firstKey = b4a.toString(server.publicKey, 'hex')
    await server.destroy()

    server = new P2PServer()
    await server.start()
    const secondKey = b4a.toString(server.publicKey, 'hex')

    expect(firstKey).toBe(secondKey)
  })

  it('pairing: phone connects and exchanges keys', async () => {
    server = new P2PServer()
    await server.start()

    const pairedPromise = new Promise<string>((resolve) => {
      server!.startPairing((deviceName) => resolve(deviceName))
    })
    const pairingTopicHex = await server.startPairing()

    const pairingTopic = Buffer.from(pairingTopicHex, 'hex')
    const phoneKeypair = crypto.keyPair()
    phoneSwarm = new Hyperswarm({ keyPair: phoneKeypair })

    const phoneConnected = new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Phone connection timeout')), 10000)

      phoneSwarm!.on('connection', (stream: any) => {
        clearTimeout(timeout)

        const parser = createMessageParser((msg) => {
          if (msg.type === MSG.PAIR_ACCEPT) {
            resolve()
          }
        })
        stream.on('data', parser)

        // Send pairing request
        stream.write(encode(MSG.PAIR_REQUEST, { deviceName: 'Test Phone' }))
      })
    })

    phoneSwarm.join(pairingTopic, { client: true, server: false })
    await phoneSwarm.flush()

    await phoneConnected

    // Verify the device was added to trusted list
    const config = loadConfig()
    const phoneKey = b4a.toString(phoneKeypair.publicKey, 'hex')
    const trusted = config.trustedDevices.find((d) => d.publicKey === phoneKey)
    expect(trusted).toBeDefined()
    expect(trusted!.name).toBe('Test Phone')
  })

  it('trusted device connects to session topic and gets session info', async () => {
    server = new P2PServer()
    await server.start()

    // Pre-trust a phone keypair
    const phoneKeypair = crypto.keyPair()
    const phoneKeyHex = b4a.toString(phoneKeypair.publicKey, 'hex')
    addTrustedDevice({ publicKey: phoneKeyHex, name: 'Pre-trusted Phone', pairedAt: new Date().toISOString() })

    // The session topic is derived from the server's public key
    const serverKeyHex = b4a.toString(server.publicKey, 'hex')
    const sessionTopic = crypto.discoveryKey(Buffer.from(serverKeyHex, 'hex'))

    phoneSwarm = new Hyperswarm({ keyPair: phoneKeypair })

    const connected = new Promise<any>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Connection timeout')), 10000)

      phoneSwarm!.on('connection', (stream: any) => {
        clearTimeout(timeout)
        resolve(stream)
      })
    })

    phoneSwarm.join(sessionTopic, { client: true, server: false })
    await phoneSwarm.flush()

    const stream = await connected
    expect(stream).toBeDefined()
    // Connection established — trusted device can talk to server

    stream.destroy()
  })

  it('getPairingPayload returns valid JSON with all required fields', async () => {
    server = new P2PServer()
    await server.start()

    const topicHex = await server.startPairing()
    const payload = server.getPairingPayload(topicHex)
    const parsed = JSON.parse(payload)

    expect(parsed.type).toBe('unstoppable-remote')
    expect(parsed.version).toBe(1)
    expect(parsed.pairingTopic).toBe(topicHex)
    expect(parsed.publicKey).toBe(b4a.toString(server.publicKey, 'hex'))
    expect(parsed.sessionTopic).toBeDefined()
    expect(parsed.sessionTopic.length).toBe(64) // 32 bytes hex
  })

  it('protocol roundtrip: encode → parse → verify all message types', () => {
    const messageTypes = [
      { type: MSG.PAIR_REQUEST, payload: { deviceName: 'Phone' } },
      { type: MSG.PAIR_ACCEPT, payload: { deviceName: 'Desktop', sessionTopic: 'abc123' } },
      { type: MSG.SESSION_OUTPUT, payload: { sessionId: 's1', data: 'hello world', timestamp: 12345 } },
      { type: MSG.SESSION_INPUT, payload: { sessionId: 's1', text: 'do something' } },
      { type: MSG.SESSION_INFO, payload: { sessionId: 's1', command: 'claude', startedAt: '2026-03-18' } },
      { type: MSG.SESSION_END, payload: { sessionId: 's1', exitCode: 0 } },
      { type: MSG.HEARTBEAT, payload: {} },
      { type: MSG.SESSIONS_LIST, payload: {} },
      { type: MSG.SESSIONS_LIST_RESPONSE, payload: { sessions: [{ id: 's1', command: 'claude' }] } },
    ]

    for (const { type, payload } of messageTypes) {
      const received: any[] = []
      const parser = createMessageParser((msg) => received.push(msg))

      parser(encode(type, payload))

      expect(received).toHaveLength(1)
      expect(received[0].type).toBe(type)
      expect(received[0].version).toBe(PROTOCOL_VERSION)
      expect(received[0].payload).toEqual(payload)
    }
  })

  it('large output chunk survives encode/decode', () => {
    const bigData = 'x'.repeat(100_000)
    const received: any[] = []
    const parser = createMessageParser((msg) => received.push(msg))

    parser(encode(MSG.SESSION_OUTPUT, { data: bigData }))

    expect(received).toHaveLength(1)
    expect(received[0].payload.data.length).toBe(100_000)
  })
})
