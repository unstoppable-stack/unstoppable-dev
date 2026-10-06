---
id: LAUNCH-001
title: Public developer preview improvement and release plan
package: multiple
status: in_progress
created: 2026-09-18
updated: 2026-10-06
owner: unassigned
---

# Public developer preview: improvement and release plan

## Outcome

A developer unfamiliar with the project can understand its purpose, install the documented release, build and modify one working app, and find help without relying on the author's machine or live assistance.

The recommended first launch is **a developer toolkit for private apps with local AI and optional P2P sync**. It includes the CLI, agent pack, one maintained example, and clear documentation. The new runtime and Personal Node can ship as an optional alpha once their own safety and distribution gates pass.

This plan proposes work; it does not mark it implemented or authorize publication. Suggested owner roles must be assigned before execution. There is no fixed launch date: passing the acceptance gates determines readiness.

Companion specification: [website improvement plan](website/20260918-prelaunch-website.md). Baseline evidence: [9 September project review](../status/project-review-2026-09-09.md).

## Progress

PRJ-01 started on 18 September. The initial structured release contract is [`planning/status/public-launch-candidate.json`](../status/public-launch-candidate.json), with a human-readable [candidate checklist](../status/public-launch-checklist.md). It records the current dirty baseline rather than pretending it is a frozen release candidate.

The first scope decision is now explicit: **Personal Node and the 0.6 runtime packages are deferred from the core developer preview**. They may ship later as an optional alpha only after their packaging, trust, resource, and replication-status gates pass. The primary path remains a proposed macOS Apple Silicon Pear Desktop journey; it is not a support claim until clean-machine and real-model evidence exists.

On 24 September, the minimal CLI was aligned with that decision: only `init`, `scaffold`, and `doctor` ship in the core profile. Full-profile dependencies moved out of the production install, and the four-package top-level production tree passed a live npm audit with zero findings. The isolated CLI artifact smoke passed in 11 seconds (242.5 kB tarball; 15,872 KiB installed prefix) through workspace initialization and Pear Desktop `local-ai` generation. This is partial PRJ-02/03/07 evidence, not a completed launch gate: the generated app was not installed or run, no real model executed, and the working tree was not frozen.

The same slice restored the opt-in real-QVAC test under `packages/node-caps-ai`, where the provider now lives, and repaired the macOS/Linux/Windows workflow to invoke that package. The ordinary capability suite passes with the real-model case visibly skipped; `npm run test:qvac` fails immediately when `QVAC_MODEL_SRC` is absent. This repairs the validation entry point, but PRJ-04 remains blocked until an approved runner actually downloads the selected model and retains the required runtime evidence.

The website contract was also reconciled on 24 September. A live registry check confirmed that npm `latest` remains CLI 0.3.0, so the public quickstart stays pinned there and labels 0.4.0-beta.1 as an unverified repository candidate. Personal Node now reads “deferred alpha,” Expo reads “deferred,” and the footer no longer claims an MIT repository license while the root license file is missing. The production build generated 26 static pages successfully.

The generated assistant guidance now carries the same maturity boundaries. Node CLI guidance no longer claims every feature combination runs, mobile guidance identifies Expo as a deferred experimental target rather than fully buildable, Node replication is not called a complete backup, and wallet guidance is explicitly planned, unvalidated, and testnet-only. Canonical and CLI-bundled agent-pack trees match, and all 255 CLI tests still pass (14 skipped).

On 25 September, a clean temporary Pear Desktop + `local-ai` scaffold was generated and its JavaScript passed syntax checks. The first dependency install fetched the Electron/QVAC graph but ended with an npm registry read timeout; the cache-only retry then identified one unfetched package (`bare-sidecar`). This is an inconclusive network failure, not a package-graph pass or defect. `scripts/release-smoke.sh` now offers `INSTALL_GENERATED_APP=1` so final evidence cannot stop at generation. Generated README copy now qualifies local inference as available only after the initial model download.

