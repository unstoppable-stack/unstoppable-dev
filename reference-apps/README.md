# Reference Apps

Curated upstream applications added as **git submodules**. These are the ground truth for battle-tested patterns used in the Unstoppable Stack agent pack.

## Primary reference

| App | Description | Platform | Key Patterns |
|-----|-------------|----------|--------------|
| [qvac-app](https://github.com/tetherto/qvac-app) | QV.AC — P2P AI assistant. Bun monorepo: `core/`, `desktop/`, `mobile/`, `ui/`, `app-runtime/`. | Desktop (Electron + Bare) + Mobile (Expo) | HyperDB over Autobee, `@qvac`/`@local` collection split, bare-rpc worker protocol, `reasoning_budget`, agent runs + delegation, HLC conflict resolution |

**Prefer this app** when sourcing patterns. It is the current generation and is
actively developed.

Useful entry points:

- `docs/architecture.md` — packages, boundaries, runtime shape
- `docs/hyperdb-migration-report.md` — the SQLite→HyperDB move and the
  convergence hazards it surfaced. The single densest doc in the repo.
- `docs/sync-architecture.md` — replication flow
- `docs/decisions/` — ADRs (hybrid logical clock, append-only history, …)
- `core/src/services/model/` — QVAC SDK usage: load presets, streaming,
  KV cache, GPU selection

> **Caution:** the repo has known doc drift. `.ai/cursor/rules/*.mdc` and parts
> of `docs/` still describe SQLite as the local materialized view, but
> `hyperdb-migration-report.md` records SQLite being removed from core except
> for RAG. When docs and code disagree, trust the code.

## Legacy references (pre-2026-07)

These are the previous generation, superseded by `qvac-app`. Its own
`CLAUDE.md` lists them as *"retained legacy package directories"* to exclude
from searches. Keep them for historical patterns; do not treat them as current.

| App | Description | Platform | Key Patterns |
|-----|-------------|----------|--------------|
| [qvac-workbench-desktop](https://github.com/tetherto/qvac-app-workbench-desktop) | QVAC AI workbench for Pear Desktop | Desktop (Pear) | Worker pattern, NDJSON IPC, streaming chat, tool calling, vision, transcription |
| [qvac-workbench-mobile](https://github.com/tetherto/qvac-app-workbench-mobile) | QVAC AI workbench for Expo Bare | Mobile (Expo) | Bare worklet, model management, mobile AI inference |
| [qvac-health](https://github.com/tetherto/qvac-health) | Health app with local AI | Mobile (Expo) | RAG, embeddings, health data, Drizzle ORM |

## Usage

```bash
# Clone with submodules
git clone --recurse-submodules <repo-url>

# If already cloned, initialize submodules
git submodule update --init --recursive

# Pull latest changes from all reference apps
git submodule update --remote --merge
```

## For AI Agents

When updating agent pack documentation:

1. **Check for upstream changes**: `git submodule update --remote` then review diffs
2. **Analyze commits**: `cd reference-apps/<app> && git log --oneline -20` to see recent changes
3. **Cross-reference patterns**: Compare implementations across apps for consistent patterns
4. **Update agent pack**: Port validated patterns to `packages/agent-pack/src/`
