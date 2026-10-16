# Skill Nodes — Architecture & Flow

> **Status**: Planning
> **Date**: 2026-04-10

## Overview

A **Skill Node** is a curated hub that aggregates skills from one or more GitHub
repos into a single searchable catalog. The official Unstoppable Stack node ships
as the default; anyone can host their own node. Skills from any node land in the
user's local `~/.agents/skills/` and become available to any AI agent (Cursor,
Claude Code, OpenCode, Codex, Unstoppable Agent).

**Key concept**: A node is NOT a single repo of skills. A node is a **manifest**
that references multiple repos. The node's CI aggregates all referenced repos
into one `registry.json`. Users subscribe to the node and get skills from all
its repos through a single search.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                      OFFICIAL NODE                                    │
│                  unstoppable-stack/skill-node                         │
│                                                                      │
│  node.json (manifest):                                               │
│  ├── unstoppable-stack/skills          (our own skills)              │
│  ├── holepunchto/pear-skills           (upstream Pear patterns)      │
│  ├── alice/ai-agent-skills             (community contributor)       │
│  └── nedcodes-ok/cursorrules-collection (foreign format)             │
│                                                                      │
│  CI aggregates all repos → registry.json (unified catalog)           │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
         ┌─────────────────────┼────────────────────┐
         ▼                     ▼                    ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│  unstoppable-    │  │  holepunchto/   │  │  alice/          │
│  stack/skills    │  │  pear-skills    │  │  ai-agent-skills │
│  (canonical)     │  │  (canonical)    │  │  (canonical)     │
│  19 skills       │  │  5 skills       │  │  8 skills        │
└─────────────────┘  └─────────────────┘  └─────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                      COMPANY NODE                                     │
│                      acme/skill-node                                  │
│                                                                      │
│  node.json:                                                          │
│  ├── acme/internal-skills              (private company skills)      │
│  ├── acme/devops-playbooks             (private, cursor rules fmt)   │
│  └── unstoppable-stack/skills          (cherry-pick official ones)   │
│                                                                      │
│  CI aggregates → registry.json                                       │
└─────────────────────────────────────────────────────────────────────┘

                    ┌──────────────────────┐
      User's CLI    │  us skills search     │
                    │  us skills install    │
                    └──────────┬───────────┘
                               ▼
                    ┌──────────────────────┐
                    │ ~/.agents/skills/     │  All installed skills land here
                    │ ├── add-ai-chat/      │  (works with any AI agent)
                    │ ├── k8s-deploy/       │
                    │ └── rag-pinecone/     │
                    └──────────────────────┘
```

---

## Core Concepts

### Node = Manifest + Aggregated Registry

A node is a GitHub repo that contains:

```
my-skill-node/
├── node.json                  ← manifest: lists repos to aggregate
├── registry.json              ← auto-generated: unified skill catalog
├── overrides/                 ← optional: override ingestion for specific repos
│   └── nedcodes-ok_cursorrules-collection.json
├── .github/workflows/
│   └── build-registry.yml     ← CI: fetches all repos, rebuilds registry.json
├── README.md
└── LICENSE
```

### node.json (manifest)

```json
{
  "version": 1,
  "node": {
    "name": "Unstoppable Official",
    "description": "Curated skills for the Unstoppable Stack",
    "homepage": "https://unstoppable-stack.dev/skills"
  },
  "repos": [
    {
      "repo": "unstoppable-stack/skills",
      "label": "Official",
      "format": "auto",
      "include": "*"
    },
    {
      "repo": "holepunchto/pear-skills",
      "label": "Pear Upstream",
      "format": "auto",
      "include": "*"
    },
    {
      "repo": "alice/ai-agent-skills",
      "label": "Alice's AI Skills",
      "format": "auto",
      "include": "*"
    },
    {
      "repo": "nedcodes-ok/cursorrules-collection",
      "label": "Cursor Rules Collection",
      "format": "cursor-rules",
      "include": ["react-*", "typescript-*", "python-*"],
      "exclude": ["test-*"]
    },
    {
      "repo": "acme/private-skills",
      "label": "Acme Internal",
      "format": "auto",
      "include": "*",
      "private": true
    }
  ]
}
```

Fields per repo:
- `repo` — GitHub `owner/name`
- `label` — display name in search results
- `format` — `"auto"` (detect), `"agentskills"`, `"cursor-rules"`,
  `"agents-md"`, `"flat-markdown"`, or `"opencode"`
- `include` / `exclude` — glob patterns to filter which skills to ingest
  (`"*"` = all)
- `private` — hint that this repo requires auth (the `gh` CLI handles it)

### Skill Repos (where skills actually live)

A skill repo is any GitHub repo that contains skills in any supported format.
It does NOT need to know about nodes. The simplest skill repo:

```
my-skills/
├── skills/
│   ├── add-ai-chat/
│   │   ├── SKILL.md
│   │   └── resources/
│   └── setup-k8s/
│       └── SKILL.md
└── README.md
```

Or it could be a Cursor rules collection, an AGENTS.md file, or any of the
foreign formats. The node's ingestion pipeline handles the conversion.

---

## registry.json (Aggregated Catalog)

The node's CI builds this by fetching all repos listed in `node.json`,
detecting their format, and merging all skills into one catalog:

```typescript
interface SkillRegistry {
  version: 1
  node: {
    name: string
    description?: string
    homepage?: string
  }
  updated: string                 // ISO 8601
  repos: RepoEntry[]             // which repos were aggregated
  skills: SkillEntry[]           // the unified catalog
}

