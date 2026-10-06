# Technical launch progress — 6 October 2026

Human-dependent pilots, ownership, clean second-machine access and account administration are intentionally pending at the user's request.

## Gates advanced

- **Public peer discovery:** passed. All three public bootstrap nodes replied to diagnostic pings. The sender now reports completion of its DHT announcement; the test waits for that before the recipient discovers it. The previous timeout was reproduced before this correction.
- **Disconnect/reconnect:** local and public DHT tests passed visible graceful disconnection, saved-order persistence after sender restart, and retrieval of a newly updated order after reconnect. Reads wait for the remote replication handshake and update, preventing an old downloaded copy from being reported as a fresh peer fetch.
- **Cold model download:** used a separate initially empty QVAC model cache. The pinned 532,517,120-byte GGUF reached model-ready in 16.122 seconds; full process-tree RSS was 1,716.6 MiB on this Mac. SHA-256 matched `bd258782e35f7f458f8aced1adc053e6e92e89bc735ba3be89d38a06121dc517`. The older harness labeled this measurement “warm”; the cache was actually empty and the harness now distinguishes cold runs explicitly.
- **Interrupted download:** killed the test app during an actual transfer after 1,179,648 bytes. Restarting with the same isolated cache recovered the complete model, matched its checksum and completed real inference in 12.639 seconds to model-ready. The recovered model completed another prompt after a network-isolated restart. Temporary test caches are removed; user model caches are untouched.
- **SDK configuration repair:** QVAC 0.15.0's Bare loader called an unavailable CommonJS `require` from an ESM worker. The generator and example now supply `bare-module.createRequire` using the current module record as referrer, which preserves its loader and filesystem protocol. A loader created without the referrer could not access external JSON config files; this was also reproduced and corrected. Both source/bundled desktop guidance document the tested adapter.
- **CI alignment:** added a public-preview workflow testing packed CLI installation through the generated desktop UI on macOS arm64, with explicit mock versus opt-in real-model settings and retained evidence. Deferred/full-profile generators run under explicitly experimental lanes and use the full build. YAML and actionlint validation pass; remote CI execution is not yet claimed.

## Validation boundaries

These results are implementation evidence on the current Mac. They do not substitute for an independent pilot or another clean machine. Public-DHT acceptance uses two distinct app/storage instances on this machine; cross-device Internet/NAT reachability is not a universal support guarantee. The disconnect case uses graceful app/worker shutdown; abrupt network loss may take longer to detect.

The selected [GGUF publisher page](https://huggingface.co/unsloth/Qwen3.5-0.8B-GGUF) labels the model Apache-2.0; the [upstream Qwen license](https://huggingface.co/Qwen/Qwen3.5-0.8B/blob/main/LICENSE) is linked for attribution. The toolkit does not redistribute weights in its npm tarball or repository.

## Candidate validation

The technical candidate is frozen at `3ce97590ba2c85eca49917327226d77f69fa3716` on `codex/public-preview-candidate` in a dedicated managed worktree. The original checkout retains its unrelated changes. [Draft PR #7](https://github.com/unstoppable-stack/unstoppable-dev/pull/7) contains the scoped implementation for review.

The final `@unstoppable-stack/cli@0.4.0-beta.1` artifact is 245,727 bytes, SHA-256 `94afd44a4bb6b62008197785ded043547669da117d6f06869635969d6d1ff3f1`. Its [identity manifest](evidence/20261006/artifact-manifest.json) records the clean candidate commit. The identity tool does not approve publication; the release contract separately records the freeze.

Fresh isolated npm prefix and cache acceptance passed in **65 seconds**, including installation of all 202 generated-app dependencies. The exact artifact passed public command/catalog/doctor checks, Codex workspace setup, generation, actual worker/storage/UI, real inference, forced model failure/retry, cancellation/reuse and network-isolated second launch fetching the previously saved unique value before writing. Warm/offline model-ready times were 1.035/1.021 seconds; process-tree RSS was 1,680.7/1,674.8 MiB. Build/test tools were reused, so this is a fresh consumer install on the current Mac, not independent clean-machine evidence.

An initial frozen artifact failed to launch because the Bare loader referrer had also been inserted into the generator's Node/Electron entry point. The Node loader was corrected, a test now executes its generated initializer under Node, and five affected snapshots were updated. The final regression suite passed **261 tests, with 14 skipped**, plus CLI type checking. Candidate website lint/type/build passed with 26 routes; actionlint passed for both CLI workflows.

The frozen maintained example separately passed public peer retrieval, graceful disconnection, restart persistence and a fresh revised value after reconnect. A real transfer interrupted at 1,114,112 bytes recovered the checksum-verified 532,517,120-byte model in 17.681 seconds to ready and completed real inference, followed by another network-isolated completion. Detailed logs are retained in `evidence/20261006`.

Matching [screenshots and a 126-second screenshot walkthrough](evidence/20261006/demo/README.md) show the same candidate running real QVAC, local storage, public discovery and peer retrieval/reconnect. This is an automated demonstration from one Mac, not a newcomer pilot.

Remote CLI and website checks passed on PR #7. Both mock-UI and opt-in real-model preview jobs passed; final runner results are recorded below. No npm or website publication has occurred.

## Remote checks and audit

[Remote preview UI acceptance](https://github.com/unstoppable-stack/unstoppable-dev/actions/runs/37444320651) passed on a fresh hosted macOS arm64 runner in 103 seconds with explicitly mocked AI. Its tarball checksum matches the locally real-tested artifact exactly. [CLI CI](https://github.com/unstoppable-stack/unstoppable-dev/actions/runs/37444320520) and [website CI](https://github.com/unstoppable-stack/unstoppable-dev/actions/runs/37444320648) also passed. The separate opt-in [real-model hosted-Mac run](https://github.com/unstoppable-stack/unstoppable-dev/actions/runs/37444526632) also **passed**, against the exact frozen commit and identical artifact hash. Complete acceptance took 169 seconds; first model-ready was 52.300 seconds and offline cached ready was 3.158 seconds, with process-tree RSS of 1,650.5/1,608.2 MiB. The fresh host had no installed model; the older harness still labels its first load “warm”, so this report records first-use timing explicitly. This closes automated second-Mac validation; independent human onboarding and assistant-edit acceptance remain pending.

The current core CLI production audit reports zero known findings across 69 production dependencies. This does not cover the whole generated desktop app or deferred Node packages.

## Remaining items set aside

Named owners, independent selected-assistant/pilot reproduction, public repository/support/security account setup, publication decisions, production registry/website verification and hosting rollback remain pending. They require people, account administration or a published release. Available technical fixes, artifact acceptance, maintained-example tests and current CI are complete for the frozen desktop scope. Deferred Node/mobile/payment work stays outside this release. A later documentation-only evidence commit can reference this immutable tested runtime commit without rebuilding or changing the retained tarball.
