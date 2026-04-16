import { PROTOCOL_VERSION, type ProtocolMessage } from './types.js'

/**
 * NDJSON protocol over a Hyperswarm SecretStream connection.
 * Each message is a single JSON line terminated by \n.
 */

export function encode(type: string, payload: Record<string, unknown> = {}): Buffer {
  const msg: ProtocolMessage = { type, version: PROTOCOL_VERSION, payload }
  return Buffer.from(JSON.stringify(msg) + '\n')
}

export function createMessageParser(onMessage: (msg: ProtocolMessage) => void) {
  let buffer = ''

  return (chunk: Buffer) => {
    buffer += chunk.toString()
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''

    for (const line of lines) {
      if (!line.trim()) continue
      try {
        const msg = JSON.parse(line) as ProtocolMessage
        if (msg.type && msg.version) {
          onMessage(msg)
        }
      } catch {
        // skip malformed messages
      }
    }
  }
}
