# Changelog

All notable changes to the published Unstoppable Stack packages are documented
here. This is the first public developer-preview release; versions below are the
initial published versions of each package.

The stack is a **developer preview**. APIs and scaffolds may change between
minor versions.

## 2026-06 — Developer Preview

### `@unstoppable-stack/cli` 0.3.0

First public release of the `us` CLI (shipped as the `minimal` build profile).

**Commands**

- `us init [project-name]` — interactive project setup with AI-assistant
  configuration (Claude Code, Cursor, OpenCode, Codex, or none). Writes
  portable agent-pack instructions into the new project.
- `us scaffold` — scaffold platform-specific apps and components. Platforms:
  - `pear-desktop` — P2P desktop app with worker bridge + HTML UI.
  - `expo-mobile` — iOS/Android with a Bare worklet for native P2P.
  - `node-cli` — P2P-enabled command-line tool.
  - `us scaffold list-platforms` / `list-features` to discover options.
- `us doctor` — check the local development environment; `-p <platform>` for
  platform-specific checks.
- `us node` — run and inspect the local Unstoppable Node daemon (see below).

**Build & packaging**

- Ships the audited `minimal` command surface by default. `remote`, `research`,
  `search`, and `memory` surfaces are excluded from the published build via
  build-time feature flags and dead-code elimination.
- `us --version` now reports `<version> (<profile>)`, with the version injected
  from `package.json` at build time so it can no longer drift.

### `unstoppable-node` 0.4.0

First public release of the personal sync node — a headless daemon that
replicates, backs up, and seeds your P2P data.

- Headless daemon with a `us node` control surface.
- TOFU (trust-on-first-use) pairing approval for connecting apps.
- Status RPC, automatic reconnect, and disk-usage reporting.
- Live local-AI (QVAC) toggle, per-app pause/resume, and data peek.
- Advisory per-app storage quotas and app AI-grant enforcement.
- JSON state export and backup inspection.

> Real-QVAC end-to-end validation is a documented external blocker pending
> `QVAC_MODEL_SRC`; it is not a publish gate for this preview.

### `@unstoppable-stack/node-client` 0.4.0

First public release of the client library apps use to connect to the
Unstoppable Node for data replication and sync, with typed error handling.

### Documentation

- New multi-page docs site with `/llms.txt` and `/llms-full.txt` exports for
  AI assistants.
- Getting Started scaffold path switch (manual vs. agent-driven).

### Not in this release

- **Unstoppable Memory** (`@unstoppable/memory*` packages and `us memory`) is
  excluded from this release pending end-to-end validation and a security pass.
  It is planned as a separate v0.1 preview. See
  `planning/status/release-plan-2026-06-12.md`.
- WDK/payments remain out of scope.