interface RepoEntry {
  repo: string                   // "unstoppable-stack/skills"
  label: string
  format: string                 // detected or explicit format
  skillCount: number
  lastCommit: string             // SHA — for freshness checking
}

interface SkillEntry {
  name: string                   // "add-ai-chat" (unique within node)
  description: string
  tags: string[]
  author?: string                // GitHub username
  version: string
  repo: string                   // which repo it came from
  path: string                   // path within that repo
  checksum: string               // SHA-256 of SKILL.md content
  resources: string[]            // ["troubleshooting.md", "full-example.md"]
  format: SkillFormat            // original format
}

type SkillFormat =
  | "agentskills"                // native SKILL.md
  | "cursor-rules"               // converted from .mdc
  | "agents-md"                  // converted from AGENTS.md
  | "opencode"                   // from .opencode/skills/
  | "codex"                      // from .codex/skills/
  | "flat-markdown"              // converted from loose .md files
```

### Name Collision Resolution

When the same skill name appears in multiple repos within a node, the first
repo listed in `node.json` wins. The node maintainer controls priority by
ordering repos in the manifest. CI warns about collisions in the build log.

---

## Foreign Format Ingestion

### Detection Cascade

When `format: "auto"` (default), CI runs this detection on each repo:

```
1. Has skills/*/SKILL.md?         → "agentskills" (canonical)
2. Has .opencode/skills/?         → "opencode" (same spec, different path)
3. Has .codex/skills/?            → "codex" (same spec, different path)
4. Has .cursor/rules/*.mdc?       → "cursor-rules"
5. Has root AGENTS.md or CLAUDE.md? → "agents-md"
6. Has *.md in rules/ or prompts/ → "flat-markdown"
7. None detected                  → skip with warning
```

### Conversion Rules

| Source Format | Name | Description | Body |
|---|---|---|---|
| **agentskills** | From frontmatter `name:` | From frontmatter `description:` | Use as-is |
| **cursor-rules** | From filename (slugified) | From frontmatter `description:` | Content after frontmatter |
| **agents-md** | `{filename}-{heading}` slugified | First sentence of section | Section content |
| **agents-md** (short) | Filename slugified | First sentence | Entire file |
| **flat-markdown** | Filename slugified | First paragraph (max 200 chars) | Entire file |

All converted skills get `metadata.source-format` and `metadata.source-file`
in their frontmatter so we know their provenance.

### Override File

For repos where auto-detection gets it wrong, the node can include an
override file:

```json
// overrides/nedcodes-ok_cursorrules-collection.json
{
  "format": "cursor-rules",
  "skillsPath": ".cursor/rules",
  "namePrefix": "cr-",
  "exclude": ["*.test.mdc", "deprecated-*"]
}
```

---

## Data Flow

### 1. User Subscribes to a Node

```
$ us skills add-node unstoppable-stack/skill-node

  CLI:
  1. Fetch node.json from the repo
  2. Fetch registry.json (pre-built by CI)
  3. Save to ~/.config/unstoppable/nodes.json:
     {
       "nodes": [
         {
           "repo": "unstoppable-stack/skill-node",
           "label": "Unstoppable Official",
           "default": true
         }
       ]
     }
  4. Cache registry at ~/.config/unstoppable/cache/unstoppable-stack_skill-node/registry.json
  5. Print: "Added 'Unstoppable Official' — 42 skills from 4 repos"
```

Users can also add a **bare repo** directly (no node.json). The CLI treats it
as a single-repo node and generates the registry locally:

```
$ us skills add-node alice/cursor-rules --format cursor-rules

  CLI:
  1. No node.json found → treat as single-repo node
  2. Detect or use specified format
  3. Fetch relevant files, build registry.json locally
  4. Cache alongside regular nodes
  5. Print: "Added alice/cursor-rules — 23 skills (cursor-rules format)"
```

### 2. Searching Skills

```
$ us skills search "p2p chat"

  Searching 2 nodes...

  Unstoppable Official
    add-p2p-rpc       P2P RPC communication pattern       v1.0.0  [installed]
    add-p2p-sync      Replicate Hypercores between peers   v1.2.0  [installed]
    p2p-chat-rooms    Multi-room encrypted P2P chat        v0.8.0
      └── from: alice/ai-agent-skills

  Acme Internal
    slack-p2p-bridge  Bridge Slack channels over P2P       v0.4.0

  Install:  us skills install p2p-chat-rooms
```

Search is **always local** — queries the cached `registry.json` files.
No network call at search time. Skills show which repo they came from
within the node.

### 3. Installing a Skill

```
$ us skills install p2p-chat-rooms

  Fetching from alice/ai-agent-skills (via Unstoppable Official node)...
  ✓ Installed p2p-chat-rooms v0.8.0 → ~/.agents/skills/p2p-chat-rooms/

  Source: unstoppable-stack/skill-node → alice/ai-agent-skills
```

Under the hood:

1. Look up `p2p-chat-rooms` in cached registries
2. Registry says: `repo: "alice/ai-agent-skills"`, `path: "skills/p2p-chat-rooms"`
3. Fetch files directly from that repo via GitHub API
4. If foreign format → convert on the fly
5. Write to `~/.agents/skills/p2p-chat-rooms/SKILL.md`
6. Write `.source.json` with full provenance:

```json
{
  "node": "unstoppable-stack/skill-node",
  "repo": "alice/ai-agent-skills",
  "path": "skills/p2p-chat-rooms",
  "version": "0.8.0",
  "checksum": "abc123...",
  "format": "agentskills",
  "installedAt": "2026-04-10T12:00:00Z"
}
```

### 4. Updating

```
$ us skills update

  Refreshing 2 nodes...
  ✓ Unstoppable Official: 42 skills (2 updated since last sync)
  ✓ Acme Internal: 14 skills (no changes)

  Updating installed skills...
  ✓ add-p2p-rpc: 1.0.0 → 1.1.0
  ✓ k8s-deploy: 2.1.0 → 2.2.0
  · 12 skills already current

  Updated 2 skills
```

### 5. Publishing to a Node

```
$ us skills publish add-my-tool --to unstoppable-stack/skill-node

  CLI:
  1. Read node.json → find the skills repo where new contributions go
     (first repo with "contributions": true, or first repo by default)
  2. Validate SKILL.md format
  3. Fork that repo → create branch → add skill → open PR
  4. Print: "Opened PR #42 to unstoppable-stack/skills"
```

### 6. Discovering Nodes

```
$ us skills discover

  Searching GitHub for skill nodes...

  ★ 234  unstoppable-stack/skill-node     Official — 42 skills from 4 repos
  ★  45  awesome-dev/p2p-node             P2P patterns — 12 skills from 2 repos
  ★  23  acme/skill-node                  DevOps — 14 skills from 3 repos

  Also found skill repos (no node, direct use):
  ★  89  cursor-community/rules           Cursor rules — ~110 skills
  ★  38  opencode-skills/collection       OpenCode skills — ~25 skills

  Add a node:  us skills add-node awesome-dev/p2p-node
  Add a repo:  us skills add-node cursor-community/rules --format cursor-rules
```

Discovery searches for:
- Repos with topic `unstoppable-skill-node` (nodes with node.json)
- Repos with topic `unstoppable-skills` (skill repos)
- Well-known cursor/agent rules collections (hardcoded list for bootstrap)

---

## Agent Integration

Two tools, same as before. The agent doesn't know about nodes vs repos —
it just searches and installs:

### skill_search

```typescript
{
  name: "skill_search",
  description: "Search configured skill nodes for skills matching a query. Returns names, descriptions, source, and whether already installed.",
  parameters: {
    type: "object",
    properties: {
      query: { type: "string", description: "Search terms" },
      node: { type: "string", description: "Limit to a specific node (optional)" }
    },
    required: ["query"]
  }
}
```

### skill_install

```typescript
{
  name: "skill_install",
  description: "Install a skill from a configured node. ALWAYS requires user approval. After install, use skill_view to load it.",
  parameters: {
    type: "object",
    properties: {
      name: { type: "string", description: "Skill name to install" },
      node: { type: "string", description: "Source node (if name is ambiguous)" }
    },
    required: ["name"]
  }
}
```

### Agent Flow

```
Agent hits problem → searches local skills → no match
  → skill_search("kubernetes deploy")
  → Returns: [{name: "k8s-deploy", description: "...", node: "Official", installed: false}]
  → Agent: "Found 'k8s-deploy' from the Official node. Install it?"
  → User approves
  → skill_install("k8s-deploy")
  → skill_view("k8s-deploy")
  → Agent follows the skill instructions
```

---

## Local Data Layout

```
~/.config/unstoppable/
├── nodes.json                              ← subscribed nodes
│   {
│     "nodes": [
│       { "repo": "unstoppable-stack/skill-node", "label": "Official", "default": true },
│       { "repo": "acme/skill-node", "label": "Acme" }
│     ]
│   }
└── cache/
    ├── unstoppable-stack_skill-node/
    │   ├── node.json                       ← cached manifest
    │   └── registry.json                   ← cached aggregated catalog
    └── acme_skill-node/
        ├── node.json
        └── registry.json

~/.agents/skills/                            ← installed skills
├── add-ai-chat/
│   ├── SKILL.md
│   ├── resources/
│   └── .source.json                        ← provenance (node + repo + path)
├── k8s-deploy/
│   ├── SKILL.md
│   └── .source.json
└── react-patterns/
    ├── SKILL.md                            ← converted from cursor-rules
    └── .source.json
```

---

## CLI Command Summary

```bash
# Node management
us skills add-node <repo>              # Subscribe to a node (or bare repo)
us skills add-node <repo> --format <f> # Force format for bare repos
us skills remove-node <name>           # Unsubscribe
us skills nodes                        # List subscribed nodes + stats

# Discovery
us skills discover                     # Find nodes/repos on GitHub

# Search & install
us skills search <query>               # Search across all nodes (local, fast)
us skills search <query> --refresh     # Refresh registries first, then search
us skills install <name>               # Install skill from best-match node
us skills install <name> --node <n>    # Install from specific node
us skills list                         # List installed skills + provenance
us skills info <name>                  # Show skill details + source

# Updates
us skills update                       # Refresh registries + update installed

# Publishing
us skills create                       # Scaffold new SKILL.md locally
us skills publish <name>               # PR to a node's contribution repo
us skills create-node                  # Scaffold a new node repo from template
```

---

## CI: How a Node Builds registry.json

The node repo's GitHub Action (`.github/workflows/build-registry.yml`):

```yaml
name: Build Registry
on:
  push:
    branches: [main]
    paths: [node.json]
  schedule:
    - cron: '0 */6 * * *'     # Rebuild every 6 hours to catch upstream changes
  workflow_dispatch:           # Manual trigger

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with: { node-version: 20 }

      - name: Build registry
        run: npx @unstoppable-stack/skill-node-builder
        # Reads node.json, fetches each repo, detects format,
        # converts foreign formats, merges into registry.json

      - name: Commit registry.json
        run: |
          git add registry.json
          git diff --cached --quiet || git commit -m "chore: rebuild registry"
          git push
