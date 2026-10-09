# Mobile compatibility acceptance — 9 October 2026

Baseline: merged PR #8, `c13ffc8334a2ae9b5f426c7856c4704a283ebbea`. Work is isolated on `codex/mobile-qvac-compatibility`; the original checkout and its local edits are preserved.

## Result and scope

Fresh Expo Mobile `bare` and `local-ai` scaffolds both install, prebuild, compile for the iOS arm64 simulator, launch and pass Maestro UI acceptance. The tests now require actual Hyperbee write/read through the React Native → IPC → Bare RPC boundary and retrieval after app-process restart. The local-AI variant additionally passes explicitly mocked chat. Native SDK bundle generation and verification pass with QVAC 0.21.

Mobile remains a deferred source target outside the minimal public CLI. No physical-device inference, Android native build, peer replication or node-sync integration was established. Worker readiness alone is not evidence of discovery or replication, despite the legacy scaffold label “Discovery active.” Human-dependent launch and device gates remain set aside.

## Changes

- SDK exactly `0.21.0`, Bare kit exactly `0.15.6` (embedded Bare `1.33.4`), Expo 54 / RN `0.81.5` retained. Host Node minimum is `22.17`.
- React DOM is pinned to `19.1.0` alongside React. A fresh install previously selected the newer optional React DOM peer and failed with ERESOLVE.
- `qvac.config.json` selects only the llama.cpp completion plugin. The SDK Expo plugin installs required published platform prebuilds, verifies its bundle, and refreshes manifest-aware linking. Resolved SDK inference `0.21.0`, LLM `0.55.0` and Fabric platform packages `0.18.1` are retained in the evidence metadata.
- Removed the rejected `n_discarded` setting and switched completion UI to SDK events with terminal error propagation. The related model-manager component and inference guidance no longer teach that removed field.
- The outer scroll view now delivers button taps while the keyboard is open; storage submission dismisses the keyboard. The stronger test reproduced the swallowed Save tap before the fix. Earlier “pass” results only checked button taps and could hide this failure.
- Maestro now requires Saved, the fetched value and the same value after restart. Automatic error-overlay dismissal was removed after it stalled on a stale warning; error overlays must remain visible to fail startup acceptance. Simulator installation and Maestro use the chosen device ID explicitly.
- Non-mock mobile inference is refused on simulators before download, with physical-device and mock-mode instructions. GPU/CPU choice remains available for real devices.
- Canonical agent-pack guidance and the CLI-bundled copy match. Old postinstall/manual linker instructions were replaced with the current SDK-owned build flow.
- A separately named deferred-mobile CI lane builds fresh `bare` and `local-ai` iOS variants on PRs and main. It retains E2E reports, package/CocoaPods lockfiles, prebuild logs and native compiler logs. It does not run or claim real model inference.

## Local evidence

Host: macOS Apple Silicon, Xcode `26.6` (`17F113`), Maestro `2.3.0`. A dedicated disposable iPhone 17 simulator used iOS `26.5`. [Evidence](evidence/20261009-mobile/) contains reports, genuine screenshots, regression output, SDK prebuild output and package/file checksums.

| Check | Result |
| --- | --- |
| Fresh native + Level-5 bare variant | Passed: startup, KV write/read and restart persistence |
| Fresh native + Level-5 local-AI variant | Passed: same KV checks plus mocked chat |
| Non-mock simulator refusal | Passed: CPU selection refuses before download, followed by restart/persistence checks |
| SDK Expo prebuild | Passed: both platform bundle checks and iOS native linking |
| Generated Expo app + updated model-manager TypeScript | Passed against installed SDK 0.21 declarations |
| Complete CLI tests | 280 passed |
| CLI TypeScript and minimal build | Passed |
| Packed core CLI consumer smoke | Passed in 12 seconds; no new real desktop model test was performed |
| Agent-pack source/bundled parity and workflow syntax | Passed |

Local runs used the tested working tree; source SHA-256 identities are retained in the evidence folder and the implementation commit is recorded after commit. The non-mock refusal check reused the successful native build (`--skip-build`); it did not perform inference. Hosted native results are linked from the PR once available. The original frozen desktop CLI artifact/checksum is unchanged; the new branch’s smoke artifact does not replace that release candidate.

## Hosted toolchain correction

The first hosted bare job exposed the macOS 14 default Xcode 15.4, below React Native 0.81’s required Xcode 16.1. Expo returned success despite CocoaPods rejecting that toolchain. The mobile lane now uses macOS 15 and records Xcode identity; E2E prebuild requires the generated workspace and Podfile.lock before passing. This follow-up changes the harness/CI, not the scaffold whose local native/UI evidence was captured.

## Remaining engineering

Physical iOS/Android real inference and Android native execution remain separate acceptance gates. Mobile peer connectivity and opt-in Node integration need their own tests. Personal Node trust/resource controls are the next separate workstream. No package/site publication or release approval was attempted.
