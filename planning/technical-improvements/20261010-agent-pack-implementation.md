# Agent pack and maintained runtime implementation

Implemented 10 October 2026 on the existing working tree, following [the architectural review](20261009-agent-pack-review.md). Existing unrelated changes were preserved. At initial delivery, nothing had been published or committed; the PR preparation below records subsequent integration.

## Ownership implemented

- **Runtime:** `packages/runtime-ai/src/` owns local AI loading, retry, one active request, bounded history, native cancellation, settlement, normalized error codes and shutdown. Bare and Node adapters isolate QVAC-specific APIs and load native modules lazily. Mock mode uses the same session and is visibly identified. Failed cancellation is an error, not a claim that Stop succeeded. App history, prompts, IPC and domain logic remain app-owned.
- **CLI:** Desktop and Node local-AI generators vendor the maintained runtime into `.unstoppable/runtime-ai/`; no unpublished npm dependency is required. Expo keeps its separate experimental implementation. Dependency declarations, model identity, platform maturity and runtime requirements come from `packages/cli/src/compatibility/profiles.json`. Generated `.unstoppable/project.json` records the app contract and `.unstoppable/APP.md` explains integration boundaries.
- **Agent pack:** Thin tool-specific wrappers route to on-demand integration references. QVAC tutorials, contradictory AI components, repeated lifecycle implementations and the copied scaffold/version tables were removed or replaced with maintained contracts and version-matched upstream documentation. Existing source skills are retained as concise workflows, with new `upgrade-stack` and `diagnose-stack-runtime` skills. Remaining P2P references stay on demand; legacy component snippets are explicitly references, not installed app helpers.
- **Upgrades:** `us compatibility list -o <workspace>` discovers apps. `us compatibility check -o <app>` reports profile, declaration, engine, exact lock-pin and vendored-runtime differences without modifying files. It preserves app edits and requires explicit migration. It does not certify arbitrary semver-resolved graphs or implement automatic upgrades.
- **Asset maintenance:** `node scripts/sync-stack-assets.mjs` generates CLI runtime sources, compatibility guidance, the QVAC contract and the bundled agent pack. Build/prepack hooks run it; checks detect stale assets and source/bundle drift.
- **Example:** Coffee Assistant uses the same vendored session while retaining its coffee prompt, order storage and peer-sharing behavior. Its compatibility check matches the current profile.

## Validation

| Gate | Result | Scope |
|---|---|---|
| CLI top-level unit/generator/compatibility/agent-pack suites | 250 tests passed across 13 files | Current snapshots, profile recording, read-only differences, emitted guidance and source links |
| Runtime contract tests | 10 passed | Lazy adapter mapping, load retry/deduplication, abort/native cancellation, stale cancel IDs, consumer break, shutdown during load/inference, cancellation failure, UTF-8 bounds and overflow behavior |
| TypeScript and minimal CLI build | Passed | CLI source and generated declarations |
| Revised skill validation | 16 skills passed | Frontmatter and skill format |
| Generated assets and agent-pack parity | Passed; 105 files match | Canonical source/bundled copy |
| Pack/install CLI smoke | Passed | Isolated npm prefix/cache, minimal command surface, workspace init, app generation, vendored runtime syntax; [log](../status/evidence/20261010-agent-pack/packed-cli-smoke.log) |
| Real desktop/native acceptance with external networking denied | Passed | Final generated worker, cached QVAC model, missing-model retry, actual output, Stop/reuse, bounded history, oversized request recovery and UI; [report](../status/evidence/20261010-agent-pack/desktop-native-offline.json) |
| Coffee example peer integration | Passed | Two real app instances using a local DHT: unique remote order, visible disconnection, persistence across full restart and updated order after reconnect |
| Coffee compatibility inspection | Matches, no mutations | Existing resolved dependency versions included in [report](../status/evidence/20261010-agent-pack/coffee-compatibility.json) |

Native desktop validation ran on macOS Apple Silicon with Node 22.21.1. The generated test app reused the maintained example's already installed native dependency graph through a node_modules symlink and an existing model cache. Scaffold/install steps are explicitly marked skipped in its native report. The packaged CLI install used its own temporary prefix/cache; it did not install the generated app's large native graph. These are distinct checks.

## Remaining acceptance limits

Fresh generated-app dependency installation, cold/interrupted download through the new runtime, missing-native-addon failure, other operating systems and independent reproduction remain unverified by this change. Runtime contract tests cover active-operation shutdown, but no dedicated real-native active-shutdown acceptance was added. Node's adapter has contract/mock coverage and remains experimental pending native acceptance. Expo remains experimental pending its own device/native gates. Personal Node capability packages were not migrated to this runtime or promoted to the default path. Coffee's public-DHT and inference-download evidence from 5–6 October does not automatically establish those gates for the migrated runtime.

The compatibility manifest records the passed macOS cached native/offline check while retaining fresh-install acceptance as pending. App metadata is descriptive; a matching profile is not a native support certificate. Existing generated apps remain at their recorded implementation until deliberately migrated; editing the library alone does not silently update them.

## Development commands

```sh
node scripts/sync-stack-assets.mjs
node scripts/sync-stack-assets.mjs --check
node scripts/check-agent-pack.mjs
node --test packages/runtime-ai/test/*.test.js
cd packages/cli
npx vitest run src/__tests__
npx tsc --noEmit
```

The agent pack now guides app integration; SDK changes should primarily be absorbed in the maintained adapter and a compatibility profile, followed by the affected native acceptance gates.

## PR integration — 11 October 2026

Prepared an isolated `codex/agent-pack-runtime-contracts` branch from main at `d3edcac`, preserving unrelated changes in the original workspace. Main had since merged the Expo QVAC 0.21 compatibility work and Personal Node controls. The new manifest captures main's existing dependency declarations; the Expo generator retains its QVAC config, manifest-aware prebuild option, simulator guard, completion event handling and keyboard/storage fixes. The mobile acceptance harness and CI changes remain intact. The pack's desktop skill now delegates plugin registration and context handling to the maintained runtime instead of referencing the deleted helper.

On this integrated branch, the complete CLI suite passed **277 tests** with 14 opt-in tests skipped, runtime contracts passed **10 tests**, and TypeScript/minimal build passed. Pack/install smoke passed with an isolated npm prefix/cache. Real cached native desktop acceptance passed again with external networking denied; the generated app reused the existing native dependency graph and model cache. The migrated coffee example again passed local-DHT retrieval, disconnect, restart persistence and updated retrieval after reconnect. Fresh app install and physical-device acceptance are still distinct pending gates.

Evidence: [packed CLI](../status/evidence/20261011-agent-pack-pr/packed-cli-smoke.log), [desktop native/offline log](../status/evidence/20261011-agent-pack-pr/desktop-native-offline.log), [desktop report](../status/evidence/20261011-agent-pack-pr/desktop-native-offline.json), [coffee peer log](../status/evidence/20261011-agent-pack-pr/coffee-local-peers.log), and [read-only compatibility inspection](../status/evidence/20261011-agent-pack-pr/coffee-compatibility.json).
