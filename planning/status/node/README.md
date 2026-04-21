# Unstoppable Node

**Goal:** Pear Desktop app that replicates, backs up, and seeds data from any
Unstoppable Stack app. Also provides delegated AI inference.

**Current state:** Pairing protocol, data + file replication, and service-advertisement handshake built. `packages/node/` and `packages/node-client/` exist with 39 passing tests. `@unstoppable/node-client` is now wired into the `node-cli` generator via the `node-sync` feature flag.

**Key files:**
- `planning/features/node.md` — Concept
- `planning/features/node-technical.md` — Technical architecture

---

## Three Services

| Service | What It Does | Key Modules to Validate |
|---------|-------------|------------------------|
| **Data Sync** | Replicate Hyperbees/Hypercores | Corestore, Hypercore replication |
| **File Sync** | Replicate Hyperdrives, mirror to local | Hyperdrive, Localdrive, Mirror |
| **AI Provider** | Delegated QVAC inference over P2P | QVAC delegated inference |

**Building this validates 7 items** from "not covered" / "docs only" to "battle-tested."

---

## Phases

### Phase 1: Basic Replication (MVP)

| # | Task | Effort | Status |
|---|------|--------|--------|
| 1 | Scaffold Pear Desktop app (renderer + worker) | Medium | Not started — CLI-only daemon today |
| 2 | Implement registry (Hyperbee for known apps + keys) | Small | Done |
| 3 | Implement Corestore replication engine | Large | Done (+ drive replication) |
| 4 | Implement discovery topic (NDJSON over Hyperswarm) | Medium | Done |
| 5 | Basic dashboard UI (app list, status, storage) | Medium | CLI status only |

### Phase 2: Auto-Discovery + Files

| Task | Effort | Status |
|------|--------|--------|
| Node discovery protocol (`nodeHello` handshake + service advertisement) | Medium | Done |
| SDK (`@unstoppable/node-client`) for app builders | Medium | Done |
| Heartbeat / online status | Small | Done |
| Hyperdrive replication (File Sync service) | Large | Done |
| Scaffold wiring: `node-sync` feature flag in generators | Medium | `node-cli` done; Pear Desktop + Expo Mobile pending |

### Phase 3: AI Provider + Management

| Task | Effort |
|------|--------|
| QVAC delegated inference service | Large |
| Storage quotas and stats | Medium |
| Export / import | Medium |
| Per-app data browser | Medium |

### Phase 4: Multi-Device + Cloud

| Task | Effort |
|------|--------|
| Node-to-Node sync | Large |
| Device linking | Large |
| Transition to hosted (Unstoppable Cloud) | Separate project |

---

## Blocked / Dependencies

- Corestore and Hyperdrive are docs-only — building the Node battle-tests them
- AI Provider (Phase 3) depends on Data Sync (Phase 1) being stable

---

## Recently Completed

| Date | Task |
|------|------|
| 2026-04-21 | **Node usability pass**: `nodeHello` handshake (node advertises `{data, files, ai}` services on connect); Hyperdrive replication wired into `ReplicationEngine` (cores share the corestore — no separate swarm needed); `connectToNode` gained `requireServices` option; `doctor` command checks for the `unstoppable-node` binary; `node-cli` generator wires `@unstoppable/node-client` via new opt-in `node-sync` feature flag — scaffolded CLIs now auto-register their Hyperbee with a local Node. 39/39 node tests + 191/191 cli tests pass. |
| 2026-03-27 | Vault → Node rebrand (classes, packages, env vars, protocols, docs) |
| 2026-03 | Pairing protocol over Hyperswarm (NDJSON, app registration) |
| 2026-03 | Data replication engine (Corestore-based, Hyperbee registry) |
| 2026-03 | Node client SDK (`@unstoppable/node-client`) |
| 2026-03 | E2E and unit tests (pairing, replication, edge cases) |
| 2026-02-10 | Technical architecture doc (3 services, protocol, SDK) |
| 2026-02-10 | Concept and planning doc |
