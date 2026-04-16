# `us` — Unified Unstoppable Stack CLI

## Vision

One CLI to rule them all. `us` is the single entry point for:
- Initializing new projects with AI agent configuration
- Scaffolding platform-specific apps with battle-tested boilerplate
- Managing and sharing P2P skills
- Running automated research/improvement loops

## Architecture

```
us
├── init <project-name>          # Interactive: creates workspace + agent pack
├── scaffold <type>              # Non-interactive: generates platform app
│   ├── app                      # App scaffolds
│   │   ├── -p expo-mobile       # iOS/Android with Expo + optional BareKit
│   │   ├── -p pear-desktop      # Pear Desktop with worker bridge
│   │   ├── -p pear-terminal     # Pear Terminal (headless P2P)
│   │   └── -p node-cli          # Node.js CLI tool
│   ├── bot                      # Bot scaffolds (future)
│   └── workflow                 # Workflow scaffolds (future)
├── skills                       # P2P skill management
│   ├── list                     # List installed skills
│   ├── generate <source>        # Generate SKILL.md from URL/repo/PDF
│   ├── test <skill>             # Test a skill against a task
│   ├── publish                  # Publish to P2P network
│   ├── sync                     # Discover + replicate from peers
│   └── search <query>           # Search P2P network for skills
├── research                     # Automated improvement loop
│   ├── run                      # Run experiment cycle
│   ├── scaffold-test            # Test all scaffold combinations
│   └── status                   # Show experiment results
└── doctor                       # Verify environment (node, pear, xcode, etc.)
```

## What Changes from Today

| Before | After |
|--------|-------|
| `create-unstoppable-app` (interactive, creates blank project + agent pack) | `us init` (same flow, same features) |
| `us create -p ... -f ...` (scaffold-cli.ts) | `us scaffold app -p ... -f ...` (nested subcommand) |
| Agent pack is static content bundled in CLI | Skills are living documents — generated, tested, shared P2P |
| Manual scaffold testing | `us research scaffold-test` automates build verification |

## CLI Source Structure

```
packages/cli/src/
├── us.ts                    # Main entry point (single binary)
├── commands/
│   ├── init.ts              # us init (from current index.ts)
│   ├── scaffold.ts          # us scaffold app -p <platform> -f <features>
│   ├── skills.ts            # us skills list/generate/test/publish/sync
│   ├── research.ts          # us research run/scaffold-test/status
│   └── doctor.ts            # us doctor
├── generators/              # Platform generators (already built)
│   ├── types.ts
│   ├── common.ts
│   ├── expo-mobile.ts
│   ├── pear-desktop.ts
│   └── node-cli.ts
├── agent-pack/              # Agent pack builder (already built)
│   └── index.ts
├── skills/                  # Skill management engine
│   ├── generator.ts         # LLM-powered skill generation
│   ├── tester.ts            # Skill testing framework
│   └── p2p.ts               # Hyperswarm publish/sync
├── research/                # Research/experiment engine
│   ├── scaffold-tester.ts   # Automated scaffold test matrix
│   └── experiment.ts        # General experiment runner
└── constants.ts
```

## Phases

### Phase 1: Restructure (now)
- Merge `index.ts` + `scaffold-cli.ts` into single `us.ts` entry point
- Move init logic into `commands/init.ts`
- Move scaffold logic into `commands/scaffold.ts`
- Add `us doctor` for environment checks
- Keep `create-unstoppable-app` as alias to `us init`
- **Test**: `us init`, `us scaffold app`, `us doctor` all work

### Phase 2: Scaffold Testing
- Build `us research scaffold-test` — test matrix of platform × features
- For each combination: scaffold → npm install → type-check/build
- Report pass/fail per combination
- Use this to validate and fix generators
- **Test**: All scaffold combos pass

### Phase 3: P2P Skills Foundation
- `us skills list` — list local skills from agent-pack-src
- `us skills generate <url>` — call LLM to produce SKILL.md from a source
- `us skills test <skill>` — run a skill against a test task, score result
- Requires LLM backend config (cloud API key or local LM Studio endpoint)
- **Test**: Generate a skill from a GitHub repo URL

### Phase 4: P2P Sharing
- `us skills publish` — publish skill to Hyperswarm topic
- `us skills sync` — discover and replicate skills from peers
- `us skills search` — search available skills on the network
- HyperDB for skill metadata (name, version, author, rating)
- Hyperdrive for skill content (SKILL.md + resources/)
- **Test**: Two peers can share and replicate a skill

### Phase 5: Research Loop
- `us research run` — continuous improvement cycle
- Test skills against tasks, score outcomes
- Iterate with LLM, keep improvements, discard regressions
- Learn from session logs (Claude Code transcripts, Cursor history)
- **Test**: A skill improves measurably after research cycle

## Scaffold Test Matrix

The `us research scaffold-test` command tests every valid combination:

| Platform | p2p | kv-storage | qvac | autobase | p2p+qvac | p2p+kv | all |
|----------|-----|------------|------|----------|----------|--------|-----|
| expo-mobile | ✓ | ✓ | ✓ | — | ✓ | ✓ | ✓ |
| pear-desktop | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| node-cli | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

Each cell: scaffold → `npm install` → build/typecheck → report

## Skill Generation Pipeline

```
Source (URL/repo/PDF)
  → Scrape content
  → Chunk + summarize
  → LLM: produce structured SKILL.md
  → Human review
  → Optional: auto-test against task
  → Publish to P2P
```

## P2P Skill Sharing Architecture

```
┌─────────────┐     Hyperswarm      ┌─────────────┐
│  Developer A │◄──────────────────►│  Developer B │
│              │    topic: "us-skills" │              │
│  HyperDB    │                     │  HyperDB    │
│  (metadata) │                     │  (metadata) │
│  Hyperdrive │                     │  Hyperdrive │
│  (content)  │                     │  (content)  │
└─────────────┘                     └─────────────┘
```

Skills are append-only (versioned), forkable, and ratable.
