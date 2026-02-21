# Sync Strategies for P2P Apps

## The Core Problem

In P2P apps, there's no central server holding the "truth." Each device has its own copy of the data, and they need to stay in sync. This creates three challenges:

1. **Availability** — Data must be accessible even when the original device is offline.
2. **Consistency** — All devices should eventually agree on the same state.
3. **Conflict resolution** — When two devices make changes independently, what wins?

---

## Strategy 1: Single-Writer Replication

**Pattern:** One Hypercore per writer. The writer appends, everyone else reads.

```
Device A (writer)          Device B (reader)          Device C (reader)
┌────────────────┐         ┌────────────────┐         ┌────────────────┐
│ Hypercore      │         │ Hypercore      │         │ Hypercore      │
│ [0][1][2][3]   │────────►│ [0][1][2][3]   │         │ [0][1][2]      │
│                │         │ (full replica)  │         │ (sparse/behind)│
└────────────────┘         └────────────────┘         └────────────────┘
```

**How it works:**
- Device A holds the secret key and appends blocks.
- Devices B and C replicate via Hyperswarm whenever they connect to A (or to each other, if they both have blocks).
- Sparse replication means C might only have blocks it actually requested.

**Strengths:**
- Zero conflict resolution needed — there's only one writer.
- Simple mental model: the log is the truth.
- Efficient: append-only, merkle-verified, sparse.

**Weaknesses:**
- If Device A is offline, no new data can be created.
- Readers can still read what they've replicated, but can't get new blocks.
- Not suitable for collaborative scenarios.

**Best for:**
- Personal data (one user, multiple devices reading)
- Publish/subscribe (one publisher, many subscribers)
- Sensor data streams
- Chat messages from one participant (combined with others via Autobase)

---

## Strategy 2: Multi-Writer via Autobase

**Pattern:** Multiple writers append to their own Hypercores. Autobase linearizes them into a single consistent view.

```
Writer A: ──[a1]──[a2]──────[a3]──
                                    ─── Autobase ──► View [a1, b1, a2, b2, a3]
Writer B: ──────[b1]──[b2]────────
```

**How it works:**
1. Each writer has their own Hypercore.
2. Writers append blocks that reference the latest known heads of other writers (causal ordering).
3. Autobase's linearizer processes the DAG and produces a deterministic order.
4. An `apply` function processes each block and updates a view (usually a Hyperbee).
5. A quorum of "indexers" sign checkpoints, locking ordering up to that point.

**The reordering problem:**
When Writer B receives a message from Writer A that it hadn't seen before, the linearizer may need to reorder existing messages. The view is "undone" and reapplied with the correct order.

```
Before receiving A's message:   After:
  View: [b1, b2]                 View: [a1, b1, a2, b2]
                                 (b1 and b2 were reprocessed)
```

This means your `apply` function MUST be:
- **Deterministic** — same inputs → same output
- **Idempotent-safe** — can be replayed without side effects
- **Self-contained** — only uses the `view` argument, no external state

**Signed length (checkpoints):**
Once a majority of indexers have processed up to a certain point, that ordering is locked. New peers can fast-forward to the signed length without replaying everything.

**Strengths:**
- True multi-writer collaboration.
- Eventually consistent — all peers converge to the same view.
- No central coordinator needed.
- Fast-forward for late joiners.

**Weaknesses:**
- Complexity: must handle reordering, writer management.
- Indexer quorum: if majority go offline, signed length stalls.
- `apply` function constraints are strict.
- Latency: waiting for quorum can add delay for "finality."

**Best for:**
- Collaborative apps (shared notes, task boards, chat rooms)
- Multi-user databases
- Any scenario where multiple devices/users write to the same data

---

## Strategy 3: Device Sync via Shared Secret Key

**Pattern:** One user, multiple devices. Each device needs write access to the same cores.

**This is the trickiest problem in P2P.**

**Option A: One writer core, switch active device**

Only one device writes at a time. Others are read-only replicas.

```
Phone (active writer)      Desktop (reader)
┌──────────────┐           ┌──────────────┐
│ Core A       │──────────►│ Core A       │
│ [write]      │           │ [read-only]  │
└──────────────┘           └──────────────┘
```

Problem: you can't write from both devices simultaneously.

**Option B: One core per device + Autobase**

Each device has its own writer core. Autobase merges them.

