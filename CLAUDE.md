# The Unstoppable Stack

## Project Overview

A toolchain enabling developers to scaffold and "vibe-code" apps using P2P protocols, local AI, and crypto payments. The stack provides a CLI, website, and AI agent packs that work across Claude, Cursor, OpenCode, and Codex.

## Vision

Allow developers to build truly unstoppable applications - apps that run locally, communicate peer-to-peer, can run AI inference offline, and process payments without centralized intermediaries.

---

## Repository Structure

```
unstoppable-stack/
├── CLAUDE.md                    # Project context (Claude Code)
├── .cursor/rules/               # Project context (Cursor)
├── packages/
│   ├── website/                 # unstoppable.dev - Next.js site
│   ├── cli/                     # create-unstoppable-app CLI
│   └── agent-pack/              # AI assistant configurations
│       ├── claude/              # Claude Code/API instructions
│       ├── cursor/              # Cursor rules and commands
│       ├── opencode/            # OpenCode skills
│       └── codex/               # Codex (OpenAI) AGENTS.md + skills
├── docs/                        # Extended documentation
│   ├── modules/                 # Per-module documentation
│   └── recipes/                 # Common patterns and recipes
├── reference-apps/              # Upstream apps as git submodules (tracked)
│   ├── qvac-workbench-desktop/  # Pear Desktop AI workbench
│   ├── qvac-workbench-mobile/   # Expo Bare AI workbench
│   └── qvac-health/             # Mobile health app with local AI
├── research/                    # Fetched docs and SDK examples
│   ├── qvac-docs/               # QVAC SDK documentation
│   └── qvac-examples/           # QVAC SDK examples
├── sandbox/                     # Battle-tested apps + CLI test builds (gitignored)
│   ├── coffee-assistant/        # P2P + AI + RPC (Node.js CLI)
│   ├── coffee-assistant-ui/     # Pear Desktop + React + Worker
│   └── slack-p2p-copy/          # P2P messaging
└── planning/                    # All planning, roadmap, status, and presentations
    ├── vision/                  # Strategy and product direction
    ├── roadmap/                 # Coverage tracking (54 items, 5 categories)
    ├── features/                # Deep planning per feature (vault, website, etc.)
    ├── status/                  # Sprint-level tracking and priorities
    └── presentations/            # Pitch decks grouped by date+name
```

---

## The Unstoppable Stack (Core Modules)

### P2P & Runtime
| Module | Purpose | Source |
|--------|---------|--------|
| **Pear** | Desktop runtime for P2P apps | Holepunch |
| **Bare** | Minimal JS runtime | Holepunch |
| **Hyperswarm** | P2P networking / DHT | Holepunch |
| **RPC** | Remote procedure calls over P2P | Holepunch |

### Data
| Module | Purpose | Source |
|--------|---------|--------|
| **HyperDB** | P2P key-value database | Holepunch |
| **Hyperdrive** | P2P file storage | Holepunch |
| **Hypercore** | Append-only log (foundation) | Holepunch |

### AI & Payments
| Module | Purpose | Source |
|--------|---------|--------|
| **QVAC SDK** | Local AI model inference | Tether |
| **WDK Wallet** | Crypto wallet & payments | Tether |

### Mobile
| Module | Purpose | Source |
|--------|---------|--------|
| **Expo Bare** | React Native with Bare runtime | Holepunch |

---

## Tech Decisions

### Monorepo
- **Package Manager**: pnpm with workspaces
- **Build Tool**: Turborepo for task orchestration
- **Node Version**: 20+ LTS

### Website (packages/website)
- **Framework**: Next.js 14+ (App Router)
- **Styling**: Tailwind CSS
- **Components**: shadcn/ui
- **Deployment**: Vercel or static export

### CLI (packages/cli)
- **Language**: TypeScript
- **Framework**: Commander.js + Inquirer (prompts)
- **Package Name**: `create-unstoppable-app`
- **Distribution**: npm

### Agent Pack (packages/agent-pack) — v2
- Portable format that generates tool-specific configs
- **Skills** with progressive disclosure (thin SKILL.md + resources/)
- **Hooks** for auto-activation (skill-rules.json) and formatting
- Build step generates Claude/Cursor/OpenCode/Codex formats

### Agent Pack Editing

**All agent pack content is edited directly** in `packages/agent-pack/src/`:
```
packages/agent-pack/src/
├── core/             # Principles, patterns, cheatsheet, architecture
├── modules/          # Per-module documentation (hyperswarm, qvac, etc.)
├── recipes/          # Common patterns (p2p-rpc, kv-cache, tool-calling, etc.)
├── skills/           # Thin SKILL.md + resources/ per skill
├── hooks/            # skill-rules.json, auto-format.sh
└── components/       # Reusable TypeScript components (ai/, p2p/, data/)
```

Changes to agent-pack should also be synced to `packages/cli/agent-pack-src/` (the CLI-bundled copy).

### Reference Apps (`reference-apps/`)

Upstream applications added as **git submodules**. These are the ground truth for battle-tested patterns.

```
reference-apps/
├── qvac-workbench-desktop/   # Pear Desktop: worker pattern, streaming, tool calling
├── qvac-workbench-mobile/    # Expo Bare: mobile AI, model management
└── qvac-health/              # Expo Bare: RAG, embeddings, health data
```

Update submodules to pull latest upstream changes:
```bash
git submodule update --remote --merge
```

### Research Folder (`research/`)

Fetched external documentation and SDK examples consulted when updating the agent pack.

```
research/
├── qvac-docs/               # QVAC SDK documentation
└── qvac-examples/           # QVAC SDK examples
```

### Sandbox (`sandbox/`)