The onboarding diagnostics now emit a shareable `us doctor --json` environment block with CLI version, OS platform, architecture, tool versions, and scoped readiness without environment values or user paths. The minimal profile no longer checks or advertises the deferred Personal Node. It also no longer requires a global Pear CLI: the current desktop scaffold installs Electron and `pear-runtime` in the generated project. CLI type checking, 256 tests (14 skipped), the minimal build, and the 26-page website build pass after those corrections.

On 28 September, the public/minimal scaffold catalog was narrowed to the release contract itself: Pear Desktop is the only exposed platform and `local-ai` the only optional feature. Expo, Node CLI, wallet, Node integration, and multi-writer generators remain available in full internal builds without appearing as supported public-preview choices. Minimal `doctor` now reports only Pear Desktop readiness. Generator copy no longer equates Node registration with a verified copy or backup, and the deferred desktop/readme paths explain that unpairing stops replication but retains downloaded blocks. CLI type checking, 260 tests (14 skipped), and both minimal and full builds pass. After one sandboxed retry stalled, an isolated network-enabled smoke packed and installed the minimal CLI, exercised its complete public command/catalog surface, generated the Pear Desktop + `local-ai` app, installed all 202 generated-app packages, and passed `npm ls` in 137 seconds. This closes the clean dependency-install slice, but it does not prove app startup, a real model, or a frozen candidate.

On 2 October, the existing desktop E2E harness was restored to reproducible use by declaring its missing `tsx` development dependency. The exact Pear Desktop + `local-ai` variant then passed Level 4 from a clean scaffold/install: generated-file integrity, real worker startup, and a Hyperbee write/read round trip. Reusing that installed project, Level 5 launched the actual Electron window and Playwright verified the title and feature sections, waited for the worker, and drove a visible KV save/fetch round trip through the renderer/bridge/worker boundary. The first real-model UI attempt then exposed a release-path defect: the generated Bare worker imported the QVAC SDK without registering its llama.cpp completion plugin. The generator and both agent-pack copies now register that plugin explicitly. After the fix, the opt-in capability test produced real output with the pinned Qwen 3.5 0.8B Q4_K_M model, and the regenerated Electron app loaded the same model and produced visible UI output in a 13-second Level-5 run. A follow-up added request-scoped Stop behavior that calls the SDK's inference cancellation API, suppresses late tokens, cancels active work during shutdown, and keeps the loaded model usable. The real UI harness now requests a deliberately missing local model, verifies the visible error, retries with the pinned model, completes a prompt, cancels a long streamed response, and completes a recovery prompt on the same model. On the measured warm run, model-ready took 1.026 seconds and the full generated-app process tree used 1,464.7 MiB RSS. A second launch under a macOS sandbox that denied every non-localhost network operation passed the same real-model sequence from cache; offline model-ready took 1.021 seconds and process-tree RSS was 1,396.4 MiB. These values describe this machine rather than a support minimum. The runs validate real inference, offline restart, error recovery, user cancellation, and warm resource samples on the primary macOS Apple Silicon source-build path; cold first-run timing and a repeat from the frozen release artifact remain open.

On 5 October, a maintained Coffee Assistant example was added under `examples/coffee-assistant` with current Electron/Bare/QVAC integration, setup instructions, locked dependencies and a real application capture. It passed real inference, failure/retry, cancellation/recovery and a network-isolated restart that retrieved a unique previously saved value before any new write. Two isolated instances exchanged an order over a real local DHT test network and restart persistence passed. Public DHT discovery timed out, so public peer behavior remains a release gate. The release smoke now connects the installed CLI artifact to the real desktop UI harness, verifies package documentation/local-dependency contents and retains checksums; the fresh-network attempt stopped at generated-app installation with a network reset, then a populated-cache retry of the retained CLI tarball passed the complete generated-app real/offline UI sequence with restart persistence in 62 seconds. The frozen-candidate and clean-machine repeat remain open. Source and bundled agent guidance still match and carry current validation metadata. Pilot materials and a release/rollback runbook are prepared. Detailed results and remaining gates are in [5 October progress](../status/public-launch-progress-20261005.md).

