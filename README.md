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

```bash
us init my-workspace --assistant codex
cd my-workspace
us scaffold app -p pear-desktop -n coffee-assistant -f local-ai
cd coffee-assistant
npm install
npm run dev
```

> **Release status:** the repository is preparing a developer preview. The exact package tag and default local-AI journey are not approved until artifact and real-model validation pass. Personal Node/runtime 0.6, mobile, wallets, Search, Memory, Remote Coder, Flow, and the standalone Agent are outside the core preview.

Claude Code, Cursor, OpenCode, and Codex configuration can be generated from the same agent-pack source. The recommended Codex path still requires an independent pilot before it becomes a support claim.

**Full CLI reference:** [`packages/cli/README.md`](./packages/cli/README.md) — every command, every flag, troubleshooting, and dev setup.

## Why?

P2P runtimes, native modules, model loading, and renderer/worker boundaries are easy to combine incorrectly. This project turns fixes found while building real apps into starters, reusable components, and assistant-readable guidance.

The [Coffee Assistant example](./examples/coffee-assistant/README.md) demonstrates the desktop integration. Its README records the example’s scope and validation limits.

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

Use the source-accurate workspace and scaffold commands shown above. The public installation command will be frozen only after the final CLI artifact succeeds in an isolated consumer environment; do not assume the registry's `latest` tag refers to this source candidate.

For every command, flag, and troubleshooting tip, see the full CLI reference: [`packages/cli/README.md`](./packages/cli/README.md).

### Proposed first assistant prompt

*"Scaffold a Pear Desktop app named coffee-assistant with local AI. Use the Unstoppable Stack CLI, keep storage and inference in the worker, and tell me which generated folder to run."*

## Agent Pack

The core of the project. A structured knowledge base that teaches AI assistants how to use the Holepunch/Tether stack correctly.

```
packages/agent-pack/src/
├── core/               # Architecture, patterns, verified package versions
├── modules/            # 14 module docs (Pear, Bare, Hyperswarm, QVAC, ...)
├── skills/             # 24 tiered skills organized by capability
│   ├── setup-pear-desktop/    # Platform: Desktop app with worker pattern
│   ├── add-p2p-networking/    # P2P: Hyperswarm peer discovery
│   ├── add-ai-chat/           # AI: QVAC chat with tool calling
│   ├── add-database/          # Data: HyperDB structured storage
│   └── ...
├── recipes/            # 24 focused patterns (kv-cache, NDJSON, encryption, ...)
├── components/         # Reusable TypeScript (chat session, swarm manager, ...)
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
│   ├── website/          # Next.js site
│   ├── runtime-ai/       # Maintained desktop/Node AI lifecycle
│   ├── node-core/        # Experimental P2P runtime
│   ├── node-caps-*/      # Experimental sync and AI capability packs
│   ├── node/             # Personal Node app (alpha)
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
cd packages/cli && pnpm build
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

The core preview focuses on assistant workspace setup and app scaffolding. See [SUPPORT.md](./SUPPORT.md) for scope and [validation and release checks](./docs/validation.md) for release gates. Internal planning, research downloads, local test builds, and upstream reference checkouts remain local maintainer material.

## Built With

- [Holepunch](https://holepunch.to) — P2P protocols (Hyperswarm, Hypercore, Pear Runtime)
- [Tether](https://tether.io) — QVAC local AI; WDK is planned work for this project
- [Next.js](https://nextjs.org) — Website
- [Commander.js](https://github.com/tj/commander.js) + [Inquirer](https://github.com/SBoudrias/Inquirer.js) — CLI

## License

[MIT](./LICENSE). See [CONTRIBUTING.md](./CONTRIBUTING.md) before submitting a
change and [SECURITY.md](./SECURITY.md) for private vulnerability reporting.

## Coding harness plugin

Installable Codex and Claude Code/Claude Desktop Code-tab workflows are being prepared for public preview. See [plugin installation](packages/agent-pack/PLUGIN.md) and the [matching CLI setup](packages/agent-pack/src/skills/build-with-unstoppable/resources/install-cli.md). The npm latest CLI is not yet the maintained-contract candidate; use the pinned source instructions until that candidate is published.
