# Changelog

All notable changes to the published Unstoppable Stack packages are documented
here. This is the first public developer-preview release; versions below are the
initial published versions of each package.

The stack is a **beta**. APIs and scaffolds may change between minor versions.

## 2026-07-30 — Personal Node Beta Release Candidate

### `unstoppable-node` 0.5.0-beta.1

- Uses least-privilege grants and binds grants to the authenticated app session.
- Persists versioned configuration and settings exports with atomic, private
  file writes; rejects oversized, malformed, and future-version imports.
- Supports safe live settings restore without opening a second database over
  the running node's storage.
- Preserves app registration and reconnect behavior after transient failures.

### `@unstoppable-stack/node-client` 0.5.0-beta.1

- Requests only the grants an app needs and restores its authenticated session
  after reconnecting.
- Includes the declaration files required by TypeScript consumers.
- Reports pairing, permission, and availability failures with user-facing
  recovery guidance.

### Unstoppable Personal Node desktop 0.5.0-beta.1

- Moves the consumer desktop distribution to Electron Forge, with native macOS,
  Windows, and Linux installer targets and the Bare node runtime isolated in a
  sidecar process.
- Keeps Node.js out of the renderer, enables context isolation and sandboxing,
  denies renderer network access and webviews, and validates every IPC command.
- Serves renderer modules through a secure local protocol and hardens the
  packaged Electron executable with runtime fuses.
- Uses native file dialogs plus one-time main-process authorization for settings
  export and import paths.
- Pins QVAC SDK 0.15.0, prunes foreign native binaries, and verifies QVAC loads
  in the packaged Bare sidecar.
- Adds packaged-application smoke testing, runtime dependency inspection, and
  release artifact checksums.

### `@unstoppable-stack/cli` 0.4.0-beta.1

- Generated apps now use the 0.5 beta node client and its least-privilege,
  reconnect-capable integration.

### Beta limitations

- Device-to-device linking and account recovery are not included yet; pairing
  is currently app-to-node on the same user's devices.
- Settings export is not a complete backup of replicated application data.
- Real QVAC inference remains a gated test requiring a model source and must be
  validated before claiming production-grade local or remote inference.
- Public desktop artifacts must be code-signed and, on macOS, notarized by the
  approval-gated release workflow.

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
