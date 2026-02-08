---
name: secure-communication
description: Add encrypted P2P messaging using SecretStream and Protomux channels
allowed-tools: Read, Grep, Edit, Write, Bash(npm *), Bash(pnpm *)
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
> via `pear-run`. See the `pear-desktop-app` skill → `resources/worker-pattern.md`.

## Steps

1. **Install dependencies**:
   ```bash
   pnpm add hyperswarm @hyperswarm/secret-stream protomux compact-encoding
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

## Deep Dive
- Full example: read `resources/full-example.md`
