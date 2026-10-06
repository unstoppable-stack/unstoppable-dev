# Dependency upgrade acceptance — 6 October 2026

The approved upgrades are implemented in draft PR [#7](https://github.com/unstoppable-stack/unstoppable-dev/pull/7). Human-dependent launch gates remain set aside. Frozen source: `064f6066c9c7f6e7998c60cb4c86a8e281852dc3`. The final `@unstoppable-stack/cli@0.4.0-beta.1` tarball is 226,743 bytes, SHA-256 `2a53e298e981a4f3f7ad1b48770506eaad3635fcf9bacd613051f4c543c4bda9`. Its [identity manifest](evidence/20261006-dependency-upgrade/artifact-manifest.json) records a clean source tree; this does not approve publication.

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
- Final packed CLI passed a fresh isolated consumer install and actual real/offline desktop acceptance in **50 seconds**, with 188 generated-app dependencies. Build tools were reused; consumer cache/prefix were fresh. The UI exercised real completion, forced model failure/retry, cancellation/reuse, oversized-request rejection, subsequent recovery and many-turn omission notice. Offline restart fetched the previous saved unique value before writing.
- [Final hosted-Mac real/offline acceptance](https://github.com/unstoppable-stack/unstoppable-dev/actions/runs/37482034741) passed in **146 seconds** against the exact frozen commit and identical tarball checksum. First model-ready was 74.226 seconds (the older harness labels it warm despite an initially empty runner model cache); offline ready was 4.124 seconds. These are diagnostics, not a speed/memory comparison.
- Final [CLI](https://github.com/unstoppable-stack/unstoppable-dev/actions/runs/37482043648), [website](https://github.com/unstoppable-stack/unstoppable-dev/actions/runs/37482043688) and [mock desktop](https://github.com/unstoppable-stack/unstoppable-dev/actions/runs/37482043749) CI passed.
- Updated example production audit reports zero known registry vulnerabilities; this does not cover development dependencies or deferred packages.

## Boundaries

Mobile's coherent legacy SDK/Bare-kit pins and deferred Personal Node's native sidecar/storage migration remain unchanged pending their own native and existing-data validation. Broad storage major upgrades were not shown to fix launch issues and were not mixed into this preview. Human onboarding, owners, public account administration and publication remain pending. No npm or website release occurred.

Historical screenshots and the 126-second walkthrough show the preceding QVAC 0.15 candidate, not the upgraded runtime. The earlier artifact and its checks remain retained as historical evidence. See the [dependency audit](../technical-improvements/20261006-dependency-update-review.md) for upstream sources and before/after replication evidence.

Evidence is retained in [dependency upgrade logs](evidence/20261006-dependency-upgrade/). An early fresh install failed on the missing optional helper and is retained. Two copied guidance files had mode 0600 instead of Git’s 0644; normalizing these made local/hosted tarballs identical for the preceding tested source. No runtime change was needed.
