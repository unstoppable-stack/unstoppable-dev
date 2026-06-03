# Unstoppable Node — Pairing Protocol

## The Problem

The current discovery protocol (node.md, node-technical.md) describes apps
connecting to the Node over a well-known Hyperswarm topic, but doesn't address:

- **Who is allowed to pair?** Any peer on the topic can register.
- **How does the user approve a pairing?** No consent mechanism.
- **How does cross-device pairing work?** No out-of-band key exchange.
- **How do two Nodes link?** No device-linking protocol.

This document specifies the pairing protocol for all three scenarios.

---

## Background: What Hyperswarm Gives Us

Every Hyperswarm instance has a **key pair** (ed25519). When two peers connect,
they perform a Noise protocol handshake that gives us:

- **Mutual authentication** — each side knows the other's public key
- **Encrypted channel** — all data is end-to-end encrypted
- **Identity** — public keys are stable identifiers

The Node and each app have their own key pair. The pairing protocol's job is to
establish **which public keys are trusted** before any data flows.

---

## Three Pairing Scenarios

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  Scenario 1: Same-Device        (automatic, low risk)   │
│  App on same machine finds local Node                  │
│                                                         │
│  Scenario 2: Cross-Device       (invite code, medium)   │
│  Phone/tablet pairs with desktop Node                  │
│                                                         │
│  Scenario 3: Node-to-Node     (seed phrase, high)     │
│  Two devices share a unified Node identity             │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## Scenario 1: Same-Device Pairing

**Use case:** A Pear Desktop app (e.g., Coffee Assistant) discovers the Node
running on the same machine.

### How it works

Both the app and the Node derive a **machine-local topic** from a shared
secret that only processes on the same machine can access:

```typescript
import { createHash } from 'bare-crypto'

function localDiscoveryTopic(): Buffer {
  const machineId = getMachineId() // hostname + username or machine-id file
  return createHash('sha256')
    .update('unstoppable:node:local:v1:' + machineId)
    .digest()
}
```

Since this topic includes the machine ID, only apps on the same computer join
the same swarm.

### Flow

```
App (same machine)                         Node
 │                                          │
 │── join(localDiscoveryTopic()) ──────────►│  (Node is already listening)
 │                                          │
 │◄──── Hyperswarm noise handshake ────────│  (mutual pubkey exchange)
 │                                          │
 │── { type: 'pairRequest',          ─────►│
 │     appId: 'coffee-assistant',          │
 │     appName: 'Coffee Assistant',        │
 │     publicKey: '<app-pubkey>',          │
 │     pid: 12345 }                        │  Node verifies pid is local
 │                                          │
 │◄── { type: 'pairAccepted',       ──────│  AUTO-APPROVED (same machine)
 │     nodePublicKey: '<node-pubkey>',   │
 │     sessionToken: '<random>' }          │
 │                                          │
 │  App is now paired. Proceeds to         │
 │  register cores/drives (existing flow). │
 │                                          │
```

**Trust model:** Same-machine pairing is **auto-approved**. The Node can
optionally verify the `pid` is a local process. The user sees a notification
("Coffee Assistant connected to Node") but doesn't need to approve.

### After pairing

The Node stores the app's public key in its registry:

```json
{
  "appId": "coffee-assistant",
  "appName": "Coffee Assistant",
  "publicKey": "abc123...",
  "pairedAt": "2026-03-06T12:00:00Z",
  "pairingMethod": "local",
  "permissions": {
    "dataSync": true,
    "fileSync": true,
    "aiDelegation": true
  }
}
```

Future connections from this public key are automatically trusted — no
re-pairing needed.

---

## Scenario 2: Cross-Device Pairing (Invite Code)

**Use case:** A phone app (Expo Bare) wants to pair with a desktop Node.
The devices are on different networks.

### Overview

The Node generates a short-lived **invite code** that encodes the information
the remote app needs to connect. The user types or scans this code on the
remote device.

### Invite code structure

The invite code is a compact encoding of:

```typescript
interface InvitePayload {
  topic: Buffer    // 32 bytes — one-time pairing topic
  publicKey: Buffer // 32 bytes — node's public key
  expiry: number   // Unix timestamp (4 bytes)
}
```

