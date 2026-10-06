# Unstoppable Stack — developer preview briefing

Draft for review, 5 October 2026. The preview is not publicly released.

Developers combining local inference with P2P storage and networking face integration work across browser, Electron and Bare runtime boundaries. Unstoppable Stack packages the working patterns as a small CLI, generated assistant guidance and a maintained desktop example so a developer can reach a working app and make a visible change with their usual coding assistant.

The first preview focuses on macOS Apple Silicon desktop apps with local data and QVAC inference. Personal Node, mobile, wallets and other planned products are outside this release.

## Demonstration

Open Coffee Assistant, load its real local model, and ask a coffee question. Save a named order and retrieve it after restarting. Repeat a question with external networking disabled once the model is cached. Open a second isolated instance and fetch the first instance's saved order using its sharing key. The two-app test currently passes with a real local DHT test network; public discovery timed out and must be resolved before presenting an Internet peer demo.

The example is first-party source under `examples/coffee-assistant`, not evidence of independent customer adoption. Its AI gives advice; saving and sharing orders use explicit controls. No payment or autonomous order-placement flow is demonstrated.

## Measured evidence

- CLI regression checks: 260 tests passed, 14 explicitly skipped. Canonical and bundled guidance match across 104 files.
- Current packed CLI: isolated installation, Codex workspace initialization and local-AI desktop generation passed in six seconds. The fresh generated-app install failed on a network reset; a populated-cache retry passed the retained tarball through real app inference, recovery and offline restart with persistence in 62 seconds. This is not a frozen-candidate or clean-machine release pass.
- Maintained example: real QVAC output, visible error/Retry, streamed cancellation and recovery passed. A network-isolated restart retrieved the prior unique saved value before writing and completed real inference.
- Latest offline warm sample: 1.021 seconds to model-ready and 1,756 MiB for the application process tree on the validation Mac. These are observations from one machine, not minimum requirements or comparative performance claims.
- Independent pilots have not run. No general productivity improvement or success rate is claimed.

## Collaboration request

Provide one independent QVAC validation partner and runner for the scoped desktop path, including cold first-download, interrupted-download recovery and resource measurements. The immediate deliverable would be a reproducible acceptance report against the same candidate artifact, plus review of model-source/redistribution guidance. This would complement three developer onboarding pilots before a controlled public preview release.

Before external presentation, substitute final candidate checksums and clean-machine results, attach the matching short demo, resolve public peer discovery, and include the independent pilot outcomes. See `public-launch-progress-20261005.md` for the current gates.