On 6 October, the technical continuation passed public DHT retrieval, graceful peer disconnection and fresh reads after restart/reconnect. It also passed an initially empty-cache model download with checksum verification, a deliberately interrupted real transfer followed by recovery, and offline inference from the recovered cache. A QVAC 0.15.0 Bare configuration-loader defect was repaired in the generator and example. CI now separates the public packed-artifact path from deferred full-profile generators. Human-dependent items remain pending at the user’s request. See [6 October progress](../status/public-launch-progress-20261006.md).

## Baseline and evidence freshness

The local checkout on 18 September remains at `58a1203`. The initial planning pass re-read website components and repository instructions without rerunning tests, audits, registry queries, or remote CI. The implementation slices subsequently ran CLI type checking and tests, minimal and full builds, a Codex workspace-init smoke, the isolated CLI artifact smoke, the CLI production audit, the AI capability suite, a clean generated-app installation, mock and real generated-app runtime flows, and the website production build successfully. These runs used the dirty working tree and are not final candidate evidence. Deferred Node/desktop audits, remote CI, the remaining QVAC resilience cases, and a repeat against one frozen candidate remain outstanding.

The review's 438 passing tests, 15 skips, package availability, CI failures, and dependency findings are **9 September observations**, not fresh release evidence. Recheck them against the candidate commit before publishing. The earlier Node audit was not performed because automatic approval review blocked sending unpublished dependency names to npm; resolve the audit method with the owner before attempting that disclosure.

## Product decisions to lock first

| Decision | Recommended default | Why |
| --- | --- | --- |
| Primary audience | JavaScript/TypeScript developers using an existing AI coding assistant | Matches the strongest current assets |
| Primary promise | A tested route to a working app using local AI and P2P technology | Specific enough to demonstrate and maintain |
| Launch label | Developer preview; runtime/Personal Node explicitly alpha | Keeps maturity claims consistent with current work |
| Default onboarding | Configure an assistant workspace, scaffold a desktop app, run it, make one change | Uses the existing CLI without requiring an onboarding rewrite |
| First documented platform | Propose macOS Apple Silicon desktop; confirm with real-model and clean-machine evidence | Concentrates acceptance testing on a concrete path |
| Other platforms | Publish a tested support matrix; Node CLI remains a useful scripted validation target | A passing package build alone does not prove the full experience |
| Personal Node | Optional advanced path | A developer can succeed before learning background services |
| Wallets | Experimental/planned, excluded from the default example | Generated wallet functionality is currently a stub |
| Showcase | A maintained version of the existing Coffee Assistant desktop demo | Reuses prior learning instead of creating a large new product |
| Monetization | Brief future direction only | Revenue systems are not necessary to validate developer adoption |

Do not claim complete offline operation before models/assets are installed, automatic availability across all devices, free infrastructure, or recoverable backups without testing those exact properties. App inference can be local while the developer's chosen coding assistant uses a cloud service; explain that distinction.

Defer Flow, Memory, Search, Remote Coder, the standalone coding agent, payment marketplaces, and multi-platform parity from this launch. Retain their plans without presenting them as one finished product.

## Priorities, ownership, and estimates

- **P0:** blocks the public path it affects. A component may be removed from release scope, but an alpha label does not excuse unsafe defaults or broken installation.
- **P1:** recommended launch quality. Can be deferred with a recorded user impact, owner, and follow-up milestone.
- **P2:** post-launch improvement; keep it off the critical path.

Suggested roles: **Product** owns scope and claims; **Runtime** owns CLI/packages/P2P/AI; **Web** owns site and docs; **Release** owns distribution and evidence; **Pilot** is a colleague who did not implement the project. One person may hold several roles, but the pilot should be independent.

Effort bands are rough focused engineering time: **S** = half to one day, **M** = one to three days, **L** = three to five days. They overlap and should not be added as a delivery promise. Native runtime failures, real-model issues, and signing setup require investigation before reliable estimates.

Tasks remain **not started** unless the progress section or candidate checklist records current work. Historical implementations are inputs to verification, not automatic completion.

## Project work backlog

### PRJ-01 — Freeze the public release contract

**P0 · Product + Release · S · No dependencies**

