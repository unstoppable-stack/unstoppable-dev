# Local harness plugin prototype

The Unstoppable Stack now builds self-contained skills-only packages for Codex and Claude Code. This is a local installation preview, not a published marketplace release. It includes 16 selected workflows and three reference routers; the existing project-pack flow remains available.

## Website installation guides

The website presents three equal starting paths:
[Claude Code](https://unstoppable.dev/docs/start/claude),
[Codex](https://unstoppable.dev/docs/start/codex), and the
[raw CLI](https://unstoppable.dev/docs/start/cli).

The website build assembles a self-contained archive containing both host
packages and their local catalogs. The plugin guides offer that download,
extraction and local installation steps; no source checkout is needed. The
archive and its checksum/source identity are emitted under `public/downloads/`
by `packages/website/scripts/prepare-plugin-download.mjs`. They become publicly
available when the updated website is deployed. This does not publish a
marketplace listing or certify session workflows.

Run `npm run --prefix packages/website plugins:prepare` to build the website
preview download. Existing source-checkout setup remains documented below.

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

## Content and coexistence

Edit `src/`, then run the sync/build commands. The builder includes only the selected source skills and core/module/recipe references. It preserves recursive resources and fails on symlinks or broken bundled Markdown links. Historical root agents, commands, hooks and the mutating conversion script are excluded.

Bundled references resolve from the installed skill. App paths resolve from the selected app directory. The plugin can guide an empty workspace without `.unstoppable/guidance`; the project-pack routers continue to use their generated guidance. Keep existing workspace instructions and edited app files. If a project already has CLI-generated skills, inspect overlap before migrating; automatic deduplication and a CLI plugin mode are still planned.

An updated plugin does not change `.unstoppable/runtime-ai/` or migrate app profiles. Installed contracts/types take precedence over examples. Experimental platform labels and wallet stubs remain as recorded in the app profile. MCP, lifecycle hooks and automatic permissions are absent from this prototype.

## Verification status

Native parsing was checked with Codex CLI 0.160.1 and Claude Code 2.0.76. Codex resolves the catalog and enumerates all 19 namespaced skills; Claude validates both its plugin manifest and catalog. Package relocation, reference links, recursive resources, repeatability and drift detection have automated checks. Existing CLI agent-pack generation has regression coverage, including the entry skill in a target without AI.

Full chat activation/automatic selection, empty/existing/multi-app model-driven workflows, native app acceptance and desktop installation/reload remain unverified. Cursor/OpenCode adapters, shared CLI/plugin assembly extraction, CLI coexistence mode, release publication and pilot work remain planned. These parser checks do not complete every P0 exit gate.

See [validation and release checks](../../docs/validation.md) for the public checks and acceptance boundaries.
