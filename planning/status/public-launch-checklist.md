# Public developer preview candidate

Last updated: 6 October 2026. Status: **blocked; not approved for publication**.

The machine-readable release contract is [`public-launch-candidate.json`](public-launch-candidate.json). The implementation backlog and acceptance criteria remain in the [public launch plan](../technical-improvements/20260918-public-launch-plan.md).

## Locked scope decisions

| Decision | Current contract |
| --- | --- |
| Audience | JavaScript/TypeScript developers using an existing AI coding assistant |
| Launch label | Developer preview |
| Default path | Configure a Codex workspace, scaffold a Pear Desktop app with local AI, run it, and make one change |
| Primary platform | Proposed macOS Apple Silicon; not supported until clean-machine and real-model evidence passes |
| Personal Node | Deferred from the core preview; eligible only as a later optional alpha after packaging, trust, and truthful-status gates |
| Mobile | Deferred from the core preview |
| Wallets/payments | Planned; excluded |
| Search, Memory, Remote Coder, Flow, standalone Agent | Excluded from the launch promise |
| Example | Maintained Coffee Assistant in `examples/coffee-assistant`; frozen local acceptance passes; independent reproduction remains pending |

`available` is intentionally not used as a synonym for “present in source.” A default-preview capability remains a **candidate** until its release gates pass against the same frozen commit and final artifacts.

## Evidence snapshot

- Frozen technical candidate: `36427726b8973ab00ec13459257c9a16bbecd9ca` on `codex/public-preview-candidate`. See [current acceptance results](public-launch-dependency-upgrade-20261006.md); historical runs below do not supersede them.
- CLI source version: `0.4.0-beta.1`.
- Runtime/Node source versions: `0.6.0-alpha.1`; excluded from the core preview.
- Agent-pack canonical and CLI-bundled directories matched on 18 September.
- The 18 September implementation slice passed CLI type checking, 254 tests (14 skipped), the minimal CLI build, a Codex workspace-init smoke, and the website production build.
- On 24 September, the default CLI was narrowed to `init`, `scaffold`, and `doctor`; Node and other deferred commands remain available only in the full internal profile.
- The public manifest now has four top-level production dependencies. A live production audit reported zero findings across 69 production dependencies.
- The isolated core smoke passed in 11 seconds: 242.5 kB tarball, 15,872 KiB installed prefix, workspace initialization, and Pear Desktop `local-ai` generation. It did not install or run the generated app or a real model.
- The real-QVAC test entry point and manual workflow now target `packages/node-caps-ai`. The default suite passes with that test skipped, the opt-in command fails clearly without `QVAC_MODEL_SRC`, and the opt-in test produced real output on macOS Apple Silicon with the pinned 532,517,120-byte Qwen 3.5 0.8B Q4_K_M model.
- A repeated scaffold smoke failed safely without `--force` and preserved a user-edited generated file.
- Root licensing, contribution, support, security-reporting, and issue-template files now exist and validate locally. Anonymous access to the configured GitHub repository returned HTTP 404. Dry-run node-core, sync, and AI capability tarballs now include their declared README/LICENSE files; remaining deferred runtime/desktop packages still need audit.
- A clean Pear Desktop `local-ai` scaffold passed generated-file syntax checks. Its dependency install remained inconclusive after an npm read timeout and an incomplete offline cache; the release smoke now has an explicit `INSTALL_GENERATED_APP=1` final-candidate gate.
- `us doctor --json` now reports CLI/OS/architecture/tool versions without user paths or environment values. The core profile omits the deferred Node check, and Pear Desktop readiness correctly relies on project-local Electron/pear-runtime rather than a global Pear CLI.
- Deferred Node UI status is now truthful: only verified mirror checkpoints show “verified copy”; pending, copying, metadata-only, failed, paused, and connected states remain distinct. New mirror passes invalidate the earlier checkpoint immediately.
- The published/minimal scaffold catalog now exposes only Pear Desktop and `local-ai`; its doctor reports only Pear Desktop readiness. Deferred, planned, and validation-only generators remain available solely in the full internal profile.
- Generated Node-sync UI distinguishes registration from copy verification. Dashboard and documentation state that unpairing stops replication but retains downloaded blocks, and the alpha has no per-app purge.
- On 28 September, CLI type checking, 260 tests (14 skipped), and both minimal and full builds passed. A packed-artifact retry stalled during its isolated npm install and was stopped after more than two minutes; it remains inconclusive rather than passing the final install gate.
- A subsequent network-enabled isolated smoke passed in 137 seconds: the packed minimal CLI installed, every public command/catalog check passed, the Pear Desktop + `local-ai` app was generated, and all 202 generated-app packages installed with a complete top-level dependency tree. That run closed dependency installation only; later source-build runs provide the separate startup and inference evidence below.
- On 2 October, the generated Pear Desktop + `local-ai` app passed the existing Level-4 worker/storage smoke and Level-5 Electron/Playwright UI flow. The UI test saved and fetched a Hyperbee value through the full renderer/bridge/worker path and verified the AI controls. An initial real-model run exposed missing QVAC plugin registration in the generated Bare worker; after the generator and agent guidance were corrected, the regenerated app loaded the pinned model and produced visible UI output in a 13-second Level-5 run. A subsequent warm run forced a real missing-model error, recovered through Retry, completed a prompt, cancelled a long streamed answer through the SDK, and completed a recovery prompt on the same model. It measured 1.026 seconds to model-ready and 1,464.7 MiB RSS for the complete app process tree on this Mac. The same sequence then passed under a macOS sandbox denying all non-localhost network traffic, with 1.021-second offline model-ready time and 1,396.4 MiB process-tree RSS.
- Historical 9 September test, audit, package-registry, and CI observations are context only. They must be rerun for the final candidate.
- No final tag, install command, artifact checksum, supported-platform result, or release date is approved.