Create one release manifest recording the candidate commit, CLI/runtime versions, distribution tags, supported OS/architectures, tested assistant paths, included features, known limitations, and evidence links. Use it to reconcile the README, website, CLI output, roadmap, and changelog. Replace stale phase counters and references to the removed node-client. Avoid a new orchestration system; a small structured file plus a short human-readable checklist is sufficient.

**Done when:**

- [x] Every advertised capability is marked available, experimental, deferred, or planned with a concrete meaning.
- [x] Default examples only use included features and compatible versions.
- [x] Supported platforms and assistant integrations are distinguishable from unverified targets.
- [x] The candidate record states that Node/desktop artifacts are deferred from the core preview.

### PRJ-02 — Repair package distribution and validate actual artifacts

**P0 for affected packages · Runtime + Release · L · Depends on PRJ-01**

Resolve the three production `file:` dependencies in `packages/node/package.json`. Prepare registry-resolvable manifests for node-core, sync, AI, and Personal Node at compatible versions. Verify declared README/license files exist. Ensure generated applications request packages available in the intended release channel.

Use an isolated local package registry or equivalent controlled artifact installation to validate the entire candidate dependency graph before public publication. Do not rely on global packages, workspace symlinks, or simply packing a tarball. The first unpublished package line needs an explicit bootstrap process. Validate the same artifact contents that will be uploaded; if packaging rewrites manifests, inspect and retain those final manifests and checksums.

After validation, publication order is core → capability packs → Personal Node → CLI as applicable. Website commands must not point users at the older `latest` packages when the instructions require a new preview. Record any registry propagation delay before proceeding.

**Done when:**

- [ ] Strict `scripts/node-release-gate.mjs` passes without unpublished-dependency exceptions.
- [ ] Candidate tarballs contain no unresolved local production dependencies.
- [ ] A fresh consumer install runs each public command and the selected generated app.
- [ ] Candidate package versions, generated dependency versions, and documentation agree.
- [ ] Prereleases cannot accidentally become `latest`.
- [ ] A post-publication smoke is prepared to run the exact documented public command.

### PRJ-03 — Finish the existing onboarding journey

**P0 · Runtime + Web · M · Depends on PRJ-01; final validation on PRJ-02**

Keep the existing workspace-plus-scaffold flow for this release. Make `us init` clearly report that it configured an assistant workspace and show the next scaffold step or first assistant prompt. Do not send users to a placeholder development script as if an app is ready. Provide one tested default path and a clearly separated manual alternative.

Improve failure messages for missing tools, failed dependency installation, unavailable preview packages, and a missing optional Node. Include a readable environment summary that users can attach to an issue without secrets. Validate CLI arguments supplied noninteractively as well as through prompts, and preserve existing directories unless an explicit overwrite operation is requested.

**Progress (2 October):** `us init` now describes the created directory as an assistant workspace, distinguishes failed dependency installation, and prints the exact workspace → scaffold → generated-app directory sequence. The core profile no longer requires the deferred Node commands. Invalid noninteractive project/assistant arguments fail, and a repeated scaffold smoke exited non-zero while preserving a user-edited file. `us doctor --json` now provides an attachable, path-free environment summary. The generated Pear/QVAC app has now produced visible real-model output from the source build; the complete documented flow still needs to be repeated from the frozen CLI artifact.

**Done when:**

- [x] A newcomer knows which folder to open, where the app is generated, and which folder runs it.
- [ ] The documented prompt leads to the expected scaffold and a visible running app.
- [x] Missing optional services do not prevent local use.
- [x] Failed installation is reported as failure with a recovery step, not unconditional success.
- [x] A second run does not silently overwrite user work.

**P2:** merge assistant setup and app scaffolding into a single guided command after the existing path is proven.

### PRJ-04 — Validate real QVAC behavior

**P0 for the local-AI promise · Runtime · L, with native-runtime contingency · Depends on PRJ-01/02**

Restore a real-model test entry point for the new package structure and repair `.github/workflows/node-qvac.yml`, which currently calls a missing package script. Choose one model and record its identifier, version/source, redistribution terms where relevant, download size, and observed hardware requirements. Resolve SDK imports from the actual installed capability pack and packaged desktop layout.