```
Phone                      Desktop
┌──────────────┐           ┌──────────────┐
│ Core-Phone   │           │ Core-Desktop │
│ [write]      │◄─────────►│ [write]      │
└──────────────┘           └──────────────┘
       │                          │
       └──────────┬───────────────┘
                  ▼
            Autobase View
            (merged state)
```

This is the approach Keet uses. Each device is its own writer, and Autobase handles merging.

**Option C: Corestore key derivation**

Both devices share the same `primaryKey`. Corestore derives the same core keys deterministically.

```
const store = new Corestore('./storage', { primaryKey: sharedSecret })
const core = store.get({ name: 'main' }) // Same key on both devices
```

Problem: both devices can write to the same core, but Hypercore is single-writer. This only works if you ensure non-concurrent writes (messy, error-prone).

**Recommendation: Option B** (per-device cores + Autobase) is the most robust for multi-device sync.

---

## Strategy 4: Always-On Seeder (The Vault Pattern)

**Pattern:** A dedicated device/service keeps data available 24/7 by replicating and re-seeding.

```
Phone (offline)            Vault (always on)           New Device
                           ┌──────────────┐
                           │ Replicated   │
      Last synced ────────►│ copy of all  │────────► Gets full data
      before going         │ cores/drives │           even though phone
      offline              └──────────────┘           is offline
```

**Why it's needed:**
- P2P data is only available when at least one peer holding it is online.
- If you close your laptop, your phone can't get your data — unless someone else has it.
- The Vault acts as a "super-peer" that's always online.

**How it works:**
1. Apps register their cores/drives with the Vault.
2. The Vault replicates them (read-only).
3. The Vault stays online and serves data to any peer that requests it.
4. When a new device joins, it can get the full history from the Vault.

**This is NOT centralization** — it's "one of many possible peers." The data is still owned by the user, the protocol is still P2P, and the Vault is optional (apps work without it, just with reduced availability).

---

## Strategy 5: Hybrid (P2P + Centralized Index)

**Pattern:** Data lives P2P, but a centralized service provides discovery, indexing, or metadata.

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│ Device A     │     │ Index Server │     │ Device B     │
│              │     │              │     │              │
│ Data: P2P    │────►│ Discovery    │◄────│ Data: P2P    │
│ (Hypercore)  │     │ registry,    │     │ (Hypercore)  │
│              │     │ metadata     │     │              │
└──────────────┘     └──────────────┘     └──────────────┘
                            │
                   Centralized for:
                   • Model discovery (QVAC registry)
                   • User directory (who has what)
                   • Search indexing
                   • Analytics
```

**The QVAC Model Registry** is a perfect example:
- Model metadata (names, sizes, checksums) is served centrally.
- Model files themselves can be downloaded via Hyperdrive or HTTP.
- The registry helps users *find* models; the data transfer is P2P.

**When to use this pattern:**
- Global search/discovery (P2P can't search data it doesn't have)
- Metadata that all users need (model registries, app catalogs)
- Analytics/aggregation (P2P data is distributed, hard to aggregate)
- Onboarding (new users need to find peers somehow)

---

## Comparison Table

| Strategy | Writers | Availability | Conflicts | Complexity | Best For |
|----------|---------|-------------|-----------|------------|----------|
| Single-writer | 1 | Low (writer must be online) | None | Low | Personal data, logs |
| Autobase multi-writer | N | Medium (any writer online) | Auto-resolved | High | Collaboration |
| Per-device + Autobase | N (1 per device) | Medium | Auto-resolved | Medium | Multi-device personal |
| Always-on seeder | N/A (read-only) | High | N/A | Medium | Backup, availability |
| Hybrid P2P + server | N | High | Depends | Medium | Discovery, search |

---

## The Availability Spectrum

```
FULLY P2P                                                FULLY CENTRALIZED
│                                                                        │
│ All data on user                                   All data on server  │
│ devices only                                       clients are thin    │
│                                                                        │
│ ◄──────────────────────────────────────────────────────────────────► │
│                                                                        │
│  Pure P2P    P2P + Seeder    P2P + Index    Hybrid     Server + cache  │
│  (Keet)      (Vault)         (QVAC reg)    (typical)   (traditional)   │
│                                                                        │
│  Max privacy                                          Max availability │
│  Min availability                                     Min privacy      │
```

The Unstoppable Stack's sweet spot is **P2P + Seeder (Vault)** — fully P2P data ownership, but with an always-on local device (the Vault) for high availability. The Cloud offering just moves the seeder off-premises.
