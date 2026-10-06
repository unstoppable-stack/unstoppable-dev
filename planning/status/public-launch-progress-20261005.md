# Public launch progress — 5 October 2026

Status: implementation advanced; publication remains blocked. Source baseline is still `58a1203` with an unfrozen working tree. No independent pilot or clean-machine result is claimed.

## Implemented

- Added maintained repository-source example at `examples/coffee-assistant` using the current Electron/Bare worker, QVAC, Hyperbee and Hyperswarm integration. Included dependency lock, MIT license, setup, troubleshooting, retention/sharing limits and demo steps. It needs inclusion in the frozen candidate commit before it is a released asset.
- Added explicit trusted-key order sharing and remote retrieval. Remote reads wait for replication; retrieval times out visibly instead of reporting an empty store as a verified remote result. Sharing keys expose saved orders, and downloaded copies can remain with recipients.
- Connected `scripts/release-smoke.sh` to the existing real desktop UI harness through `US_DESKTOP_PROJECT_DIR`. `RUN_REAL_QVAC=1 RUN_OFFLINE_QVAC=1` now tests the exact artifact-generated app, including retrieving a unique previous value after restart before writing new data.
- Added artifact README/LICENSE and local-production-dependency validation, SHA-256 manifests, and an automated canonical/bundled agent-pack drift check. The smoke uses the recommended Codex workspace path.
- Replaced reconstructed homepage/example visuals and obsolete cart/backoffice claims with a genuine app capture and current behavior. Added dated assistant-guidance validation metadata to both source copies.
- Prepared independent pilot observations and release/public-smoke/rollback procedures.

## Evidence

| Check | Result and limits |
| --- | --- |
| CLI typecheck and regression suite | Pass; 260 tests, 14 explicit skips |
| Agent pack | 104 identical source/bundled files; automated drift check passes |
| Current packed CLI | Isolated install, commands/catalog, Codex init and desktop generation pass in 6 seconds; no model runs in this core-only check |
| Combined artifact-to-app test | Fresh-network install ends in `ECONNRESET`. Retry with populated package cache passes the exact retained tarball → Codex workspace → generated app → real UI → network-isolated persistence/inference in 62 seconds; clean-machine/frozen-source gates remain open |
| Maintained example install | Dependency retry succeeds; `npm ls --depth=0` confirms a complete graph |
| Real example UI | Worker/storage, actual model, forced failure/Retry, streamed cancellation and recovery pass in 23 seconds |
| Network-isolated restart | Pass in 9 seconds; reads previous unique saved value before writing; real inference, Retry and Stop/recovery pass |
| Latest offline sample | 1.021 seconds warm model-ready; 1,756 MiB full app-process RSS on this machine, not a support minimum |
| Two-app peer/persistence | Real local DHT testnet pass; recipient starts with distinct empty storage, retrieves the unique sender order, sender restart preserves it |
| Public DHT discovery | Fails with visible 30-second peer-unavailable timeout; not a public networking acceptance pass |
| Website | Lint, typecheck and 26-page build pass; genuine screenshot visually inspected |

Retained logs and the current artifact checksum manifest: [evidence directory](evidence/20261005/). The tarball checksum records identity, not publication approval. Earlier test failures are retained in the run history; final local tests followed corrections to replication ordering and app-page selection.

## Remaining critical path

1. Freeze the reviewed candidate and repeat the now-passing combined real/offline artifact gate on a clean macOS Apple Silicon machine, with fresh-network installation evidence.
2. Record cold initial download and interrupted-download recovery; retain disk/time/resource evidence.
3. Resolve public DHT discovery on the intended network and verify peer disconnect/reconnect behavior. Local testnet evidence is insufficient for a public connectivity promise.
4. Include reviewed release changes in a clean candidate commit, assign owners, and set exact preview tag/version and final checksums. This checkout also contains earlier work; do not freeze unrelated content without review.
5. Run three independent pilots, including one assistant-guided visible app change; record unsuccessful attempts and interventions. Prepared [pilot sheet](public-launch-pilot.md).
6. Finish public repository/support access, final CI/support matrix, matching demonstration media and the Tether briefing using actual pilot results.
7. Execute publication, deployment, anonymous install smoke and rollback rehearsal according to the [release runbook](public-launch-release-runbook.md).

Personal Node, mobile, wallets and other excluded products remain outside this core preview. Their packaging/audit/trust gates do not block this scope unless they are reintroduced.
