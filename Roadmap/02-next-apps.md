# Phase 2 — Next Apps to Build

Each app below is designed to validate a specific set of unproven modules and
patterns. Build in priority order — each builds on the last.

---

## App 3: P2P File Sync (Hyperdrive + Corestore)

**Goal:** Validate Hyperdrive (P2P file storage) and Corestore (multi-core
management) — two modules that are currently docs-only in the agent pack.

**Concept:** A Pear Desktop app for syncing a folder between devices. Drop files
on one device, they appear on the other. Like a P2P Dropbox with no server.

**Stack modules to exercise:**
- Hyperdrive (P2P filesystem — read, write, watch, mirror)
- Corestore (managing multiple Hypercores under one storage)
- Hyperswarm (peer discovery)
- Pear Desktop + Worker (already proven)
- React UI (file browser, drag & drop, sync status)

**What we'll learn:**
- How Hyperdrive actually works in practice (mirroring, watching)
- Corestore namespace patterns and multi-core replication
- File metadata handling (mtime, size, MIME types)
- Large file handling and streaming
- Conflict resolution (if any)

**Agent pack files to update:**
- `modules/hyperdrive.md` — validate and fix with real usage
- `modules/corestore.md` — validate and fix
- `skills/file-sharing/` — full rewrite with battle-tested code
- New recipe: `recipes/hyperdrive-mirror.md`

**Estimated effort:** Medium (reuse worker bridge, focus on new modules)

---

## App 4: Collaborative Notes (HyperDB + Multi-Writer)

**Goal:** Validate HyperDB (the newer structured P2P database), multi-writer
replication, and the offline-first sync pattern.

**Concept:** A shared notes app where multiple users can create and edit notes,
with changes syncing in real-time over P2P. Works offline, merges when peers
reconnect.

**Stack modules to exercise:**
- HyperDB (structured key-value store with schemas)
- Hyperswarm (discovery + replication)
- Multi-writer replication (multiple users writing to shared state)
- Offline-first pattern (write locally, sync when connected)
- Pear Desktop + Worker (proven)

**What we'll learn:**
- HyperDB schema definitions and queries
- Multi-writer merge/conflict behavior
- Realistic offline-first patterns (not theoretical)
- How auto-replication works with HyperDB vs manual Hypercore replication

**Agent pack files to update:**
- `modules/hyperdb.md` — validate and fix with real usage
- `skills/add-p2p-sync/` — update with multi-writer patterns
- `skills/offline-first-app/` — rewrite with battle-tested code
- New recipe: `recipes/hyperdb-multi-writer.md`
- New recipe: `recipes/offline-first-merge.md`

**Estimated effort:** Medium-High (multi-writer is the hard part)

---

## App 5: P2P Encrypted Chat (SecretStream + Protomux)

**Goal:** Validate SecretStream (end-to-end encryption) and Protomux
(multiplexed channels over a single connection).

**Concept:** A desktop chat app with encrypted 1:1 and group messaging. Each
message is end-to-end encrypted. Multiple protocol channels on one connection
(chat, presence, file transfer).

**Stack modules to exercise:**
- SecretStream (Noise protocol encryption)
- Protomux (multiplexed channels over encrypted stream)
- Hyperswarm (peer discovery)
- Compact-encoding (binary message encoding)
- Pear Desktop + Worker (proven)

**What we'll learn:**
- SecretStream API in practice (key exchange, verification)
- Protomux channel/message patterns
- Binary encoding with compact-encoding
- Multiple protocols over a single P2P connection

**Agent pack files to update:**
- `skills/secure-communication/` — rewrite with battle-tested code
- New module: `modules/secret-stream.md`
- New module: `modules/protomux.md`
- New recipe: `recipes/protomux-channels.md`

**Estimated effort:** Medium (encryption is mostly handled by the library)

---

## App 6: Mobile P2P App (Expo Bare)

**Goal:** Validate Expo Bare (React Native + Bare runtime) for mobile P2P apps.

**Concept:** A mobile version of one of the previous apps (file sync or chat)
using Expo with `react-native-bare-kit`. Runs P2P code in the Bare worklet,
React Native UI in the main thread.

**Stack modules to exercise:**
- Expo Bare / react-native-bare-kit
- bare-pack (bundling Bare backend for mobile)
- Hyperswarm (P2P from mobile)
- QVAC SDK on-device (if supported on mobile)

**What we'll learn:**
- Mobile build pipeline (bare-pack → iOS/Android)
- Bare worklet lifecycle (suspend/resume)
- Communication between RN UI and Bare worklet
- Mobile-specific gotchas (battery, background, connectivity)
- On-device AI inference constraints

**Agent pack files to update:**
- `modules/expo-bare.md` — major rewrite with real mobile patterns
- New skill: `skills/mobile-p2p-app/` (or expand pear-desktop-app)
- New recipe: `recipes/bare-pack-mobile.md`

**Estimated effort:** High (mobile toolchain is complex, new territory)

---

## App 7: Payment-Enabled App (WDK Wallet)

**Goal:** Validate WDK Wallet integration for crypto payments.

**Concept:** A marketplace or tipping app where users can send/receive payments
P2P using WDK Wallet. Could extend the Coffee Assistant to accept USDt payments.

**Stack modules to exercise:**
- WDK Wallet (wallet creation, send, receive, balance)
- Payment verification over P2P
- Hyperswarm (for payment channel communication)

**What we'll learn:**
- WDK Wallet SDK API in practice
- Payment flow patterns (request → approve → confirm)
- Wallet state management
- Error handling for failed/pending transactions

**Agent pack files to update:**
- `modules/wdk.md` — rewrite with real API usage
- `skills/wallet-integration/` — rewrite with battle-tested code
- New recipe: `recipes/p2p-payments.md`

**Estimated effort:** Medium (depends on WDK SDK maturity and documentation)

---

## Priority Order

| # | App | Primary Validation Target | Depends On |
|---|-----|--------------------------|------------|
| 3 | P2P File Sync | Hyperdrive, Corestore | Worker bridge (done) |
| 4 | Collaborative Notes | HyperDB, Multi-writer, Offline-first | Worker bridge (done) |
| 5 | Encrypted Chat | SecretStream, Protomux | Worker bridge (done) |
| 6 | Mobile P2P App | Expo Bare, bare-pack | Hyperswarm knowledge (done) |
| 7 | Payment App | WDK Wallet | P2P knowledge (done) |

Apps 3-5 can be done in any order (independent modules). App 6 requires a
different platform (mobile). App 7 depends on WDK documentation availability.
