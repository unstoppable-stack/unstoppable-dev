# Unstoppable Stack harness plugin

The Unstoppable Stack provides self-contained skills-only preview packages for Codex and Claude Code. Repository catalogs and downloadable local-install archives are available; official-directory listing is a separate step. See [package.json](package.json) for the current plugin version and [website download metadata](../website/src/lib/plugin-download.json) for its archive. The plugin includes 16 selected workflows and three reference routers; the existing project-pack flow remains available.

## Public installation

Install from the public repository catalog:

```sh
claude plugin marketplace add unstoppable-stack/unstoppable-dev
claude plugin install unstoppable-stack@unstoppable-stack --scope user
```

For Claude Desktop, fully quit/reopen the app, choose Code → Local and start a new target-folder session. Type `/` and select `unstoppable-stack:build-with-unstoppable`. Cowork reads a separate account-synced customization store. The successful local Code-tab loading reported during development is not evidence of Cowork support.

Codex repository installation:

```sh
codex plugin marketplace add unstoppable-stack/unstoppable-dev
codex plugin add unstoppable-stack@unstoppable-stack
```

Use the supported desktop plugin directory for installation if the installed CLI does not expose `plugin add`. Start a new target-workspace chat after enabling the plugin. Repository catalogs and official public directories are different distribution channels.

Read [CLI installation](src/skills/build-with-unstoppable/resources/install-cli.md) before building an app. Install the published CLI beta with `npm install -g @unstoppable-stack/cli@0.4.0-beta.1`. npm `latest` remains on earlier 0.3.0; do not substitute it for this workflow. The immutable source install remains an optional fallback. The same guide is bundled in both packages and generated from release metadata.

For public preview updates, use `claude plugin marketplace update unstoppable-stack` then `claude plugin update unstoppable-stack@unstoppable-stack`, or `codex plugin marketplace upgrade unstoppable-stack` followed by your supported plugin update/reinstall flow. Restart the session. If transitioning from the development catalog, remove only the old `unstoppable-stack@unstoppable-stack-dev` plugin after the public one is working; retain unrelated catalogs/plugins and app instructions.

## Build and check

From the repository root, using Node 22+ for these build scripts:

```sh
node scripts/sync-stack-assets.mjs
node packages/agent-pack/scripts/build-plugin.mjs
node packages/agent-pack/scripts/build-plugin.mjs --check
node packages/agent-pack/scripts/build-plugin.mjs --public --check
node --test packages/agent-pack/scripts/build-plugin.test.mjs
node packages/agent-pack/scripts/smoke-plugin-hosts.mjs
```

The host smoke requires installed `codex` and `claude` executables. It copies the artifacts outside the repository, validates Claude manifests, checks Codex catalog discovery, and reads the package through Codex app-server. State/log files use temporary directories. It makes no model calls and does not install or enable a plugin globally. App-server startup may require an ordinary terminal outside a restricted process sandbox.

Local development output lives under `dist/` and is gitignored. Public packages live under tracked `plugins/`, with repository-root catalogs; regenerate them with `build-plugin.mjs --public` after source changes. Build before using a catalog; retain the whole distribution directory if copying it elsewhere:

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

See [validation and release checks](../../docs/validation.md) for public checks and acceptance boundaries.

See [publication runbook](PUBLICATION.md) for archives, review gates and the matching CLI release dependency.
