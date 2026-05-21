# Unstoppable Node

**Goal:** Pear Desktop app that replicates, backs up, and seeds data from any
Unstoppable Stack app. Also provides delegated AI inference.

**Current state:** Pairing protocol, data + file replication, service-advertisement handshake, AI provider service, and Pear Desktop dashboard all built. `packages/node/` has 48 passing tests; `packages/node-desktop/` wraps the daemon as a Pear Desktop app. `@unstoppable/node-client` is wired into all three generators (`node-cli`, `pear-desktop`, `expo-mobile`) via the `node-sync` feature flag.

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
| 1 | Scaffold Pear Desktop app (renderer + worker) | Medium | Done — `packages/node-desktop/` |
| 2 | Implement registry (Hyperbee for known apps + keys) | Small | Done |
| 3 | Implement Corestore replication engine | Large | Done (+ drive replication) |
| 4 | Implement discovery topic (NDJSON over Hyperswarm) | Medium | Done |
| 5 | Basic dashboard UI (app list, status, storage) | Medium | Done |

### Phase 2: Auto-Discovery + Files

| Task | Effort | Status |
|------|--------|--------|
| Node discovery protocol (`nodeHello` handshake + service advertisement) | Medium | Done |
| SDK (`@unstoppable/node-client`) for app builders | Medium | Done |
| Heartbeat / online status | Small | Done |
| Hyperdrive replication (File Sync service) | Large | Done |
| Scaffold wiring: `node-sync` feature flag in generators | Medium | Done (node-cli, pear-desktop, expo-mobile) |

### Phase 3: AI Provider + Management

| Task | Effort | Status |
|------|--------|--------|
| QVAC delegated inference service (opt-in `--ai` / `--ai-mock` flag) | Large | Done — `AIProvider` + `inference` wire messages |
| Storage quotas and stats | Medium | Partial — stats surfaced; quotas pending |
| Export / import | Medium | Not started |
| Per-app data browser | Medium | Not started |

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
| 2026-04-22 | **Node full slice**: `node-sync` feature flag rolled out to Pear Desktop + Expo Mobile generators (worker/worklet wires `connectToNode` with best-effort fallback UI sections); `AIProvider` service lands in the daemon with `--ai` / `--ai-mock` flags (plus `UNSTOPPABLE_AI[_MOCK]` env vars) — inference streams over a new `inference` / `inference-token` / `inference-done` wire protocol and `services.ai` flips only when the provider actually starts; `node-client` gained `requestInference()` async iterator; `packages/node-desktop/` scaffolds a Pear Desktop dashboard that embeds `NodeDaemon` in its worker (app list, unpair, peer/core/drive counts, event log, services pills); `protocol.js` + client now lazy-load `os` so the daemon runs inside Bare without patches. 48/48 node tests + 206/206 cli tests pass. |
| 2026-04-21 | **Node usability pass**: `nodeHello` handshake (node advertises `{data, files, ai}` services on connect); Hyperdrive replication wired into `ReplicationEngine` (cores share the corestore — no separate swarm needed); `connectToNode` gained `requireServices` option; `doctor` command checks for the `unstoppable-node` binary; `node-cli` generator wires `@unstoppable/node-client` via new opt-in `node-sync` feature flag — scaffolded CLIs now auto-register their Hyperbee with a local Node. 39/39 node tests + 191/191 cli tests pass. |
| 2026-03-27 | Vault → Node rebrand (classes, packages, env vars, protocols, docs) |
| 2026-03 | Pairing protocol over Hyperswarm (NDJSON, app registration) |
| 2026-03 | Data replication engine (Corestore-based, Hyperbee registry) |
| 2026-03 | Node client SDK (`@unstoppable/node-client`) |
| 2026-03 | E2E and unit tests (pairing, replication, edge cases) |
| 2026-02-10 | Technical architecture doc (3 services, protocol, SDK) |
| 2026-02-10 | Concept and planning doc |
