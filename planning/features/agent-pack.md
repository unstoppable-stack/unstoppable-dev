# Agent Pack & Researcher Improvements

> Implementation update (10 October 2026): the pack now guides app contracts and explicit compatibility migrations. Local AI lifecycle is maintained in packages/runtime-ai; the CLI emits per-app manifests and read-only compatibility checks. The historical research-driven roadmap below is retained for context, not the current content pipeline.

> Distribution planning (11 October 2026): see [the harness plugin plan](harness-plugin.md) for Codex/Claude Code packaging, shared content assembly, project-pack coexistence, additional harness adapters and release acceptance gates.

> Distribution planning (11 October 2026): see [the harness plugin plan](harness-plugin.md) for Codex/Claude Code packaging, project-pack coexistence and release acceptance gates.

## Purpose

This document audits the current agent pack system, synthesizes best practices from leading open-source agent configurations, and proposes a roadmap for continuously improving the agents that help developers build Unstoppable Stack apps.

---

## 1. Current State Audit

### What We Have

| Component | Status | Notes |
|-----------|--------|-------|
| **Research pipeline** | Working | OpenCode researcher agent produces docs in `research/output/` |
| **Sync script** | Working | `sync-research.js` copies research → `packages/agent-pack/src/` |
| **Agent pack source** | 34 files | 7 core, 12 modules, 15 recipes |
| **CLI builder** | Working | Generates Claude/Cursor/OpenCode configs from source |
| **Tool specs** | Documented | Feature matrix, per-tool capabilities, unified model |
| **Researcher agent** | OpenCode only | `research/.opencode/` with researcher + skills |
| **Verify skill** | Exists | `verify-research` skill for quality audits |

### What's Working Well

1. **Single source of truth** — research/output/ → agent-pack/src/ → CLI output. Clean pipeline.
2. **Multi-tool output** — The CLI generates Claude/Cursor/OpenCode configs from the same source.
3. **Content quality** — Modules have verified version numbers, real code examples, and gotchas.
4. **Structured frontmatter** — Consistent YAML metadata enables smart filtering and dependency resolution.
5. **Research methodology** — The researcher agent has clear quality standards and verification checklists.

### Critical Gaps

| Gap | Impact | Priority |
|-----|--------|----------|
| **No skills in generated output** | Agents can't invoke recipes as commands | HIGH |
| **No progressive disclosure** | Everything loaded at once, wastes context | HIGH |
| **No auto-activation** | Agent doesn't know which skill is relevant | HIGH |
| **No hooks** | No auto-formatting, no secret protection | MEDIUM |
| **No feedback loop** | Can't learn from scaffolded app failures | HIGH |
| **No validation tests** | No way to verify generated configs work | MEDIUM |
| **Researcher is OpenCode-only** | Can't run research from Claude/Cursor | MEDIUM |
| **No skill gating** | All content always loaded, no on/off | LOW |

---

## 2. Research Findings: Best Practices

### 2.1 — Repo Layout as Product (claude-code-showcase)

**Pattern**: Treat the agent configuration as a first-class deliverable with a standard directory contract.

**What they do**:
```
CLAUDE.md                    # "How to work in this repo"
.claude/settings.json        # Guardrails & permissions
.claude/skills/              # Reusable slash commands
.claude/commands/            # Workflow primitives
.mcp.json                    # Tool integrations
```

**Our gap**: We generate `CLAUDE.md` and `settings.json` but don't generate _skills_ for Claude or meaningful _commands_. Our Cursor output doesn't leverage `.mdc` auto-scoping well enough. Our OpenCode output has agents but no real skills.

**Action**: Generate proper skills/commands for all three tools from recipes.

---

### 2.2 — Progressive Disclosure & 500-Line Rule (claude-code-infrastructure-showcase / diet103)

**Pattern**: Keep the main instruction file thin. Put deep content into `resources/*.md` files that the agent loads on demand.

**What they do**:
```
.claude/skills/add-p2p-sync/
├── SKILL.md              # ≤500 lines: when to use, steps, invocation
└── resources/
    ├── hyperdb-api.md    # Deep API reference
    ├── examples.md       # Full code examples
    └── gotchas.md        # Edge cases
```

The SKILL.md says "Read `resources/hyperdb-api.md` for the full API" — the agent only loads it when actively working on that skill.

**Our gap**: Our recipes are monolithic 50-200 line files. Our module docs are 60-80 lines. This is fine now but will bloat as content grows. More importantly, we concatenate _everything_ into CLAUDE.md (currently ~15KB for a full build, heading toward 50KB+).

