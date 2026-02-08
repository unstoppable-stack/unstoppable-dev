# The Unstoppable Stack

## Project Overview

A toolchain enabling developers to scaffold and "vibe-code" apps using P2P protocols, local AI, and crypto payments. The stack provides a CLI, website, templates, and AI agent packs that work across Claude, Cursor, and OpenCode.

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
│   ├── templates/               # Project scaffolds
│   │   ├── starter/             # Basic Pear + Bare starter
│   │   ├── p2p-sync/            # P2P data sync template
│   │   ├── ai-local/            # QVAC inference template
│   │   └── expo-mobile/         # Expo Bare mobile template
│   └── agent-pack/              # AI assistant configurations
│       ├── claude/              # Claude Code/API instructions
│       ├── cursor/              # Cursor rules and commands
│       └── opencode/            # OpenCode skills
├── docs/                        # Extended documentation
│   ├── modules/                 # Per-module documentation
│   └── recipes/                 # Common patterns and recipes
├── research/                    # Reference material (battle-tested apps, libraries)
└── project-planning/            # Planning documents (this phase)
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

### Templates (packages/templates)
- Structure follows scaffolded app conventions
- Each template includes its own README and agent instructions
- Templates are copied and processed by CLI

### Agent Pack (packages/agent-pack) — v2
- Portable format that generates tool-specific configs
- **Skills** with progressive disclosure (thin SKILL.md + resources/)
- **Hooks** for auto-activation (skill-rules.json) and formatting
- Build step generates Claude/Cursor/OpenCode formats

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

### Research Folder

The `research/` folder contains **reference material** — battle-tested apps, mini-apps, and libraries that serve as ground truth for the agent pack documentation. These are NOT synced automatically; they are consulted when updating the agent pack.

```
research/
├── coffee-assistant/              # Battle-tested app with AI + P2P + RPC
├── qvac-app-workbench-desktop-main/  # QVAC reference desktop app
├── qvac-app-workbench-mobile-main/   # QVAC reference mobile app
├── qvac-docs/                     # QVAC SDK documentation
├── qvac-examples/                 # QVAC SDK examples
└── qvac-health-dev/               # Health app reference
```

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
    None
? Select a template:
  ❯ Starter (Pear + Bare basics)
    P2P Sync App (HyperDB + Hyperswarm)
    AI Local (QVAC inference)
    Mobile (Expo Bare)
? Select additional modules:
  ◉ HyperDB (P2P database)
  ◉ Hyperdrive (P2P files)
  ◯ QVAC (AI inference)
  ◯ WDK Wallet (crypto payments)
```

### Output
```
Creating my-app...
✓ Scaffolded from starter template
✓ Added HyperDB module
✓ Added Hyperdrive module
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
4. **Template Awareness** - Knows what was scaffolded

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

---

## Development Phases

### Phase 0: Foundation (Current)
- [x] Define planning documents
- [ ] Research tech stack libraries deeply
- [ ] Initialize monorepo structure
- [ ] Create CLAUDE.md and agent context

### Phase 1: POC
- [ ] CLI skeleton (init command, prompts, scaffolding)
- [ ] One working template (Starter)
- [ ] Agent pack v0 (rules + 3-5 recipes)
- [ ] Website v0 (landing + getting started)

### Phase 2: Templates & Docs
- [ ] Additional templates (P2P sync, AI local, mobile)
- [ ] Per-module documentation
- [ ] More recipes and patterns

### Phase 3: Unstoppable Auth
- [ ] Local-first identity model
- [ ] Device linking and recovery
- [ ] Integration into templates

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
- Planning: `./project-planning/`
- Website: `./packages/website/`
- CLI: `./packages/cli/`

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

4. **Template awareness** - When helping users build, know which template they started from and which modules are included.

5. **Recipes over raw docs** - Prefer showing working patterns over explaining APIs in the abstract.
