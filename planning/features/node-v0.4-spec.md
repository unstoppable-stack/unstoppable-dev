# Unstoppable Node v0.4 — Implementation Spec

> Status: **in progress (16 of 20 features landed)** — see "Implementation status" below
> Audience: an engineer picking up the Node work cold
> Last updated: 2026-06-03
> Scope: turn the current local-only Node slice into a publishable, smoke-tested developer preview

## Implementation status (2026-06-03)

| ID | Feature | Status |
|----|---------|--------|
| F1 | Bare-runtime smoke test in CI | Done — `bin/headless.js` + `scripts/smoke.js` + `.github/workflows/node-smoke.yml` |
| F2 | Migrate off `Pear.worker.pipe()` | Done — `pear-pipe` in dashboard worker |
| F3 | Publish prep (no actual publish) | Done — exports map, files list, repo metadata, READMEs, gated `node-publish.yml`; `npm publish --dry-run` passes |
| F4 | Real-QVAC E2E test | Ready for manual validation — opt-in test + workflow added; needs confirmed model source |
| F5 | Discovery flakiness | Done — Node stress harness and headless/dashboard smoke pass 20/20 locally on default discovery topic |
| F6 | Per-app data browser | Done — `peekCore` / `peekDrive` + tabbed modal |
| F7 | Disk usage stats | Done — `getDiskUsage()` + per-app + total bytes |
| F8 | Live AI toggle | Done — `enableAI`/`disableAI` + dashboard button |
| F9 | Notifications | Done — pair-request desktop notifications, permission UI, pending-approval app badge, opt-in sound, and opt-in auto-restore landed |
| F10 | Device name in pair modal | Done — `os.hostname()` default, plumbed end-to-end |
| F11 | "auto-paired" badge + Promote | Done |
| F12a | Node config store + Settings UI | Partial — config store, daemon API, worker messages, editable dashboard form, and persisted-vs-live UI labels landed |
| F12 | Storage quotas | Done for v0.4 — global/default/per-app config, quota status, dashboard badges, per-app quota edits, and advisory pause enforcement landed |
| F13 | Export / import | Partial — JSON bundle for config, trust registry, paired app registry, dashboard export/import, dashboard confirmation, and CLI inspect landed |
| F14 | Per-app pause/resume | Done |
| F15 | `getNodeStatus()` + event | Done |
| F16 | Reconnect with backoff | Done — opt-in |
| F17 | Typed errors | Done — 6 subclasses with stable `.code` |
| F18 | `us node` subcommand | Done — start/status/stop, pid file, log tail |
| F19 | First-run welcome modal | Done — localStorage-gated + `?` button |
| F20 | System tray | Partial — Pear/Electron tray menu with Show/Pause All/Quit and close-to-tray on supported platforms landed; richer status menu/autostart deferred |

325 tests pass across 4 packages.
> Predecessor docs (read first, in order):
>   1. `planning/features/node.md` — concept
>   2. `planning/features/node-technical.md` — architecture
>   3. `planning/features/node-pairing-protocol.md` — wire protocol
>   4. `planning/features/node-capability-api.md` — generic capability-host direction
>   5. `planning/status/node/README.md` — phase tracker
>   6. `sandbox/node-demo/FINDINGS.md` — May 22 bug report (essential context — explains why we ship lessons)

---

## 1. Where things stand

### What ships today (v0.3.0)

| Area | Package | Status |
|------|---------|--------|
| Daemon | `packages/node/` | Pairing, data + drive replication, AI provider (mock + real QVAC), trust gate hook |
| Client SDK | `packages/node-client/` | `connectToNode`, `requireServices`, `requestInference` streaming, heartbeat |
| Dashboard | `packages/node-desktop/` | Pear Desktop app that embeds the daemon; status, paired apps, unpair, event log, **trust-on-first-use approval modal** work is present in the working tree but not yet committed |
| Generators | `packages/cli/` | `node-sync` feature flag on `node-cli`, `pear-desktop`, `expo-mobile` |
| Doctor | `packages/cli/src/commands/doctor.ts` | Detects `unstoppable-node` binary |
| Tests | `packages/node/test/` | 48 unit/integration tests under Node.js |

### What's NOT shipping today

- Nothing is on npm. Local consumption via `file:` links only.
- The trust gate UI work (`packages/node-desktop/lib/approval.js`, `packages/node-desktop/lib/registry.js`, modal in `app/index.js`, `approvePairing` callback in `NodeDaemon`) is **not a v0.4 feature**. Treat it as baseline work that must be landed first, then build v0.4 on top.
- AI provider has only been exercised in mock mode. Real QVAC model has not been end-to-end tested.
- Package versions are still `0.1.0`; v0.4 requires an explicit version bump/release pass before publish.

### Code map (cold-start reading order)

```
packages/node/src/
  index.js            CLI entry, flag parsing
  node.js             NodeDaemon — main service class
  registry.js         Hyperbee app registry
  replication.js      Corestore + Hyperdrive replication engine
  protocol.js         Wire protocol encoding + topic derivation
  ai-provider.js      QVAC integration (real + mock)

packages/node-client/src/
  index.js            connectToNode + NodeClient
  client.js           Hyperswarm dialer, nodeHello handshake, inference iterator
  protocol.js         Mirror of the daemon's wire protocol

packages/node-desktop/
  worker.js           Embeds NodeDaemon inside a Pear worker
  app/index.js        Renderer UI (status, event log, modal)
  app/bridge.js       pear-run wrapper for renderer ↔ worker
  lib/approval.js     ApprovalGate (TOFU trust)
  lib/registry.js     Persisted trust registry JSON

packages/cli/src/generators/
  node-cli.ts         CLI app scaffold (adds node-sync via NodeClient)
  pear-desktop.ts     Pear Desktop scaffold (worker connects to node)
  expo-mobile.ts      Bare worklet scaffold (worklet connects to node)
```

