# Agent pack and runtime boundary review

Reviewed: 9 October 2026. Scope: the current working tree, including ongoing CLI/QVAC migration changes. This is an architectural review; no implementation files were changed.

## Recommendation

Reposition the agent pack as a guide to using, extending, diagnosing, and upgrading Unstoppable apps. Make tested code own reusable infrastructure behavior. Let upstream documentation own the full QVAC/Holepunch API reference.

The agent pack still has a valuable job: explaining our runtime boundaries, local-first behavior, feature composition, trust model, and acceptance checks. Reproducing upstream SDK tutorials creates a second maintenance burden and conflicting instructions. Removing all local guidance would lose offline access and project-specific integration knowledge, so retain a small versioned compatibility reference and local contract documentation.

Start with desktop local AI, the public-preview journey. Do not expand a common abstraction to every SDK capability or promote the deferred AI node pack to the default before validating it.

## Findings

### 1. High: shipped guidance has conflicting compatibility contracts

- `packages/agent-pack/src/modules/qvac.mdc:55` states that QVAC removed `n_discarded`; `src/components/ai/model-manager.ts:76` still passes it to `loadModel()`.
- `src/skills/add-ai-chat/SKILL.md:19` directs agents to configure reasoning at load time and avoid filtering reasoning tags; `src/components/ai/chat-session.ts:70` still filters streamed `<think>` blocks.
- `src/core/scenarios.mdc:81` recommends `loadModel({ ... delegate: ... })`, while `src/modules/qvac.mdc:71` says that API was removed in 0.19.
- `src/core/cheatsheet.mdc:27` calls SDK 0.15 the latest stable version; desktop and Node generators now use 0.21.
- `src/core/verified-versions.mdc` instructs agents to always use its versions and lists Electron 40.2.1, Hypercore 11.27.0, and Corestore 7.8.0; the desktop generator emits Electron 44.5.1, Hypercore 11.37.2, and Corestore 7.13.0 ranges.

This is already a maintenance failure, not just a future risk. An agent can follow a shipped reference faithfully and regress a migrated app. The source/bundle equality check passes because it detects copying drift, not semantic contradictions.

Keep intentional platform differences: Expo remains deferred on a separate SDK 0.15 toolchain. The problem is guidance that presents old behavior as universal rather than selecting it through an explicit runtime/version profile.

### 2. High: reusable components are neither the scaffold's implementation nor an installed library contract

`packages/agent-pack/src/components/` contains eight TypeScript helpers. The content loader in `packages/cli/src/agent-pack/index.ts` loads core, modules, recipes, skills, and hooks, but does not load components. The app generators independently emit their own implementations.

For example, `add-p2p-sync/SKILL.md:32` claims the project includes `src/p2p/swarm-manager.ts`, `src/p2p/replication.ts`, and `src/data/corestore-manager.ts`, and imports their classes. Node scaffolding emits `src/swarm-manager.ts` and `src/storage-manager.ts`; desktop scaffolding embeds infrastructure in `worker.js`.

Consequently, these components do not currently shield generated apps from upstream changes. They form another implementation to maintain, and the skill can produce missing imports. Either promote validated helpers into real packages used by generators, or remove obsolete component assumptions. Do not treat copyable snippets as a supported abstraction.

### 3. High: the existing AI node abstraction is not ready to become the common local AI layer

`packages/node-caps-ai` is explicitly a deferred alpha for delegated inference. Its real-model workflow installs SDK 0.15, while desktop/Node scaffolds have moved to 0.21. Its provider has a useful injection seam, but it does not provide the desktop contract for bounded context, model configuration, request ownership, and native cancellation.

`src/index.js:54` checks `ctx.signal` between yielded tokens. `src/provider.js` does not accept that signal or explicitly call QVAC cancellation. This does not establish that a native operation promptly stops when a peer disconnects or a consumer breaks its loop. SDK iterator cleanup might provide some behavior; it must be verified rather than assumed. The mock test confirms a subsequent request works; the real-model test checks non-empty output, not native cancellation and recovery.

Extract a local inference/session contract separately from its P2P exposure. The capability pack can consume that contract after passing current-version tests. Apps should not need to create or pair with a Personal Node merely to run local inference.

### 4. Medium: hardcoded output adds another source of API guidance

`packages/cli/src/agent-pack/index.ts` embeds AI instructions in generated Claude agents, Cursor rules, OpenCode content, and Codex root instructions. Updating `src/modules/qvac.mdc` does not update those strings. The Codex foundations skill also tells agents to read all core references before implementation, including stale compatibility guidance.

Generate tool-specific wrappers from one content model. Keep always-loaded guidance short and application-specific. Upstream API usage should be selected by the app's actual runtime and installed dependency profile.

### 5. Medium: the pack lacks the app metadata needed to tailor guidance

`BuildOptions` receives assistant, template, directory, and project name, but no platform, selected features, compatibility profile, or runtime-library version. All modules and skills are emitted. The separate `us scaffold app` command writes app files without attaching a matching agent profile or persistent upgrade manifest.

This distinction matters: `us init` configures a workspace, and `us scaffold app` creates executable apps. A workspace may contain multiple apps. Guidance should discover those apps and their contracts rather than assume one generic `src/ai` directory or advertise every experimental feature.

