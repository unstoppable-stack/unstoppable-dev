# Unstoppable Stack plugin for coding harnesses

**Status:** local packaging prototype implemented; P0 behavior/activation gates and later milestones pending; not published  
**Date:** 11 October 2026  
**First targets:** Codex and Claude Code; Cursor and OpenCode follow through adapters

**Implementation update:** [11 October evidence](../status/evidence/20261011-harness-plugin/README.md) records the entry skill, self-contained packages, host parser validation and regression checks. See [local setup](../../packages/agent-pack/PLUGIN.md) to try the prototype. Parsing checks do not complete P0's model-driven workflow gates.

## Product direction

Make the Unstoppable Stack installable in a developer's coding assistant. After installation, the assistant should be able to turn an app idea into a working local-first target, extend an existing target, diagnose failures, and guide deliberate upgrades using the stack's maintained contracts.

The plugin is the reusable workflow and knowledge layer. The CLI remains responsible for scaffolding, environment checks and compatibility inspection; maintained runtime packages remain responsible for executable infrastructure. Installing the plugin does not install Pear, native addons, model weights or app dependencies. It gives the assistant the instructions and resources to set them up when the task requires them.

**Recommendation:** evolve the existing agent pack into one versioned product with generated distribution adapters. Start with a skills-only plugin that invokes the installed CLI through the harness's existing shell tools. Keep project-local packs as a supported fallback. Add MCP only when a measured workflow gap justifies it.

## Developer experience

1. Install the Unstoppable Stack plugin in the chosen harness through its supported local or marketplace flow.
2. Ask: “Build a desktop coffee assistant with local AI and peer-to-peer order sharing.”
3. The assistant loads the stack entry skill, discovers the workspace and installed CLI, and chooses a supported platform/profile. It asks only for missing decisions that materially affect the result.
4. If tooling is missing, it explains the concrete installation step. It uses a documented, versioned CLI release rather than silently executing an unpinned latest package.
5. It scaffolds into a new directory, reads the generated app contract, installs the required dependencies within normal task authorization, and builds the feature through existing managers and adapters.
6. It validates the changed behavior and reports the exact evidence, including which native/offline checks remain unverified.
7. Later requests such as “add file sharing,” “debug model loading,” or “review an upgrade” route to a focused skill without replaying setup.

For an existing repository, the first action is app discovery and inspection. A project without stack metadata can still receive architecture guidance, but adoption requires a deliberate integration plan. Multiple apps are resolved by target path; the assistant must not apply one app's profile to the whole workspace.

“All necessary” means an accessible architecture guide, platform selection, executable setup path, feature workflows, version-aware references, troubleshooting and validation. It does not mean loading every SDK manual into each conversation. Installed guidance can work offline; initial tooling/model downloads and the coding harness's own inference connectivity are separate concerns.

## Existing foundation and gaps

This audit reflects the current working tree, including the maintained-runtime changes recorded in [the 10 October implementation report](../technical-improvements/20261010-agent-pack-implementation.md).

| Area | Already present | Plugin work needed |
| --- | --- | --- |
| Shared content | `packages/agent-pack/src/`: core, modules, recipes and thin skills with resources | Reuse source; define a curated public plugin surface |
| Harness output | `packages/cli/src/agent-pack/index.ts` emits Claude, Codex, Cursor and OpenCode project packs | Extract shared content assembly from project-specific output |
| App discovery | `.unstoppable/project.json`, `us compatibility list/check` | Entry workflow that handles empty workspaces, old apps and multiple targets |
| AI ownership | `packages/runtime-ai/src/`, vendored into generated desktop/Node apps | Route plugin guidance to the installed app contract; avoid new lifecycle implementations |
| Compatibility | `packages/cli/src/compatibility/profiles.json` | Record plugin/CLI/content compatibility without another dependency table |
| Assets pipeline | `scripts/sync-stack-assets.mjs`, parity checks and agent-pack tests | Add deterministic plugin assembly and artifact validation |
| Cursor package | `.cursor-plugin/plugin.json` points at source rules, skills, agents, commands and hooks | Treat as a prototype until installation/path/content acceptance passes |
| Historical artifacts | Root `agents/`, `commands/`, `hooks/` and conversion script | Audit or replace before inclusion; do not ship merely because files exist |

Two concrete gaps matter before packaging:

