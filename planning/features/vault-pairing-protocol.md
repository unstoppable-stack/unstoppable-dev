# Unstoppable Vault — Pairing Protocol

## The Problem

The current discovery protocol (vault.md, vault-technical.md) describes apps
connecting to the Vault over a well-known Hyperswarm topic, but doesn't address:

- **Who is allowed to pair?** Any peer on the topic can register.
- **How does the user approve a pairing?** No consent mechanism.
- **How does cross-device pairing work?** No out-of-band key exchange.
- **How do two Vaults link?** No device-linking protocol.

This document specifies the pairing protocol for all three scenarios.

---

## Background: What Hyperswarm Gives Us

Every Hyperswarm instance has a **key pair** (ed25519). When two peers connect,
they perform a Noise protocol handshake that gives us:

- **Mutual authentication** — each side knows the other's public key
- **Encrypted channel** — all data is end-to-end encrypted
- **Identity** — public keys are stable identifiers

The Vault and each app have their own key pair. The pairing protocol's job is to
establish **which public keys are trusted** before any data flows.

---

## Three Pairing Scenarios

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  Scenario 1: Same-Device        (automatic, low risk)   │
│  App on same machine finds local Vault                  │
│                                                         │
│  Scenario 2: Cross-Device       (invite code, medium)   │
│  Phone/tablet pairs with desktop Vault                  │
│                                                         │
│  Scenario 3: Vault-to-Vault     (seed phrase, high)     │
│  Two devices share a unified Vault identity             │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## Scenario 1: Same-Device Pairing

**Use case:** A Pear Desktop app (e.g., Coffee Assistant) discovers the Vault
running on the same machine.

### How it works

Both the app and the Vault derive a **machine-local topic** from a shared
secret that only processes on the same machine can access:

```typescript
import { createHash } from 'bare-crypto'

function localDiscoveryTopic(): Buffer {
  const machineId = getMachineId() // hostname + username or machine-id file
  return createHash('sha256')
    .update('unstoppable:vault:local:v1:' + machineId)
    .digest()
}
```

Since this topic includes the machine ID, only apps on the same computer join
the same swarm.

### Flow

```
App (same machine)                         Vault
 │                                          │
 │── join(localDiscoveryTopic()) ──────────►│  (Vault is already listening)
 │                                          │
 │◄──── Hyperswarm noise handshake ────────│  (mutual pubkey exchange)
 │                                          │
 │── { type: 'pairRequest',          ─────►│
 │     appId: 'coffee-assistant',          │
 │     appName: 'Coffee Assistant',        │
 │     publicKey: '<app-pubkey>',          │
 │     pid: 12345 }                        │  Vault verifies pid is local
 │                                          │
 │◄── { type: 'pairAccepted',       ──────│  AUTO-APPROVED (same machine)
 │     vaultPublicKey: '<vault-pubkey>',   │
 │     sessionToken: '<random>' }          │
 │                                          │
 │  App is now paired. Proceeds to         │
 │  register cores/drives (existing flow). │
 │                                          │
```

**Trust model:** Same-machine pairing is **auto-approved**. The Vault can
optionally verify the `pid` is a local process. The user sees a notification
("Coffee Assistant connected to Vault") but doesn't need to approve.

### After pairing

The Vault stores the app's public key in its registry:

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

**Use case:** A phone app (Expo Bare) wants to pair with a desktop Vault.
The devices are on different networks.

### Overview

The Vault generates a short-lived **invite code** that encodes the information
the remote app needs to connect. The user types or scans this code on the
remote device.

### Invite code structure

The invite code is a compact encoding of:

```typescript
interface InvitePayload {
  topic: Buffer    // 32 bytes — one-time pairing topic
  publicKey: Buffer // 32 bytes — vault's public key
  expiry: number   // Unix timestamp (4 bytes)
}
```

Encoded as a **base32 string** for easy typing, or a **QR code** for scanning:

```
VAULT-AXKJ-M7RP-Q2WD-4FN3
```

~26 characters. Readable, typeable, expires in 10 minutes.

### Flow

