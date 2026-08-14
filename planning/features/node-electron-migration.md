# Personal Node Electron Migration

> Status: installer foundation and approval-gated signing CI implemented;
> production AI validation remains a release gate
> Updated: 2026-07-31

## Decision

Use Electron as the default desktop distribution shell and retain Pear as a
temporary compatibility path. Keep `NodeDaemon` in a separate Bare process so
Electron main never becomes the P2P, storage, or inference runtime.

This follows the current QVAC desktop boundary without copying its much larger
application framework: renderer → isolated preload → Electron main → Bare
sidecar. The Personal Node keeps its existing NDJSON host protocol because that
protocol is already covered and maps directly to dashboard events and commands.

## Implemented

- Electron main process with single-instance, close-to-tray, safe external
  navigation, renderer event buffering, and bounded shutdown.
- Sandboxed renderer with `nodeIntegration: false`, `contextIsolation: true`,
  a narrow `contextBridge`, command allowlisting, and a 64 KiB IPC limit.
- Secure, standard custom application protocol with strict origin and path
  containment, allowing ES modules without weakening Chromium web security.
- Shared renderer and daemon adapters so Electron and Pear use the same UI and
  `NodeDaemon` host.
- `bare-sidecar` process for the real daemon plus Bare-compatible filesystem
  and path access in `unstoppable-node`.
- Electron Forge packaging for macOS DMG/ZIP, Windows Squirrel setup, and Linux
  Debian packages.
- Packaging hook that replaces the monorepo `file:` symlink with a real package
  copy and direct runtime dependencies so installers are self-contained, then
  removes native binaries for foreign platforms.
- Electron Fuse hardening plus artifact inspection that reads the actual fuse
  wire, verifies pinned QVAC, rejects known build-only packages in the runtime,
  and caps unpacked size to catch prebuild regressions.
- Unit, IPC-policy, real sidecar transport, packaging-contract, and gated
  real-daemon sidecar tests.

## Verified Locally

- Desktop tests: 39 passed, 1 gated integration test skipped by default.
- Real Bare daemon sidecar integration: passed with
  `RUN_ELECTRON_SIDECAR_E2E=1`.
- Node package regression suite: 88 passed, 1 real-model test skipped.
- macOS arm64 package and makers: passed.
- macOS ARM64 packaging removed 507 foreign native prebuilds and reduced the app
  from 6.7 GB to about 709 MB on disk.
- Packaged executable emitted `PERSONAL_NODE_QVAC_READY 0.15.0` and
  `PERSONAL_NODE_SMOKE_READY` with a valid node key.
- npm audits are clean for node, node-client, and CLI. Desktop audit findings
  are confined to build dependencies and absent from the verified runtime.

## Release Gates

1. Add final `.icns`, `.ico`, tray, and installer artwork.
2. Run the macOS signing/notarization and Windows code-signing workflow with
   production credentials and archive the passing artifacts.
3. Decide whether Windows v1 ships Squirrel setup or adds the QVAC-style MSIX
   pipeline; test on a real Windows runner.
4. Add AppImage/Flatpak if Debian packaging is not sufficient for Linux users.
5. Validate a real production model completion on macOS, Windows, and Linux.
   QVAC 0.15.0 is pinned and loads inside the packaged Bare sidecar, while the
   real-model test remains opt-in pending an approved model source.
6. Add an updater only after signed artifact publishing and rollback policy are
   defined.
7. Run install/uninstall, first-run, tray, sleep/wake, offline, and upgrade tests
   on clean macOS, Windows, and Linux machines.
8. Resolve or approve the documented desktop build-tool audit exception. npm
   reports 40 findings in Electron Forge and its transitive build tools, with no
   safe available fix; artifact verification confirms those packages do not ship.

Do not remove the Pear scripts until the signed Electron builds have completed
at least one release cycle without data-path or daemon-lifecycle regressions.