- The CLI generates foundation/module/recipe router skills plus `.unstoppable/guidance`. Those routers are not source skills, and a globally installed plugin cannot assume that generated directory exists. All core/module/recipe references need a self-contained plugin route.
- Historical root artifacts drift from current contracts. For example, `agents/unstoppable-dev.md` still points at removed AI components, legacy reference apps and mandatory repeated confirmation. `convert-to-plugin.mjs` targets old `.md` source paths and mutates source files. Neither should be the basis of the release builder. Hook paths/events require independent host validation.

## Harness support and distribution

Official documentation checked on 11 October 2026 establishes the following packaging options. These are capabilities of the formats, not evidence that our plugin already works in them.

| Harness | Packaging route | Recommended scope |
| --- | --- | --- |
| Codex | Root `plugin.json` with `skills/`; optional OpenAI extension metadata and compatibility overlay | First release; validate the actual desktop and CLI surfaces separately |
| Claude Code | `.claude-plugin/plugin.json` with root skill directories and a marketplace catalog | First release; validate local loading before catalog distribution |
| Cursor | Portable root manifest or `.cursor-plugin/plugin.json` for rules and other Cursor components | Next adapter; only add a small routing rule if skill discovery needs it |
| OpenCode | Discoverable skill directories; native plugins are JavaScript/TypeScript modules | Ship a skills pack first; write an executable plugin only for an identified host integration need |
| Other harnesses | Agent Skills bundle and documented manual/project installation | Declare supported discovery paths only after checking each harness |

Codex's documented portable package uses a root manifest and skill directory, with local catalogs available for development. Public directory submission is a separate release step. [OpenAI packaging documentation](https://developers.openai.com/plugins/build/plugins).

