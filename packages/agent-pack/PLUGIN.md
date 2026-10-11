# Local harness plugin prototype

The Unstoppable Stack now builds self-contained skills-only packages for Codex and Claude Code. This is a development prototype, not a published marketplace release. It includes 16 selected workflows and three reference routers; the existing project-pack flow remains available.

## Build and check

From the repository root, using Node 22+ for these build scripts:

```sh
node scripts/sync-stack-assets.mjs
node packages/agent-pack/scripts/build-plugin.mjs
node packages/agent-pack/scripts/build-plugin.mjs --check
node --test packages/agent-pack/scripts/build-plugin.test.mjs
node packages/agent-pack/scripts/smoke-plugin-hosts.mjs
```

The host smoke requires installed `codex` and `claude` executables. It copies the artifacts outside the repository, validates Claude manifests, checks Codex catalog discovery, and reads the package through Codex app-server. State/log files use temporary directories. It makes no model calls and does not install or enable a plugin globally. App-server startup may require an ordinary terminal outside a restricted process sandbox.

Generated files live under `dist/` and are gitignored. Build before using a catalog; retain the whole distribution directory if copying it elsewhere:

| Path | Purpose |
| --- | --- |
| `dist/portable/` | Portable root manifest and skill resources for Codex |
| `dist/claude/` | Claude manifest and the same skill resources |
| `dist/.agents/plugins/marketplace.json` | Codex local development catalog |
| `dist/.claude-plugin/marketplace.json` | Claude local development catalog |

Each package's `content-inventory.json` records source hashes, a source digest and output hashes, including its host manifest. These identify the exact content; they are not native compatibility certification. `--check` detects edited, missing or extra output files. Rebuild after maintained source changes; repeated builds are deterministic.

## Try in Claude Code

Build, then from a separate app/workspace directory run:

```sh
claude --plugin-dir /absolute/path/to/unstoppable-stack/packages/agent-pack/dist/claude
```

Invoke `/unstoppable-stack:build-with-unstoppable` and describe the app. This loads the package for that session. The namespace and local-loading route follow [Claude's plugin documentation](https://code.claude.com/docs/en/plugins).

For local catalog installation instead, add the absolute `dist` directory with `/plugin marketplace add`, then install `unstoppable-stack@unstoppable-stack-dev` through `/plugin`. Session-only loading is the simpler development route.

## Try in Codex

Build, then register the local distribution directory:

```sh
codex plugin marketplace add /absolute/path/to/unstoppable-stack/packages/agent-pack/dist
```

Open the local catalog in the desktop plugin directory and install Unstoppable Stack, then start a new chat in the target workspace. Select the discovered `unstoppable-stack:build-with-unstoppable` skill. On a CLI exposing `codex plugin add`, the equivalent local install command is:

```sh
codex plugin add unstoppable-stack@unstoppable-stack-dev
```

Confirm available commands with your installed `codex plugin --help`. Catalog registration, installation and session activation are distinct steps; catalog discovery alone does not activate skills. See [OpenAI packaging documentation](https://developers.openai.com/plugins/build/plugins).

These steps install guidance. The app-building workflow separately checks for `@unstoppable-stack/cli` and uses its actual platform/feature catalog. The plugin does not install native runtimes, models or app dependencies as an installation side effect.

## Manual workflow checks

Use a separate temporary workspace for each test and keep normal harness permissions enabled:

1. Empty workspace: ask “Build a desktop coffee assistant with local AI and P2P order sharing.” Check that the skill discovers the installed CLI, uses its real platform catalog and scaffolds a new target. It should read the generated app manifest and extend the maintained runtime rather than emit a second AI lifecycle implementation.
2. Existing app: ask “Inspect this app’s model-loading failure and propose a focused fix.” Check target selection, app metadata and the worker/adapter boundary before any dependency change.
3. Multi-app workspace: ask “Review compatibility only for apps/coffee; leave apps/notes unchanged.” Confirm the read-only check targets that app and preserves both apps’ edited files.
4. Offline references: invoke the modules/router skill and open its bundled QVAC contract with networking unavailable. Guidance should resolve from the installed package; native cached inference is a separate test.

Record the harness/plugin/CLI/profile versions and actual result for each test. App build/run, P2P reconnect and real native cancellation/reuse are acceptance checks beyond package parsing. Test both explicit skill invocation and an ordinary app request to assess automatic selection.

The PR's **CLI / Unit tests** job also uploads a `harness-plugin-prototype` artifact. Download/unzip the whole artifact, including hidden folders, and use that directory in place of `dist` in the local catalog commands. In Claude, point `--plugin-dir` at its `claude` subdirectory.

## Content and coexistence

Edit `src/`, then run the sync/build commands. The builder includes only the selected source skills and core/module/recipe references. It preserves recursive resources and fails on symlinks or broken bundled Markdown links. Historical root agents, commands, hooks and the mutating conversion script are excluded.

Bundled references resolve from the installed skill. App paths resolve from the selected app directory. The plugin can guide an empty workspace without `.unstoppable/guidance`; the project-pack routers continue to use their generated guidance. Keep existing workspace instructions and edited app files. If a project already has CLI-generated skills, inspect overlap before migrating; automatic deduplication and a CLI plugin mode are still planned.

An updated plugin does not change `.unstoppable/runtime-ai/` or migrate app profiles. Installed contracts/types take precedence over examples. Experimental platform labels and wallet stubs remain as recorded in the app profile. MCP, lifecycle hooks and automatic permissions are absent from this prototype.

## Verification status

Native parsing was checked with Codex CLI 0.160.1 and Claude Code 2.0.76. Codex resolves the catalog and enumerates all 19 namespaced skills; Claude validates both its plugin manifest and catalog. Package relocation, reference links, recursive resources, repeatability and drift detection have automated checks. Existing CLI agent-pack generation has regression coverage, including the entry skill in a target without AI.

Full chat activation/automatic selection, empty/existing/multi-app model-driven workflows, native app acceptance and desktop installation/reload remain unverified. Cursor/OpenCode adapters, shared CLI/plugin assembly extraction, CLI coexistence mode, release publication and pilot work remain planned. These parser checks do not complete every P0 exit gate.

See the [plugin plan](../../planning/features/harness-plugin.md) and [implementation evidence](../../planning/status/evidence/20261011-harness-plugin/README.md).
