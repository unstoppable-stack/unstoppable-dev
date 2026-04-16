# How Keet Handles P2P Chat

Keet is the flagship P2P chat application built by Holepunch, backed by Tether. It's the best real-world example of a fully P2P data application running in production. Understanding how Keet solves the hard problems gives us patterns for the Unstoppable Stack.

---

## Core Architecture

Keet is 100% P2P — no servers at all. Here's how it manages:

```
┌──────────────┐                    ┌──────────────┐
│   Device A   │  Hyperswarm (DHT)  │   Device B   │
│              │◄──────────────────►│              │
│  Autobase    │  Noise-encrypted   │  Autobase    │
│  (writer A)  │  direct connection │  (writer B)  │
│              │                    │              │
│  View:       │                    │  View:       │
│  messages,   │  Eventually        │  messages,   │
│  members,    │  consistent        │  members,    │
│  settings    │                    │  settings    │
└──────────────┘                    └──────────────┘
```

### Rooms = Autobases

Each Keet "room" is an **Autobase** instance:
- The room creator's key is the bootstrap key.
- Each participant gets their own writer Hypercore.
- The Autobase linearizes all messages into a consistent order.
- The view is a Hyperbee that stores the room state.

### Identity = Key Pairs

- No phone number, no email. Your identity IS your key pair.
- 24-word seed phrase (BIP-39 style) generates the master key.
- From the master key, Corestore derives all app-specific keys.
- "Pairing" with another user means exchanging public keys.

### Multi-Device = Per-Device Writers

Each device is a separate writer in the Autobase:

```
Phone (writer-phone)      Desktop (writer-desktop)
     │                           │
     ▼                           ▼
Autobase Room → Linearized View (same on both devices)
```

When you install Keet on a second device:
1. Scan a QR code from the first device.
2. The first device shares the master key (or derives a linked key).
3. The second device creates its own writer core.
4. The first device adds the second device as a writer to all rooms.
5. Autobase handles merging both devices' messages.

### Device Linking Protocol

```
Device A (existing)              Device B (new)
     │                                │
     │◄── Scan QR / paste link ──────│
     │                                │
     │── Share: {                     │
     │     masterKey,                 │
     │     rooms: [{                  │
     │       bootstrapKey,            │
     │       ...                      │
     │     }]                         │
     │   } ──────────────────────────►│
     │                                │
     │                                │── Create writer core
     │                                │── Join rooms
     │◄── addWriter request ─────────│
     │                                │
     │── host.addWriter(B.key) ──────│
     │   (in each room's Autobase)    │
     │                                │
     │  Both devices can now write    │
     │  to all rooms.                 │
```

---

## Data Persistence: How Messages Survive

### Problem: If You Close the App, Can Others Still See Your Messages?

In traditional chat apps, messages live on a server. In Keet, messages only exist on the devices of room participants. If ALL participants go offline, the messages are inaccessible until someone comes back.

### Keet's Solutions

**1. Multi-Peer Replication**

Every room participant replicates the full Autobase (all writers' cores). So if you send a message, everyone in the room gets a copy. Your message survives as long as at least one room member is online.

```
Alice sends "Hello" → Alice's core has it
                    → Bob replicates it → Bob's device has it
                    → Carol replicates it → Carol's device has it

Alice goes offline → Bob and Carol still have the message
                  → New joiner Dave gets it from Bob or Carol
```

**2. Persistent Rooms**

Room data persists on disk (in Corestore's storage). Even if you close Keet, reopen it later, and reconnect, your local copy of all messages is still there. You just need to connect to any peer to get messages sent while you were offline.

**3. Seeding via Multiple Devices**

If you run Keet on both your phone and desktop, both devices replicate everything. Your desktop is effectively a "mini Node" — it keeps your data available even when your phone is off.

**4. No External Backup**

Keet does NOT have:
- Cloud backup
- A Node-like always-on seeder
- Any server-side data persistence

This means: if ALL room members lose their devices (or their data is corrupted), the room's history is lost forever. This is a conscious trade-off for complete decentralization.

---

## Consistency Model

### Autobase's Eventually Consistent Ordering

Messages are eventually consistent — all participants converge to the same order, but there may be temporary disagreements.

**Example:**
```
Time 1: Alice sends "Hello"         → All peers see: [Hello]
Time 2: Bob sends "Hi" (before seeing Alice) → 
  Bob sees:  [Hi]
  Alice sees: [Hello]
  
Time 3: Alice and Bob sync →
  Both see: [Hello, Hi] (or [Hi, Hello] — Autobase decides)
  The order is deterministic once both messages are known.
```

**Signed length checkpoints:**
Once a majority of indexers (usually room admins) have processed messages, the order is locked. Late joiners fast-forward to this point.

### What Keet Does Right

- **Causal ordering** — messages reference their causal predecessors, so "replies" always appear after the message they reference.
- **Reordering is invisible** — the UI re-renders when order changes. For chat, this is usually fine (messages that were concurrent didn't depend on each other).
- **Read receipts** — implemented as acks in the Autobase, helping convergence.

---

## File Sharing in Keet

**Files are shared via Hyperdrive:**

```
Sender                              Receiver
  │                                    │
  │── Create Hyperdrive per file ─────│
  │── Put file in drive ──────────────│
  │── Share drive key in chat msg ────│
  │                                    │
  │                                    │── Replicate drive
  │◄── Drive replication ────────────►│── Download file
  │                                    │
```

- Each shared file (or batch of files) gets its own Hyperdrive.
- The drive key is embedded in the chat message.
- Receivers replicate the drive to download.
- Sparse: only the requested file is downloaded, not the whole drive.
- No file size limit (direct P2P transfer, no server in the way).

---

## Lessons for the Unstoppable Stack

### 1. Autobase Is the Multi-Writer Answer

Keet proves Autobase works at scale for multi-writer scenarios. Any Unstoppable Stack app that needs collaboration should use Autobase.

### 2. Per-Device Writers Solve Multi-Device

Don't try to share a single Hypercore key across devices. Give each device its own writer and let Autobase merge. Keet does this, and it works.

### 3. Availability Is the Achilles' Heel

Keet's biggest weakness is availability. If no room member is online, new members can't get the room history. The Node directly addresses this by being an always-on participant.

### 4. The Node Would Transform Keet-Like Apps

If Keet had a Node:
```
Room: Alice, Bob, Carol (all offline)
Node: online, has replicated all writers

Dave joins room → connects to Node → gets full history
```

The Node doesn't need write access. It's a read-only replicator. It just needs the bootstrap keys and to be added as a reader to the room's Autobase.

### 5. No Centralized Fallback Is a Feature, Not a Bug

Keet deliberately has no server fallback. This means true data sovereignty. For the Unstoppable Stack, the Node and Cloud are opt-in enhancements, not requirements. Apps must work without them.

### 6. Key-Based Identity Works

Keet proves that key-based identity (24-word seed phrase) is viable for a consumer app. No email, no phone, no KYC. The trade-off is recovery: lose your seed, lose your identity.

---

## Keet's Architecture vs Unstoppable Node

| Aspect | Keet (Today) | With Node |
|--------|-------------|------------|
| Availability | Only when peers online | 24/7 via Node |
| Multi-device | Per-device writers + Autobase | Same, + Node as extra peer |
| File sharing | Ephemeral Hyperdrives | Node mirrors files permanently |
| AI inference | N/A | Node delegates via QVAC |
| Recovery | 24-word seed only | Node has replicated copy |
| Search | Local only | Node could index across apps |
| Backup | None (by design) | Node replicates everything |