Encoded as a **base32 string** for easy typing, or a **QR code** for scanning:

```
NODE-AXKJ-M7RP-Q2WD-4FN3
```

~26 characters. Readable, typeable, expires in 10 minutes.

### Flow

```
User clicks "Add Device" on Node UI
         │
         ▼
┌─ Node ──────────────────────────────────────────────┐
│                                                       │
│  1. Generate one-time key pair for this invite         │
│  2. Create a one-time Hyperswarm topic                 │
│  3. Join that topic and wait for connection            │
│  4. Show invite code on screen:                        │
│                                                       │
│     ┌────────────────────────────────┐                │
│     │  Pair a new device             │                │
│     │                                │                │
│     │  NODE-AXKJ-M7RP-Q2WD-4FN3    │                │
│     │                                │                │
│     │  [QR Code]                     │                │
│     │                                │                │
│     │  Expires in 9:42               │                │
│     │  [Cancel]                      │                │
│     └────────────────────────────────┘                │
│                                                       │
└───────────────────────────────────────────────────────┘

User enters code on phone app (or scans QR)
         │
         ▼
┌─ Phone App ──────────────────────────────────────────┐
│                                                       │
│  1. Decode invite → get topic + node public key       │
│  2. Join the one-time topic                            │
│  3. Connect to Node (noise handshake)                 │
│  4. Verify node public key matches invite             │
│                                                       │
└───────────────────────────────────────────────────────┘

Pairing handshake:

Phone App                                  Node
 │                                          │
 │── join(inviteTopic) ────────────────────►│
 │                                          │
 │◄──── noise handshake ───────────────────│
 │                                          │
 │  Verify: remotePublicKey === invite.pk  │
 │                                          │
 │── { type: 'pairRequest',          ─────►│
 │     appId: 'health-app',               │
 │     appName: 'Health Tracker',          │
 │     deviceName: 'iPhone 15',            │
 │     publicKey: '<phone-pubkey>' }       │
 │                                          │
 │         Node UI shows confirmation:     │
 │         "Health Tracker (iPhone 15)      │
 │          wants to connect. [Allow] [Deny]"
 │                                          │
 │◄── { type: 'pairAccepted',       ──────│  User taps [Allow]
 │     nodePublicKey: '<node-pubkey>',   │
 │     permanentTopic: '<hex>',            │
 │     services: {                         │
 │       data: true,                       │
 │       files: true,                      │
 │       ai: { topic, providerPubKey }     │
 │     } }                                 │
 │                                          │
 │  Phone stores node info permanently.   │
 │  Future connections use permanentTopic.  │
 │                                          │
 │  Node destroys the invite topic.        │
 │                                          │
```

### Security properties

- **One-time topic**: The invite topic is used only for pairing, then destroyed.
  Eavesdroppers who discover the topic after pairing can't connect.
- **Time-limited**: Invite expires after 10 minutes (configurable).
- **User approval**: The Node shows a confirmation dialog with the app name and
  device name. User must explicitly approve.
- **Public key pinning**: After pairing, both sides pin each other's public keys.
  Future connections verify the pinned key — MITM is impossible after pairing.
- **No shared secrets stored**: The invite code is ephemeral. After pairing,
  trust is based on public key identity, not the invite.

### Reconnection

After pairing, the phone connects to the Node using the `permanentTopic`:

```typescript
const nodeTopic = Buffer.from(pairedNode.permanentTopic, 'hex')
swarm.join(nodeTopic)

swarm.on('connection', (socket, info) => {
  if (info.publicKey.toString('hex') === pairedNode.nodePublicKey) {
    // Trusted connection — proceed with registration/sync
  } else {
    socket.destroy() // Unknown peer on our topic
  }
})
```

---

## Scenario 3: Node-to-Node Linking (Seed Phrase)

**Use case:** User has a desktop and a laptop, each running a Node. They want
both Nodes to share the same app registry and replicate all data.

### Overview

Both Nodes derive a **shared identity** from a seed phrase (BIP39-style
mnemonic). This gives them:

- The same swarm key pair (they appear as the same identity on the DHT)
- A shared topic for Node-to-Node sync
- A shared encryption key for the registry

### Flow

```
First Node (desktop)                     Second Node (laptop)
 │                                          │
 │  User clicks "Link Another Device"      │
 │  Node generates a 12-word seed phrase: │
 │                                          │
 │  "oak river moon signal frost           │
 │   blade quiet north echo                │
 │   valley dawn crystal"                  │
 │                                          │
 │  User writes it down or copies it.      │
 │                                          │
 │  Node derives:                         │
 │  - nodeIdentity (key pair)             │  User enters the same 12 words
 │  - syncTopic (for node-to-node)       │  on the second Node.
 │  - registryKey (encryption)             │
 │                                          │  Second Node derives the
 │  Joins syncTopic, announces identity.   │  same identity, topic, and key.
 │                                          │
 │◄──────── P2P connection ────────────────│  They find each other on syncTopic.
 │                                          │
 │  Registry replication begins:           │
 │  - All paired apps                      │
 │  - All core/drive keys                  │
 │  - AI provider config                   │
 │                                          │
 │  Both Nodes now replicate all apps.    │
 │                                          │
```

### Key derivation

```typescript
import { createHash, createKeyPair } from 'bare-crypto'

function deriveNodeIdentity(seedPhrase: string) {
  const seed = createHash('sha256')
    .update('unstoppable:node:identity:v1:' + seedPhrase)
    .digest()

  const keyPair = createKeyPair(seed)

  const syncTopic = createHash('sha256')
    .update('unstoppable:node:sync:v1:' + seed.toString('hex'))
    .digest()

  const registryKey = createHash('sha256')
    .update('unstoppable:node:registry:v1:' + seed.toString('hex'))
    .digest()

  return { keyPair, syncTopic, registryKey }
}
```

### What syncs between Nodes

| Data | Direction | How |
|------|-----------|-----|
| App registry | Bidirectional | Shared Hyperbee, auto-merge |
| Core keys | Bidirectional | Part of registry |
| Replicated data | Each Node replicates independently | Both join app core topics |
| AI provider status | Informational | One Node can be the active provider |
| Storage stats | Informational | Each Node tracks its own |

### Conflict resolution

Both Nodes can independently pair new apps. The shared registry is a Hyperbee
with app IDs as keys — last-write-wins semantics work because registrations are
additive (you add apps, you rarely remove them). Explicit "unpair" actions
include a timestamp to resolve conflicts.

---

## Permissions Model

Each paired app gets a permissions record:

```typescript
interface AppPermissions {
  dataSync: boolean       // Replicate Hyperbees/Hypercores
  fileSync: boolean       // Replicate Hyperdrives
  aiDelegation: boolean   // Use Node's AI provider
  maxStorage?: number     // Per-app storage quota (bytes)
}
```

Default permissions by pairing method:

| Method | dataSync | fileSync | aiDelegation | Notes |
|--------|----------|----------|-------------|-------|
| Local (same machine) | yes | yes | yes | Auto-approved |
| Invite (cross-device) | yes | yes | yes | User-approved |
| Manual (paste key) | yes | no | no | Minimal trust |

The user can modify permissions from the Node dashboard at any time.

---

## Revoking Access

The Node can revoke access to any paired app:

1. Remove the app's public key from the trusted registry
2. Stop replicating its cores/drives
3. Optionally delete local replicas

The app will see disconnections on its next connection attempt. There is no
"revocation broadcast" — the Node simply stops responding to that public key.

For Node-to-Node unlinking, the user enters a new seed phrase (or generates
a fresh one), which derives a new identity. The old linked Node loses access
because it's on the old topic with the old key pair.

---

## Protocol Messages (Complete)

All messages are NDJSON over Hyperswarm encrypted connections.

### Pairing Phase

| Message | Direction | Fields |
|---------|-----------|--------|
| `pairRequest` | App → Node | `appId`, `appName`, `publicKey`, `deviceName?`, `pid?` |
| `pairAccepted` | Node → App | `nodePublicKey`, `permanentTopic`, `services` |
| `pairDenied` | Node → App | `reason` |