```

We publish `@unstoppable-stack/skill-node-builder` as an npm package that:
1. Reads `node.json`
2. For each repo: fetches tree via GitHub API, detects format, extracts skills
3. Converts foreign formats → SkillEntry objects
4. Handles name collisions (first repo wins, warns in log)
5. Writes `registry.json`

This same builder logic is also used by the CLI when adding a bare repo
(no node.json) — it runs locally instead of in CI.

---

## Implementation Phases

### Phase 3a: Core CLI + Official Node (Medium, ~1 week)

- [ ] Define TypeScript types: `NodeManifest`, `SkillRegistry`, `SkillEntry`
- [ ] Build the registry builder (shared between CI and CLI):
  - agentskills format detection + indexing
  - cursor-rules conversion
  - agents-md splitting
  - flat-markdown wrapping
- [ ] Create `unstoppable-stack/skill-node` repo:
  - `node.json` pointing to `unstoppable-stack/skills`
  - CI workflow using the builder
  - Seed `unstoppable-stack/skills` with our 19 existing skills
- [ ] CLI: `us skills add-node`, `us skills nodes`, `us skills remove-node`
- [ ] CLI: `us skills search` (local, cached registry)
- [ ] CLI: `us skills install` + `.source.json` provenance
- [ ] CLI: `us skills list`, `us skills info`
- [ ] CLI: `us skills update`
- [ ] Default config ships with official node pre-configured

### Phase 3b: Multi-Repo Ingestion + Discovery (Medium, ~1 week)

- [ ] Support bare repos (no node.json) as single-repo nodes
- [ ] Foreign format pipeline: cursor-rules, agents-md, flat-markdown
- [ ] Override files for tricky repos
- [ ] `us skills discover` (GitHub topic search)
- [ ] `--format` flag for manual format specification
- [ ] Cache TTL + `--refresh` flag

### Phase 3c: Publishing + Agent Tools (Medium, ~1 week)

- [ ] `us skills create` (scaffold SKILL.md with prompts)
- [ ] `us skills publish` (fork + PR via `gh`)
- [ ] `us skills create-node` (template repo scaffolding)
- [ ] `@unstoppable-stack/skill-node-builder` npm package
- [ ] Agent tools: `skill_search`, `skill_install`
- [ ] Agent approval flow for installs

### Phase 4: P2P Layer (Large, optional, future)

- [ ] P2P node type: serves registry.json over Hyperswarm
- [ ] Offline/LAN skill sharing
- [ ] Same interface, different transport

---

## Open Questions

1. **Name collisions across nodes**: Two nodes both have `k8s-deploy`. Current
   plan: default node wins; user overrides with `--node`. Within a single node,
   first repo in `node.json` wins.

2. **Contribution routing**: When publishing to a node, which repo receives the
   PR? Plan: `node.json` has a `"contributions"` field pointing to the repo
   that accepts PRs. Defaults to first repo.

3. **Freshness**: How often should CI rebuild? Every 6 hours by default
   (cron), plus on `node.json` changes. CLI caches locally with configurable TTL.

4. **Private repos in nodes**: Works if the CI has access (GitHub token in
   secrets). Users need `gh` auth for private repos. The `private: true` hint
   in `node.json` tells the CLI to expect auth.

5. **Skill versioning**: For v1, a skill's version is whatever's in its
   frontmatter (or `"0.0.0"`). The checksum field handles update detection.
   Semantic versioning enforcement can come later.

6. **Large foreign repos**: Some cursor-rules collections have 100+ files.
   The `include`/`exclude` globs in `node.json` let node maintainers cherry-pick.
   The builder only fetches matching files.
