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


> **Release status:** the repository is preparing a developer preview. The exact package tag and default local-AI journey are not approved until artifact and real-model validation pass. Personal Node/runtime 0.6, mobile, wallets, Search, Memory, Remote Coder, Flow, and the standalone Agent are outside the core preview.

Claude Code, Cursor, OpenCode, and Codex configuration can be generated from the same agent-pack source. The recommended Codex path still requires an independent pilot before it becomes a support claim.

**Full CLI reference:** [`packages/cli/README.md`](./packages/cli/README.md) — every command, every flag, troubleshooting, and dev setup.

## Packages and integrations

The public architecture is the CLI, one P2P library, and Claude/Codex plugin
packages built from the shared agent pack. Personal Node is an optional application.

- `@unstoppable-stack/cli`: assistant workspace setup, scaffolding and checks.
- `@unstoppable-stack/p2p`: identity, pairing, grants, capability calls and streaming;
  its `/sync` entry adds replication without a second package.
- QVAC is used directly through its upstream SDK/inference packages. Small tested
  lifecycle helpers remain internal to generated apps; there is no public AI wrapper.
- Wallets will use the upstream WDK SDK directly. Current wallet scaffolds are stubs.
- Memory and Search are excluded from this release. Their source is retained.

The new P2P package and reorganized Personal Node are unpublished alpha source.
Published CLI `0.3.0` and Node `0.4.0` retain their existing APIs. See
[package architecture and migration](docs/package-architecture.md) for status,
imports, local development and release assembly. See
[plugin setup](packages/agent-pack/PLUGIN.md) for local Claude/Codex previews.
The [P2P notes example](examples/p2p-notes/README.md) consumes the consolidated
library directly. [Canonical release preparation](docs/public-release.md)
tests both public npm artifacts and builds the plugin download.

## Why?

P2P runtimes, native modules, model loading, and renderer/worker boundaries are easy to combine incorrectly. This project turns fixes found while building real apps into starters, reusable components, and assistant-readable guidance.

The [Local Goods ecommerce example](./examples/ecommerce-assistant/README.md) demonstrates the desktop integration. Its README records the example’s scope and validation limits.

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
| Claude Code | [Install Claude plugin](https://unstoppable-stack.dev/docs/start/claude) | Downloadable local preview; marketplace listing pending |
| Codex | [Install Codex plugin](https://unstoppable-stack.dev/docs/start/codex) | Downloadable local preview; marketplace listing pending |
| Raw CLI | [Install the CLI](https://unstoppable-stack.dev/docs/start/cli) | Matching `0.4.0-beta.1` source preview; npm `0.3.0` is the earlier API |

For the raw CLI path, install the matching preview using the linked guide
(source build until the beta is published), then:

```bash
us --version
us init shop-workspace --assistant none --no-install
cd shop-workspace
us scaffold app -p pear-desktop -n shop-starter
cd shop-starter
npm install
npm run dev
```

Use `--assistant claude` or `--assistant codex` instead of `none` for generated
project guidance. The source candidate `0.4.0-beta.1` and P2P alpha are unpublished;
use version-matched commands. The plugin download adds guidance, not models or
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
│   ├── runtime-ai/       # Maintained desktop/Node AI lifecycle
│   ├── p2p/              # P2P library (alpha)
│   ├── node/             # Personal Node composition (alpha)
│   ├── node-desktop/     # Personal Node desktop shell (alpha)
│   └── memory*/          # Deferred Memory experiments
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
- **Worker Bridge** — `Pear.worker.pipe()` for renderer↔worker communication

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