### Registration Phase (after pairing)

| Message | Direction | Fields |
|---------|-----------|--------|
| `register` | App → Node | `appId`, `cores[]`, `drives[]`, `requestedServices[]` |
| `registered` | Node → App | `replicating[]`, `aiConfig?` |

### Operational Phase

| Message | Direction | Fields |
|---------|-----------|--------|
| `heartbeat` | App → Node | `appId`, `uptime`, `coreStats[]` |
| `syncStatus` | Node → App | `coreKey`, `length`, `byteLength`, `peers` |
| `serviceUpdate` | Node → App | `services` (updated AI config, etc.) |

### Node-to-Node Phase

| Message | Direction | Fields |
|---------|-----------|--------|
| `nodeHello` | Node ↔ Node | `nodeId`, `deviceName`, `appCount`, `storageUsed` |
| `registrySync` | Node ↔ Node | (Hyperbee replication — automatic) |

---

## Implementation Priority

| Phase | What | Effort |
|-------|------|--------|
| **Node Phase 1** | Same-device pairing (auto-approve, local topic) | Small |
| **Node Phase 2** | Cross-device invite codes (QR + typed code) | Medium |
| **Node Phase 2** | Permission model + revocation | Small |
| **Node Phase 4** | Node-to-Node linking (seed phrase) | Large |

Same-device pairing is the simplest and should be implemented first. It
covers the most common use case (desktop apps on the same machine) and lets
us validate the core replication flow without solving cross-device trust.

---

## v0.4 Discovery Flake Finding

During v0.4 smoke-test work, rapidly restarting the Node on the default
machine-local topic reproduced `Node not found` failures even when the daemon had
already emitted `ready`. In failed runs the daemon did **not** emit
`peerConnected`, so the failure was before `nodeHello`, approval, or
registration. The likely cause is stale public-DHT records for the shared local
topic after many short-lived daemon identities announce and exit.

Mitigations added for v0.4:

- `NodeClient.connect()` now keeps nudging discovery while the caller's existing
  timeout is active, and resets its client swarm after repeated empty lookup
  cycles.
- `NodeDaemon` waits for a short discovery warmup before emitting `ready`, so UIs
  do not prompt apps to connect immediately after `flush()`.
- Both daemon and client protocol helpers honor `UNSTOPPABLE_NODE_TOPIC`, which
  lets CI smoke tests use a fresh isolated topic instead of inheriting stale DHT
  state from previous local runs.
- `packages/node-desktop/scripts/smoke.js` can run `NODE_SMOKE_RUNS=20` against
  one long-lived headless daemon. On 2026-05-27 this produced 20/20 successful
  demo pairings, each under 1 second, with the Bare runtime.
- `packages/node/scripts/discovery-stress.js` runs the same release-gate shape in
  plain Node.js: one isolated bootstrap DHT, one long-lived `NodeDaemon`, then N
  fresh clients pairing sequentially with a 5-second timeout. Run it with
  `npm run discovery:stress` from `packages/node`; tune with
  `NODE_DISCOVERY_RUNS`, `NODE_DISCOVERY_TIMEOUT_MS`, and
  `NODE_DISCOVERY_WARMUP_MS`.

---

## Open Questions

1. **Should the Node have a persistent identity?** Currently each Node
   instance generates its own key pair. With Node-to-Node linking, the seed
   phrase provides a shared identity. Should the Node always derive its key
   from a seed phrase, even for single-device use?

2. **Invite code format**: Base32 with dashes (human-typeable) vs pure QR
   (phone-only)? Both? The invite payload is 68 bytes — fits in a compact QR.

3. **NAT traversal for cross-device**: Hyperswarm handles hole-punching, but
   are there edge cases (strict corporate NATs) where pairing fails? Should
   the invite include relay hints?

4. **App identity persistence**: When an app is uninstalled and reinstalled,
   it gets a new key pair. How does it re-pair with the Node? Should apps
   derive their key from the project's pear key?

5. **Multi-user sharing**: Should one Node be able to share specific apps
   with another user's Node? (e.g., shared family notes). This is a different
   trust model — not device linking, but selective data sharing with access
   control.