**Action**: Adopt the thin-skill + resources pattern. Skills reference resources; resources hold the deep content.

---

### 2.3 — Auto-Activation via Hooks (diet103)

**Pattern**: A hook inspects the user's prompt and file context, then suggests or activates relevant skills.

**How it works**:
1. `skill-rules.json` maps keywords/file patterns → skill names.
2. A `UserPromptSubmit` hook reads the prompt, matches against rules, and injects `"Consider using /add-p2p-sync for this task"` into context.

**Our gap**: Zero auto-activation. Users must know skill names exist to invoke them.

**Action for Claude Code**: Generate a `skill-rules.json` + hook that maps keywords like "sync", "database", "inference" to relevant skills.

**Action for Cursor**: Use `globs` frontmatter aggressively so rules auto-activate when touching relevant files.

**Action for OpenCode**: Use agent descriptions so the model naturally routes to the right subagent.

---

### 2.4 — Lazy Loading / Token Efficiency (opencode-skillful)

**Pattern**: Don't preload all skills. Provide `skill_find` / `skill_use` / `skill_resource` tools so the agent discovers and loads skills on demand.

**Our gap**: We dump everything into a single instructions file. For OpenCode, all content is in `instructions.md`.

**Action**: For OpenCode output, generate a skill registry and instruct the agent to use `skill_find` before loading full content. For Claude, use the progressive disclosure pattern (2.2). For Cursor, rely on glob-scoping and `alwaysApply: false`.

---

### 2.5 — Skill Gating (malhashemi/opencode-skills)

**Pattern**: Disable all skills by default; enable only what the user/project needs.

**Their approach**:
```json
{
  "skill": { "*": false },
  "skill": {
    "add-p2p-sync": "allow",
    "local-inference": "allow"
  }
}
```

**Our gap**: We generate everything, no gating.

**Action**: CLI generates a config with only relevant skills enabled. User can enable more later.

---

### 2.6 — Distributable Skills (neurofoo/agent-skills)

**Pattern**: "Marketplace install" flow — skills as independent packages.

**Our action (future)**: Once skills are stable, publish them so users can `npx @unstoppable/agent-pack add-skill p2p-sync`.

---

## 3. Proposed Architecture (v2)

### 3.1 — Source Structure (New)

```
packages/agent-pack/src/
├── core/                         # Always included (thin)
│   ├── architecture.md           # ≤200 lines
│   ├── principles.md             # ≤300 lines (has decision tree)
│   ├── patterns.md               # ≤200 lines (quick reference)
│   └── cheatsheet.md             # ≤100 lines
│
├── modules/                      # Per-module knowledge
│   └── <module>.md               # ≤150 lines each (overview + quick start)
│
├── recipes/                      # Task-oriented guides (detail)
│   └── <recipe>.md               # Full implementation guides
│
├── skills/                       # NEW: Invokable skills (thin)
│   └── <skill-name>/
│       ├── SKILL.md              # ≤100 lines: when/why/steps
│       └── resources/            # Deep content loaded on demand
│           ├── api-reference.md
│           ├── full-example.md
│           └── troubleshooting.md
│
└── hooks/                        # NEW: Hook scripts
    ├── skill-activator.sh        # Auto-suggest skills based on prompt
    ├── auto-format.sh            # Format after edits
    └── skill-rules.json          # Keyword → skill mapping
```

### 3.2 — Skill Design

Each skill follows this contract:

```markdown
---
name: add-p2p-sync
description: Add P2P data synchronization between peers using Hypercore and Hyperswarm
allowed-tools: Read, Grep, Edit, Write, Bash(npm *), Bash(pnpm *)
---

# Add P2P Data Sync

## When to Use
- User wants to sync data between devices
- User mentions "replication", "multi-device", or "offline sync"

## Prerequisites
- Hypercore and Hyperswarm installed (check package.json)

## Steps
1. Create writer module in `src/data/writer.ts`
2. Create reader module in `src/data/reader.ts`
3. Set up Hyperswarm discovery in `src/p2p/swarm.ts`
4. Connect replication in `src/app/index.ts`

## Quick Implementation
[Minimal 20-line snippet]

## Deep Dive
For full API reference, read `resources/api-reference.md`.
For a complete working example, read `resources/full-example.md`.
For common issues, read `resources/troubleshooting.md`.
```

The key insight: the SKILL.md is **thin** (~80 lines). The agent reads it fast, knows what to do, and only loads resources when it needs detail.