## PRJ-01 completion checklist

- [x] Record a candidate commit, source versions, scope, maturity definitions, limitations, assistant matrix, and support matrix.
- [x] Decide the Node boundary: deferred from the core preview.
- [x] Distinguish proposed, validation-only, experimental/deferred, and planned surfaces.
- [ ] Assign named owners for Product, Runtime, Web, Release, and Pilot.
- [x] Reconcile the root README, website, CLI output, roadmap, changelog, and generated docs with this contract.
- [x] Record the exact locally tested artifact/version install command; keep public instructions on the published baseline until publication.
- [x] Freeze a clean candidate commit and add final artifact manifests and checksums.

PRJ-01 remains in progress until the unchecked items are complete. Publication remains blocked by the P0 gates listed in the manifest.

The root README, CLI README/output, changelog header, active status page, website support matrix, public roadmap, and generated agent-pack guidance now use the same release boundary: Personal Node and Expo are deferred, wallets are planned/unvalidated, and the public quickstart remains pinned to the actually published CLI 0.3.0 while 0.4.0-beta.1 is blocked. The reviewed website production build generated 26 static pages, canonical and bundled agent-pack sources match, and the CLI suite still passes.

PRJ-02 is now split cleanly by scope: the core CLI artifact installs without the deferred Node package graph, while the optional Node alpha still fails its own registry-resolvable packaging gate. PRJ-07 is complete for the CLI production tree; the deferred Node/desktop audit remains explicitly unperformed.

## Next execution slice

1. PRJ-02: make the candidate dependency graph registry-resolvable and test final tarballs in an isolated consumer.
2. PRJ-04: record cold first-run/download timing, then repeat the real-model UI, offline restart, failure/retry, cancellation, and resource checks against the frozen candidate.
3. PRJ-03: finish the workspace → scaffold → run onboarding path using those validated artifacts.
4. WEB-01/02/03: publish only the resulting supported claims and exact commands.

## 5 October implementation slice

See [current evidence and remaining gates](public-launch-progress-20261005.md). A maintained example now exists in `examples/coffee-assistant`, with a real application screenshot, locked dependencies, and setup/troubleshooting. Real inference, retry/cancel/recovery, offline restart with persistence, and local-DHT two-app order retrieval passed. Public discovery timed out. The fresh-network artifact install stopped on a network reset; a populated-cache retry then passed the retained tarball through real UI and offline restart with persistence in 62 seconds. Frozen-candidate and clean-machine acceptance remain open. Automated drift and artifact-content/checksum checks now exist. The [pilot observation sheet](public-launch-pilot.md) and [release/rollback runbook](public-launch-release-runbook.md) are prepared; no independent participant or production rollback result is claimed.

## 6 October technical acceptance

The frozen candidate passed a fresh installed-tarball desktop journey with real and offline inference, 261 CLI tests (14 skipped), website checks, public peer reconnect and interrupted model download/offline recovery. Artifact checksum and matching screenshots are retained in `evidence/20261006`. The draft PR starts remote CLI, website and preview CI. Human-dependent and publication gates remain open; see the updated manifest and progress report.

## Dependency upgrade acceptance — 6 October

The current candidate supersedes the 0.15 runtime and its screenshots. The upgraded packed CLI passes real/offline desktop acceptance with 266 passing CLI tests (14 skipped), and the website passes lint/type/build on Next 15.5.27. [Current evidence](public-launch-dependency-upgrade-20261006.md) records new hashes and hosted results. Historical entries above remain context, not approval of a changed artifact.