```
User clicks "Add Device" on Vault UI
         │
         ▼
┌─ Vault ──────────────────────────────────────────────┐
│                                                       │
│  1. Generate one-time key pair for this invite         │
│  2. Create a one-time Hyperswarm topic                 │
│  3. Join that topic and wait for connection            │
│  4. Show invite code on screen:                        │
│                                                       │
│     ┌────────────────────────────────┐                │
│     │  Pair a new device             │                │
│     │                                │                │
│     │  VAULT-AXKJ-M7RP-Q2WD-4FN3    │                │
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
│  1. Decode invite → get topic + vault public key       │
│  2. Join the one-time topic                            │
│  3. Connect to Vault (noise handshake)                 │
│  4. Verify vault public key matches invite             │
│                                                       │
└───────────────────────────────────────────────────────┘

Pairing handshake:

Phone App                                  Vault
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
 │         Vault UI shows confirmation:     │
 │         "Health Tracker (iPhone 15)      │
 │          wants to connect. [Allow] [Deny]"
 │                                          │
 │◄── { type: 'pairAccepted',       ──────│  User taps [Allow]
 │     vaultPublicKey: '<vault-pubkey>',   │
 │     permanentTopic: '<hex>',            │
 │     services: {                         │
 │       data: true,                       │
 │       files: true,                      │
 │       ai: { topic, providerPubKey }     │
 │     } }                                 │
 │                                          │
 │  Phone stores vault info permanently.   │
 │  Future connections use permanentTopic.  │
 │                                          │
 │  Vault destroys the invite topic.        │
 │                                          │
```

### Security properties

- **One-time topic**: The invite topic is used only for pairing, then destroyed.
  Eavesdroppers who discover the topic after pairing can't connect.
- **Time-limited**: Invite expires after 10 minutes (configurable).
- **User approval**: The Vault shows a confirmation dialog with the app name and
  device name. User must explicitly approve.
- **Public key pinning**: After pairing, both sides pin each other's public keys.
  Future connections verify the pinned key — MITM is impossible after pairing.
- **No shared secrets stored**: The invite code is ephemeral. After pairing,
  trust is based on public key identity, not the invite.

### Reconnection

After pairing, the phone connects to the Vault using the `permanentTopic`:

```typescript
const vaultTopic = Buffer.from(pairedVault.permanentTopic, 'hex')
swarm.join(vaultTopic)

swarm.on('connection', (socket, info) => {
  if (info.publicKey.toString('hex') === pairedVault.vaultPublicKey) {
    // Trusted connection — proceed with registration/sync
  } else {
    socket.destroy() // Unknown peer on our topic
  }
})
```

---

## Scenario 3: Vault-to-Vault Linking (Seed Phrase)

**Use case:** User has a desktop and a laptop, each running a Vault. They want
both Vaults to share the same app registry and replicate all data.

### Overview

Both Vaults derive a **shared identity** from a seed phrase (BIP39-style
mnemonic). This gives them:

- The same swarm key pair (they appear as the same identity on the DHT)
- A shared topic for Vault-to-Vault sync
- A shared encryption key for the registry

### Flow

```
First Vault (desktop)                     Second Vault (laptop)
 │                                          │
 │  User clicks "Link Another Device"      │
 │  Vault generates a 12-word seed phrase: │
 │                                          │
 │  "oak river moon signal frost           │
 │   blade quiet north echo                │
 │   valley dawn crystal"                  │
 │                                          │
 │  User writes it down or copies it.      │
 │                                          │
 │  Vault derives:                         │
 │  - vaultIdentity (key pair)             │  User enters the same 12 words
 │  - syncTopic (for vault-to-vault)       │  on the second Vault.
 │  - registryKey (encryption)             │
 │                                          │  Second Vault derives the
 │  Joins syncTopic, announces identity.   │  same identity, topic, and key.
 │                                          │
 │◄──────── P2P connection ────────────────│  They find each other on syncTopic.
 │                                          │
 │  Registry replication begins:           │
 │  - All paired apps                      │
 │  - All core/drive keys                  │
 │  - AI provider config                   │
 │                                          │
 │  Both Vaults now replicate all apps.    │
 │                                          │
```

### Key derivation

```typescript
import { createHash, createKeyPair } from 'bare-crypto'

function deriveVaultIdentity(seedPhrase: string) {
  const seed = createHash('sha256')
    .update('unstoppable:vault:identity:v1:' + seedPhrase)
    .digest()

  const keyPair = createKeyPair(seed)

  const syncTopic = createHash('sha256')
    .update('unstoppable:vault:sync:v1:' + seed.toString('hex'))
    .digest()

  const registryKey = createHash('sha256')
    .update('unstoppable:vault:registry:v1:' + seed.toString('hex'))
    .digest()

  return { keyPair, syncTopic, registryKey }
}
```