### 3.3 — Auto-Activation Hook (Claude Code)

```json
// .claude/settings.json (generated)
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [{
          "type": "command",
          "command": "npx prettier --write \"$FILE\" 2>/dev/null || true"
        }]
      }
    ]
  }
}
```

Plus a `skill-rules.json`:
```json
{
  "rules": [
    {
      "keywords": ["sync", "replicate", "multi-device", "offline"],
      "files": ["src/p2p/**", "src/data/**"],
      "suggest": "/add-p2p-sync"
    },
    {
      "keywords": ["inference", "llm", "model", "ai", "chat"],
      "files": ["src/ai/**", "src/inference/**"],
      "suggest": "/local-inference"
    },
    {
      "keywords": ["file", "share", "upload", "download", "drive"],
      "files": ["src/files/**", "src/storage/**"],
      "suggest": "/file-sharing"
    },
    {
      "keywords": ["wallet", "payment", "bitcoin", "token"],
      "suggest": "/wallet-integration"
    }
  ]
}
```

### 3.4 — Output Mapping (v2)

| Source | Claude Code | Cursor | OpenCode |
|--------|-------------|--------|----------|
| `core/*.md` | Concatenated in `CLAUDE.md` (thin) | `project.mdc` (alwaysApply) | `instructions.md` (thin) |
| `modules/<mod>.md` | `.claude/rules/<mod>.md` (path-scoped) | `module-<mod>.mdc` (description-triggered) | In `instructions.md` summary |
| `skills/*/SKILL.md` | `.claude/skills/*/SKILL.md` (copy) | `skill-<name>.mdc` (description-triggered) | `.opencode/skills/*/SKILL.md` |
| `skills/*/resources/*` | `.claude/skills/*/resources/*` (copy) | Referenced from `.mdc` | `.opencode/skills/*/resources/*` |
| `hooks/*` | `.claude/settings.json` hooks | N/A | N/A |
| `recipes/*.md` | Become skill resources | Become `.mdc` files | Become skill resources |

### 3.5 — Size Budgets (v2)

| Tool | Main File | Per-Rule/Skill | Total Budget |
|------|-----------|----------------|-------------|
| Claude Code | CLAUDE.md ≤ 8KB | SKILL.md ≤ 3KB, resources unlimited | ~50KB loaded |
| Cursor | project.mdc ≤ 5KB | Per .mdc ≤ 3KB | ~20KB auto-loaded |
| OpenCode | instructions.md ≤ 8KB | SKILL.md ≤ 3KB | ~30KB loaded |

---

## 4. Researcher Agent Improvements

### 4.1 — Current State

The researcher agent lives in `research/.opencode/` and has:
- `agents/researcher.md` — Deep research methodology
- `skills/write-module/SKILL.md` — Module doc template
- `skills/write-recipe/SKILL.md` — Recipe doc template
- `skills/verify-research/SKILL.md` — Quality audit

It's OpenCode-only and its output feeds the pipeline.

### 4.2 — Proposed Improvements

#### A. Make Researcher Multi-Tool

Create researcher instructions for all three tools so research can happen from any environment:

```
research/
├── .opencode/           # OpenCode researcher (existing)
├── CLAUDE.md            # Claude Code researcher (NEW)
├── .claude/
│   ├── skills/
│   │   ├── write-module/SKILL.md
│   │   ├── write-recipe/SKILL.md
│   │   └── verify-research/SKILL.md
│   └── settings.json
├── .cursor/
│   └── rules/
│       ├── researcher.mdc   # alwaysApply
│       └── writing-guide.mdc
└── output/              # Still the single source of truth
```

#### B. Add "Build & Test" Skill

The researcher should be able to _verify_ that generated agent packs actually work:

```markdown
# Skill: Test Agent Pack Output

## Steps
1. Run CLI: `node packages/cli/dist/index.js test-app --assistant claude --no-install`
2. Verify generated files exist and are valid
3. Check CLAUDE.md size is within budget
4. Verify skills reference existing resources
5. Check no broken @-references
6. Report pass/fail
```

#### C. Add "Improve From Feedback" Skill

When a user reports an error while building with the agent pack, this skill:

1. Reads the error report
2. Identifies which module/recipe is involved
3. Checks current documentation for the gap
4. Proposes a fix to the research output
5. Runs sync + rebuild to verify