### Lessons from v0.3.0 (don't relearn these)

From `sandbox/node-demo/FINDINGS.md`:

1. **Bare ≠ Node.** Bare lacks `events`, `crypto`, `os`, and `process.env`. Use `bare-events`, `hypercore-crypto`, `bare-os`, `bare-env` — all already direct deps of `packages/node` and `packages/node-client`. Never re-introduce a vanilla `require('crypto')`.
2. **Discovery topic must match across runtimes.** `localDiscoveryTopic()` derives a SHA-style topic from `<USER>@<hostname>`. If Bare and Node disagree on either, the client can't find the daemon. Both sides now lazy-load `bare-os`/`bare-env` with fallbacks — keep it that way.
3. **`bridge.js` must forward `Pear.config.args`.** Otherwise `--ai-mock` / `--ai-model <src>` flags never reach the worker.
4. **CI didn't catch any of these.** Every existing test runs under Node.js. The Bare/Pear surface has zero automated coverage. **Fix this** (see F1).
5. **CSS attribute selectors and the cascade.** The May 27 modal-permanently-visible bug came from `.modal-backdrop { display: flex }` overriding the UA `[hidden] { display: none }` (same specificity → later wins). Always pair a `display` rule with an explicit `[hidden]` override. Already fixed in `app/index.js`; don't regress.

---

## 2. Non-goals for v0.4

To keep scope bounded, the following are explicitly **out**:

- Cloud-hosted node variant (Phase 4, separate project)
- Node-to-node sync across devices (Phase 4)
- Device-linking / multi-device identity (Phase 4)
- WDK / payment integration
- Browser-only client (the SDK targets Node + Bare/Pear)
- Cross-platform packaging beyond Pear's defaults (no Electron-Forge installer, no Linux .deb)

These belong in v0.5+. If a feature below feels like it overlaps with one of these, scope it down.

### Release gates versus backlog

This document intentionally lists more than the minimum v0.4 release. Use these labels when sequencing work:

| Label | Meaning |
|-------|---------|
| **Release gate** | Must land before tagging v0.4.0. If it slips, do not publish. |
| **Target** | Should land in v0.4 if it does not endanger the release gates. |
| **Stretch** | Useful backlog item; cut freely if the release is at risk. |

Tier 0 is all release-gate work. Tier 1 has a mix of targets and stretch items. Tiers 2-4 are mostly backlog unless explicitly called out in the definition of done.

---

## 3. Features (ordered by priority)

Each feature lists: **problem**, **acceptance criteria** (testable), **implementation notes**, **files**, **effort** (S / M / L).

### Tier 0 — Make it shippable

#### F1. Bare-runtime smoke test in CI

**Release label.** Release gate.

**Problem.** All existing tests run under Node.js. The Bare/Pear path is unexercised, which is how five separate bugs shipped in v0.3.0 (events, crypto, os, env, bridge args). The next regression will happen the moment someone touches `node.js`, `protocol.js`, `ai-provider.js`, or `bridge.js`.

**Acceptance criteria.**
- A new CI job (`.github/workflows/node-smoke.yml` preferred) installs the Bare/Pear runtime, boots the dashboard daemon path in headless mode with `--ai-mock`, waits for `services.ai = true` over the wire, runs `sandbox/node-demo/demo.js`, and asserts the demo's exit code is 0.
- The job runs on every PR that touches `packages/node/**`, `packages/node-client/**`, or `packages/node-desktop/**`.
- The job fails (red, not skipped) if any of: Bare/Pear can't install, the daemon emits `fatal`, the demo times out, or the demo's `requireServices: ['ai']` assertion fails.
- A `pnpm --filter unstoppable-node-desktop test:smoke` script reproduces the job locally. If the script lives in another package, document why and keep the command in this spec up to date.
- The smoke path exercises the same `NodeDaemon` construction path as the dashboard worker. No parallel test-only daemon bootstrap.

**Implementation notes.**
- Pear ships prebuilt binaries — installable via `npm i -g pear@latest` on GitHub Actions runners. Allow ~2 min for first-run bundle download.
- Headless: Pear Desktop opens a window, which CI doesn't have. Either (a) launch under `xvfb-run` (Linux), or (b) add a `--headless` flag to the dashboard that skips renderer init and runs only the worker. (b) is cleaner.
- For (b): make `worker.js` runnable as a standalone Bare entry. Move shared Bare logic into `lib/daemon-host.js` and import from both `worker.js` (Pear worker) and a new `bin/headless.js` (Bare CLI). Then CI just runs `bare bin/headless.js --ai-mock`.
- Prefer a deterministic timeout contract: daemon ready within 20 s, demo pair within 30 s, full job under 2 min after dependencies are installed. If these are too tight, document the measured timings in the PR.

**Files.**
- `packages/node-desktop/bin/headless.js` (new)
- `packages/node-desktop/lib/daemon-host.js` (new — extract from `worker.js`)
- `packages/node-desktop/package.json` (add `test:smoke` script + bare bin)
- `.github/workflows/cli.yml` or new `node-smoke.yml`