Several advanced skills also refer to repository-local `research/` material that is not shipped into generated apps. Replace those references with accessible upstream links or bundled, explicitly versioned integration notes.

## Proposed ownership

| Layer | Owns | Should avoid owning |
|---|---|---|
| Upstream docs and installed types | Full SDK APIs, models, plugins, release notes | Unstoppable app architecture |
| Unstoppable runtime packages | Model/session lifecycle, cancellation, normalized errors/events, validated P2P boundaries | A second implementation of every QVAC feature |
| CLI | App assembly, dependencies and native packaging, profile metadata, upgrade checks | Repeated copies of runtime behavior |
| Agent pack | Choose an integration, extend app code, preserve boundaries, diagnose and validate | Broad SDK tutorials and hand-maintained dependency tables |
| App | Screens, domain data/schema, prompts, business logic, feature policy | Native engine initialization scattered through UI code |

The SDK already drives a Bare worker and provides a typed API. Our additional abstraction should own app integration and lifecycle policy, not merely rename SDK functions. The official [JS/TS guide](https://docs.qvac.tether.io/sdk/js-ts-sdk/) covers Node, Expo, and in-process Bare; [release notes](https://docs.qvac.tether.io/sdk/reference/release-notes/) describe compatibility changes. Those are appropriate first sources for SDK details.

## Suggested contract

Use a small local AI session interface: load with progress, stream with request identity and an abort signal, cancel, close, and inspect readiness/capabilities. Normalize app-facing content/progress/error events. Specify concurrency, history ownership, overflow recovery, and shutdown behavior explicitly.

Provide separate Node SDK and Bare inference adapters. Keep Electron renderer/IPC outside native adapters. Leave Expo experimental until physical-device validation. Advanced tools, vision, RAG, and custom plugins can initially use documented adapter extensions or direct SDK access behind the same runtime boundary; do not promise a universal API prematurely.

Cancellation requires an adapter implementation that translates abort into the SDK's supported cancellation scope, waits for settlement where needed, rejects late events, and verifies reuse. It is not satisfied by suppressing display tokens. Document any per-model cancellation/concurrency constraint instead of implying isolated per-request cancellation.

Apply the same principle selectively to P2P. `node-core` already owns identity, pairing, and capability transport. Use it for that purpose. Do not require its pairing/grant model for a simple replicated database. Keep domain schemas and deterministic merge policy app-owned; extract only demonstrated recurring lifecycle and replication plumbing.

## Migration sequence

1. **Repair the current pack first.** Remove or label obsolete components and legacy SDK examples; eliminate contradictory hardcoded rules; fix imports and repository-only links. Retain integration gotchas, runtime boundaries, offline behavior, and release checks.
2. **Introduce one compatibility manifest.** Record platform, maturity, runtime/library versions, tested upstream combination, model identity/revision, and validation evidence. Generate dependency declarations and compatibility summaries from it. Have scaffolded apps record their profile and generator version in `.unstoppable/project.json` (proposed filename).
3. **Extract desktop AI lifecycle into tested code.** Start from the current generated worker and chat-context helper. Make the desktop generator consume it; implement the Node adapter next. Keep application UI and prompts editable. Do not silently upgrade existing generated apps.
4. **Make the pack contract-oriented.** Consolidate basic AI setup skills into extending generated AI apps, runtime diagnosis, and compatibility upgrades. Replace unvalidated advanced SDK tutorials with concise pointers and clear maturity labels. Support workspace-level app discovery and per-app guidance.
5. **Add safe upgrades.** Compare recorded profiles, report incompatible changes, and offer explicit migrations. Never suggest regenerating an existing edited application with `--force` as a normal upgrade path. Installed versions must select guidance; current web docs alone are insufficient for older apps or offline work.

## Validation needed

- Compile/run maintained examples against their declared adapter/profile rather than checking code strings alone.
- Test local adapter contracts and capability transport separately, then together where used.
- Test cold download, interrupted download/retry, cached network-isolated restart, missing addon, oversized history, overflow recovery, Stop during real inference, Stop followed by another request, and cleanup during an active operation.
- Check emitted agent links/imports, compatibility statements, and feature maturity for each assistant format. Keep source/bundle equality as a useful additional check.
- Upgrade one upstream combination at a time and prove an existing app using our public contract still passes. An abstraction contains maintenance work; it does not remove upstream, native ABI, or packaging compatibility requirements.

## Checks performed

- Read the generators, pack builder, core/module references, representative skills/resources, reusable components, AI provider/capability code, real-model test, and relevant workflows.
- Confirmed source and CLI bundle equality: 104 files match.
- Ran focused Vitest suites for chat context, Node generator, desktop generator, and scaffold command: **130 tests passed across 4 files**.
- Checked current official QVAC documentation and release notes.
- No real inference, native build, dependency upgrade, or upstream submodule update was performed for this review. Passing generator tests does not validate the stale snippets or establish native cancellation.

Success should mean one upstream change is handled inside a small adapter and one compatibility profile, with app code and agent workflow guidance still working. That is the useful measure of change resistance.