**Progress (2 October):** the missing entry point now exists as `packages/node-caps-ai/test/ai-provider-real.test.js`, with a cross-platform `test:qvac` package script. The manual workflow installs QVAC SDK 0.15.0 beside the capability pack and targets the current package on macOS, Linux, and Windows. Default tests pass with the costly case explicitly skipped, and the opt-in command rejects a missing model source. On macOS Apple Silicon, the opt-in capability test produced output with `Qwen3.5-0.8B-Q4_K_M.gguf` (532,517,120 bytes; SHA-256 `bd258782e35f7f458f8aced1adc053e6e92e89bc735ba3be89d38a06121dc517`). A real generated-app attempt then caught missing QVAC plugin registration in the Bare worker; after correcting the generator, a regenerated Electron app loaded the pinned model and produced visible UI output in a 13-second Level-5 run. The real harness now also forces a missing-model error, recovers through the visible Retry control, starts and cancels a long completion through the SDK, and successfully completes another request on the same loaded model. A warm run measured 1.026 seconds to model-ready and 1,464.7 MiB RSS for the entire app process tree. A network-isolated restart passed from cache with 1.021-second model-ready time and 1,396.4 MiB process-tree RSS. These results came from the dirty source build, so they are strong implementation evidence rather than final frozen-candidate evidence.

Exercise initial model download, interrupted download/retry, first completion, continued streaming, user cancellation, model failure, shutdown, and an offline restart with the model already installed. Verify cancellation releases expensive work rather than merely hiding output. Record memory use and first-run versus warm-start time; these are measurements to collect, not existing promises.

**Done when:**

- [ ] A real model produces output on the primary documented platform using the release candidate.
- [x] Mock mode is visibly identified and cannot be mistaken for the public demonstration.
- [x] Offline restart, cancellation, and error recovery pass with retained logs.
- [ ] Supported architecture claims are backed by their own execution results.
- [x] Model/resource limitations appear in the quickstart before a large download begins.

### PRJ-05 — Make Node trust and resource use explicit

**P0 if Node/runtime is included · Runtime · L · Depends on PRJ-01**

Review pairing entry points in node-core, Personal Node, generated apps, and desktop. Default public headless use to explicit approval or scoped invitations. Retain automatic acceptance only as a deliberate development option, clearly described. Keep per-direction grants and test changes to them across reconnects and revocation.

Add or verify bounded requests, concurrent inference limits, stream backpressure, cancellation, and refusal under resource pressure. A trusted peer should not be able to accidentally exhaust an unattended node through unlimited requests. Reuse existing controls where present; this task is a focused review and correction of shipped paths, not a new general security framework.

**Done when:**

- [ ] An unknown peer cannot use sync or AI merely by reaching the public key.
- [ ] Expired/revoked invitations, denied grants, and revoked peers are rejected.
- [ ] Per-peer access remains scoped after restart/reconnect.
- [ ] The documented concurrency/size limits are exercised with meaningful failure tests.
- [ ] Desktop and headless instructions describe their actual approval behavior.

### PRJ-06 — Correct replication, retention, and recovery claims

**P0 for honest status/claims; P2 for full backup functionality · Runtime + Web · M · Depends on PRJ-01/05**

Drive “Connected,” “Copying,” and verified-copy status from the corresponding runtime facts. In particular, replace the scaffold's immediate “Protected” message after registration with status derived from a completed checkpoint. Surface source absence, stale checkpoints, pauses, and quota failures accurately.

Document settings export contents, excluded identity/data, retained blocks after unpairing, and how to remove local data safely. For the preview, clearly limit the promise to replication and settings export. Do not make full identity/data recovery a prerequisite for a preview that never advertises it. A stable consumer backup product must separately implement and test recovery, deletion, and rollback.

