# Unstoppable Vault

**Goal:** Pear Desktop app that replicates, backs up, and seeds data from any
Unstoppable Stack app. Also provides delegated AI inference.

**Current state:** Planning complete. No code yet.

**Key files:**
- `planning/features/vault.md` — Concept
- `planning/features/vault-technical.md` — Technical architecture

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

| # | Task | Effort |
|---|------|--------|
| 1 | Scaffold Pear Desktop app (renderer + worker) | Medium |
| 2 | Implement registry (Hyperbee for known apps + keys) | Small |
| 3 | Implement Corestore replication engine | Large |
| 4 | Implement discovery topic (NDJSON over Hyperswarm) | Medium |
| 5 | Basic dashboard UI (app list, status, storage) | Medium |

### Phase 2: Auto-Discovery + Files

| Task | Effort |
|------|--------|
| Vault discovery protocol (automatic registration) | Medium |
| SDK (`@unstoppable/vault-client`) for app builders | Medium |
| Heartbeat / online status | Small |
| Hyperdrive replication (File Sync service) | Large |

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
| Vault-to-Vault sync | Large |
| Device linking | Large |
| Transition to hosted (Unstoppable Cloud) | Separate project |

---

## Blocked / Dependencies

- Corestore and Hyperdrive are docs-only — building the Vault battle-tests them
- AI Provider (Phase 3) depends on Data Sync (Phase 1) being stable

---

## Recently Completed

| Date | Task |
|------|------|
| 2026-02-10 | Technical architecture doc (3 services, protocol, SDK) |
| 2026-02-10 | Concept and planning doc |
