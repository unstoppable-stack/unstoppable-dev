<p align="center">
  <br />
  <strong>The Unstoppable Stack</strong>
  <br />
  <em>Build private apps with local AI and peer-to-peer communication</em>
  <br />
  <br />
  <a href="https://unstoppable-stack.dev">Website</a> ·
  <a href="#quick-start">Quick Start</a> ·
  <a href="#agent-pack">Agent Pack</a> ·
  <a href="https://github.com/unstoppable-stack/unstoppable-dev/issues">Issues</a> ·
  <a href="./SUPPORT.md">Support</a>
</p>

---

## What is this?

The Unstoppable Stack is a developer toolkit for building private apps with local data, local AI, and direct peer communication using an existing AI coding assistant.

The current source separates assistant setup from app generation: `us init` creates an assistant-configured workspace, then `us scaffold app` generates a runnable application inside it.

Start with [Claude Code](https://unstoppable-stack.dev/docs/start/claude),
[Codex](https://unstoppable-stack.dev/docs/start/codex), or the
[raw CLI](https://unstoppable-stack.dev/docs/start/cli). Each path creates the same
local-first desktop baseline; the plugin guides include the separate CLI install.


> **Release status:** CLI `0.4.0-beta.4` and P2P `0.6.0-alpha.3` are published prereleases, verified through fresh npm installs. Local AI requires separate native/model acceptance. Personal Node/runtime 0.6, mobile, wallets, Search, Memory, Remote Coder, Flow, and the standalone Agent are outside the core preview.

Claude Code, Cursor, OpenCode, and Codex configuration can be generated from the same agent-pack source. The recommended Codex path still requires an independent pilot before it becomes a support claim.

**Full CLI reference:** [`packages/cli/README.md`](./packages/cli/README.md) — every command, every flag, troubleshooting, and dev setup.

## What can I build?

| I want to… | Building blocks | Start here | Status |
| --- | --- | --- | --- |
| Create an app that saves data locally | CLI, desktop worker, Hyperbee | [Desktop quick start](#quick-start) | Core preview |
| Call a method on a trusted device | P2P pairing, grants and RPC | [P2P API](packages/p2p/docs/api.md) | Experimental; published alpha.3 |
| Keep a replica of notes or files | P2P `/sync`, Hyperbee, Hyperdrive | [Notes example](examples/p2p-notes/README.md) | Experimental; published alpha.3 |
| Add an on-device shopping assistant | QVAC, Bare, local storage | [Local Goods example](examples/ecommerce-assistant/README.md) | Native/model acceptance is separate |
| Merge edits made on offline devices | P2P `/db`, Autobase, app-owned reducer | [Collaborative notes](examples/p2p-database/README.md) | Experimental; published alpha.3 |
| Run an optional peer for storage or AI | Personal Node | [Node guide](packages/node/README.md) | Deferred alpha |

Explore the [library guide](https://unstoppable-stack.dev/docs/modules) for what
each dependency does, or [runnable examples](https://unstoppable-stack.dev/docs/examples)
for commands and expected results. Mobile, wallets, Memory and Search remain
outside the core preview; wallet scaffolds do not process payments.

## Packages and integrations

The public architecture is the CLI, one P2P library, and Claude/Codex plugin
packages built from the shared agent pack. Personal Node is an optional application.

- `@unstoppable-stack/cli`: assistant workspace setup, scaffolding and checks.
- `@unstoppable-stack/p2p`: identity, pairing, grants, capability calls and streaming;
  its `/sync` entry adds replication without a second package.
- QVAC is used directly through its upstream SDK/inference packages. Small tested
  lifecycle helpers remain internal to generated apps; there is no public AI wrapper.
- Wallets will use the upstream WDK SDK directly. Current wallet scaffolds are stubs.
- Memory is preserved on `codex/deferred-package-development`; Search remains deferred.
  See the [package inventory](docs/package-inventory.md) for what stays on main.

CLI `0.4.0-beta.4` and P2P `0.6.0-alpha.3` are published on npm under
`beta` and `alpha`. Personal Node remains deferred, unpublished alpha source.
Earlier CLI `0.3.0` and Node `0.4.0` retain their existing APIs. See
[package architecture and migration](docs/package-architecture.md) for status,
imports, local development and release assembly. See
[plugin setup](packages/agent-pack/PLUGIN.md) for local Claude/Codex previews.
The [P2P documentation index](packages/p2p/docs/README.md) covers the shared API;
the [capability inventory](packages/p2p/docs/roadmap.md) maps the broader Node
service plans to implemented features, missing contracts and package owners.
The [P2P notes example](examples/p2p-notes/README.md) consumes the consolidated
library directly. [Canonical release preparation](docs/public-release.md)
tests both public npm artifacts and builds the plugin download.

## Why?

P2P runtimes, native modules, model loading, and renderer/worker boundaries are easy to combine incorrectly. This project turns fixes found while building real apps into starters, reusable components, and assistant-readable guidance.

The [Local Goods ecommerce example](./examples/ecommerce-assistant/README.md) demonstrates the desktop integration. Its README records the example’s scope and validation limits.

The [minimal Notes example](examples/unstoppable-notes/README.md) demonstrates
durable text notes and offline-readable replication using the published P2P
library. The full Notes product and native/device tests live in a separate
private organization repository.

## The Stack

Built on technology by [Holepunch](https://holepunch.to) and [Tether](https://tether.io):

| Layer | Modules |
|-------|---------|
| **P2P & Runtime** | Pear, Bare, Hyperswarm, bare-rpc |
| **Data** | Hypercore, Hyperbee, HyperDB, Hyperdrive, Corestore |
| **AI** | QVAC SDK (local inference, tool calling, streaming) |
| **Payments** | WDK Wallet — planned; no working payment path is included |
| **Mobile** | Expo Bare — generated target under validation, outside the core preview |

## Quick Start

| Start with | Install action | Availability |
| --- | --- | --- |
| Claude Code | [Install Claude plugin](https://unstoppable-stack.dev/docs/start/claude) | Repository catalog; official directory listing pending |
| Codex | [Install Codex plugin](https://unstoppable-stack.dev/docs/start/codex) | Repository catalog; official directory listing pending |
| Raw CLI | [Install the CLI](https://unstoppable-stack.dev/docs/start/cli) | Published `0.4.0-beta.4` beta; install that exact version |

For the raw CLI path, use Node.js **22.17+** and npm. Start in a directory
where you can create a new workspace, then:

```bash
npm install -g @unstoppable-stack/cli@0.4.0-beta.4
us --version
us init shop-workspace --assistant none --no-install
cd shop-workspace
us scaffold app -p pear-desktop -n shop-starter
cd shop-starter
npm install
npm run dev
```

In the window's **KV Storage** section, enter `note:welcome` as Key and `Hello`
as Value. Click **Save**, then **Fetch**. Close the app normally, run `npm run dev`
again from `shop-starter`, enter the same key and Fetch: `Hello` should remain.
The empty inputs after a restart do not mean the database is empty.

Continue with [your first app tutorial](https://unstoppable-stack.dev/docs/tutorial)
to change the saved data, or [run two local peers](https://unstoppable-stack.dev/docs/connect)
to try scoped calls and replication. The base scaffold does not automatically
replicate its private store to another app.

Use `--assistant claude` or `--assistant codex` instead of `none` for generated
project guidance. Install P2P directly with
`npm install @unstoppable-stack/p2p@0.6.0-alpha.3`; use version-matched commands. The plugin download adds guidance, not models or
native dependencies. See the [package structure](docs/package-architecture.md).

### Proposed first assistant prompt

*"Scaffold a Pear Desktop app named shop-assistant with local AI. Use the Unstoppable Stack CLI, keep storage and inference in the worker, and tell me which generated folder to run."*

## Agent Pack

The core of the project. A structured knowledge base that teaches AI assistants how to use the Holepunch/Tether stack correctly.

```
packages/agent-pack/src/
├── core/               # Architecture, patterns, verified package versions
├── modules/            # 14 module docs (Pear, Bare, Hyperswarm, QVAC, ...)
├── skills/             # Task-specific implementation workflows
│   ├── setup-pear-desktop/    # Platform: Desktop app with worker pattern
│   ├── add-p2p-networking/    # P2P: Hyperswarm peer discovery
│   ├── add-ai-chat/           # AI: QVAC chat with tool calling
│   ├── add-database/          # Data: HyperDB structured storage
│   └── ...
├── recipes/            # 24 focused patterns (kv-cache, NDJSON, encryption, ...)
├── components/         # Reusable integration components
└── hooks/              # Auto-activation rules
```

### How knowledge is built

We don't write docs from docs. We **build real apps**, hit real bugs, fix them, and extract working patterns.

```
Build app → Find bugs → Document fixes → Extract into agent pack → Validate by rebuilding from scratch
```

Recipes have different validation levels. Documentation-only coverage is not treated as a running example. See [validation and release checks](./docs/validation.md) for the checks available in this repository.

### Multi-tool support

The same knowledge base generates configs for:

| Tool | Format |
|------|--------|
| **Claude Code** | `.claude/` directory with rules, skills, and hooks |
| **Cursor** | `.cursor/rules/*.mdc` with description-triggered and glob-scoped rules |
| **OpenCode** | `opencode.json` with skills and specialized agents |
| **Codex** | `AGENTS.md` + `.agents/skills/` |

## Repository Structure

```
unstoppable-stack/
├── AGENTS.md             # Shared contributor instructions for coding agents
├── packages/
│   ├── cli/              # Assistant setup, scaffolding, diagnostics
│   ├── agent-pack/       # Canonical assistant guidance and plugin builders
│   ├── p2p/              # P2P capabilities and /sync replication
│   ├── node/             # Optional Personal Node app; internal QVAC adapter
│   ├── runtime-ai/       # Private lifecycle helpers copied into generated apps
│   ├── website/          # unstoppable-stack.dev — Next.js site
│   └── node-desktop/     # Personal Node desktop shell (alpha)
├── examples/             # First-party examples and smoke fixtures
├── docs/                 # Public engineering documentation
└── scripts/              # Asset synchronization and release checks
```

## Development

```bash
# Clone
git clone https://github.com/unstoppable-stack/unstoppable-dev.git
cd unstoppable-dev

# The repository root is not a package-manager workspace. Work per package.
cd packages/cli
pnpm install --frozen-lockfile
pnpm build
pnpm test

cd ../website
pnpm install --frozen-lockfile
pnpm build
```

See [`packages/cli/README.md`](./packages/cli/README.md#development) for the full
dev workflow (test scripts, E2E levels, generator layout).

### Editing the Agent Pack

All agent pack content lives in `packages/agent-pack/src/`. After making changes:

```bash
# Sync runtime assets, compatibility guidance, and the CLI bundle
node scripts/sync-stack-assets.mjs

# Rebuild CLI from its package directory
pnpm --dir packages/cli build
```

## Validated Patterns

These patterns have implementation evidence in the repository. Release support still depends on candidate-specific package, platform, and real-model checks:

- **Pear Desktop Apps** — Renderer/worker split, NDJSON pipe bridge, SWC + React Refresh build
- **P2P Communication** — Hyperswarm topics, bare-rpc with numeric command IDs
- **Local Storage** — Hyperbee key-value persistence
- **Local AI** — QVAC streaming chat, kv-cache, Zod v4 tool calling
- **Bare Runtime** — API compatibility (no TextEncoder/Buffer/crypto), bare-* as npm deps
- **Worker Bridge** — Electron preload IPC to a `pear-runtime` Bare worker; worker code uses `Bare.IPC`

See [validation and release checks](./docs/validation.md) for test scope and remaining acceptance gates.

## Release plan

The core preview focuses on assistant workspace setup and app scaffolding. See [SUPPORT.md](./SUPPORT.md) for scope and [validation and release checks](./docs/validation.md) for release gates. Internal planning, research downloads, and local test builds are kept outside the tracked source tree.

## Built With

- [Holepunch](https://holepunch.to) — P2P protocols (Hyperswarm, Hypercore, Pear Runtime)
- [Tether](https://tether.io) — QVAC local AI; WDK is planned work for this project
- [Next.js](https://nextjs.org) — Website
- [Commander.js](https://github.com/tj/commander.js) + [Inquirer](https://github.com/SBoudrias/Inquirer.js) — CLI

## License

[MIT](./LICENSE). See [CONTRIBUTING.md](./CONTRIBUTING.md) before submitting a
change and [SECURITY.md](./SECURITY.md) for private vulnerability reporting.
