# Unstoppable Node Desktop

Electron-first desktop home for a user's **Personal Node**. It runs the same daemon as
`unstoppable-node`, with a control panel intended to make protection and local
AI understandable without requiring protocol knowledge:

- See which apps are protected and whether protection is active or paused
- Review each app's storage use and choose a human-readable storage limit
- Allow or block AI access per app and turn local AI on or off globally
- Inspect technical details only when needed
- Remove apps that should no longer connect
- Use the system tray menu to show or quit the dashboard

## Running

```bash
# One-time install
cd packages/node-desktop
npm install

# Launch the Electron dashboard (CLI daemon can be stopped first)
npm run dev

# Keep testing the legacy Pear shell during the migration
npm run dev:pear
```

The dashboard binds to the same machine-local discovery topic as
`unstoppable-node`, so apps on this computer connect without setup. Discovery
across a phone or second computer requires an explicit shared topic; a safe
end-user device-linking flow is not implemented yet.

The tray menu exposes Show,
Pause All, Resume All, and Quit actions. Closing the dashboard hides it to the tray on supported desktop
platforms. The app is single-instance: launching it again restores the existing
dashboard instead of starting a second node against the same storage.

When app approvals are pending, supported desktop environments show an app
badge with the pending request count. Advanced settings can enable a short generated
sound and best-effort window restore for pair requests; both are off by default.

## Flags

Electron and Pear both forward these daemon flags:

- `--ai` — load a real QVAC model and advertise `services.ai = true`
- `--ai-mock` — echo-mode AI provider, useful for UI development
- `--ai-model <source>` — choose the QVAC model preset, path, or URL

Real QVAC mode uses the pinned `@qvac/sdk` 0.15.0 release dependency. Package
tests verify that its API loads in the installed Bare sidecar; validating an
actual production model on each platform remains a stable-release gate.

## Installers

Electron Forge produces native artifacts while Pear remains available as a
fallback during the transition:

```bash
npm run package:electron  # unpacked app for the current platform
npm run make:mac          # DMG + ZIP (run on macOS)
npm run make:windows      # Squirrel setup executable (run on Windows)
npm run make:linux        # Debian package (run on Linux)
```

Artifacts are written under `out/make/`. The package hook replaces npm's local
monorepo symlink with a real copy of `unstoppable-node`, so an installed app is
self-contained. It also keeps only native prebuilds for the target platform;
the macOS ARM64 package dropped from 6.7 GB to about 709 MB on disk.

Development builds are unsigned. Public candidates are built only by the
approval-gated **Personal Node Desktop Release** workflow. It signs and
notarizes the macOS app, signs the Windows installer, builds the Debian package,
runs each packaged executable, verifies signatures, and publishes checksummed
workflow artifacts.

Configure the `desktop-release` GitHub environment with required reviewers and
these secrets:

- macOS: `APPLE_DISTRIBUTION_CERTIFICATE` (base64 PKCS#12),
  `APPLE_P12_PASSWORD`, `APPLE_KEYCHAIN_PASSWORD`,
  `MACOS_SIGNING_IDENTITY`, `APPLE_ID`, `APPLE_ID_PASSWORD`, and
  `APPLE_TEAM_ID`.
- Windows: `WINDOWS_CERTIFICATE_BASE64` (base64 PFX) and
  `WINDOWS_CERTIFICATE_PASSWORD`.

The workflow intentionally fails when signing credentials are absent. Branded
`.icns`/`.ico` assets, MSIX/AppImage variants, automatic updates, and rollback
infrastructure are post-beta distribution improvements rather than requirements
for the first signed beta.

Also protect the `qvac-validation` environment with required reviewers. The
manual **Node Real QVAC** workflow uses it to test the pinned SDK and one
approved model source across macOS, Windows, and Linux before stable promotion.

The candidate checklist and stable promotion gates are tracked in
[`planning/status/node/release-readiness-0.5-beta.md`](../../planning/status/node/release-readiness-0.5-beta.md).

## Smoke Testing

```bash
npm run test:smoke
NODE_SMOKE_RUNS=20 NODE_SMOKE_TOPIC=default BARE_BIN=node npm run test:smoke
RUN_ELECTRON_SIDECAR_E2E=1 npm test
npm run package:electron
npm run test:packaged-runtime
npm run test:packaged
```

`NODE_SMOKE_TOPIC=isolated` is the default and injects a fresh topic for CI.
`NODE_SMOKE_TOPIC=default` leaves `UNSTOPPABLE_NODE_TOPIC` unset so the headless
daemon and demo client use the real machine-local discovery topic.

## Architecture

```
┌─ Electron or Pear desktop shell ────────────────┐
│                                                 │
│  ┌─ Renderer (index.html + app/index.js) ─┐    │
│  │                                        │    │
│  │  Live status UI, paired apps, log view │    │
│  │                                        │    │
│  └────────────────┬───────────────────────┘    │
│       contextBridge IPC (Electron) / Pear pipe  │
│  ┌────────────────┴───────────────────────┐    │
│  │ Electron main: allowlist + lifecycle   │    │
│  └────────────────┬───────────────────────┘    │
│                   │ bare-sidecar NDJSON          │
│  ┌────────────────┴───────────────────────┐    │
│  │                                        │    │
│  │  Bare worker (worker.js)               │    │
│  │  ┌────────────────────────────────┐    │    │
│  │  │ NodeDaemon (from packages/node)│    │    │
│  │  │  - Corestore                   │    │    │
│  │  │  - Hyperswarm (discovery)      │    │    │
│  │  │  - Hyperswarm (replication)    │    │    │
│  │  │  - AIProvider (optional)       │    │    │
│  │  └────────────────────────────────┘    │    │
│  └────────────────────────────────────────┘    │
└─────────────────────────────────────────────────┘
```

The Bare worker embeds `NodeDaemon` directly and forwards its events (plus a
periodic status snapshot) to the renderer over a newline-delimited JSON
pipe. UI commands (`unpair`, `refresh-status`, `shutdown`, config updates,
quota changes, backup/import, and trust decisions) travel back
the same way.

The Electron renderer has no Node.js access. `contextIsolation` and renderer
sandboxing are enabled, navigation/popups are denied or opened externally, and
only known daemon commands under 64 KiB cross the preload IPC boundary. The
renderer is served through a secure, path-contained local protocol. Package-time
Electron fuses disable RunAsNode, `NODE_OPTIONS`, CLI inspection, and extra
`file://` privileges; the artifact verifier reads those settings from the
actual executable. The
main process contains no P2P or inference implementation; it owns only window,
tray, IPC, and worker lifecycle.

## Status

- Phase 1 (the basics) ✓
  - Protected-app list with plain-language state and expandable technical details
  - Permission modal with least-privilege capability summaries
  - Advanced settings, AI controls, storage limits, settings export/import, tray menu
- Electron installer milestone ✓
  - Secure preload bridge and command allowlist
  - Bare sidecar lifecycle with real-daemon integration coverage
  - DMG/ZIP, Windows setup, and Debian maker configuration
  - Approval-gated signing/notarization workflow and packaged-app smoke tests
  - Pinned QVAC SDK, target-native pruning, fuse checks, and runtime inspection
  - Pear fallback preserved during rollout
- Phase 2 (future)
  - QR/device-code linking for phones and additional computers
  - Encrypted app-data backup, restore, retention, and delete controls
  - Graphs for bandwidth and replication progress
  - Richer model picker UI for QVAC provider
  - Updater, branded installer assets, more installer formats, and real-model QVAC validation
