# Dependency update review — 6 October 2026

Live npm metadata and first-party release history were checked for Bare, Pear, Holepunch, QVAC and the desktop/website runtimes. Recommendations use actual lockfile versions, not only older-looking minimum ranges. Initial experiments ran in disposable copies. The approved desktop and website upgrades are now implemented; final acceptance is recorded separately below.

## Recommended order

| Priority | Package / surface | Current → target | Recommendation and evidence |
| --- | --- | --- | --- |
| First | Website `next` + `eslint-config-next` | 15.5.12 → 15.5.27 | Update within the maintained 15.x line. Official September security fixes are available. Updated website passes ESLint, TypeScript and production build for all 26 routes. No need to migrate to Next 16 to obtain these fixes. |
| First | Example's transitive `hypercore` | 11.37.1 → 11.37.2 | Update the lockfile; for any surface that relies on the fix, raise its explicit minimum where appropriate. An actual clear/replication test failed with `INVALID_OPERATION` and `REQUEST_TIMEOUT` before the update and fetched all three remaining blocks after it. This matters for block eviction/purge paths, not the previously fixed announcement race. |
| First | Example's transitive `hyperdht` | 6.34.0 → 6.34.1 | Update the lockfile. Upstream fixes orphaned holepunchers/UDP socket leaks after relayed disconnects and relay failures, while allowing recovery. Updated example passed public discovery, graceful disconnect, persistence and fresh revised reads after reconnect; its real-model desktop flow also passed. The app test does not specifically force NAT/relay loss or measure file descriptors. |
| Next | Desktop example and generator `electron` | 40.10.6 → 44.5.1 | Move to a supported major. Latest npm stable was 44.5.1 at capture; Electron supports the latest three stable majors. Current 40.x has no newer maintained patch. Electron 44 passed actual Bare worker/storage/UI and real retry/cancel/recovery with existing QVAC 0.15. It also passed offline operation with adapted QVAC 0.21. Review Node tooling requirements (`electron` declares Node >=22.12), OS support and packaged distributions before adopting. |
| Next, as a migration | QVAC | SDK 0.15.0 → SDK/inference 0.21.0 | Worth migrating for configuration loading, committed KV-cache recovery, bounded automatic cache retention, verified downloads and mobile build fixes. Use `@qvac/inference` inside the existing Bare worker, with explicitly selected native addons. Keep `@qvac/sdk` for Node/Expo clients. A version-only upgrade is insufficient. |
| Deferred surfaces | `bare-sidecar` / compatible Bare packages in Personal Node | Sidecar 0.5.3 → 0.5.7; other lockfile refreshes | Node Desktop's older lock still has Bare module 6.4.0, fs 4.7.1 and sidecar 0.5.3. Sidecar updates advance the embedded Bare runtime and add an option for an independent process group. Refresh compatible dependencies together and rerun native packaging/runtime checks. The preview example already uses sidecar 0.5.7 through Pear Runtime, so this is not a missing upgrade there. |
| Deferred mobile | `react-native-bare-kit` with QVAC | Exact 0.15.0 → tested compatible 0.15.6 | Latest published kit is 0.15.6. QVAC 0.20.1 documents testing ^0.15.5, embedding Bare 1.33. Match native addon runtime requirements instead of independently bumping the kit. Later QVAC releases fix missing `bare-posix` Android prebuild tracing and improve host/addon checks. Native build/device acceptance has not been run here. |

The default example already locks current `pear-runtime` 1.3.1, `bare-module` 7.2.1, `bare-rpc` 1.3.8, `bare-fs` 4.8.2, `bare-runtime` 1.34.1, `bare-pack` 2.2.3, `corestore` 7.13.0, `hyperbee` 2.27.3, `hyperswarm` 4.17.2 and `hypercore-crypto` 3.7.0. Raising every older minimum would not itself change these installed versions.

## QVAC migration experiment

A disposable app replaced SDK 0.15.0 with `@qvac/inference@0.21.0`, `@qvac/llm-llamacpp@0.55.0` and `bare-process@4.5.1`. It sets the process global before importing the engine and registers the LLM plugin explicitly. The old `bare-module.createRequire` global adapter was removed. Published inference 0.21's configuration loader uses dynamic import rather than the old unbound require.

The first actual desktop run failed because `modelConfig.n_discarded` is now rejected. Removing that field allowed real configuration loading, model failure/retry, streamed completion, cancellation, subsequent completion, worker/storage behavior and network-isolated cached-model restart to pass. Electron 44 plus this adapted engine passed the same offline flow. These are migration experiments on this Mac, not new release approval or packaged-device tests.