**Progress (28 September):** desktop peer rows now derive their label from each resource's live protection state. Only active mirror resources at a verified `protected` checkpoint show “verified copy”; pending, copying, metadata-only, failed, paused, and merely connected states remain distinct. Dashboard totals now say paired apps and stored replicated data rather than treating every registered app as protected. A sync-pack regression test confirms that scheduling a new mirror pass immediately invalidates an earlier verified checkpoint. Generated Node-sync UI now says “registered for replication — copy verification pending” and no longer instructs preview users to start the deferred Node. The website, Node README, and dashboard removal confirmation say that disconnecting/unpairing stops replication but leaves downloaded blocks; the alpha has no per-app purge. The desktop suite passes 66 tests with one sidecar E2E skipped; the sync pack passes eight tests, and the CLI suite passes 260 tests with 14 skipped.

**Done when:**

- [x] A delayed or failed copy never appears complete.
- [x] New writes invalidate or qualify an earlier verified-checkpoint status.
- [x] A user can discover what remains after disconnecting or unpairing.
- [x] Website, dashboard, generated UI, and README use the same definitions.
- [x] No release copy describes settings export as a full data backup.

### PRJ-07 — Refresh dependencies and trim default installation

**P0 to assess/fix release-relevant findings; P1 for dependency splitting · Runtime + Release · M · Depends on PRJ-01**

Recheck the candidate CLI against current advisories; the previous audit reported five affected production packages, with fixes available. Update compatible dependencies and locks, assess reachable behavior, and rerun affected smoke paths. Record the disposition of remaining findings. Select an authorized audit approach for private/unpublished packages; do not repeat the previously blocked metadata disclosure without permission.

Inspect the minimal CLI tarball and installed dependency tree. Move unused Search/Remote dependency families out of the default installation where feasible; build-time feature flags alone do not prevent npm from installing them. Measure installed size, native build requirements, and clean installation time before and after. Avoid a wholesale package-manager migration during release prep.

**Done when:**

- [x] Current CLI findings have a documented fix or reviewed, scoped disposition.
- [x] The live CLI production audit reports no known high/critical vulnerability in the public package tree.
- [x] Clean generated-app installation works without unnecessary experimental dependencies or undocumented native tooling.
- [x] The unperformed deferred Node/desktop audit is explicitly listed as a validation limitation.

### PRJ-08 — Make the agent pack a maintained release asset

**P0 for the default journey; P1 for broader coverage · Runtime + Product · M · Depends on PRJ-01/03**

Audit the instructions needed for the chosen example first: runtime boundaries, current QVAC API, scaffolding, storage, and Node integration if used. Reference official SDK guidance for underlying APIs and retain project-specific integration lessons. Add tested version/date and validation level to maintained recipes; distinguish documentation-only coverage from a running example.

Keep canonical content in `packages/agent-pack/src/` and sync it to `packages/cli/agent-pack-src/`. Automate a drift check. Validate generated configuration placement and referenced resources for every assistant advertised, with a hands-on pilot on the recommended assistant path. Add a small release check that the generated context actually points at current commands and packages.

**Done when:**

- [ ] The launch example can be modified using the generated instructions.
- [x] Source and bundled copies match.
- [ ] No launch recipe depends on removed APIs or unshipped wallet behavior.
- [ ] Published coverage labels have a validation date and evidence source.

### PRJ-09 — Promote one public reference app and record the demo

**P0 · Runtime + Product · L · Depends on PRJ-03/04/08; Node extension on PRJ-05/06**

Use the existing Coffee Assistant desktop work as the starting point. Extract the smallest maintained example into a tracked public location, with self-contained dependencies, fixtures, setup, and troubleshooting. Remove author-specific paths, credentials, research checkout dependencies, and unexplained workarounds. Keep the core demonstration to local AI, a saved record, and a simple P2P interaction; no real payment flow.

Record a two-to-three-minute demonstration from the release candidate: open the app; make a real QVAC request; save an order/record locally; restart to show persistence; show peer communication with the intended network available. Demonstrate local operation offline separately. If showing Personal Node mirroring, wait for a verified checkpoint and explain the limited retention/recovery promise.

**Done when:**

- [ ] A colleague reproduces the example from a clean checkout using only its README.
- [ ] Local persistence and peer interaction have observable acceptance results.
- [ ] Video, screenshots, code, and instructions represent the same version.
- [ ] The demo is clearly labeled as maintained by this project, not a community deployment.

### PRJ-10 — Reconcile CI and the supported-platform matrix