```markdown
# Skill: Improve From Feedback

## Input
$ARGUMENTS = the error or problem description

## Steps
1. Parse the error to identify:
   - Which module(s) are involved
   - What the user was trying to do
   - What went wrong
2. Read the relevant module/recipe docs
3. Identify the gap or inaccuracy
4. Update the research output file
5. Run `node packages/agent-pack/scripts/sync-research.js`
6. Verify the fix addresses the reported issue
7. Summarize what changed and why
```

#### D. Add "Competitive Analysis" Skill

Periodically scan the community for new patterns:

```markdown
# Skill: Scan Community Patterns

## Steps
1. Check awesome-claude-code for new skill repos
2. Check awesome-opencode for new plugins
3. Compare their patterns against our implementation
4. Report new ideas worth adopting
5. Write findings to research/output/community-scan-YYYY-MM.md
```

---

## 5. Continuous Improvement Process

### 5.1 — The Feedback Loop

```
┌──────────────────────────────────────────────────────────────┐
│                    IMPROVEMENT CYCLE                          │
│                                                              │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐              │
│  │ Research  │───>│  Build   │───>│   Use    │              │
│  │          │    │          │    │          │              │
│  │ - Verify │    │ - Sync   │    │ - Build  │              │
│  │ - Update │    │ - Generate│    │ - Debug  │              │
│  │ - Improve│    │ - Test   │    │ - Report │              │
│  └──────────┘    └──────────┘    └──────────┘              │
│       ^                                │                    │
│       │          ┌──────────┐          │                    │
│       └──────────│ Feedback │<─────────┘                    │
│                  │          │                                │
│                  │ - Errors │                                │
│                  │ - Gaps   │                                │
│                  │ - Ideas  │                                │
│                  └──────────┘                                │
└──────────────────────────────────────────────────────────────┘
```

### 5.2 — Concrete Process Steps

#### Step 1: Research Phase
- Researcher agent investigates a module or pattern
- Writes to `research/output/` using standard formats
- Runs `/verify-research` to check quality
- **NEW**: Produces both a module doc AND a skill with resources

#### Step 2: Build Phase
- Run `node packages/agent-pack/scripts/sync-research.js`
- Run `pnpm --filter cli build`
- **NEW**: Run `/test-agent-pack` to verify output validity
- **NEW**: Check size budgets are respected

#### Step 3: Use Phase
- Developer scaffolds a project with the CLI
- Works with the generated agent pack
- Agent helps them build using skills and patterns

#### Step 4: Feedback Phase
- Developer encounters an error or gap
- Reports it (GitHub issue, direct feedback, etc.)
- **NEW**: Run `/improve-from-feedback "error description"`
- Researcher identifies and fixes the gap
- Cycle restarts at Step 1

### 5.3 — Quality Metrics

Track these metrics to measure improvement over time:

| Metric | How to Measure | Target |
|--------|---------------|--------|
| **Content coverage** | Modules documented / total modules | 100% |
| **Recipe coverage** | Recipes per module | ≥2 per module |
| **Code accuracy** | Examples that compile/run | 100% |
| **Size compliance** | Files within budget | 100% |
| **Skill completeness** | Skills with resources | ≥80% |
| **Build success rate** | `test-agent-pack` pass rate | 100% |
| **User error rate** | Reported issues per month | Decreasing |

### 5.4 — Automation Opportunities

| Task | Automation | Tool |
|------|-----------|------|
| Sync research → agent pack | `sync-research.js` | Script (exists) |
| Verify content quality | `/verify-research` skill | Agent skill (exists) |
| Test generated output | `/test-agent-pack` skill | Agent skill (NEW) |
| Check size budgets | Budget checker script | Script (NEW) |
| Process feedback | `/improve-from-feedback` skill | Agent skill (NEW) |
| Community scan | `/scan-community` skill | Agent skill (NEW) |
| Sync to CLI bundle | Post-sync copy | Script (NEW) |

---

## 6. Implementation Roadmap

### Phase 1: Skill Architecture (Next)

**Goal**: Convert recipes into proper skills with progressive disclosure.

Tasks:
- [ ] Create `packages/agent-pack/src/skills/` directory structure
- [ ] Convert top 5 recipes into thin SKILL.md + resources/ format
  - `add-p2p-sync`
  - `local-inference`
  - `file-sharing`
  - `offline-first-app`
  - `p2p-rpc`
- [ ] Update CLI builders to output skills (not just flat .mdc / concatenated text)
- [ ] Add size budget checks to sync script
- [ ] Slim down CLAUDE.md output to ≤8KB (move detail to skills/rules)

### Phase 2: Auto-Activation & Hooks

