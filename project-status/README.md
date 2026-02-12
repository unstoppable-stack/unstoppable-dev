# Project Status — The Unstoppable Stack

> **Last updated:** 2026-02-10

---

## Workstreams

| # | Workstream | Folder | Status Summary |
|---|-----------|--------|----------------|
| 1 | [Agent Pack Content](./01-agent-pack-content/) | Knowledge by category | 39% battle-tested, 31% docs-only, 30% not covered |
| 2 | [Agent Pack Architecture](./02-agent-pack-architecture/) | Skill system, builders | Skills exist, no auto-activation yet |
| 3 | [Unstoppable Vault](./03-unstoppable-vault/) | Pear desktop sync app | Planning done, no code yet |
| 4 | [Website](./04-website/) | unstoppable.dev | Scaffolded, needs polish |

---

## Coverage Summary (from Roadmap)

| Category | Battle-tested | Docs only | Not covered | Total |
|----------|--------------|-----------|-------------|-------|
| Platform / Runtime | 3 | 0 | 6 | 9 |
| QVAC (Local AI) | 6 | 10 | 1 | 17 |
| P2P & Data | 7 | 7 | 1 | 15 |
| WDK (Payments) | 0 | 0 | 6 | 6 |
| Build Tooling | 5 | 0 | 2 | 7 |
| **Total** | **21** | **17** | **16** | **54** |

---

## Priority Order

The primary goal is making the agent pack able to **build apps on all platforms**,
starting with mobile. Capabilities (more QVAC features, more P2P modules) come after.

| Priority | What | Why | Workstreams |
|----------|------|-----|-------------|
| **1 — CRITICAL** | Mobile support (Expo Bare) | Platform gap — can't build mobile apps at all | Content/Platform |
| **2 — HIGH** | Build Vault Phase 1 | Validates 7 items at once (Corestore, Hyperdrive, etc.) | Vault, Content |
| **3 — MEDIUM** | QVAC capabilities (Vision, RAG, Transcription) | Extends what apps can do | Content/QVAC |
| **4 — MEDIUM** | P2P advanced (HyperDB, SecretStream) | Enables collaborative + secure apps | Content/P2P |
| **5 — MEDIUM** | Website polish | Public face | Website |
| **6 — MEDIUM** | Agent pack auto-activation + tooling | Better DX for scaffolded projects | Architecture |
| **7 — LOW** | WDK / Payments | Depends on WDK SDK maturity | Content/WDK |

---

## Conventions

- Keep "Next Up" to **3-5 tasks** per file
- Effort estimates: **Small** (hours) / **Medium** (1-2 days) / **Large** (3+ days)
- Date format: `YYYY-MM-DD`
- After completing a task: move to "Recently Completed" with date, add follow-up
