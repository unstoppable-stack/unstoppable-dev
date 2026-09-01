# Personal Node 0.5 Release Readiness

> Updated: 2026-07-31
> Candidate: `unstoppable-node`, `@unstoppable-stack/node-client`, and desktop
> `0.5.0-beta.1`; CLI `0.4.0-beta.1`

## Release decision

The code is ready to enter a signed **beta candidate** lane. It is not yet an
honest stable release: production signing has not run, inference with a real
model has not been proven on every architecture, and the current product does
not provide device linking or app-data deletion/recovery.

Do not remove the prerelease suffix or publish to npm's `latest` tag until every
stable gate below is closed.

## Completed candidate gates

- PR #4's least-privilege grants, session-bound identity checks, reconnect
  behavior, declarations, and plain-language UX are present in the local tree.
- Configuration and trust state are versioned, schema-validated, written
  atomically with private file modes, and reject future/unsafe input.
- Settings imports are size- and shape-bounded, validated before preview, and
  restored against the already-running database rather than a second Corestore.
- Electron uses a sandboxed, context-isolated renderer with no Node.js access,
  no renderer network access, no webviews, restricted navigation/external URLs,
  command allowlisting, native file-dialog authorization, and a path-contained
  secure application protocol for renderer modules.
- Electron package-time fuses disable RunAsNode, `NODE_OPTIONS`, CLI inspect,
  and extra `file://` privileges, and enable cookie encryption. CI reads the
  fuse wire from the packaged executable rather than trusting configuration.
- The Bare daemon runs in a sidecar and passes a real boundary test plus a
  packaged-app boot smoke test.
- `@qvac/sdk` is pinned to `0.15.0`; both the development and packaged Bare
  sidecars import its required API successfully. Foreign native prebuilds are
  removed at package time (507 removed in the macOS ARM64 verification),
  reducing the unpacked app from 6.7 GB to about 709 MB on disk.
- npm publishing is manual, environment-protected, provenance-enabled, rejects
  version collisions, and cannot route a prerelease to `latest`.
- Desktop release CI targets macOS, Windows, and Debian; it requires signing
  secrets, verifies signatures/notarization, runs packaged binaries, and emits
  SHA-256 checksums.
- Package versions, locks, generated dependencies, snapshots, repository URLs,
  and the changelog are aligned and checked by `scripts/node-release-gate.mjs`.
- npm advisory scans report zero findings for node, node-client, and CLI. The
  packaged desktop runtime is checked to exclude the advisory-bearing Forge,
  tar, glob/minimatch, and related build packages.

## Beta release gates requiring external state

- [ ] Configure required reviewers and secrets for GitHub environments
  `npm-release`, `desktop-release`, and `qvac-validation`.
- [ ] Run **Personal Node Desktop Release** and retain passing macOS, Windows,
  and Linux artifacts. Test installation/uninstallation on clean machines.
- [ ] Run **Node Release** with `publish=false`, inspect the tarballs/checksums,
  then rerun with `publish=true` and `dist_tag=beta` after approval.

## Stable gates

- [ ] Pass a real-model QVAC completion test with an approved model source on
  every supported architecture. SDK loading alone does not prove model download,
  native inference, memory pressure, cancellation, or recovery behavior. Run
  the manual **Node Real QVAC** workflow and retain all three passing jobs.
- [ ] Resolve or formally accept the desktop build-tool audit exception. npm
  currently reports 40 findings (3 low, 36 high, 1 critical) through Electron
  Forge/QVAC's optional Forge peer, with no non-breaking fix. These packages are
  not in the packaged runtime, but the build environment still needs restricted
  inputs, lockfile integrity, and continued upstream monitoring.
- [ ] Decide the first stable promise for multi-device use. If the product says
  a phone or second computer can find a node, ship authenticated QR/device-code
  linking; otherwise keep same-computer discovery explicit in every surface.
- [ ] Provide a user-controlled way to delete an app's retained local data, not
  only stop replication and deny reconnection.
- [ ] Define recovery: node identity, settings, and replicated data must have a
  documented migrate/restore procedure with a destructive-restore warning and
  a tested rollback path.
- [ ] Complete a minimum 14-day beta soak with upgrade, downgrade refusal,
  sleep/wake, offline/reconnect, disk-full, corrupt-settings, and crash-recovery
  scenarios. Track release-blocking failures without adding telemetry by
  default.
- [ ] Commission branded `.icns`/`.ico` assets and verify installer identity in
  OS trust dialogs. Decide whether automatic updates are a stable requirement;
  if enabled, sign update metadata and document rollback.
- [ ] Publish a support/privacy page explaining local storage, P2P connections,
  model downloads, what settings export contains, and how users obtain logs.

## Promotion rule

Promote `0.5.0-beta.N` to stable only from an exact commit whose npm tarballs and
three desktop artifacts passed the release workflows. Stable versions publish
to `latest`; prereleases publish only to `beta`.