**Effort.** M (1-2 days). The headless extraction is the bulk; CI integration is straightforward.

---

#### F2. Migrate off deprecated `Pear.worker.pipe()`

**Release label.** Release gate.

**Problem.** `worker.js` still calls `Pear.worker.pipe()`, which prints a deprecation warning on every boot and is documented to be removed in a future Pear release.

**Acceptance criteria.**
- `worker.js` imports from `pear-pipe` directly: `import pipe from 'pear-pipe'`, then `const p = pipe()`.
- `bridge.js` imports from `pear-run` directly (it already does).
- Booting the dashboard prints no `[ DEPRECATED ]` lines.
- F1's smoke test still passes.

**Implementation notes.**
- See `reference-apps/qvac-workbench-desktop/workbench-worker/WorkerManager.ts` for the pattern — they already use `pear-pipe` indirectly via `await Pear.worker.pipe()`. Switching to direct import is a one-line change.
- Add `"pear-pipe": "^1.0.6"` to `packages/node-desktop/package.json` deps (currently transitive only).

**Files.**
- `packages/node-desktop/worker.js`
- `packages/node-desktop/package.json`

**Effort.** S (under an hour).

---

#### F3. Publish `unstoppable-node` and `@unstoppable/node-client` to npm

**Release label.** Release gate.

**Problem.** The packages are not on npm. Generators bake `file:`-style local links into scaffolded apps, which only works inside this monorepo. External adopters can't `npm install` either package.

**Acceptance criteria.**
- `unstoppable-node@0.4.0` is published to npm. `npm i -g unstoppable-node` installs a working `unstoppable-node` binary.
- `@unstoppable/node-client@0.4.0` is published to npm. `npm i @unstoppable/node-client` resolves in a fresh empty project.
- All three generators emit `"@unstoppable/node-client": "^0.4.0"` (or whatever the published version is) instead of `file:` links.
- The dashboard package's `unstoppable-node` dep stays as `file:../node` (monorepo internal), but the published version's version number tracks the npm version.
- README in each published package has install + quickstart sections that work copy-paste.
- Package metadata is release-ready: `version`, `license`, `repository`, `files`, `bin`, `exports`, and `publishConfig` are explicit for both packages.
- `npm pack --dry-run` for both packages contains only the intended runtime files and README/license metadata.

**Implementation notes.**
- Keep the daemon package name as `unstoppable-node` for v0.4 unless the npm name is unavailable. `@unstoppable/node-client` is already scoped; renaming the daemon can be revisited before a stable 1.0, but should not block this preview release.
- Use `npm publish --access public` for the scoped package.
- Set up `prepublishOnly` scripts that run the package test suite. F1 smoke should be a required GitHub check before tagging; do not make every local `npm publish --dry-run` require a GUI/runtime smoke unless the headless path is stable.
- Add `.github/workflows/release.yml` that publishes on git tag (`v0.4.0`, `v0.4.1`, ...). A release skill can come later; do not block v0.4 on tool-specific release automation.
- For the CLI: the binary entry `bin/unstoppable-node` should also work when installed via `npx unstoppable-node` without global install.
- Current package versions are `0.1.0`; update both package versions and generator fixtures in one PR to avoid mixed local/published behavior.

**Files.**
- `packages/node/package.json` (publishConfig, bin, files allowlist)
- `packages/node-client/package.json` (same)
- `packages/cli/src/generators/{node-cli,pear-desktop,expo-mobile}.ts` (swap `file:` for `^0.4.0`)
- `packages/cli/src/__tests__/__snapshots__/generators.snapshot.test.ts.snap` (regenerate)
- `.github/workflows/release.yml` (new)

**Effort.** M (1-2 days).

---

#### F4. Real-QVAC end-to-end test

**Release label.** Release gate for manual/nightly validation, not default PR CI.

**Problem.** `--ai-mock` is the only path that has been validated. We don't actually know whether `--ai-model <src>` works against a current `@qvac/sdk` release. The agent pack tells users to set this up; we'd better know it works.

**Acceptance criteria.**
- A new test under `packages/node/test/ai-provider-real.test.js` (skipped by default, runs with `RUN_QVAC_E2E=1` / `npm run test:qvac`) does:
  1. Boots a `NodeDaemon` with `{ ai: { modelSrc: '<small model>' } }`.
  2. Connects a client with `requireServices: ['ai']`.
  3. Streams a one-token inference.
  4. Asserts the token is non-empty text (not the mock placeholder).
- The test accepts an explicit `QVAC_MODEL_SRC` so validation can use a local path, preset, or URL without committing artifacts.
- Documented in `packages/node/README.md` and the agent pack `add-ai-chat` skill.
- A manual GitHub Actions workflow can run the test with an explicit model URL/path input. It must be possible to prove v0.4 against real QVAC without relying on a developer laptop.

**Implementation notes.**
- Don't add the real model test to the default CI matrix — model download is too heavy. Run nightly or on manual trigger.
- If the QVAC SDK API has changed since `0.11` (current pin), update `ai-provider.js` to match. Coordinate with the agent-pack `verified-versions.mdc` so user-facing recipes don't drift.
- If no redistributable model under 500 MB is available, keep the test opt-in with a documented `QVAC_MODEL_SRC` env var and record the tested model in `packages/node/README.md`. Do not commit model artifacts.