### What syncs between Vaults

| Data | Direction | How |
|------|-----------|-----|
| App registry | Bidirectional | Shared Hyperbee, auto-merge |
| Core keys | Bidirectional | Part of registry |
| Replicated data | Each Vault replicates independently | Both join app core topics |
| AI provider status | Informational | One Vault can be the active provider |
| Storage stats | Informational | Each Vault tracks its own |

### Conflict resolution

Both Vaults can independently pair new apps. The shared registry is a Hyperbee
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
  aiDelegation: boolean   // Use Vault's AI provider
  maxStorage?: number     // Per-app storage quota (bytes)
}
```

Default permissions by pairing method:

| Method | dataSync | fileSync | aiDelegation | Notes |
|--------|----------|----------|-------------|-------|
| Local (same machine) | yes | yes | yes | Auto-approved |
| Invite (cross-device) | yes | yes | yes | User-approved |
| Manual (paste key) | yes | no | no | Minimal trust |

The user can modify permissions from the Vault dashboard at any time.

---

## Revoking Access

The Vault can revoke access to any paired app:

1. Remove the app's public key from the trusted registry
2. Stop replicating its cores/drives
3. Optionally delete local replicas

The app will see disconnections on its next connection attempt. There is no
"revocation broadcast" — the Vault simply stops responding to that public key.

For Vault-to-Vault unlinking, the user enters a new seed phrase (or generates
a fresh one), which derives a new identity. The old linked Vault loses access
because it's on the old topic with the old key pair.

---

## Protocol Messages (Complete)

All messages are NDJSON over Hyperswarm encrypted connections.

### Pairing Phase

| Message | Direction | Fields |
|---------|-----------|--------|
| `pairRequest` | App → Vault | `appId`, `appName`, `publicKey`, `deviceName?`, `pid?` |
| `pairAccepted` | Vault → App | `vaultPublicKey`, `permanentTopic`, `services` |
| `pairDenied` | Vault → App | `reason` |

### Registration Phase (after pairing)

| Message | Direction | Fields |
|---------|-----------|--------|
| `register` | App → Vault | `appId`, `cores[]`, `drives[]`, `requestedServices[]` |
| `registered` | Vault → App | `replicating[]`, `aiConfig?` |

### Operational Phase

| Message | Direction | Fields |
|---------|-----------|--------|
| `heartbeat` | App → Vault | `appId`, `uptime`, `coreStats[]` |
| `syncStatus` | Vault → App | `coreKey`, `length`, `byteLength`, `peers` |
| `serviceUpdate` | Vault → App | `services` (updated AI config, etc.) |

### Vault-to-Vault Phase

| Message | Direction | Fields |
|---------|-----------|--------|
| `vaultHello` | Vault ↔ Vault | `vaultId`, `deviceName`, `appCount`, `storageUsed` |
| `registrySync` | Vault ↔ Vault | (Hyperbee replication — automatic) |

---

## Implementation Priority

| Phase | What | Effort |
|-------|------|--------|
| **Vault Phase 1** | Same-device pairing (auto-approve, local topic) | Small |
| **Vault Phase 2** | Cross-device invite codes (QR + typed code) | Medium |
| **Vault Phase 2** | Permission model + revocation | Small |
| **Vault Phase 4** | Vault-to-Vault linking (seed phrase) | Large |

Same-device pairing is the simplest and should be implemented first. It
covers the most common use case (desktop apps on the same machine) and lets
us validate the core replication flow without solving cross-device trust.

---

## Open Questions

1. **Should the Vault have a persistent identity?** Currently each Vault
   instance generates its own key pair. With Vault-to-Vault linking, the seed
   phrase provides a shared identity. Should the Vault always derive its key
   from a seed phrase, even for single-device use?

2. **Invite code format**: Base32 with dashes (human-typeable) vs pure QR
   (phone-only)? Both? The invite payload is 68 bytes — fits in a compact QR.

3. **NAT traversal for cross-device**: Hyperswarm handles hole-punching, but
   are there edge cases (strict corporate NATs) where pairing fails? Should
   the invite include relay hints?

4. **App identity persistence**: When an app is uninstalled and reinstalled,
   it gets a new key pair. How does it re-pair with the Vault? Should apps
   derive their key from the project's pear key?

5. **Multi-user sharing**: Should one Vault be able to share specific apps
   with another user's Vault? (e.g., shared family notes). This is a different
   trust model — not device linking, but selective data sharing with access
   control.
