# P2P Data Sync — Key Findings

## 1. The Layer Cake

Everything builds on Hypercore (append-only log):
- **Hypercore** → raw log, single writer
- **Hyperbee** → sorted B-tree on a core (KV store)
- **Autobase** → linearizes multiple writers into one view
- **HyperDB** → schema + indexes on top (bee or RocksDB backend)
- **Hyperdrive** → P2P filesystem (files + blobs)
- **Corestore** → factory for managing many cores
- **Hyperswarm** → DHT-based peer discovery

## 2. Single-Writer vs Multi-Writer

- **Single writer** (Hypercore/Hyperbee): one device writes, others read. Simple, no conflicts, but writer must be online.
- **Multi-writer** (Autobase): multiple writers linearized deterministically. Handles reordering. The `apply` function MUST be deterministic and self-contained.
- **Rule:** Use Autobase whenever multiple users OR multiple devices write to the same data.

## 3. Data vs Files: Use the Right Tool

| Need | Tool |
|------|------|
| Key-value (one writer) | Hyperbee |
| KV with schema/indexes | HyperDB |
| Multi-writer collaboration | Autobase → Hyperbee view |
| Files | Hyperdrive |
| Event streams | Raw Hypercore |

**Never store large blobs in Hyperbee** — use Hyperdrive for files, Hyperbee for metadata.

## 4. Multi-Device Sync: The Keet Pattern

Keet (Holepunch's P2P chat) solves multi-device like this:
- Each device gets its own writer Hypercore.
- Autobase merges all device writers.
- Device linking via QR code / secure key exchange.
- Identity = 24-word seed phrase (no server, no email).

## 5. Availability Is the #1 Challenge

P2P data is only available when at least one peer is online.

**Solutions:**
1. **Pure P2P** — accept limited availability (Keet's approach)
2. **Vault** — always-on local peer that replicates everything
3. **Cloud** — hosted peer with guaranteed uptime

The Vault is the sweet spot: user-controlled, high availability, no trust issues.

## 6. When You Still Need a Server

Some things are hard or impossible in pure P2P:
- **Global search** — can't search data you don't have
- **User directory** — finding users by name/email
- **Model registry** — QVAC uses a centralized registry for model discovery
- **Financial transactions** — need global ordering
- **Notifications** — can't push to an offline device

The stack is ~90% P2P, with strategic centralization for discovery and payments.

## 7. The QVAC Registry Pattern: Centralized Discovery, P2P Data

The QVAC model registry shows the ideal hybrid:
- **Centralized:** model metadata (name, size, checksum)
- **P2P:** model file download (Hyperdrive)
- The server helps you *find* things; actual data transfer is peer-to-peer.

## 8. The Vault Operates at Protocol Level

The Vault replicates Hypercores, not app data. It doesn't need to understand your data model.

- **Single-writer cores:** `store.get({ key })` + `core.download({ start: 0, end: -1 })`
- **Autobase:** replicate all writer cores via Corestore
- **Hyperdrive:** replicate + optional mirror to local filesystem
- **Compatible with any app** because it works at the Corestore level.

## 9. Vault Architecture Decisions

1. **Corestore-per-app** — isolation between apps
2. **Full download** — the Vault is a backup, not a sparse cache
3. **Read-only** — the Vault never writes to app data
4. **Autobase registry** — for multi-Vault sync
5. **Same protocol → Cloud** — the Vault IS the Cloud, just local

## 10. Recommended Build Order

1. **Phase 1:** Manual registration + single-writer replication + dashboard
2. **Phase 2:** Hyperdrive + auto-discovery + SDK
3. **Phase 3:** Autobase + QVAC delegation + data browser
4. **Phase 4:** Vault-to-Vault sync + export/import
5. **Phase 5:** Cloud (separate project, same protocol)

## Quick Reference: Choosing Your Stack

```
Do I need multi-writer?
├── Yes → Autobase + Hyperbee view
└── No
    ├── Structured data → Hyperbee (simple) or HyperDB (schema)
    ├── Files → Hyperdrive
    └── Event stream → Raw Hypercore

Do I need always-on availability?
├── Yes → Add Vault seeder
└── No → Pure P2P is fine

Do I need global search/discovery?
├── Yes → Add centralized index (like QVAC registry)
└── No → Hyperswarm DHT is enough
```