**Files.**
- `packages/node/test/ai-provider-real.test.js` (new)
- `packages/node/src/ai-provider.js` (possibly)
- `packages/node/README.md`
- `.github/workflows/node-qvac.yml` (new)

**Effort.** M (1 day if QVAC API is stable; L if it's drifted).

---

#### F5. Investigate + fix discovery flakiness

**Release label.** Release gate.

**Problem.** During the May 27 testing session, the demo client sometimes paired in 2 s and sometimes timed out after 30 s with `Node not found` — even though the dashboard was clearly running and reachable. The root cause is unclear.

**Acceptance criteria.**
- Run the demo client 20 times in a row against a long-lived dashboard. **All 20 pair within 5 seconds.** Document the test methodology in `sandbox/node-demo/README.md`.
- Document the actual failure mode (DHT propagation lag? swarm reuse? topic mismatch?) in `planning/features/node-pairing-protocol.md`.
- If the cause is DHT propagation, add an explicit "warming up" status to `localDiscoveryTopic` — daemon should advertise on boot and confirm the topic is observable on the DHT before emitting `ready`.
- The final fix includes a regression test or smoke assertion that would have failed under the observed flaky behavior. If a deterministic test is impossible, document that explicitly with the retry/run-count evidence.

**Implementation notes.**
- Likely culprits, in order of suspicion:
  1. The daemon joins the discovery topic with `server: true`, but the swarm hasn't fully propagated when the client starts looking. Hyperswarm's `flush()` waits for *announce* completion, not *lookup* propagation by peers.
  2. The client's `swarm.flush()` returns before any peer is found (it doesn't block until a candidate exists).
  3. Stale ephemeral peers from previous demo runs are being returned by the DHT.
- Start by adding verbose logging to `NodeClient.connect()` and the daemon's `_handleDiscoveryConnection` — log every `swarm.on('connection')`, `swarm.on('peer')`, and topic-join confirmation with timestamps.
- Compare a fast run (success) to a slow run (timeout) and find where time is being spent.

**Files.**
- `packages/node-client/src/client.js`
- `packages/node/src/node.js`
- `sandbox/node-demo/README.md` (new — capture the methodology)