**P0 for claimed support · Runtime + Release · M plus mobile investigation · Depends on PRJ-01/02**

Recheck the current nightly iOS failure and diagnose its native prebuild error. Either fix it and retain successful native execution evidence, or label mobile experimental and remove it from the primary quickstart. Do not reinterpret installation-only checks as full mobile support. Keep experimental failures visible in a separately named lane so core launch status remains meaningful.

Run core, sync, AI, Personal Node, and relevant desktop tests explicitly in candidate validation. Confirm optional integration tests and individual capability packs are actually exercised, rather than merely installed. Test the generated application beyond text snapshots: startup, storage round trip, actual worker boundary, real inference, and peer behavior as applicable.

**Done when:**

- [ ] Every supported combination has install/build/run evidence linked to the candidate commit.
- [ ] Skips and mocks are visible in reports.
- [ ] Default published commands are exercised from packed/installed artifacts.
- [ ] Existing healthy desktop checks remain green after release changes.
- [ ] The support matrix lists OS, architecture, runtime, feature coverage, and last verified date.

### PRJ-11 — Prepare public repository and support operations

**P0 · Product + Release · M · Depends on PRJ-01**

Add the intended root/package license files, verified contributor setup, issue templates, security-reporting instructions, and a clear maintainer/support route. Review material that will become public, including history and reference submodule access, for accidental credentials, internal-only material, and unsupported attribution. Do not publish ignored research or private examples simply to make a demo work.

Correct root setup instructions to match how packages are actually installed today; implementing the originally planned workspace/Turborepo architecture is not a release requirement. Update contradictory project instructions and link older launch plans as historical. Describe the protocol break from the older published package line and whether re-pairing is required. Do not promise identity/data migration that has not been tested.

**Progress (25 September):** the repository now has a root MIT license matching the CLI package, scoped contribution instructions, a best-effort support policy, private vulnerability-reporting instructions, and structured bug/security issue links. Local YAML/license/build checks pass. Anonymous HTTP access to the configured GitHub repository returned 404, so public repository, issue, and private-security intake remain blocked on repository administration. README/license files were added to node-core, node-caps-sync, and node-caps-ai, and each dry-run tarball contains them. Other deferred runtime/desktop packages still require the same audit; no final package-documentation gate is claimed complete.

**Done when:**

- [ ] A contributor can follow installation and scoped test instructions on a clean clone.
- [ ] Licenses and package documentation appear in final tarballs.
- [ ] Public visitors can access the repository, examples, docs, and issue route at announcement time.
- [ ] Upgrade/re-pairing instructions and known limitations are published.
- [ ] One person is assigned to triage launch issues and maintain the release notes.

### PRJ-12 — Run an independent pilot and prepare the Tether briefing

**P0 for launch evidence · Product + Pilot · M plus participant availability · Depends on the launch path and website draft**

Recruit three colleagues unfamiliar with the implementation. Ask each to follow the website, run the reference app, and make one small change with their usual supported assistant. Record setup time, time to first running app, successful real inference, successful persistence/P2P checks, interventions, and confusing terminology. Separate model download/toolchain time from app-building time.

Proposed acceptance target: all three can complete the documented core path without private instructions or source patches. Set a provisional 30-minute target after prerequisites and model download, then report the actual distribution rather than turning the target into a marketing guarantee. An unexplained blocker is a failed pilot attempt and should be fixed and retested.

For a performance comparison, add fresh-session attempts using current official docs/skills under the same model/tool/task/time budget. This comparison is useful evidence, but not required to launch if numerical productivity claims are removed. Treat the existing “50+ prompts to 2” as a labeled historical case study.

**Done when:**

- [ ] Pilot observations and resulting fixes are recorded, including unsuccessful attempts.
- [ ] The core flow succeeds without author-only knowledge.
- [ ] The briefing contains one problem, one demo, measured evidence, and one concrete collaboration request.
- [ ] No benchmark anecdote is presented as a general success rate.

### PRJ-13 — Execute a controlled release and verify the public journey

**P0 · Release + Web · M plus publishing/signing dependencies · Depends on all in-scope gates**

