# The Unstoppable Stack

Developer tooling for local-first apps using Holepunch P2P protocols and QVAC
local AI. The core preview is assistant workspace setup and app scaffolding.
Personal Node, Memory, mobile, wallets, and other deferred capabilities must
keep their experimental status explicit. See README.md and SUPPORT.md.

## Repository layout

- `packages/cli/`: TypeScript Commander CLI (`us`). Default builds expose the
  minimal preview commands; the full profile includes deferred experiments.
- `packages/agent-pack/src/`: canonical assistant guidance, skills, recipes,
  hooks, and reusable components. CLI output supports Claude Code, Cursor,
  OpenCode, and Codex; preserve these product integrations.
- `packages/runtime-ai/src/`: maintained desktop/Node AI lifecycle and adapters.
  Generators vendor this into `.unstoppable/runtime-ai/`. Apps own UI, prompts,
  schemas, and domain logic. Expo has a separate experimental implementation.
- `packages/website/`: Next.js App Router site, Tailwind, shadcn/ui.
- `packages/p2p/`, `packages/node/`, `packages/node-desktop/`: experimental P2P
  library, Personal Node composition, and desktop shell.
- Deferred Memory source is preserved on `codex/deferred-package-development`,
  outside main. See `docs/package-inventory.md` before restoring experiments.
- `examples/`: first-party examples and CI fixtures.
- `docs/validation.md`: public validation commands and acceptance boundaries.

## Development

The root is **not** a package-manager workspace. Install dependencies and run
commands in the affected package. CLI and website use pnpm; runtime packages
have their own manifests/lockfiles. Follow each package's README and CI.

```bash
pnpm --dir packages/cli install --frozen-lockfile
pnpm --dir packages/cli typecheck
pnpm --dir packages/cli test
pnpm --dir packages/cli build

pnpm --dir packages/website install --frozen-lockfile
pnpm --dir packages/website build
```

After maintained source changes, synchronize generated assets:

```bash
node scripts/sync-stack-assets.mjs
node scripts/sync-stack-assets.mjs --check
node scripts/check-agent-pack.mjs
```

Edit agent-pack content in `packages/agent-pack/src/`, then use this sync step
for the CLI-bundled copy. Do not hand-edit `packages/cli/agent-pack-src/` or
`packages/cli/src/generated/`. Compatibility dependencies come from
`packages/cli/src/compatibility/profiles.json`, not separate version tables.

## Implementation contracts

- Keep apps usable offline; networking enables sync rather than basic use.
- Handle peer disconnections and cancellation; replicate cores before reading.
- Keep native inference in adapters/workers. Renderer code uses IPC.
- Preserve edited apps during upgrades. `us compatibility list/check` proposes
  read-only differences; `--force` regeneration is not an upgrade workflow.
- Keep contract/mock results distinct from native inference, cancellation,
  offline, and packaged-artifact acceptance. Run relevant checks from
  `docs/validation.md`; do not imply release approval from unit tests.
- Use TypeScript where practical, existing formatting conventions, Vitest for
  CLI behavior, and conventional commit messages. Preserve unrelated edits.

## UI design

US-related app interfaces follow the Personal Node desktop visual system by
default: graphite surfaces, cyan actions/selection, compact functional layouts,
truthful connection/sync/AI states, and accessible system light/dark themes.
Read [the design guide](docs/ui-design.md) before UI changes. Canonical tokens
and desktop primitives live in `packages/agent-pack/src/ui/`; synchronize their
CLI and example copies with `scripts/sync-stack-assets.mjs`. Preserve each app's
functionality and user-selected design; adapt layouts to native mobile controls.

## Local maintainer material

`planning/`, `research/`, `sandbox/`, `reference-apps/`, and `.local/` are ignored, optional local
material. They may contain plans, fetched upstream docs, experiments, and
cleanup archives. Public code, CI, and documentation must work without them.
Do not link public documentation or compatibility evidence to these folders.
Repo-specific editor settings stay local; AGENTS.md is the shared contributor
context. Do not remove assistant formats from the product because of this.

Never commit credentials, wallet seeds, private peer data, model downloads,
or local assistant settings. See CONTRIBUTING.md and SECURITY.md.