Battle-tested apps we built + CLI test builds. **Gitignored** but accessible to AI agents.

```
sandbox/
├── coffee-assistant/         # Battle-tested: P2P + AI + RPC (Node.js CLI)
├── coffee-assistant-ui/      # Battle-tested: Pear Desktop + React + Worker
├── slack-p2p-copy/           # Battle-tested: P2P messaging
└── <cli-test-builds>/        # Future: scaffolded with create-unstoppable-app
```

The battle-tested apps contain `fixes/` folders and planning notes — these are the primary source of validated patterns for the agent pack. CLI test builds should include a `FEEDBACK.md`.

---

## CLI Specification

### Installation
```bash
npm create unstoppable-app@latest
# or
npx create-unstoppable-app
# or
pnpm create unstoppable-app
```

### Interactive Flow
```
? What is your project name? my-app
? Select your AI assistant:
  ❯ Claude Code
    Cursor
    OpenCode
    Codex
    None
```

### Output
```
Creating my-app...
✓ Configured Claude Code agent pack
✓ Installed dependencies

Next steps:
  cd my-app
  pnpm dev
```

---

## Agent Pack Architecture

The agent pack provides AI assistants with context about:

1. **Architecture Guidelines** - How unstoppable apps are structured
2. **Module Documentation** - What each module does, when to use it
3. **Recipes** - Common patterns (auth, sync, storage, inference)
4. **Skills** - Guided implementation workflows with progressive disclosure

### Format per Tool

**Claude Code** (`.claude/` or `CLAUDE.md`):
- Project instructions in markdown
- MCP server configurations (if needed)

**Cursor** (`.cursor/rules`):
- Project rules
- Composer commands

**OpenCode** (`opencode.json` + skills):
- Agent configuration
- Skill definitions

**Codex** (`AGENTS.md` + `.codex/`):
- Project instructions in `AGENTS.md`
- Skills in `.codex/skills/`
- Project config in `.codex/config.toml`

---

## Development Phases

### Phase 0: Foundation (Current)
- [x] Define planning documents
- [ ] Research tech stack libraries deeply
- [ ] Initialize monorepo structure
- [ ] Create CLAUDE.md and agent context

### Phase 1: POC
- [ ] CLI skeleton (init command, prompts, scaffolding)
- [ ] Agent pack v0 (rules + 3-5 recipes)
- [ ] Website v0 (landing + getting started)

### Phase 2: Content & Mobile
- [ ] Mobile platform support (Expo Bare)
- [ ] Per-module documentation
- [ ] More recipes and patterns

### Phase 3: Unstoppable Auth
- [ ] Local-first identity model
- [ ] Device linking and recovery

### Phase 4: Cloud Services (Monetization)
- [ ] Inference hosting
- [ ] Backup services
- [ ] Billing dashboard

---

## Coding Guidelines

### General
- TypeScript everywhere
- ESLint + Prettier for formatting
- Vitest for testing
- Conventional commits

### P2P Patterns
- Always handle peer disconnection gracefully
- Use Hyperswarm topics for discoverability
- Replicate Hypercores before reading

### File Structure (Scaffolded Apps)
```
my-app/
├── src/
│   ├── index.ts          # Entry point
│   ├── app/              # Application logic
│   ├── p2p/              # P2P networking
│   ├── data/             # Database/storage
│   └── ui/               # UI components (if applicable)
├── package.json
├── tsconfig.json
└── CLAUDE.md             # Agent instructions
```

---

## Key Resources

### Holepunch
- Docs: https://docs.holepunch.to/
- Pear: https://docs.pear.holepunch.to/
- GitHub: https://github.com/holepunchto

### Tether/QVAC
- QVAC: https://github.com/nicosoftware/qvac (needs verification)
- WDK: (documentation needed)

### This Project
- Planning: `./planning/` (vision, roadmap, features, status, presentations)
- Website: `./packages/website/`
- CLI: `./packages/cli/`
- Reference Apps: `./reference-apps/` (git submodules)
- Research: `./research/` (local, not tracked)
- Sandbox: `./sandbox/` (gitignored, for CLI test builds)

---

## Commands

```bash
# Development
pnpm install              # Install all dependencies
pnpm dev                  # Run all packages in dev mode
pnpm build                # Build all packages
pnpm test                 # Run tests

# CLI development
pnpm --filter cli dev     # Run CLI in watch mode
pnpm --filter cli build   # Build CLI

# Website development
pnpm --filter website dev # Run website locally
```

---

## Notes for AI Assistants

When working on this codebase:

1. **Understand the P2P model** - Apps don't have traditional servers. Data lives on user devices and syncs peer-to-peer.

2. **Local-first mindset** - Everything should work offline. Network is a nice-to-have for sync.

3. **Module boundaries** - Each Holepunch module (Hypercore, HyperDB, Hyperdrive) is independent but composable.

4. **Module awareness** - Know which stack modules the user's project uses and which are available.

5. **Recipes over raw docs** - Prefer showing working patterns over explaining APIs in the abstract.

6. **Reference apps** - `reference-apps/` contains upstream apps as git submodules. Use `git submodule update --remote` to pull latest changes, then analyze diffs and commits for new patterns.

7. **Research material** - `research/` contains fetched QVAC docs and SDK examples. Consult when writing or validating agent pack content.

8. **Sandbox** - `sandbox/` is gitignored but accessible to you. It contains battle-tested apps (`coffee-assistant`, `coffee-assistant-ui`, `slack-p2p-copy`) and CLI test builds. The battle-tested apps have `fixes/` folders with critical learnings. Scan `FEEDBACK.md` files for improvement opportunities.