Freeze the candidate commit and evidence. Prepare versioned release notes, known issues, package checksums, and previous working website deployment. If shipping desktop installers, verify signing/notarization and clean installation/uninstallation per advertised platform; development/package-smoke success is not sufficient.

Validate artifacts privately, publish eligible packages in dependency order, check registry availability, then deploy the matching website and make the public repository/example links accessible. Run the public install journey in an anonymous environment before announcing. Reconfirm that preview instructions use the intended version/tag.

Rollback means restoring the previous website deployment and redirecting install guidance to a known working version; deprecate or supersede a broken npm release as appropriate. Do not assume npm versions can be overwritten, and do not roll back a user's data format automatically. Announce only after the public smoke passes.

**Done when:**

- [ ] Public artifacts and instructions match the frozen release record.
- [ ] Anonymous install, first app launch, example access, and issue submission entry point work.
- [ ] Website rollback and package incident procedures are documented.
- [ ] A launch owner has checked the complete journey after deployment.

## Execution sequence and dependencies

| Phase | Project focus | Website focus | Exit gate |
| --- | --- | --- | --- |
| 1. Fix the promise | PRJ-01; start package/bootstrap and QVAC investigations | WEB-01 positioning and content inventory | One supported journey and explicit scope |
| 2. Make it work | PRJ-02–08 and PRJ-10/11, focused on included surfaces | WEB-02–06 drafts using real commands and evidence | Candidate artifacts run end to end |
| 3. Make it understandable | PRJ-09 reference app; PRJ-12 pilot | WEB-07 usability, WEB-08 metadata, WEB-09 validation | Independent colleagues complete the journey |
| 4. Release | PRJ-13 | Production route/link/command verification | Public journey passes before announcement |

Work can overlap, but final copy depends on real release capabilities. Do not record the final demo or freeze install commands before candidate behavior and versions are stable. Unresolved mobile/signing issues can delay those surfaces without delaying a correctly scoped toolkit release.

For one primary maintainer, plan this as several focused iterations rather than a weekend of polishing. Re-estimate after the packaging and real-model investigations; they dominate uncertainty. Set a date only once those paths work.

## First five implementation tickets

1. PRJ-01: write the release manifest and support matrix; decide whether optional Node ships.
2. PRJ-02: produce installable candidate artifacts and a clean consumer smoke.
3. PRJ-04: restore real-QVAC validation for the current runtime structure.
4. PRJ-03 + WEB-02/03: repair the existing onboarding messages and copyable website path.
5. PRJ-05/06 if Node ships: close default-trust and misleading protection-status gaps.

This sequence starts with the uncertainties that could change scope. Visual polish can proceed once the public story and example are stable.

## Launch decision checklist

- [ ] Scope/version/platform manifest is complete and accurate.
- [ ] All applicable P0 tasks pass against the same candidate commit/artifacts.
- [ ] Local AI is demonstrated with a real model on the documented platform.
- [ ] Optional services remain optional; included services have safe trust defaults and truthful status.
- [ ] Website commands, assistant instructions, README, example, and packages agree.
- [ ] Three independent pilot participants complete the core journey after fixes.
- [ ] Public repository, licensing, support, limitations, and upgrade notes are ready.
- [ ] No unsupported numerical speed claims, payment claims, or backup guarantees remain.
- [ ] Desktop/mobile features without evidence are explicitly deferred or experimental outside the core journey.
- [ ] Public smoke, rollback procedure, and launch issue ownership are ready.

Each completed gate should retain: task ID, commit, artifact/version, date, environment, check result, evidence link, and remaining limitations. Store the candidate record under `planning/status/`; one concise record is sufficient.

## Follow-up after launch

For the first two weeks, manually review incoming issues and onboarding feedback, fix install/data/trust regressions first, and publish short patch notes. Track successful example builds and recurring support problems. Do not require telemetry or a new account system to use the toolkit; voluntary pilot reports are enough initially.

Consider the next platform, a real WDK integration, broader reference apps, and improved one-command setup only after the primary path remains stable. Stable consumer Personal Node additionally needs verified identity/data recovery, deletion, upgrades, resource-pressure behavior, and a deliberate update strategy.