**Effort.** M (could be S if the cause is obvious; L if it's a deep DHT issue).

---

### Tier 1 — Dashboard usability

#### F6. Per-app data browser

**Release label.** Target.

**Problem.** The dashboard shows that App X has 3 cores and 1 drive, but you can't see what's *in* them. For a user verifying their data is actually being replicated, this is the single most-requested missing thing.

**Acceptance criteria.**
- Clicking an app row in the Paired Apps list expands it to show:
  - For each Hyperbee/Hypercore: name, key (truncated), length, last 5 entries (key + JSON-stringified value, with a "show full value" expander)
  - For each Hyperdrive: name, key, total entries, recent files list with sizes
- All data is read-only.
- Updates live as the daemon replicates new entries (within 2 s of the daemon receiving them).
- A "Copy as JSON" button on each expanded section copies a structured dump for debugging.

**Implementation notes.**
- The daemon already has the corestore + bees opened. Add a new wire command from renderer → worker:
  - `{ type: 'inspect-app', appId }` → returns `{ cores: [{ name, key, length, recent: [...] }], drives: [...] }`
- For Hyperbees: `bee.createReadStream({ reverse: true, limit: 5 })`.
- For Hyperdrives: `drive.list('/').for-await` with a `.slice(0, N)`.
- Don't try to peek into raw Hypercores without a wrapping bee/drive — they're append-only blobs and the dashboard has no schema for them. Display just `length` + key.

**Files.**
- `packages/node/src/node.js` (add `getStatus` enhancement or new `inspectApp` method)
- `packages/node-desktop/worker.js` (new command case)
- `packages/node-desktop/app/index.js` (expand/collapse UI)
- `packages/node-desktop/lib/inspect.js` (new — bee/drive peek helpers; Bare-portable)
- `packages/node-desktop/test/inspect.test.js` (new)

**Effort.** M (1-2 days).

---

#### F7. Disk usage stats

**Release label.** Target.

**Problem.** Users have no idea how much disk their node is consuming. This is critical for the "I'd run this on a Raspberry Pi" pitch.

**Acceptance criteria.**
- Dashboard summary metrics gain a "Storage" tile showing total bytes used.
- Each paired-app row shows that app's disk contribution (sum of its cores + drives, on disk).
- Updates within 5 s of a write completing.
- The number matches `du -s` of the corestore directory within 10% margin (allow for filesystem overhead).

**Implementation notes.**
- Hypercores expose `byteLength` but that's the logical length, not on-disk. Use `bare-fs.stat` on each block storage file, OR sum `core.storage.byteLength` if Corestore exposes a sensible total.
- This is naturally a poll, not push — recompute on the 2-second status interval.
- Don't block the daemon on disk stats; do it async with a "stats are catching up" indicator if needed.

**Files.**
- `packages/node/src/replication.js` (add `getDiskUsage()`)
- `packages/node/src/node.js` (expose in `getStatus`)
- `packages/node-desktop/app/index.js` (new tile + per-row column)

**Effort.** M (1 day).

---

#### F8. Toggle AI on/off without relaunch

**Release label.** Target.

**Problem.** Today the only way to enable/disable the AI provider is to relaunch the daemon with/without `--ai`. The dashboard already has an "AI" service pill — make it interactive.

**Acceptance criteria.**
- Clicking the `ai` service pill while it's off opens a small dropdown: "Enable with mock provider" / "Enable with model: <select>".
- Clicking "enable" causes the daemon to spin up the AIProvider, advertise `services.ai = true` on the next handshake, and the pill flips green.
- Clicking the pill while it's on shows "Disable AI". Confirms, then the daemon tears down the provider and re-handshakes existing clients with `services.ai = false`.
- Clients currently mid-inference get an `inference-error` of `{ reason: 'provider shut down' }`; new inference calls fail with `AI provider not available`.
- The chosen model persists in the dashboard's config (next launch comes up with the same setting).

**Implementation notes.**
- `NodeDaemon` already has `start()` for AI; you need a `startAI(opts)` and `stopAI()` that:
  - Re-emit `nodeHello` to all connected sockets with the new `services` object so clients update their `client.services`.
  - Persist the choice to `<storage>/node-config.json` so the daemon comes up with it next boot.
- The "models available" list needs a source — for now hardcode the QVAC-tested models in `agent-pack/src/core/verified-versions.mdc`; later, a model registry.

**Files.**
- `packages/node/src/node.js` (`startAI` / `stopAI`)
- `packages/node/src/ai-provider.js` (already supports `close`)
- `packages/node-client/src/client.js` (handle re-handshake — update `this.services` and re-emit `nodeHello` event)
- `packages/node-desktop/worker.js` (new commands `enable-ai`, `disable-ai`)
- `packages/node-desktop/app/index.js` (interactive pill)

**Effort.** M (1-2 days).

---

#### F9. Pair-request notification

**Release label.** Stretch.

**Implementation status.** Done for v0.4: the dashboard can show browser/Electron desktop notifications for `pairAwaitingApproval` when `notifications.pairRequests` is enabled, Config exposes notification permission state plus a permission request button, supported desktop environments show a pending approval badge, opt-in generated sound is available through `notifications.pairRequestSound`, and best-effort window restore/focus is available through `notifications.pairRequestAutoRestore`.

**Problem.** If the dashboard window isn't focused (or is in another desktop), the pair-request modal appears silently. The user only finds out by checking the window.

**Acceptance criteria.**
- When a `pairAwaitingApproval` arrives:
  - The dashboard window's taskbar/dock icon flashes / bounces (OS-native attention).
  - A short notification sound plays (configurable; default off — opt-in via dashboard settings).
  - If the window is minimized, it auto-restores (configurable; default off).
- A "Don't show pair-request prompts" toggle in settings ALSO controls these (if pairings are auto-approved by some rule).

**Implementation notes.**
- Pear-electron wraps Electron. Electron has `app.dock.bounce()` (macOS) and `BrowserWindow.flashFrame(true)` (Windows/Linux). Both are available via the main process.
- Pear's renderer can call these through `Pear.electron` or via the IPC bridge — see `reference-apps/qvac-workbench-desktop/src/` for examples of dock/tray interaction.
- Sound: a short `.wav` in `app/assets/`, played via standard `<audio>` element.

**Files.**
- `packages/node-desktop/app/index.js` (notification logic, settings store)
- `packages/node-desktop/app/assets/pair-request.wav` (new)
- `packages/node-desktop/index.js` (Pear entry — may need to expose dock APIs)

**Effort.** M (1 day; cross-OS testing adds complexity).

---

#### F10. Show device name in pair modal

**Release label.** Target.

**Problem.** The pair modal shows `app id` + `app name` + `public key`. Two physical devices running the same app produce identical-looking pair requests. The user can't tell phone-from-laptop without checking the public key against something.

**Acceptance criteria.**
- The pairing protocol includes a `deviceName` field already (see `_handlePairRequest` in `node.js:208`). Surface it in the modal as a new row: `Device: my-laptop.local`.
- The client SDK auto-fills `deviceName` from `os.hostname()` (Bare and Node both supported via the existing `os` lazy-load pattern). Users can override via `connectToNode({ deviceName })`.
- If `deviceName` is missing or "unknown", show `Device: (not provided)` in dim text rather than hiding the row.

**Implementation notes.**
- The wire path already exists. This is purely a client-population + UI-rendering fix.
- Test with: same `appId` from two terminals (different processes) → modal differentiates them.

**Files.**
- `packages/node-client/src/client.js` (auto-populate `deviceName`)
- `packages/node-desktop/app/index.js` (new modal row)

**Effort.** S (a few hours).

---

#### F11. "Untrusted" badge wording

**Release label.** Target.

**Problem.** Currently the dashboard shows `trusted` (green) for keys the user approved, and `untrusted` (yellow) for keys that paired before the trust gate existed (legacy, no user gate). The yellow "untrusted" label is alarming and inaccurate — the daemon DID accept them, just before there was a UI to ask.

**Acceptance criteria.**
- Replace `untrusted` with `auto-paired` (neutral grey badge) for keys where the gate wasn't consulted.
- Add a tooltip explaining the distinction.
- Add a "Promote to trusted" action on `auto-paired` rows that writes an `approved` entry to the trust registry.

**Implementation notes.**
- One CSS change + one new wire command (`promote-trust`).

**Files.**
- `packages/node-desktop/app/index.js`
- `packages/node-desktop/worker.js`
- `packages/node-desktop/lib/approval.js` (add `promote(publicKey, info)` method)

**Effort.** S.

---

### Tier 2 — Node management

> Direction: v0.4 may keep the current concrete wire messages, but new config,
> permissions, and dashboard work should align with `node-capability-api.md`:
> the Node is a generic capability host, and data/files/AI are first
> capabilities rather than app-specific features.

#### F12a. Node config store + Settings UI

**Release label.** Target.

**Implementation status.** Partial: `node-config.json`, daemon `getConfig()` / `updateConfig()`, dashboard worker commands, and editable Config UI landed. Stored quota values are enforced by F12 advisory pause logic.

**Problem.** The dashboard now has a Config tab, but most node settings are still implicit launch flags or hardcoded behavior. Users should be able to inspect and change supported node configuration from the UI, with clear live-apply vs restart-required behavior.

**Acceptance criteria.**
- The daemon persists editable config at `<storage>/node-config.json`.
- Dashboard Config tab can read and update supported config keys without hand-editing files.
- Initial config keys include:
  - `ai.enabled`, `ai.mode` (`mock` or `qvac`), `ai.modelSrc`
  - `storage.globalQuotaBytes`, `storage.perAppQuotaBytes`
  - `pairing.requireApproval`, `pairing.autoApproveLocal`
  - `notifications.pairRequests`, `notifications.pairRequestSound`, `notifications.pairRequestAutoRestore`
  - `ui.showWelcome`
- Daemon exposes `getConfig()` and `updateConfig(patch)` methods.
- Worker supports `get-config` and `update-config` messages.
- Config updates validate before save; invalid updates return a structured error and do not partially write.
- Live-applicable settings apply immediately where possible: AI enable/disable/model choice, quotas, pairing policy, notification toggles.
- Restart-required settings are shown with a clear badge in the Config tab.
- Export/import (F13) includes `node-config.json`.

**Implementation notes.**
- Keep config JSON small and explicit. Do not persist derived status snapshots.
- Prefer one `packages/node/src/config.js` module with `loadConfig`, `saveConfig`, `validateConfig`, and `mergeConfigPatch` helpers.
- Dashboard should render the current config separately from live status. Status answers "what is running now"; config answers "what should run by default".
- Existing launch flags should seed config on first run but not silently overwrite user-edited config on later runs unless a flag is explicitly passed again.

**Files.**
- `packages/node/src/config.js` (new)
- `packages/node/src/node.js` (`getConfig`, `updateConfig`, live apply hooks)
- `packages/node-desktop/lib/daemon-host.js` (wire commands)
- `packages/node-desktop/app/index.js` (editable Config tab)
- `packages/node/test/config.test.js` (new)
- `packages/node-desktop/test/config-ui.test.js` or renderer-level test when harness exists

**Effort.** M.

---

#### F12. Storage quotas

**Release label.** Stretch.

**Implementation status.** Done for v0.4: daemon status includes `storage.quotas`, configured global/default/per-app limits pause over-quota app announcements, dashboard storage rows show quota state, paired-app rows allow per-app quota edits, and tests cover per-app advisory pause. Hard Corestore-level quota enforcement remains future work.

**Problem.** A misbehaving (or malicious) app could fill the node's disk by registering huge drives. The dashboard has no defense.

**Acceptance criteria.**
- Each paired app row shows a "Quota" with default `unlimited`. Click to edit → user enters a max in MB/GB.
- When an app's disk usage exceeds its quota:
  - New writes to its cores/drives are still accepted at the protocol level (we can't reach back inside Hyperbee replication), but the daemon stops *announcing* its discoveryKeys on the swarm, slowing further inbound replication.
  - The app row shows a red "Over quota" badge.
  - An event log entry is emitted (rate-limited to once per app per hour).
- A global quota (default `unlimited`) caps the sum across all apps.

**Implementation notes.**
- This is an *advisory* quota, not a hard limit. Honestly enforcing per-app quotas inside a shared Corestore would require per-app namespacing changes that we don't want to do in v0.4.
- Document this clearly in the UI tooltip so users don't expect hard enforcement.

**Files.**
- `packages/node/src/replication.js` (pause/resume announce based on quota)
- `packages/node/src/registry.js` (persist quota per app)
- `packages/node-desktop/app/index.js`

**Effort.** M.

---

#### F13. Export node state

**Release label.** Stretch.

**Implementation status.** Partial: CLI and dashboard can export/import a JSON `.uns` bundle containing node config, dashboard trust decisions, and paired app registry. Dashboard import now previews bundle metadata, app list, config presence, and trust counts before writing to storage; the CLI exposes the same read-only summary via `unstoppable-node inspect <backup.uns>`. Full encrypted Corestore archive and identity round-trip remain future work.

**Problem.** Users have no way to back up the node's identity + paired apps + AI config. If they lose their machine, they lose their P2P "router."

**Acceptance criteria.**
- A "Backup" button in dashboard settings produces an encrypted tar archive of: the corestore directory, the trust registry, and the node config. Password-protected with a user-supplied passphrase (PBKDF2 + AES-GCM via `hypercore-crypto`'s primitives or `sodium-native`).
- The CLI gains `unstoppable-node export <out.uns>` and `unstoppable-node import <in.uns>` commands.
- Round trip: `export` → wipe storage → `import` → daemon comes back up with the same identity, same paired apps, same AI config.

**Implementation notes.**
- The node's "identity" today is just whatever Corestore generates. After F3, consider deriving a stable identity from a seed and storing the seed in the export.

**Files.**
- `packages/node/src/export.js` (new)
- `packages/node/src/index.js` (CLI commands)
- `packages/node-desktop/app/index.js` (UI)
- `packages/node/test/export.test.js` (new)

**Effort.** L.

---

#### F14. Per-app pause/resume

**Release label.** Stretch.

**Problem.** Sometimes you want to stop replicating a specific app's data temporarily (e.g., huge app you're running out of space on) without unpairing it (which deletes everything).

**Acceptance criteria.**
- Each paired-app row gets a Pause/Resume button.
- Paused apps don't get new bytes replicated; they remain trusted; their data on disk is untouched.
- Resume restarts replication where it left off.
- Persists across daemon restart.

**Implementation notes.**
- Backed by leave/join on the discovery topic for that app's cores/drives. Don't delete anything.

**Files.**
- `packages/node/src/replication.js`
- `packages/node-desktop/worker.js`
- `packages/node-desktop/app/index.js`

**Effort.** S-M.

---

### Tier 3 — Client SDK extensions

#### F15. `client.getNodeStatus()` and richer events

**Release label.** Target.

**Problem.** Today an app that paired with a node can ask "are we connected?" and listen for `disconnected`. It can't query "how many peers does the node have? what's my replication progress? is the AI provider warming up a model?"

**Acceptance criteria.**
- New SDK method `client.getNodeStatus({ timeout = 5000 })` resolves with `{ services, apps, cores, drives, connectedPeers, aiState? }` — same shape as the dashboard's `status` snapshot, filtered to omit other apps' identifying data.
- New SDK event `client.on('nodeStatus', (status) => ...)` fires whenever the daemon emits a fresh status snapshot.
- The daemon gains a `requestStatus` wire message that returns the snapshot.

**Implementation notes.**
- Filter: an app should only see its own registered cores/drives, not other apps'. The daemon already has appId context per socket — use it.

**Files.**
- `packages/node/src/node.js` (handle `requestStatus`)
- `packages/node-client/src/client.js` (`getNodeStatus` + `nodeStatus` event)
- `packages/node-client/test/status.test.js` (new)

**Effort.** S-M.

---

#### F16. Reconnect with backoff

**Release label.** Target.

**Problem.** The SDK reports `disconnected` and then... that's it. Apps have to reimplement reconnect themselves.

**Acceptance criteria.**
- New `connectToNode` option `reconnect: true` (default `false`, opt-in to avoid behavior change in 0.4.x).
- When enabled: on disconnect, retry every `2^attempt × 250 ms` capped at 30 s. Emit `reconnecting` event per attempt. Emit `reconnected` when successful, `connected` is *not* re-fired (existing semantics).
- Reconnect respects the original `requireServices` constraint — if the node comes back without the required service, the client emits `serviceLost` and stops trying.

**Files.**
- `packages/node-client/src/client.js`
- `packages/node-client/test/reconnect.test.js` (new)

**Effort.** M.

---

#### F17. Typed errors

**Release label.** Target.

**Problem.** Today the SDK rejects with `new Error('Node not found...')`, `new Error('Node denied pair: ...')`, `new Error('Required services missing...')`. Callers can only `try/catch` and string-match.

**Acceptance criteria.**
- Export named error classes: `NodeNotFoundError`, `PairingDeniedError`, `RequiredServiceMissingError`, `InferenceError`, `NodeDisconnectedError`. All extend a base `NodeClientError`.
- Each has structured fields (e.g., `PairingDeniedError.reason`, `RequiredServiceMissingError.missing: ['ai']`).
- Existing string error messages are preserved verbatim (for backwards compat).
- Documented in `packages/node-client/README.md` with TS-style type hints (or actual `.d.ts` if we're ready).

**Files.**
- `packages/node-client/src/errors.js` (new)
- `packages/node-client/src/client.js`
- `packages/node-client/src/index.js` (re-export)

**Effort.** S.

---

### Tier 4 — Discoverability & DX

#### F18. `us node` subcommand

**Release label.** Target for `start` + `status`; stretch for `logs` + `stop`.

**Problem.** Right now the user has two ways to interact: `unstoppable-node` (the daemon binary) and `pear run packages/node-desktop` (the dashboard). Neither is discoverable from the `us` CLI. The agent pack's setup guides have to teach both.

**Acceptance criteria.**
- New CLI: `us node start [--ai | --ai-mock | --ai-model <src>] [--headless]` — boots the daemon. With `--headless`, runs the binary; without, launches the dashboard if Pear is installed (else falls back to binary with a hint).
- `us node status` — connects to the local node, prints status JSON.
- `us node logs` — tails the daemon's log file (location TBD; for now stdout from the binary).
- `us node stop` — kills the daemon.
- `us doctor` already mentions the node; have it suggest `us node start` if not running.

**Implementation notes.**
- This is wrapping, not reimplementing. The CLI should `spawn(...)` the existing binary or `pear run`, and `getNodeStatus` for `status`.
- Do not let `logs` or `stop` block v0.4 if they slow other work. `start` and `status` are the useful minimum.

**Files.**
- `packages/cli/src/commands/node.ts` (new)
- `packages/cli/src/us.ts`
- `packages/cli/src/commands/doctor.ts` (hint)
- `packages/cli/src/__tests__/node-command.test.ts` (new)

**Effort.** M.

---

#### F19. First-run experience for the dashboard

**Release label.** Stretch.

**Problem.** New user opens the dashboard, sees an empty Paired Apps list and an event log, and… now what? There's no guidance on what to do next or any sense of the dashboard's purpose.

**Acceptance criteria.**
- On first launch (detected by absence of `<storage>/onboarded.json`), show a 3-step welcome modal:
  1. "Your personal P2P sync node is running" — explain the role
  2. "Generate a backup key" — copy/save a passphrase that protects exports (F13 setup)
  3. "Scaffold an app to connect" — copy a `us scaffold app -p node-cli -n my-app -f node-sync` snippet
- "Don't show again" closes and writes `onboarded.json`.
- A "Show welcome" link in settings re-opens it.

**Files.**
- `packages/node-desktop/app/index.js` (modal flow — reuse the `.modal-backdrop[hidden]` pattern from the pair modal)
- `packages/node-desktop/lib/onboarding.js` (new)

**Effort.** S-M.

---

#### F20. System-tray / minimize-to-tray

**Release label.** Stretch.

**Problem.** A node is a background service. Forcing the user to leave the dashboard window open feels wrong.

**Acceptance criteria.**
- Dashboard runs as a tray app. Closing the window minimizes to tray; quit requires explicit "Quit" from the tray menu.
- Tray icon shows: green dot when running, red on fatal, yellow when paused/quota-exceeded.
- Tray menu: Open Dashboard, Pause All, Quit.
- Settings option to "Launch on login" (uses OS-native autostart; only macOS + Linux for v0.4, Windows in v0.5).

**Implementation notes.**
- Electron-native — see `Tray` and `Menu` from Electron. Pear-electron exposes these.
- macOS auto-start: `app.setLoginItemSettings({ openAtLogin: true })`.
- Linux auto-start: write a `.desktop` file to `~/.config/autostart/`.

**Files.**
- `packages/node-desktop/index.js`
- `packages/node-desktop/lib/tray.js` (new)
- `packages/node-desktop/lib/autostart.js` (new)

**Effort.** M-L (cross-platform fiddling is the time sink).

---

## 4. Testing strategy

| Layer | Today | Add in v0.4 |
|-------|-------|-------------|
| Unit (Node.js) | 48 tests for daemon + 14 for dashboard libs | +tests for each new feature; aim ≥80% line coverage on `node/src` |
| Integration (Node.js, network) | `pairing.test.js`, `replication.test.js`, `approval-gate-integration.test.js` | +tests for: status snapshot filtering (F15), reconnect (F16), quota (F12) |
| **Bare/Pear smoke** | **0** (this is the gap) | **F1 — at least one CI job that boots Pear** |
| End-to-end | `sandbox/node-demo/demo.js` (manual) | Convert to a CI fixture |
| Real-model | None | F4 — nightly |

The single most important addition is F1 — without it, the next reorganization will reintroduce one of the May 22 bugs.

---

## 5. Suggested execution order

1. **Land the trust-gate baseline work** as `feat(node-desktop): trust-on-first-use approval modal`. Squash any leftover debug scaffolding from May 27 (verify by `git diff`). This is prerequisite to everything else and should not be mixed with v0.4 feature work.
2. **F1 + F2** — establish the safety net before adding features.
3. **F3 preparation** — fix package metadata, README quickstarts, generator dependency strings, and release workflow. Do the actual npm publish only after F1-F5 are green.
4. **F5 + F4** — kill the flakiness while the surface area is small.
5. **F10, F11, F8** — high-value, low-effort dashboard polish.
6. **F6, F7** — the "I can see what's going on" features that turn this from a daemon into a tool.
7. **F15, F16, F17** — SDK ergonomics. Pair with whichever agent-pack skill consumes them.
8. **F12, F13, F14** — node management.
9. **F18, F19, F20** — discoverability polish.

Estimated total effort: **6-9 dev days** for release gates, **8-12 dev days** for release gates plus Tier 1 targets, another **5-7** for the remaining stretch/backlog items.

---

## 6. Open questions for the implementer

- **Identity model.** Today the node's identity is wherever Corestore happened to land. F13 (export) implicitly proposes a stable seed. Should we formalize this *now* (and have v0.4 nodes adopt the new format) or defer to v0.5 alongside multi-device? Recommended: defer.
- **Authentication beyond TOFU.** The trust gate is trust-on-first-use. A more sophisticated model (e.g., "only accept apps signed by my agent-pack key") may be needed once we have device linking. v0.4 stays with TOFU.
- **Should `unstoppable-node` and the dashboard be the same binary?** Today they're separate (`packages/node/` daemon vs `packages/node-desktop/` Pear app). F1 proposes a `bin/headless.js` in the dashboard package. After F1, consider merging the two — dashboard becomes the default, `--headless` is the CLI mode. Probably yes; defer the decision to after F1 ships and we see how the headless path feels.
- **Telemetry.** Should the node optionally phone home with usage stats (peer count distribution, AI usage)? Not for v0.4 — too much opt-in/privacy paperwork. Note as a v0.5+ idea.

---

## 7. Definition of done for v0.4

- Trust-gate baseline work is committed and covered by tests.
- All release gates complete: F1-F5.
- Target dashboard work complete unless explicitly cut in a release note: F6, F7, F8, F10, F11.
- SDK target work complete unless explicitly cut in a release note: F15-F17.
- F18 (`us node`) includes at minimum the `start` and `status` subcommands.
- Published to npm.
- README + agent pack updated.
- F1 smoke test green on `main`.
- A new entry in `planning/status/node/README.md` "Recently Completed" with the v0.4 summary.