**Goal**: Agents automatically discover and suggest relevant skills.

Tasks:
- [ ] Create `skill-rules.json` keyword → skill mapping
- [ ] Add `PostToolUse` formatting hook to Claude output
- [ ] Add `description` field to all Cursor `.mdc` files for agent-choice triggering
- [ ] Add skill descriptions to OpenCode config for natural routing
- [ ] Write auto-activation hook script for Claude Code

### Phase 3: Researcher Improvements

**Goal**: Research runs from any tool, with quality automation.

Tasks:
- [ ] Create `research/CLAUDE.md` for researcher agent
- [ ] Create `research/.cursor/rules/` for researcher agent
- [ ] Build `/test-agent-pack` skill
- [ ] Build `/improve-from-feedback` skill
- [ ] Add automated size budget reporting to sync script

### Phase 4: Feedback Loop & Gating

**Goal**: Continuous improvement with minimal manual effort.

Tasks:
- [ ] Create feedback intake process (GitHub issue template)
- [ ] Build skill gating config (enable/disable per project)
- [ ] Add `/scan-community` skill for competitive analysis
- [ ] Create "Unstoppable Pack update" command for existing projects
- [ ] Publish skills as independent packages (marketplace)

---

## 7. Quick Wins (Can Do Now)

These require minimal code changes and have immediate impact:

### 7.1 — Add `description` to all Cursor `.mdc` files
Currently some `.mdc` files have generic descriptions. The `description` field is how Cursor decides whether to include a rule. Make them specific and keyword-rich.

### 7.2 — Slim the CLAUDE.md output
The current `buildClaude()` concatenates all core + all modules into one file. Move modules into `.claude/rules/` as path-scoped files instead.

### 7.3 — Add PostToolUse formatting hook
One line in `settings.json` that auto-formats after edits. Free quality improvement.

### 7.4 — Generate actual skills from recipes
The recipe content already exists. Wrapping it in SKILL.md format is mostly structural.

### 7.5 — Add Cursor-specific glob patterns
The current Cursor output only has one glob-scoped rule (`p2p-patterns.mdc`). Add globs for QVAC files (`src/ai/**`, `src/inference/**`) and file sharing (`src/files/**`).

---

## 8. Decision Log

| Decision | Rationale | Date |
|----------|-----------|------|
| Keep recipes AND skills (not replace) | Recipes are full docs; skills are thin invocation wrappers that reference recipes as resources | 2026-02-06 |
| Progressive disclosure over gating | Gating is complex UX; progressive disclosure is invisible to users | 2026-02-06 |
| CLAUDE.md ≤ 8KB budget | diet103 shows 500 lines/file works; 8KB is ~300 lines with code | 2026-02-06 |
| Multi-tool researcher | Research shouldn't be locked to one tool; same content, different configs | 2026-02-06 |
| Auto-activation via hooks (Claude only) | Only Claude has lifecycle hooks; Cursor uses globs; OpenCode uses descriptions | 2026-02-06 |

---

## Appendix A: Reference Repos

| Repo | Key Takeaway | Link |
|------|-------------|------|
| ChrisWiles/claude-code-showcase | Repo layout as product, slash commands | GitHub |
| diet103/claude-code-infrastructure-showcase | Progressive disclosure, skill-rules.json, 500-line rule | GitHub |
| zenobi-us/opencode-skillful | Lazy skill loading, token efficiency | GitHub |
| malhashemi/opencode-skills | Skill gating, enable/disable pattern | GitHub |
| neurofoo/agent-skills | Marketplace distribution pattern | GitHub |
| awesome-claude-code | Discovery hub for Claude patterns | GitHub |
| awesome-opencode | Discovery hub for OpenCode patterns | GitHub |

## Appendix B: Current Content Inventory

### Core (7 files)
- architecture.md, cheatsheet.md, design-guide.md, patterns.md, principles.md, production-readiness.md, scenarios.md

### Modules (12 files)
- bare, corestore, expo-bare, hyperbee, hypercore, hyperdb, hyperdht, hyperdrive, hyperswarm, pear, qvac, wdk

### Recipes (15 files)
- file-sharing, local-inference, local-p2p-testing, offline-first-app, p2p-data-sync, p2p-ndjson-messaging, p2p-rpc, qvac-delegated-inference, qvac-embeddings-rag-sqlite, qvac-kv-cache, qvac-logging, qvac-model-sources, qvac-multimodal-vision, qvac-tool-calling, qvac-transcription, qvac-translation, secure-communication, wallet-integration
