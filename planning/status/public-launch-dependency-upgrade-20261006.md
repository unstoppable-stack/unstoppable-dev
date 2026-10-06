# Dependency upgrade acceptance — 6 October 2026

The approved upgrades are implemented in draft PR [#7](https://github.com/unstoppable-stack/unstoppable-dev/pull/7). Human-dependent launch gates remain set aside. Final artifact recapture after correcting the packed README's Node requirement is in progress; this document will record its final immutable source and checksum.

| Surface | Updated version | Effect |
| --- | --- | --- |
| Website Next.js / ESLint Next | 15.5.27 | Maintained-line security fixes without a Next 16 migration |
| Desktop Electron | 44.5.1 | Supported Electron generation |
| Desktop QVAC | inference 0.21.0 / llama.cpp 0.55.0 | Native Bare plugin assembly, current configuration/cache/download behavior |
| Hypercore / HyperDHT | >=11.37.2 / >=6.34.1 | Clear/replication correction and relayed-disconnect socket cleanup |
| Desktop Bare RPC / Corestore / Hyperswarm | >=1.3.8 / >=7.13.0 / >=4.17.2 | Align generator floors with the tested current dependency graph |
| Experimental Node generator | SDK 0.21.0, Node >=22.17 | Current client API; real Node inference is not separately validated |

Bare Runtime 1.34.1, Pear Runtime 1.3.1, Bare module 7.2.1, fs 4.8.2 and sidecar 0.5.7 were already current in the desktop preview. The migration removes the old configuration require shim and removed `n_discarded` field. New desktop apps require Node 22.17+ tooling. History is bounded by a conservative UTF-8 budget, not a tokenizer: older whole turns are omitted with a visible notice, oversized latest requests are rejected intact, and actual SDK overflow retries once before visible output. Named KV caches are not enabled by this scaffold.

A fresh install exposed eager language/audio imports despite optional upstream peers. The generator and example explicitly install `@qvac/langdetect-text` and `@qvac/decoder-audio`; the example lock was regenerated from its manifest without residual SDK peers. Canonical and CLI-bundled guidance match across 104 files and no longer teach removed SDK delegation.

## Validation

- 266 CLI tests passed, 14 skipped; type checking and agent-pack drift passed.
- Website lint, type checking and production build passed with 26 routes; workflow actionlint passed.
- Clean example installation passed public DHT retrieval, graceful disconnect, saved-order restart and revised-value reconnect.
- An actual model transfer interrupted after 6,553,600 bytes recovered the checksum-verified 532,517,120-byte model and completed inference, then another completion after a network-isolated restart. Recovery model-ready was 25.198 seconds on this Mac; this is not a performance comparison.
- Runtime `3642772` passed fresh packed CLI real/offline acceptance locally and on a separate hosted Mac. Final packed README identity is being recaptured.

## Boundaries

Mobile's coherent legacy SDK/Bare-kit pins and deferred Personal Node's native sidecar/storage migration remain unchanged pending their own native and existing-data validation. Broad storage major upgrades were not shown to fix launch issues and were not mixed into this preview. Human onboarding, owners, public account administration and publication remain pending. No npm or website release occurred.

Historical screenshots and the 126-second walkthrough show the preceding QVAC 0.15 candidate, not the upgraded runtime. The earlier artifact and its checks remain retained as historical evidence. See the [dependency audit](../technical-improvements/20261006-dependency-update-review.md) for upstream sources and before/after replication evidence.