Important changes before adoption:

- Replace removed sliding-window configuration with deliberate application history/context handling and `ContextOverflowError` recovery. A short test passing after removing the setting does not validate long conversations.
- Review system prompt behavior and automatic/named KV caches. QVAC 0.20 changes how system messages apply on cached and uncached paths; cancelled/failed warm turns preserve the last committed cache.
- Audit old delegated DHT examples: SDK 0.19 removed its `delegate` path. Our own node capability RPC is separate, but agent-pack recipes that teach the removed SDK API must change.
- Migrate Bare workers and Node/Expo clients separately; select required addons and compatible host runtimes. The current latest docs' mobile install example still lists older host/bundler versions than recent release notes, so use package contents, runtime checks and successful native builds as evidence.
- Synchronize canonical and CLI-bundled agent-pack content. Generated Node, Pear and Expo code plus recipes currently teach 0.15 APIs, including `n_discarded` and SDK delegation.
- Repeat cold download/interruption recovery, long-context behavior, installed-artifact acceptance and hosted-Mac CI after implementation. Existing frozen candidate checksums identify the old tested release, not this proposed migration.

Observed times are diagnostic only: adapted engine's first test ready was 19.152 seconds, offline ready 2.030 seconds; combined Electron 44/offline ready 2.027 seconds. Different cache/engine states make these unsuitable for claiming a speed or memory improvement.

## Other package generations

CLI/search internal tools still declare Corestore 6, Hypercore 10 and Hyperdrive 11, while current applications use Corestore 7/Hypercore 11 and current Hyperdrive is 13. Node/sync packages still lock Hyperdrive 12 and older network/storage patches. Align each storage generation as a separate migration with existing-data/replication tests; changing all majors together could invalidate on-disk data assumptions. CLI tooling dependency majors do not have a demonstrated connection to the launch issues and should not displace the updates above.

Dependency updates do not resolve local `file:` production dependencies, private repository access, ownership or independent pilot gates. Existing announcement-readiness and remote-handshake waits remain necessary; a newer DHT does not replace those application fixes.

## Evidence and sources

Retained [registry metadata, version inventory, before/after replication test and experiment logs](../status/evidence/20261006-dependency-audit/) document the checked versions and results. Only temporary test copies were changed. Website check ran individual npm lint/type/build commands after a nested pnpm invocation stalled; each direct command passed. No dependency or release artifact change is claimed.

- [Next.js September security release](https://nextjs.org/blog/september-2026-security-release), [15.5.27 release](https://github.com/vercel/next.js/releases/tag/v15.5.27). Exposure depends on enabled routes/features; the recommendation does not claim every listed advisory is exploitable in this site.
- [Hypercore clear/replication correction](https://github.com/holepunchto/hypercore/pull/879), [version comparison](https://github.com/holepunchto/hypercore/compare/v11.37.1...v11.37.2).
- [HyperDHT relay handshake cleanup](https://github.com/holepunchto/hyperdht/pull/292), [version comparison](https://github.com/holepunchto/hyperdht/compare/v6.34.0...v6.34.1).
- [QVAC 0.19 migration/checksums](https://github.com/tetherto/qvac/releases/tag/sdk-v0.19.0), [0.19.1 mobile fix](https://github.com/tetherto/qvac/releases/tag/sdk-v0.19.1), [0.20 cache/system prompt changes](https://github.com/tetherto/qvac/releases/tag/sdk-v0.20.0), [0.20.1 host compatibility](https://github.com/tetherto/qvac/releases/tag/sdk-v0.20.1), [0.21 release](https://github.com/tetherto/qvac/releases/tag/sdk-v0.21.0), [Bare integration](https://docs.qvac.tether.io/sdk/js-ts-sdk/).
- [Bare Sidecar changes](https://github.com/holepunchto/bare-sidecar/compare/v0.5.3...v0.5.7), [Electron support policy](https://www.electronjs.org/docs/latest/tutorial/electron-timelines).

## Implementation

The preview now pins QVAC inference 0.21.0 / llama.cpp 0.55.0, uses Electron 44.5.1, raises Hypercore and HyperDHT minimums to the fixed releases, and locks Next/ESLint Next 15.5.27. Bare workers register the LLM plugin explicitly and manage bounded history, user-visible omission, oversized requests, and one overflow retry before output. Node scaffolds target SDK 0.21.0; Expo and Personal Node native migrations remain deferred. Canonical and bundled guidance match. See [dependency upgrade acceptance](../status/public-launch-dependency-upgrade-20261006.md) for the final candidate and validation; the audit experiments above are historical.
