# Changelog

Notable package changes are documented here. Some entries describe source
candidates or earlier package lines rather than artifacts that are currently
approved for the next public preview. See [SUPPORT.md](./SUPPORT.md) for scope
and [validation and release checks](./docs/validation.md) for acceptance gates.

The stack is a **beta**. APIs and scaffolds may change between minor versions.

## Unreleased — Personal Node experience

- Add Simple Home, an Advanced view switch, readable saved-data cards, and the
  Notebook + Briefing ecosystem source example with desktop acceptance checks.
- Add Personal Node architecture, integration guidance, and examples to the
  website. Personal Node remains experimental; full backup/recovery is unfinished.

## CLI 0.4.0-beta.3 — 20 October 2026

- Publish assistant plugin setup commands and matching website guides.
- Record fresh registry acceptance for CLI beta.3 and P2P 0.6.0-alpha.2 in
  [the publication evidence](release/registry-acceptance-2026-10-20-beta3.json).
  Personal Node packages remain outside the publication allowlist.

## CLI 0.4.0-beta.2 / P2P 0.6.0-alpha.2 — prior changes

- Fix concurrent identity/invite updates, runtime ownership, startup/close races,
  bounded handshakes, RPC execution/cancellation and sync manifest replacement.
- Add optional typed `/rpc` contracts, runtime schemas, inferred clients and
  TypeScript declarations without requiring a validator library.
- Add the experimental `/db` Autobase adapter with deterministic application
  views, offline writes and founder-controlled writer admission/removal.
- Update Local Goods to scoped receipt RPC with a private local cart. Add typed
  notes calls and a collaborative database example with restart/convergence tests.
- Expand website package guides and runnable examples; distinguish published
  beta.1/alpha.1 from these source candidates. Pin plugin installer metadata
  independently of the advancing source version; rebuild plugin preview 0.1.4.
- Keep optional Personal Node and Desktop source versions aligned at
  0.6.0-alpha.2 for their existing release gate. They remain deferred and excluded
  from the canonical CLI/P2P publication allowlist.

The current published preview is CLI beta.3 and P2P alpha.2; see
[the release guide](docs/public-release.md) for the verified install path.

## Unreleased — package consolidation (16 October 2026)

- Merge unpublished `node-core` and `node-caps-sync` into
  `@unstoppable-stack/p2p`, with replication exported from `/sync`.
- Move `node-caps-ai` into Personal Node's internal `src/ai/` adapter; use QVAC
  upstream directly and retain private generated-app lifecycle helpers.
- Update generators, compatibility profile revisions, assistant guidance,
  consumer dependencies and CI for the consolidated library.
- Mark internal guidance and excluded Memory packages private. Memory and Search
  remain outside the release; existing source and internal tools are retained.
- Stage P2P/Node release tarballs without filesystem dependencies and test them
  through an isolated installed consumer before publishing.
- Await P2P listener readiness before advertising readiness to callers.
- Serialize peer-registry writes and wait for pairing persistence during
  shutdown; catch asynchronous message failures.
- Add a direct P2P notes consumer that verifies scoped calls, real replication
  and offline replica restart from the installed package.
- Prepare the canonical CLI beta and P2P alpha through an explicit allowlist,
  exact-artifact consumer tests, production audits, npm dry runs and a manual
  publishing workflow. Build Claude/Codex plugin downloads separately.

These are source changes, not published releases. Published CLI `0.3.0` and Node
`0.4.0` are unchanged. See [migration notes](docs/package-architecture.md).

## 2026-08-18 — Node as a Library

The Personal Node stops being a product with a client SDK and becomes a
runtime any app can embed. An app can now *be* a node: hold a stable
identity, host capabilities, and pair directly with other apps.

### `@unstoppable-stack/node-core` 0.6.0-alpha.1

- New. One symmetric runtime: `listen()` accepts pair requests, while
  `connect()`, `discover()`, `pair()` and `joinNetwork()` reach a peer. A
  process may do either or both.
- Capability packs, where unary methods are async functions and streaming
  methods are async generators; cancellation and multiplexing come from the bus.
- Per-direction grants, checked before method resolution so an ungranted peer
  cannot enumerate what a node hosts.
- Persisted ed25519 identity, so a node keeps its public key across restarts.
- Invite codes for first contact across devices, and named app networks for
  many-peer meshes.
- Carries no storage stack: an app that only wants app-to-app RPC installs no
  Hypercore dependencies.

### `@unstoppable-stack/node-caps-sync` 0.6.0-alpha.1

- New. Data and file replication as a capability pack, scoped per peer.

### `@unstoppable-stack/node-caps-ai` 0.6.0-alpha.1

- New. Delegated local inference as a capability pack, with a runtime toggle.

### `unstoppable-node` 0.6.0-alpha.1

- Recomposed on `node-core` plus the sync and ai packs. The daemon, its
  registry, replication engine, AI provider and protocol module are gone.
- Peers are keyed by public key, so two devices running one app are two peers
  rather than one colliding record. Quotas follow, and node config migrates to
  v2 (`storage.perAppQuotaBytes` becomes `perPeerQuotaBytes`).
- `us node invite` mints pairing codes.

### `@unstoppable-stack/node-client` — discontinued

- Removed. Its role is one of `node-core`'s two verbs. Apps that used
  `connectToNode()` should call `createNode()` and then `discover()`.

**Breaking:** wire protocol v2 with no v1 compatibility path. Existing 0.5
installs re-pair.

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
  It is planned as a separate v0.1 preview.
- WDK/payments remain out of scope.
