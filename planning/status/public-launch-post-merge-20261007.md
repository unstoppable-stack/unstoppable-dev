# Post-merge desktop demo and Personal Node readiness

Date: 7 October 2026. Baseline: merged PR #7, `b62b6614509d39ced2e06b34c92c43500463b7fc`.

## Desktop preview

The [new 126-second Coffee Assistant walkthrough](evidence/20261007/demo/coffee-assistant-walkthrough.mp4) uses genuine QVAC 0.21 inference and seven fresh screenshots from the merged example. It shows local persistence, public-DHT discovery, retrieval by a separate instance, restart, and a fresh value after reconnect. [Capture details](evidence/20261007/demo/README.md) explain that both instances ran on one Mac. This is automated example evidence, not an independent pilot or continuous screen recording.

The frozen CLI candidate and its checksum remain unchanged. No npm/site publication, repository administration, or human pilot work was performed.

## Personal Node changes

- Node hosts use the optional QVAC SDK 0.21.0. Bare sidecars use inference 0.21.0 and llama.cpp 0.55.0 directly with the shared runtime adapter; data-only nodes still avoid the native AI installation.
- The default model is Qwen3.5 0.8B Q4_K_M with a 4096-token context and reasoning disabled. Model configuration can be overridden by the host.
- Native completion is serialized per provider. A concurrent request receives a busy error. Abort signals and early stream return cancel the specific native request, allowing another request on the same model.
- A real-model test exposed a transport bug: returning from a client stream marked the local queue finished before the cleanup check, so CANCEL never reached the host. The transport now distinguishes natural exhaustion from consumer return. A regression test waits for the remote abort signal and verifies that the connection remains usable.
- Production package dependencies use alpha version ranges rather than repository-relative `file:` paths. Local development links remain in devDependencies. The desktop packaging hook materializes all four internal packages into the application.
- Corestore, Hypercore, HyperDHT, Hyperswarm, bare-fs, and bare-sidecar receive compatible updates. Hyperdrive remains on 12.3.0. The deferred Node desktop moves to Electron 44.6.0; the existing preview stays on its previously accepted Electron version.
- The release gate rejects local production dependency specifications. A new isolated consumer smoke packs, installs, resolves and exercises all four Node packages outside the checkout with a real paired P2P connection and mock inference.
- Node workflows use Node 22; publishing workflows retain Node 24. Desktop CI now includes the isolated tarball consumer on macOS, Linux and Windows.

## Local acceptance

All local native tests ran on macOS Apple Silicon. Results are linked in [the evidence folder](evidence/20261007/node/).

| Check | Result |
| --- | --- |
| node-core | 81 passed |
| node-caps-sync | 7 passed |
| node-caps-ai | 11 passed; optional real-model case skipped in ordinary suite |
| unstoppable-node | 24 passed |
| node-desktop | 65 passed; optional Electron-sidecar E2E skipped locally |
| Opt-in Node SDK real model | Passed: delegated P2P completion, early cancellation and subsequent completion |
| Packaged Bare-sidecar real model | Passed: native load, completion, early cancellation and subsequent completion |
| Packaged metadata, size and Electron fuses | Passed; application resources approximately 248 MiB |
| Isolated four-tarball consumer | Passed; fresh installation and paired P2P capability composition |
| Desktop production dependency audit | Zero reported advisories |
| Strict release gate and workflow syntax | Passed |

Real-model checks used an existing local Qwen3.5 GGUF. They do not prove a new Node cold download, Node network-isolated recovery, physical-device mobile support, or resource safety for untrusted clients. The model was not bundled in the app. Artifact identities from a clean source commit are recorded separately in the evidence folder.

## Preservation and remaining scope

The original `feat/personal-node-ux` checkout and its unrelated local edits were preserved. Its binary diff, index diff, local file archive and manifest are stored in the ignored `sandbox/post-merge-preservation-20261007/` directory. Implementation was performed in the isolated managed worktree.

Personal Node remains a deferred development alpha. Registry publication, trust defaults, request/resource bounds, replication-status acceptance and broader OS real-model evidence still need their own gates. Portable tarballs do not establish that the unpublished dependencies resolve from a public registry.

Mobile SDK/Bare-kit migration and native simulator validation are the next separate engineering phase. Physical-device testing and independent launch pilots remain human-dependent and set aside at the user's request.
