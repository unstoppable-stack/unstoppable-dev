<p align="center">
  <br />
  <strong>The Unstoppable Stack</strong>
  <br />
  <em>Vibe-code P2P apps with AI — no servers, no gatekeepers</em>
  <br />
  <br />
  <a href="https://unstoppable.dev">Website</a> ·
  <a href="#quick-start">Quick Start</a> ·
  <a href="#agent-pack">Agent Pack</a> ·
  <a href="https://github.com/unstoppable-stack/unstoppable-dev/issues">Issues</a>
</p>

---

## What is this?

The Unstoppable Stack is a toolchain that lets you **build apps using P2P protocols, local AI, and crypto payments** — with any AI coding assistant.

Run one command. Open your AI editor. Describe what you want. Get a working app.

```bash
npx create-unstoppable-app
```

Your AI assistant (Claude, Cursor, or OpenCode) gets pre-loaded with battle-tested knowledge about the entire stack — so it actually builds things that work.

## Why?

AI coding tools are amazing at building centralized apps. React + Next.js + AWS? Minutes.

But ask AI to build with [Holepunch](https://holepunch.to) P2P protocols, [QVAC](https://qvac.tether.io) local inference, or [WDK Wallet](https://wallet.tether.io) — and it falls apart. Wrong APIs, wrong architecture, hours of debugging.

**If AI can't build with our stack, developers won't use it.**

The Unstoppable Stack fixes this. We build real apps, document every fix, and package that knowledge so AI assistants get it right the first time.

The result: the same P2P desktop app that took 50+ prompts and hours of debugging now builds in **2 prompts with zero errors**.

## The Stack

Built on technology by [Holepunch](https://holepunch.to) and [Tether](https://tether.io):

| Layer | Modules |
|-------|---------|
| **P2P & Runtime** | Pear, Bare, Hyperswarm, bare-rpc |
| **Data** | Hypercore, Hyperbee, HyperDB, Hyperdrive, Corestore |
| **AI** | QVAC SDK (local inference, tool calling, streaming) |
| **Payments** | WDK Wallet (self-custodial, USDt) |
| **Mobile** | Expo Bare (React Native + Bare runtime) |

## Quick Start

```bash
# Scaffold a new project
npx create-unstoppable-app

# Follow the prompts
? Project name: my-app
? AI assistant: Cursor
? Template: Blank Project

# Open in your editor and start building
cd my-app
```

Your project comes pre-configured with AI rules for your chosen assistant. Start describing what you want to build.

### Example prompts that work out of the box:

- *"Build me a P2P desktop chat app with encrypted messaging"*
- *"Create a local AI assistant with tool calling that can manage a to-do list"*
- *"Build two Pear desktop apps that sync data over P2P using Hyperbee"*

## Agent Pack

The core of the project. A structured knowledge base that teaches AI assistants how to use the Holepunch/Tether stack correctly.

```
packages/agent-pack/src/
├── core/               # Architecture, patterns, verified package versions
├── modules/            # 12 module docs (Pear, Bare, Hyperswarm, QVAC, ...)
├── skills/             # 10 guided skills with full code examples
│   ├── pear-desktop-app/   # Desktop app with worker pattern
│   ├── p2p-rpc/            # RPC over P2P connections
│   ├── qvac-chat-app/      # AI chat with tool calling
│   ├── qvac-tool-calling/  # Zod schemas + tool loop
│   └── ...
├── recipes/            # 18 focused patterns (kv-cache, NDJSON, encryption, ...)
├── components/         # Reusable TypeScript (chat session, swarm manager, ...)
└── hooks/              # Auto-activation rules
```

### How knowledge is built

We don't write docs from docs. We **build real apps**, hit real bugs, fix them, and extract working patterns.

```
Build app → Find bugs → Document fixes → Extract into agent pack → Validate by rebuilding from scratch
```

If the AI can rebuild the same app using only the agent pack — the knowledge is validated. See [Roadmap/](./Roadmap/) for the full coverage matrix.

### Multi-tool support

The same knowledge base generates configs for:

| Tool | Format |
|------|--------|
| **Claude Code** | `.claude/` directory with rules, skills, and hooks |
| **Cursor** | `.cursor/rules/*.mdc` with description-triggered and glob-scoped rules |
| **OpenCode** | `opencode.json` with skills and specialized agents |

## Repository Structure

```
unstoppable-stack/
├── packages/
│   ├── cli/              # create-unstoppable-app — scaffolds projects
│   ├── agent-pack/       # AI knowledge base (source of truth)
│   ├── website/          # unstoppable.dev — Next.js site
│   └── templates/        # Project scaffolds (blank, p2p-sync, qvac-ai)
├── research/             # Reference apps — ground truth for the agent pack
│   ├── coffee-assistant/       # CLI app: P2P + RPC + QVAC + Hyperbee
│   └── coffee-assistant-ui/    # Desktop app: Pear + React + Worker pattern
├── Roadmap/              # Coverage matrix, next apps, gap analysis
├── presentation/         # Deck, speaker notes, one-pager
└── project-planning/     # Architecture decisions and planning docs
```

## Development

```bash
# Clone
git clone https://github.com/unstoppable-stack/unstoppable-dev.git
cd unstoppable-dev

# Install dependencies
pnpm install

# Build the CLI
pnpm --filter create-unstoppable-app build

# Run the website locally
pnpm --filter website dev

# Link the CLI globally for testing
cd packages/cli && npm link
```

### Editing the Agent Pack

All agent pack content lives in `packages/agent-pack/src/`. After making changes:

```bash
# Sync to CLI bundle
rsync -av --delete packages/agent-pack/src/ packages/cli/agent-pack-src/

# Rebuild CLI
pnpm --filter create-unstoppable-app build
```

## Validated Patterns

These patterns have been built, debugged, and validated in real apps:

- **Pear Desktop Apps** — Renderer/worker split, NDJSON pipe bridge, SWC + React Refresh build
- **P2P Communication** — Hyperswarm topics, bare-rpc with numeric command IDs
- **Local Storage** — Hyperbee key-value persistence
- **Local AI** — QVAC streaming chat, kv-cache, Zod v4 tool calling
- **Bare Runtime** — API compatibility (no TextEncoder/Buffer/crypto), bare-* as npm deps
- **Worker Bridge** — `Pear.worker.pipe()` for renderer↔worker communication

See [Roadmap/00-overview.md](./Roadmap/00-overview.md) for the full coverage matrix.

## Roadmap

| Phase | Status | What |
|-------|--------|------|
| **Toolchain** | Done | CLI, Agent Pack, Website |
| **Validate core** | 50% | 2 of 7 reference apps built |
| **Validate full stack** | Planned | Hyperdrive, HyperDB, SecretStream, Expo Bare, WDK |
| **Unstoppable Auth** | Planned | Local-first identity across apps |
| **Unstoppable Subscriptions** | Vision | Cloud inference, storage, seeding — revenue share with builders |

See [Roadmap/](./Roadmap/) for the detailed plan.

## Built With

- [Holepunch](https://holepunch.to) — P2P protocols (Hyperswarm, Hypercore, Pear Runtime)
- [Tether](https://tether.io) — QVAC (local AI), WDK (crypto wallet)
- [Next.js](https://nextjs.org) — Website
- [Commander.js](https://github.com/tj/commander.js) + [Inquirer](https://github.com/SBoudrias/Inquirer.js) — CLI

## License

MIT
