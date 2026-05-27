# Unstoppable Node

**Goal:** Pear Desktop app that replicates, backs up, and seeds data from any
Unstoppable Stack app. Also provides delegated AI inference.

**Current state:** Pairing protocol, data + file replication, service-advertisement handshake, AI provider service, Pear Desktop dashboard with trust-on-first-use approval modal, headless daemon for CI + `us node` CLI, typed errors, status RPC, reconnect with backoff, live AI toggle, per-app pause/resume, data peek, and disk-usage stats all built. `packages/node/` has 75 passing tests; `packages/node-client/` has 5; `packages/node-desktop/` has 20; `packages/cli/` has 223 (including the new `us node` subcommand). `@unstoppable/node-client` is wired into all three generators (`node-cli`, `pear-desktop`, `expo-mobile`) via the `node-sync` feature flag. Both publishable packages are prepped for npm (exports map, files list, repo metadata, gated workflow, READMEs) — actual publish deferred.

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
| Live AI toggle from the dashboard (no restart) | Small | Done — F8 (`enableAI` / `disableAI` + `servicesChanged` event) |
| Storage quotas and stats | Medium | Done (stats); quotas pending — `getDiskUsage()` + per-app + total bytes in status |
| Per-app pause/resume replication | Medium | Done — F14 |
| Per-app data browser (Hyperbee/Hyperdrive peek) | Medium | Done — F6 (modal with tabbed core/drive view) |
| Trust-on-first-use approval modal + persistent registry | Medium | Done — `ApprovalGate` with promote / revoke / forget actions |
| First-run welcome modal | Small | Done — F19 |
| Export / import | Medium | Not started |

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
| 2026-05-27 | **Node v0.4 batch (16 of 20 features from `planning/features/node-v0.4-spec.md`)**: Trust-on-first-use approval modal lands (F12 in earlier work) with `ApprovalGate` persisting decisions to `<storage>/trust-registry.json`; modal CSS specificity bug fixed (was permanently visible from boot). **F2** migrated the dashboard worker off the deprecated `Pear.worker.pipe()` to `pear-pipe`. **F1** extracted a runtime-portable `daemon-host.js` factory that both the dashboard worker and a new `bin/headless.js` consume — backed by a self-contained `scripts/smoke.js` (no sandbox deps) + a `.github/workflows/node-smoke.yml` workflow that spawns under Bare, pairs a NodeClient, hits getNodeStatus, and runs mock inference. **F10** ships `deviceName` end-to-end (client default = `os.hostname()`, plumbed through pairRequest → daemon → registry → modal). **F11** renamed "untrusted" → "auto-paired" and added a Promote action that writes a user-approval entry. **F15** added `client.getNodeStatus()` + `nodeStatus` event over a new `status-request` RPC, with the daemon's `getStatus()` now consolidated (removed a duplicate) into a single source of truth that returns protocolVersion, nodePublicKey, services, apps, cores, drives, connectedPeers, storage block, and ai. **F16** added opt-in `connectToNode({ reconnect })` with exponential backoff, `reconnecting`/`reconnected`/`reconnectFailed` events. **F17** added typed errors (`NodeClientError` base + 6 subclasses with stable `.code`): NODE_NOT_FOUND, NODE_DENIED (with `.reason`), NODE_MISSING_SERVICE (with `.missing`/`.services`), INVALID_OPTION, CLOSED, INFERENCE_ERROR. **F7** added `getDiskUsage()` (walks the storage dir), per-app + total byteLength in status, dashboard storage tile + per-app size badges. **F8** added live AI toggle (`enableAI`/`disableAI`) without daemon restart, dashboard header button. **F14** added per-app `pauseApp`/`resumeApp` (leaves swarm topic, cores stay open for peek); dashboard Pause/Resume button. **F6** added `peekCore` (last N blocks with utf-8 preview) and `peekDrive` (directory listing); dashboard "Peek data" button opens a tabbed modal. **F18** added `us node start/status/stop` subcommand (background daemon, pid file under `~/.unstoppable/node/`, log tail). **F19** added a first-run welcome modal in the dashboard. **F3** prepped `unstoppable-node` + `@unstoppable/node-client` for npm (exports map, files list, repo metadata, READMEs, gated workflow_dispatch publish action; `npm publish --dry-run` validates both packages). 75 daemon + 20 dashboard + 5 client + 223 CLI = 323 tests pass. |
| 2026-04-22 | **Node full slice**: `node-sync` feature flag rolled out to Pear Desktop + Expo Mobile generators (worker/worklet wires `connectToNode` with best-effort fallback UI sections); `AIProvider` service lands in the daemon with `--ai` / `--ai-mock` flags (plus `UNSTOPPABLE_AI[_MOCK]` env vars) — inference streams over a new `inference` / `inference-token` / `inference-done` wire protocol and `services.ai` flips only when the provider actually starts; `node-client` gained `requestInference()` async iterator; `packages/node-desktop/` scaffolds a Pear Desktop dashboard that embeds `NodeDaemon` in its worker (app list, unpair, peer/core/drive counts, event log, services pills); `protocol.js` + client now lazy-load `os` so the daemon runs inside Bare without patches. 48/48 node tests + 206/206 cli tests pass. |
| 2026-04-21 | **Node usability pass**: `nodeHello` handshake (node advertises `{data, files, ai}` services on connect); Hyperdrive replication wired into `ReplicationEngine` (cores share the corestore — no separate swarm needed); `connectToNode` gained `requireServices` option; `doctor` command checks for the `unstoppable-node` binary; `node-cli` generator wires `@unstoppable/node-client` via new opt-in `node-sync` feature flag — scaffolded CLIs now auto-register their Hyperbee with a local Node. 39/39 node tests + 191/191 cli tests pass. |
| 2026-03-27 | Vault → Node rebrand (classes, packages, env vars, protocols, docs) |
| 2026-03 | Pairing protocol over Hyperswarm (NDJSON, app registration) |
| 2026-03 | Data replication engine (Corestore-based, Hyperbee registry) |
| 2026-03 | Node client SDK (`@unstoppable/node-client`) |
| 2026-03 | E2E and unit tests (pairing, replication, edge cases) |
| 2026-02-10 | Technical architecture doc (3 services, protocol, SDK) |
| 2026-02-10 | Concept and planning doc |
