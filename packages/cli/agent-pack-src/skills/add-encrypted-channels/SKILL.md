---
name: add-encrypted-channels
description: Encrypted P2P messaging with SecretStream and Protomux channels.
when_to_use: User needs end-to-end encrypted messaging or multiplexed protocols on a single P2P connection.
paths: ["src/p2p/**", "src/messaging/**"]
version: "2026-04-14"
---

# Secure P2P Communication

## When to Use
- User needs encrypted messaging between peers
- User mentions "chat", "messaging", "encrypted", or "secure channel"
- User wants multiplexed protocols on a single connection

## Prerequisites
- Hyperswarm, @hyperswarm/secret-stream, protomux, compact-encoding installed

> **CRITICAL — Pear Desktop Apps:** These P2P modules CANNOT run in the
> renderer (browser context). They MUST run in a **worker process** started
> via `pear-run`. See the `setup-pear-desktop` skill → `resources/worker-pattern.md`.

## Steps

1. **Install dependencies**:
   ```bash
   npm i hyperswarm @hyperswarm/secret-stream protomux compact-encoding
   ```

2. **Create messaging module** in `src/p2p/messaging.ts`:
   - Wrap swarm connections with SecretStream
   - Create Protomux channels for each protocol
   - Handle incoming messages with callbacks

3. **Wire to swarm** and handle connection lifecycle

## Quick Implementation

```ts
import Hyperswarm from 'hyperswarm'
import SecretStream from '@hyperswarm/secret-stream'
import Protomux from 'protomux'
import c from 'compact-encoding'

const swarm = new Hyperswarm()
swarm.on('connection', (conn, info) => {
  const secure = new SecretStream(info.client, conn)
  const mux = new Protomux(secure)
  const channel = mux.createChannel({ protocol: 'chat' })
  const msg = channel.addMessage({
    encoding: c.string,
    onmessage: (m) => console.log('recv:', m)
  })
  channel.open()
  msg.send('hello encrypted')
})

const topic = Buffer.alloc(32).fill('secure-chat')
swarm.join(topic, { server: true, client: true })
```

## Key Gotchas
- Call `channel.open()` before sending any messages
- Both peers must use the same protocol name in `createChannel`
- Use the same 32-byte topic on both sides for discovery
- Use `SecretStream.keyPair(seed)` for deterministic identities

## Critical Rules
- **Never share secret keys in discovery topics** — topics are public on the DHT. Use `crypto.discoveryKey()` to derive topics, never raw secret keys
- **Use SecretStream for all sensitive data** — raw Hyperswarm sockets are encrypted at the transport layer, but SecretStream adds an additional application-level encryption layer with identity verification
- **Handle key rotation** — if a peer's identity is compromised, you need a mechanism to revoke and rotate keys. Plan for this upfront
- **Both peers must use the same protocol name** — `mux.createChannel({ protocol: 'chat' })` must match on both sides or messages won't route
- **Always call `channel.open()` before sending** — messages sent before `open()` are silently dropped
- **Don't reuse Protomux channels after close** — create a new channel if the connection drops and reconnects
- **Verify peer identity** — use `conn.remotePublicKey` to verify who you're talking to. Don't blindly trust any connecting peer

## Validation
1. [ ] `npm i hyperswarm @hyperswarm/secret-stream protomux compact-encoding` installs without errors
2. [ ] Encrypted channel established: `SecretStream` wraps the connection and `mux.createChannel()` succeeds
3. [ ] Messages flow: `msg.send('hello')` on one peer triggers `onmessage` on the other
4. [ ] Data is encrypted in transit: raw socket inspection shows ciphertext, not plaintext
5. [ ] Both peers must use same protocol: mismatched `protocol` names result in no message delivery
6. [ ] Unauthorized peers rejected: a peer with an unknown public key can be identified and disconnected
7. [ ] Channel lifecycle: closing and reopening a channel on reconnect works correctly

## Troubleshooting
- **Messages not received** — ensure `channel.open()` was called on both sides and the `protocol` name matches exactly
- **`SecretStream` throws on construction** — verify the `initiator` boolean matches the connection role (`info.client` for the initiator)
- **Protomux channel silently drops messages** — check that the encoding matches on both sides (e.g., both use `c.string` or both use `c.buffer`)
- **Peer identity verification fails** — `conn.remotePublicKey` is only available after the handshake completes. Wait for the `open` event on SecretStream
- **Multiple protocols interfere** — each protocol needs its own channel via `mux.createChannel({ protocol: 'unique-name' })`. Don't reuse channel names

## Deep Dive
- Full example: read `resources/full-example.md`
