---
name: add-p2p-networking
description: Add Hyperswarm peer discovery and connection management to an
  existing app. The foundation for all P2P features — add this before
  add-p2p-rpc, add-p2p-sync, or add-encrypted-channels.
---

# Add P2P Networking

## When to Use
- User wants to connect peers over the network
- User mentions "P2P", "peer", "swarm", "discovery", "connect to other devices"
- User needs the networking foundation before adding RPC, sync, or encryption
- Required before: `add-p2p-rpc`, `add-p2p-sync`, `add-encrypted-channels`

## Prerequisites
- Hyperswarm (`^4.16.0`) installed
- Node.js, Bare, or Expo Bare runtime

> **CRITICAL — Pear Desktop Apps:** Hyperswarm CANNOT run in the renderer.
> It MUST run in a **worker process** via `pear-run`. See `setup-pear-desktop`.

## Included Components

Your project includes a battle-tested component in `src/p2p/`:

- **`src/p2p/swarm-manager.ts`** — Hyperswarm with connection lifecycle, error handling, graceful shutdown

## Steps

1. **Install dependencies**:
   ```bash
   npm i hyperswarm hypercore-crypto
   ```

2. **Create the swarm** in `src/p2p/swarm.ts`:
   ```ts
   import Hyperswarm from 'hyperswarm'
   import crypto from 'hypercore-crypto'

   const swarm = new Hyperswarm()

   // Deterministic topic from app/room ID
   function getTopic(roomId: string): Buffer {
     return crypto.discoveryKey(Buffer.from(roomId))
   }

   // Join a topic
   const topic = getTopic('my-app:room-1')
   const discovery = swarm.join(topic, { server: true, client: true })
   await discovery.flushed()
   console.log('Announced on DHT, waiting for peers...')
   ```

3. **Handle connections**:
   ```ts
   swarm.on('connection', (socket, info) => {
     console.log('Peer connected:', info.publicKey.toString('hex').slice(0, 8))

     // This is where you wire in RPC, replication, or messaging
     // See: add-p2p-rpc, add-p2p-sync, add-encrypted-channels

     socket.on('error', (err) => {
       console.log('Peer error (normal):', err.message)
     })

     socket.on('close', () => {
       console.log('Peer disconnected')
     })
   })
   ```

4. **Graceful shutdown**:
   ```ts
   async function cleanup() {
     await swarm.destroy()
   }

   // Node.js
   process.on('SIGINT', cleanup)

   // Pear
   Pear.teardown(cleanup)
   ```

## Topic Design

Topics are 32-byte buffers that identify what peers are looking for. Design them carefully:

```ts
// GOOD: Deterministic from app + room
const topic = crypto.discoveryKey(Buffer.from('my-app:room-123'))

// GOOD: From a shared secret
const topic = crypto.discoveryKey(Buffer.from(inviteCode))

// BAD: Random topic — peers can't find each other
const topic = crypto.randomBytes(32)

// BAD: Hardcoded buffer — all instances join the same room
const topic = Buffer.alloc(32).fill('chat')
```

## Connection Roles

Hyperswarm connections have roles:

```ts
swarm.on('connection', (socket, info) => {
  if (info.client) {
    // We initiated this connection (we're the client)
  } else {
    // They connected to us (we're the server)
  }
})
```

Both sides should join with `{ server: true, client: true }` for reliable
mutual discovery. Use roles to decide who initiates RPC or replication.

## Key Gotchas
- Use `discovery.flushed()` to wait for DHT announcement (NOT `swarm.flush()`)
- Both peers must join with `{ server: true, client: true }` for reliable discovery
- Always handle `socket.on('error')` — peers disconnect constantly
- Same-machine testing needs a local DHT bootstrap (see `setup-local-testing`)
- Connections are encrypted by default via Noise protocol
- `swarm.connections` is a Set of all active connections
- Call `swarm.destroy()` on shutdown to cleanly leave the DHT

## Critical Rules
- **Never hardcode discovery keys** — derive topics deterministically from app/room IDs using `crypto.discoveryKey()`
- **Never ignore disconnects** — always handle `socket.on('error')` and `socket.on('close')`. Peers drop constantly in P2P networks
- **Always `await ready()`** — call `await swarm.listen()` or wait for cores/stores to be ready before joining topics
- **Never use random topics for reconnectable rooms** — `crypto.randomBytes(32)` means peers can never find each other again
- **Don't skip `discovery.flushed()`** — without it, you may try to use connections before the DHT announcement completes
- **Don't forget graceful shutdown** — call `swarm.destroy()` on exit or you'll leave ghost entries in the DHT
- **Don't run Hyperswarm in the renderer** on Pear Desktop — it must run in a worker process via `pear-run`

## Validation
1. [ ] `npm i hyperswarm hypercore-crypto` completes without errors
2. [ ] Swarm joins a topic: `discovery.flushed()` resolves without timeout
3. [ ] Two peers discover each other: `swarm.on('connection')` fires on both sides
4. [ ] `socket.write()` / `socket.on('data')` delivers data in both directions
5. [ ] Disconnecting one peer fires `socket.on('close')` on the other
6. [ ] `socket.on('error')` is handled — no uncaught exceptions on abrupt disconnect
7. [ ] `swarm.destroy()` completes cleanly without hanging
8. [ ] Restarting a peer re-discovers the other peer on the same topic

## Troubleshooting
- **Peers don't discover each other** — ensure both use the exact same 32-byte topic buffer and join with `{ server: true, client: true }`
- **Works on different machines but not same machine** — local testing needs a DHT bootstrap node. See `setup-local-testing`
- **`swarm.flush()` vs `discovery.flushed()`** — use `discovery.flushed()` per-topic. `swarm.flush()` waits for all pending connections, not discovery announcements
- **Connection fires but socket is immediately destroyed** — the remote peer may be crashing. Check error handlers on both sides
- **Swarm hangs on destroy** — ensure all sockets are closed and no pending I/O remains

> **Status**: Battle-tested. Hyperswarm peer discovery and connection
> management validated in coffee-assistant and coffee-assistant-ui.
