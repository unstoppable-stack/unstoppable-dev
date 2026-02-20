# Agent Pack Content & Docs

**Goal:** Every module in the stack backed by battle-tested knowledge.
Research → agent pack docs → CLI output.

**Pipeline:** `research/` → `packages/agent-pack/src/` → `packages/cli/agent-pack-src/`

---

## Coverage by Category

| Category | File | Battle-tested | Docs only | Not covered | Total |
|----------|------|--------------|-----------|-------------|-------|
| [Platform / Runtime](./platform-runtime.md) | | 3 | 0 | 6 | 9 |
| [QVAC (Local AI)](./qvac-ai.md) | | 6 | 10 | 1 | 17 |
| [P2P & Data](./p2p-data.md) | | 7 | 7 | 1 | 15 |
| [WDK (Payments)](./wdk-payments.md) | | 0 | 0 | 6 | 6 |
| [Build Tooling](./build-tooling.md) | | 5 | 0 | 2 | 7 |
| **Total** | | **21** | **17** | **16** | **54** |

**39% battle-tested, 31% docs-only, 30% not covered.**

---

## Priority Order for Content Work

1. **Platform / Runtime — Mobile** — Can't build mobile apps at all today
2. **P2P & Data — Corestore, Hyperdrive** — Vault will validate these
3. **QVAC — Vision, Embeddings/RAG** — High user value, existing recipes need validation
4. **P2P & Data — HyperDB, SecretStream** — Collaborative + secure apps
5. **QVAC — Transcription, TTS, Translation** — More capabilities
6. **WDK — Payments** — Depends on WDK SDK maturity
7. **Build Tooling — Testing, CI/CD** — DX improvements

---

## Content Inventory

| Type | Count | Location |
|------|-------|----------|
| Core docs | 7 | `agent-pack/src/core/` |
| Module docs | 12 | `agent-pack/src/modules/` |
| Recipes | 18 | `agent-pack/src/recipes/` |
| Skills | 10 | `agent-pack/src/skills/` |
| Skill resources | 23 | `agent-pack/src/skills/*/resources/` |
| Components | 8 | `agent-pack/src/components/` |