Claude Code packages skills and other components under its plugin root, supports local development loading, and distributes through marketplace catalogs. Its plugin skills are namespaced, so documentation and invocation tests must account for that. [Claude Code plugins](https://code.claude.com/docs/en/plugins).

Cursor accepts both the portable Agent Plugins format and its own richer format. Its documentation identifies differences in MCP variable handling, which reinforces keeping host configuration in adapters. [Cursor plugins reference](https://cursor.com/docs/reference/plugins).

OpenCode discovers project/global skills, including agent-compatible directories. Its executable plugin API is a different artifact type from a skill bundle; do not assume it loads another host's manifest. [OpenCode skills](https://opencode.ai/docs/skills/), [OpenCode plugins](https://opencode.ai/docs/plugins/).

Record minimum tested harness versions and enabled surfaces in each release. Recheck manifest schemas and installation instructions at implementation time. Do not infer CLI, IDE, cloud and desktop parity from one successful installation.

## Shared architecture

```text
agent-pack/src + compatibility manifest + runtime contracts
                          |
             shared content assembly and validation
                          |
       +------------------+-------------------+
       |                  |                   |
 project-local packs   portable plugin   harness adapters
 (existing CLI flow)   skills/resources   Claude/Cursor/OpenCode
```

Keep authoring in `packages/agent-pack/src/`. Continue generating the CLI-bundled copy with `node scripts/sync-stack-assets.mjs`. Generate plugin output from the same synchronized inputs, never from hand-edited release folders or research snapshots.

Proposed build output (paths are a design proposal):

```text
packages/agent-pack/dist/
├── portable/                 # Codex first; candidate portable Cursor package
│   ├── plugin.json
│   ├── skills/
│   │   ├── build-with-unstoppable/SKILL.md
│   │   ├── unstoppable-foundations/{SKILL.md,resources/}
│   │   ├── unstoppable-modules/{SKILL.md,resources/}
│   │   ├── unstoppable-recipes/{SKILL.md,resources/}
│   │   └── <selected-existing-skills>/
│   └── README.md
├── claude/                   # Same content, Claude manifest/invocation adapter
├── cursor/                   # Same content, optional thin rule adapter
└── skills/                   # Self-contained fallback bundle for OpenCode/others
```

Bundle core/module/recipe indexes and references under router skill resources. Prefer links relative to the owning skill for bundled knowledge. Target app paths such as `.unstoppable/project.json` remain relative to the explicitly selected app directory. Test cross-skill links in a copied installation outside this repository. If a host cannot resolve a shared reference reliably, generate the necessary resource into the consuming skill rather than guessing a universal plugin-root variable.

The builder should recursively preserve resources and future scripts/assets, validate link destinations, and emit a content inventory with source revision and hashes. Include only redistributable maintained material; do not require local `research/`, `sandbox/`, initialized submodules or private SDK documentation at runtime. Link to version-matched upstream docs where detailed APIs are needed.

## First release content

Prefer a small complete set of workflows over exposing every historical skill. Keep existing identifiers where practical; add one clear entry skill. Detailed AI extensions and experimental features remain discoverable through the module/recipe routers with honest support labels.

| Workflow | Content to reuse or add | Expected outcome |
| --- | --- | --- |
| Start from an idea | New `build-with-unstoppable` entry skill | Select target, inspect CLI, route to setup/feature workflows |
| Create a target | `scaffold-project`, `setup-pear-desktop`, `setup-node-cli` | Use installed platform catalog and generated app contract |
| Add networking/storage | P2P networking, sync, RPC, KV, database and file-storage skills | Compose existing managers and schemas; handle disconnection/restart |
| Add local AI | `add-ai-chat` and maintained runtime reference | Extend prompts/UI/tools through the app's session and IPC contract |
| Validate | `setup-local-testing` plus task-specific checks | Distinguish static/mock tests, local peers and real native evidence |
| Diagnose | `diagnose-stack-runtime` | Identify failure boundary and produce a focused reproducer/fix |
| Upgrade | `upgrade-stack` | Read-only comparison followed by deliberate edit-preserving migration |
| Architecture and advanced features | Foundation/module/recipe routers | Read only relevant guidance and installed/version-matched APIs |

Payment guidance must identify the current wallet stub. Expo and Node native AI maturity must reflect the installed profile. Personal Node integration remains deferred unless deliberately selected and separately supported. A plugin release must not promote these features by changing descriptions alone.

No background service, telemetry, network-required documentation lookup, automatic formatting hook or specialist subagent is necessary for the first release. Normal shell execution remains governed by the harness and the user's task authorization. Do not copy the current generated Claude permission allowlist into global plugin configuration.

## Coexistence, versions and upgrades

Support two explicit distribution modes:

- **Project pack:** existing `us init` behavior continues to emit local skills and guidance; useful for teams, reproducibility and harnesses without native plugins.
- **Plugin:** reusable skills come from the installed package; a future CLI option emits only small project-specific context and app metadata. Its spelling is undecided and must not be advertised as an existing command.

The entry skill should detect an existing generated pack and report overlapping content/version differences before proposing migration. Avoid silently deleting local skills or overwriting user instructions. Preserve existing `AGENTS.md`, `CLAUDE.md`, settings and rules; managed sections or explicit diffs are implementation choices to verify before adding that option. In multiple-harness projects, record which distribution mode applies to each harness.

Keep plugin/content version, CLI version, app profile revision and vendored runtime version distinct. A plugin update refreshes workflows and references; it does not mutate an app's runtime. The installed app manifest, dependency types and actual CLI command surface take precedence over the plugin's current-release examples.

Publish a machine-readable plugin compatibility declaration for tested CLI versions and content contract revisions. Derive platform/dependency guidance from the existing compatibility manifest. Unsupported combinations should give a concrete compatibility explanation and inspection path, not trigger automatic reinstall or regeneration. Retain tagged release artifacts so projects can pin/roll back guidance independently from app migrations.

## Implementation milestones

These are proposed implementation slices, not completed work or calendar commitments. Ship through gates in order; marketplace approval is an external dependency.

### P0 — Packaging and discovery spike

- [x] Add the entry skill and define the curated first-release inventory.
- [x] Produce one self-contained router/reference bundle from current source.
- [ ] Load it in Codex and Claude Code from their supported local development paths.
- [ ] Exercise it from an empty workspace, an existing app and a nested multi-app directory.
- [ ] Record harness versions, invocation syntax and installed resource resolution.

**Exit:** both primary harnesses discover and load bundled guidance without a generated project pack or this repository. Resolve host limitations before expanding the package.

### P1 — Shared builder and artifact checks

- [ ] Extract reusable content assembly from the CLI builder while preserving existing output behavior.
- [x] Add a deterministic, non-mutating plugin build script and host manifests.
- [ ] Generate foundation/module/recipe routers, indexes and resources through shared assembly for both distribution modes (plugin routers implemented; shared CLI assembly pending).
- [ ] Validate manifests, frontmatter, recursive resources, local links, duplicate names and release inventory.
- [x] Add a check mode to detect stale generated output; retain source/CLI bundle parity checks.
- [x] Exclude historical agent/command/hook artifacts from the new packages; retain only validated assets.

**Exit:** clean repeated builds produce identical artifacts; existing CLI pack tests pass; unpacked artifacts are self-contained.

### P2 — CLI/project integration and app acceptance

- [ ] Add the explicit plugin/project-pack mode after finalizing its UX.
- [ ] Implement CLI prerequisite/version inspection and app target discovery in the entry workflow.
- [ ] Handle existing generated packs with an edit-preserving migration preview.
- [ ] Run the acceptance matrix below in both primary harnesses.
- [ ] Document install, first app, existing-project use, update, rollback and removal.

**Exit:** a developer can build and extend the selected supported app with either primary harness; conflicting or unsupported versions produce useful guidance without destructive changes.

### P3 — Distribution and pilot

- [ ] Publish tagged artifacts with matching content inventories and release notes.
- [ ] Create documented catalogs/install routes for Codex and Claude Code, then validate fetched installs.
- [ ] Run a small developer pilot and collect reproducible gaps through the existing issue workflow.
- [ ] Add website onboarding only after installation steps are verified.
- [ ] Submit to public directories where appropriate; track approval independently from direct distribution.

**Exit:** an independent developer installs from a released artifact/catalog and reproduces the first-app workflow. Feedback reports include plugin, harness, CLI and app-profile versions, with no secrets or private app data required.

### P4 — Additional harness adapters

- [ ] Validate the portable package in Cursor and compare it with the existing Cursor manifest route.
- [ ] Provide a tested OpenCode skills installation route and duplicate-discovery checks.
- [ ] Add further harnesses only with discovery/invocation/resource-path acceptance evidence.
- [ ] Evaluate optional hooks, agents and MCP against observed pilot friction.

**Exit:** each advertised harness has a tested install path and the same core workflow outcomes. Unsupported host-specific capabilities are documented explicitly.

## Acceptance matrix

| Scenario | Required evidence |
| --- | --- |
| Install outside the monorepo | Host discovers entry/feature/router skills; references resolve from copied package/cache paths |
| Empty workspace and missing CLI | Agent explains the prerequisite and versioned setup route; no invented command or hidden bootstrap |
| New supported app | Real scaffold/build/run using the released CLI; generated contract drives subsequent edits |
| Existing/multi-app workspace | Correct target/profile selected; local instructions and edited files preserved |
| P2P feature change | Two local peer instances, persistence, disconnect/reconnect and affected data behavior |
| Local AI feature change | Real native output, cancellation followed by reuse, retry and cached offline startup on the declared validated platform |
| Offline guidance | Installed entry/router resources load without internet; unavailable live docs are identified honestly |
| Experimental/stub feature request | Agent reports actual profile maturity and gives an appropriate supported or experimental path |
| Older CLI/app versus newer plugin | Installed contracts take precedence; incompatibility explained; no force regeneration |
| Plugin plus project pack | Overlap detected; no contradictory automatic edits; explicit migration preview |
| Plugin update/removal | Workflow bundle updates/removes through supported host flow; app source and runtime remain intact |
| Context footprint | Record skill catalog size and loaded reference bytes; entry skill target ≤4 KiB, thin workflow target ≤8 KiB; deep resources on demand |

Structural CI checks cannot certify the harness's skill selection or native runtime. Keep artifact checks, real harness workflow evaluations and native/offline acceptance reports separate. Store prompts, versions, outcomes and logs under a dated plugin evidence directory in `planning/status/evidence/`, following the existing runtime evidence pattern.

## Optional MCP later

Consider a local stdio MCP adapter if pilots repeatedly struggle with shell parsing, app discovery or selecting references. Candidate read-only tools are app/profile inspection, compatibility comparison and indexed guidance retrieval. Tool names and schemas remain undecided.

Reuse CLI/domain logic rather than maintaining a parallel scaffolder or runtime. Any future mutating tool should show its target and operation clearly and follow the host's authorization model. A hosted docs service must remain an enhancement to bundled references. Require measured improvement in workflow completion or diagnosis quality before making MCP part of default installation.

## Recommended next action

Implement **P0 only** first: one entry skill, self-contained reference routers, and local Codex/Claude Code loading. This tests the key assumption—reliable reusable guidance outside CLI-generated projects—before committing to marketplace plumbing or new services. Then use the findings to finalize builder and coexistence work.

This plan extends [agent-pack planning](agent-pack.md) and the [maintained-runtime architecture](../technical-improvements/20261009-agent-pack-review.md). It does not change the current public launch support contract or mark plugin distribution complete.
