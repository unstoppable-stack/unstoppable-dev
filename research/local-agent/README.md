# Research: Local AI Coding Agent with P2P Knowledge Sharing

> **Goal**: Build an "Unstoppable Agent" — a local-first AI coding assistant that runs on small models (via QVAC), supports a skill system, and shares knowledge peer-to-peer.

**Date**: 2026-03-15
**Status**: Research Complete — Ready for POC

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Landscape Analysis](#landscape-analysis)
3. [Architecture Deep Dive: Hermes Agent](#architecture-deep-dive-hermes-agent)
4. [Architecture Deep Dive: CoPaw](#architecture-deep-dive-copaw)
5. [Architecture Deep Dive: OpenCode](#architecture-deep-dive-opencode)
6. [QVAC SDK Capabilities for Agent Building](#qvac-sdk-capabilities-for-agent-building)
7. [Small Model Landscape for Tool Calling](#small-model-landscape-for-tool-calling)
8. [Proposed Architecture: Unstoppable Agent](#proposed-architecture-unstoppable-agent)
9. [P2P Knowledge Sharing System](#p2p-knowledge-sharing-system)
10. [Skill System Design](#skill-system-design)
11. [Implementation Plan](#implementation-plan)
12. [Open Questions](#open-questions)

---

## Executive Summary

We want to build a **local AI coding agent** that:

1. **Runs entirely locally** using QVAC SDK for inference (no API keys needed)
2. **Supports skills** — structured procedural knowledge the agent loads on demand
3. **Shares knowledge via P2P** — skills, feedback, troubleshooting tips flow between users via Hyperswarm/HyperDB
4. **Works with any model** — local QVAC models, cloud APIs (OpenRouter, Anthropic), or hybrid
5. **Self-improves** — creates skills from experience, community skills improve via P2P feedback

Three open-source projects were deeply studied:

| Project | Stars | Key Insight | Language |
|---------|-------|-------------|----------|
| **Hermes Agent** (Nous Research) | 7.4k | Self-improving agent with skill creation, memory, trajectory compression for RL training | Python |
| **CoPaw** (AgentScope) | 11.8k | Personal assistant with skill hub, multi-channel delivery, local model support | Python |
| **OpenCode** (anomalyco) | 122k | Go-based coding agent with TUI, clean tool/provider architecture | Go |

**Key conclusion**: Hermes Agent's architecture is the strongest match for our vision — it already has skill creation, memory, session search, multi-provider support, and a trajectory compression system for training smaller models. Combined with QVAC's local inference and Hyperswarm's P2P networking, we can build something unique.

---

## Landscape Analysis

### What Exists Today

| Feature | Claude Code | Hermes Agent | CoPaw | OpenCode |
|---------|------------|--------------|-------|----------|
| Local model support | No | Yes (Ollama, llama.cpp, any OpenAI-compat) | Yes (llama.cpp, MLX, Ollama) | Yes (Ollama) |
| Skill system | Yes (SKILL.md) | Yes (agentskills.io + self-creation) | Yes (SKILL.md + hub import) | Yes (opencode.json) |
| Self-improving | No | **Yes** (creates skills from experience) | Planned | No |
| Memory persistence | No | **Yes** (MEMORY.md + USER.md + Honcho) | **Yes** (built-in) | No |
| Session search | No | **Yes** (FTS5 SQLite) | Planned | No |
| P2P knowledge sharing | No | No | No | No |
| Tool calling | Cloud-only | Multi-provider | Multi-provider | Multi-provider |
| Trajectory/RL training | No | **Yes** (Atropos + compression) | No | No |
| Offline-first | No | Partial (needs API) | Partial | Partial |
| Truly unstoppable | No | No | No | No |

### The Gap We Fill

**No existing agent combines local inference + P2P knowledge sharing + self-improvement.** This is the unique value proposition:

- **Hermes** needs API keys and cloud models for best results
- **CoPaw** is cloud-oriented with local as a fallback
- **OpenCode** has no skill creation or knowledge sharing
- **None** share knowledge peer-to-peer

Our agent would be the first to:
1. Run inference 100% locally via QVAC
2. Share skills and troubleshooting knowledge via Hyperswarm
3. Use P2P feedback to collectively improve skill quality
4. Generate training data (trajectories) that can train better local models

---

## Architecture Deep Dive: Hermes Agent

Hermes is the most architecturally relevant project. Key components:

### Agent Loop (`run_agent.py`)

```
User Message
    ↓
System Prompt (built from: identity + memory + skills + context files)
    ↓
LLM Call (OpenAI-compatible API)
    ↓
┌─ Text Response → Stream to user
└─ Tool Calls → Dispatch to registry → Results back to LLM
    ↓
Repeat until: no tool calls, max iterations, or interrupt
    ↓
Post-conversation: save trajectory, update memory, maybe create skill
```

Key design decisions:
- **Shared iteration budget** across parent + child agents (IterationBudget class)
- **Tool registry** pattern — tools self-register via `registry.register()`
- **Toolsets** — composable groups of tools (e.g., "web", "terminal", "skills")
- **Context compression** — summarizes middle turns when context gets large
- **Budget pressure** — warns LLM at 70% and 90% of iteration budget
- **Fallback model** — automatic failover to a backup model/provider

### Tool System (`tools/` + `toolsets.py`)

Each tool module self-registers:

```python
from tools.registry import registry

registry.register(
    name="skill_manage",
    toolset="skills",
    schema=SKILL_MANAGE_SCHEMA,  # OpenAI function-calling format
    handler=lambda args, **kw: skill_manage(...)
)
```

Toolsets group tools and support composition:

```python
TOOLSETS = {
    "skills": {
        "description": "Access, create, edit, and manage skill documents",
        "tools": ["skills_list", "skill_view", "skill_manage"],
        "includes": []
    },
    "debugging": {
        "tools": ["terminal", "process"],
        "includes": ["web", "file"]  # composable
    },
}
```

40+ built-in tools organized into toolsets: web, terminal, file, vision, image gen, skills, browser, cron, memory, session search, code execution, delegation, TTS, etc.

### Skill System (the crown jewel)

**Three progressive disclosure tiers:**

1. `skills_list()` → metadata only (~3k tokens for all skills)
2. `skill_view(name)` → full SKILL.md content
3. `skill_view(name, path)` → specific reference/template file

**Agent-created skills** via `skill_manage` tool:
- `create` — new skill from SKILL.md content
- `patch` — targeted find-and-replace (preferred for updates)
- `edit` — full SKILL.md rewrite
- `delete`, `write_file`, `remove_file`

**When skills are created automatically:**
- Complex task succeeded (5+ tool calls)
- Errors were overcome
- User-corrected approach worked
- Non-trivial workflow discovered

**Skills Hub integration:**
- Sources: GitHub, skills.sh (Vercel), clawhub, lobehub, well-known endpoints
- Security scanning on install
- Trust levels: builtin > official > trusted > community
- Update lifecycle: check → update → audit

**Format** (agentskills.io compatible):

```yaml
---
name: my-skill
description: Brief description
version: 1.0.0
platforms: [macos, linux]
metadata:
  hermes:
    tags: [python, automation]
    fallback_for_toolsets: [web]  # conditional activation
---
# Skill Title
## When to Use
## Procedure
## Pitfalls
## Verification
```

### Memory System

- **MEMORY.md** — persistent notes across sessions
- **USER.md** — user profile (preferences, environment, habits)
- **Honcho** — dialectic user modeling (cross-session)
- **Session search** — FTS5 full-text search across all past conversations
- **Memory nudges** — periodic reminders to persist important information

### Trajectory Compression (for RL training)

Hermes can save conversation trajectories and compress them for training:
- Protects first/last turns
- Summarizes middle turns via LLM
- Target: 15,250 tokens per trajectory
- Used with Tinker-Atropos for reinforcement learning

**This is directly relevant** — we could use this to generate training data for improving QVAC-compatible local models.

### State Management (`hermes_state.py`)

SQLite with WAL mode:
- Sessions table (metadata, model config, token counts)
- Messages table (role, content, tool calls, timestamps)
- FTS5 virtual table for full-text search
- Session titles, parent chains (for compression-triggered splits)

---

## Architecture Deep Dive: CoPaw

CoPaw is a personal AI assistant with strong skill and channel integration.

### Key Architecture Points

- **Python-based** with a web console (React frontend)
- **Multi-channel**: DingTalk, Feishu, QQ, Discord, iMessage, Slack, etc.
- **Skill loading**: `~/.copaw/active_skills/` directory, each with `SKILL.md`
- **Custom skills**: `~/.copaw/customized_skills/` — user-created, merged at startup
- **Console management**: Web UI for skill CRUD, enable/disable, import from hub
- **Skill import**: Supports GitHub, LobeHub, skills.sh, clawhub, skillsmp URLs
- **Local models**: llama.cpp, MLX (Apple Silicon), Ollama backends
- **Tool Guard**: Security layer that blocks risky tool calls until user approval

### Skill System Comparison

| Feature | Hermes | CoPaw | Our Plan |
|---------|--------|-------|----------|
| Format | SKILL.md (agentskills.io) | SKILL.md (simplified) | SKILL.md (agentskills.io) |
| Agent creates skills | Yes | No | Yes |
| Hub sources | 7 sources | 5 sources | P2P + hub sources |
| Security scanning | Yes | Basic | Yes + P2P reputation |
| Conditional activation | Yes (fallback_for_toolsets) | No | Yes |
| P2P sharing | No | No | **Yes** |

### What We Can Learn

1. **Console UI** — web-based skill management is very user-friendly
2. **Multi-channel delivery** — skills work across all platforms
3. **Import from URLs** — simple UX for adding community skills
4. **Tool Guard** — security layer for dangerous operations

---

## Architecture Deep Dive: OpenCode

OpenCode is a Go-based TUI coding agent with 122k stars.

### Key Architecture Points

- **Go + Bubble Tea** TUI framework
- **Provider system**: OpenAI, Anthropic, Google, Groq, AWS Bedrock, Azure, OpenRouter, Copilot, OpenAI-compatible (Ollama)
- **Tool system**: file read/write, bash, glob, grep, diagnostics, tree, sub-agent
- **LSP integration**: Language server protocol for code intelligence
- **Session management**: SQLite-backed conversation history
- **Configuration**: TOML config file + environment variables

### What We Can Learn

1. **Clean provider abstraction** — easy to add new model providers
2. **LSP integration** — code intelligence without cloud
3. **Sub-agent pattern** — spawn child agents for parallel work
4. **TUI excellence** — Bubble Tea for terminal UIs in Go

### Relevance for Us

OpenCode is less directly relevant because:
- Written in Go (we're TypeScript)
- No skill system (has `opencode.json` for rules, not skills)
- No self-improvement or knowledge sharing
- No memory persistence

But the **provider abstraction** and **sub-agent pattern** are worth studying.

---

## QVAC SDK Capabilities for Agent Building

QVAC is our secret weapon. Here's what it can do:

### Core Inference (Agent Loop)

| Capability | Model | Key API | Status |
|-----------|-------|---------|--------|
| **Chat/Completion** | Qwen3 4B/1.7B, Llama 3.2 1B | `completion()` with streaming | Battle-tested |
| **Tool Calling** | Qwen 3.1 7B (best), Qwen 3 4B | `completion()` with `tools` array | Battle-tested |
| **KV Cache** | Any LLM | `completion({ kvCache: sessionId })` | Battle-tested |
| **Vision** | SmolVLM 2.5B | `completion()` with `attachments` | Documented |
| **Embeddings** | GTE Large, Gemma 300M | `embed()` | Documented |
| **RAG** | Embeddings + vector DB | `embed()` + SQLite/HyperDB | Documented |

### Supporting Capabilities

| Capability | Use in Agent | Status |
|-----------|-------------|--------|
| **Transcription (Whisper)** | Voice-to-text input | Documented |
| **TTS** | Text-to-speech output | Not covered |
| **OCR** | Read images/documents | Not covered |
| **Translation** | Multi-language support | Documented |
| **Delegated Inference** | P2P model sharing | Documented |

### Best Models for Agent Use

For a coding agent running on consumer hardware:

| Use Case | Model | Size | RAM Needed |
|---------|-------|------|-----------|
| **Tool calling (best)** | `QWEN_3_1_7B_INST_Q4` | ~4.5GB | 8GB+ |
| **Tool calling (light)** | `QWEN_3_4B_INST_Q4_K_M` | ~2.5GB | 6GB+ |
| **Fast chat** | `QWEN3_600M_INST_Q4` | ~400MB | 2GB+ |
| **Desktop quality** | `GPT_OSS_20B_INST_Q4_K_M` | ~12GB | 16GB+ |
| **Code embeddings** | `GTE_LARGE_FP16` | ~650MB | 4GB+ |

### Key QVAC Advantage: Delegated Inference

QVAC supports **P2P delegated inference** via Hyperswarm:

```typescript
// Provider (powerful machine)
await startQVACProvider({
  topic: discoveryKey,
  models: [{ modelId: 'qwen-7b', ... }]
})

// Consumer (weak machine)
const model = await loadModel({
  delegate: { topic: discoveryKey }
})
const result = await completion({ modelId: model.id, messages })
```

This means: a user with a weak laptop can delegate inference to a more powerful peer on the network. **Truly unstoppable AI inference.**

---

## Small Model Landscape for Tool Calling

### 2026 State of the Art

| Model | Params (Active) | Tool Calling | Code Quality | Availability |
|-------|-----------------|--------------|--------------|-------------|
| **Qwen3-Coder-Next** | 3B (of 80B MoE) | Excellent | Claude Sonnet 4.5 level | GGUF available |
| **Qwen 3.1 7B** | 7B | Excellent | Very good | QVAC constant |
| **Qwen 3 4B** | 4B | Good | Good | QVAC constant |
| **Llama 3.2 1B** | 1B | Basic | Okay | QVAC constant |
| **Qwen 2.5 14B** | 14B | Excellent | Very good | Ollama/GGUF |

### Tool Calling Format

QVAC uses OpenAI-compatible tool calling:

```typescript
const result = await completion({
  modelId: 'qwen-7b',
  messages: [...],
  tools: [{
    type: 'function',
    function: {
      name: 'read_file',
      description: 'Read a file from disk',
      parameters: {
        type: 'object',
        properties: { path: { type: 'string' } },
        required: ['path']
      }
    }
  }],
  toolCallStream: (toolCall) => { /* handle streaming tool call */ }
})
```

### Challenges with Small Models

1. **Context window** — 4K-32K tokens vs 200K+ for cloud models
2. **Tool call accuracy** — smaller models make more parsing errors
3. **Multi-step reasoning** — fewer successful long chains
4. **JSON output reliability** — needs repair/retry logic

### Mitigation Strategies (from Hermes Agent)

1. **JSON repair** — parse `<tool_call>` XML, repair malformed JSON
2. **Iteration budget** — limit tool call loops, warn model to wrap up
3. **Context compression** — summarize middle turns to save tokens
4. **Skill system** — provide structured knowledge so model doesn't need to reason from scratch
5. **Sub-agents** — delegate sub-tasks to fresh context windows
6. **Trajectory compression** — compress past work into summaries

---

## Proposed Architecture: Unstoppable Agent

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Unstoppable Agent                      │
│                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │  Agent Loop   │  │  Tool System │  │  Skill System│  │
│  │  (ReAct)      │  │  (Registry)  │  │  (SKILL.md)  │  │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  │
│         │                  │                  │          │
│  ┌──────┴──────────────────┴──────────────────┴───────┐  │
│  │              Provider Abstraction Layer             │  │
│  │  ┌────────┐  ┌────────┐  ┌─────────┐  ┌────────┐ │  │
│  │  │  QVAC  │  │ Ollama │  │OpenRouter│  │ Custom │ │  │
│  │  │ (local)│  │ (local)│  │ (cloud)  │  │  API   │ │  │
│  │  └────────┘  └────────┘  └─────────┘  └────────┘ │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  ┌──────────────────────────────────────────────────┐    │
│  │              P2P Knowledge Layer                   │    │
│  │  ┌──────────┐  ┌───────────┐  ┌──────────────┐  │    │
│  │  │ Skill    │  │ Feedback  │  │  Delegated   │  │    │
│  │  │ Sharing  │  │ & Tips    │  │  Inference   │  │    │
│  │  │(HyperDB) │  │(HyperDB) │  │ (Hyperswarm) │  │    │
│  │  └──────────┘  └───────────┘  └──────────────┘  │    │
│  └──────────────────────────────────────────────────┘    │
│                                                          │
│  ┌──────────────────────────────────────────────────┐    │
│  │              Local Storage Layer                   │    │
│  │  ┌─────────┐  ┌──────────┐  ┌────────────────┐  │    │
│  │  │ Sessions │  │ Memory   │  │  Trajectories  │  │    │
│  │  │ (SQLite) │  │ (Files)  │  │  (JSONL)       │  │    │
│  │  └─────────┘  └──────────┘  └────────────────┘  │    │
│  └──────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
```

### Core Components (TypeScript)

#### 1. Agent Loop

The main ReAct loop, adapted from Hermes:

```typescript
interface AgentConfig {
  provider: 'qvac' | 'ollama' | 'openrouter' | 'custom'
  model: string
  maxIterations: number
  tools: ToolDefinition[]
  skills: SkillRegistry
  memory: MemoryStore
}

class UnstoppableAgent {
  async runConversation(userMessage: string): AsyncGenerator<AgentEvent> {
    const systemPrompt = this.buildSystemPrompt()
    const messages = [{ role: 'system', content: systemPrompt }, ...this.history]
    messages.push({ role: 'user', content: userMessage })

    for (let i = 0; i < this.config.maxIterations; i++) {
      const response = await this.provider.completion({
        messages,
        tools: this.getToolDefinitions(),
        stream: true,
      })

      if (response.toolCalls?.length > 0) {
        const results = await this.executeToolCalls(response.toolCalls)
        messages.push({ role: 'assistant', content: response.content, tool_calls: response.toolCalls })
        for (const result of results) {
          messages.push({ role: 'tool', content: result.output, tool_call_id: result.id })
        }
        yield { type: 'tool_result', results }
      } else {
        yield { type: 'response', content: response.content }
        break
      }
    }

    // Post-conversation: consider skill creation, save trajectory
    await this.postConversation(messages)
  }
}
```

#### 2. Provider Abstraction

```typescript
interface LLMProvider {
  completion(opts: CompletionOptions): Promise<CompletionResult>
  streamCompletion(opts: CompletionOptions): AsyncGenerator<StreamChunk>
  listModels(): Promise<ModelInfo[]>
}

class QVACProvider implements LLMProvider {
  // Uses @qvac/sdk directly
  async completion(opts) {
    return await qvac.completion({
      modelId: this.modelId,
      messages: opts.messages,
      tools: opts.tools,
      kvCache: opts.sessionId,  // Reuse KV cache across turns
      toolCallStream: opts.onToolCall,
    })
  }
}

class OllamaProvider implements LLMProvider { /* OpenAI-compat API */ }
class OpenRouterProvider implements LLMProvider { /* Cloud fallback */ }
```

#### 3. Tool Registry (adapted from Hermes)

```typescript
interface ToolDefinition {
  name: string
  toolset: string
  description: string
  parameters: JSONSchema
  handler: (args: Record<string, any>) => Promise<string>
}

class ToolRegistry {
  private tools = new Map<string, ToolDefinition>()

  register(tool: ToolDefinition) { this.tools.set(tool.name, tool) }

  getDefinitions(enabledToolsets: string[]): OpenAITool[] {
    return [...this.tools.values()]
      .filter(t => enabledToolsets.includes(t.toolset))
      .map(t => ({ type: 'function', function: { name: t.name, ... } }))
  }

  async dispatch(name: string, args: Record<string, any>): Promise<string> {
    const tool = this.tools.get(name)
    if (!tool) throw new Error(`Unknown tool: ${name}`)
    return tool.handler(args)
  }
}
```

#### 4. Core Tools (MVP)

| Tool | Toolset | Purpose |
|------|---------|---------|
| `read_file` | file | Read file contents |
| `write_file` | file | Write/create files |
| `patch_file` | file | Find-and-replace in files |
| `search_files` | file | Search file contents (ripgrep) |
| `glob_files` | file | Find files by pattern |
| `terminal` | terminal | Execute shell commands |
| `skills_list` | skills | List available skills |
| `skill_view` | skills | Load skill content |
| `skill_manage` | skills | Create/edit/delete skills |
| `memory` | memory | Read/write persistent memory |
| `p2p_share_skill` | p2p | Share a skill to the network |
| `p2p_search_skills` | p2p | Search P2P skill network |
| `p2p_feedback` | p2p | Submit feedback on a skill |
| `delegate_inference` | p2p | Offload to a more powerful peer |

---

## P2P Knowledge Sharing System

This is the **unique innovation**. Knowledge flows between agent users via Hyperswarm.

### Architecture

```
┌──────────────────────────────────────────────────────────┐
│                   P2P Skill Network                       │
│                                                           │
│  User A (shares skill)     User B (discovers skill)      │
│  ┌───────────────┐         ┌───────────────┐             │
│  │ HyperDB       │◄───────►│ HyperDB       │             │
│  │ /skills/      │  Hyper  │ /skills/      │             │
│  │ /feedback/    │  swarm  │ /feedback/    │             │
│  │ /tips/        │         │ /tips/        │             │
│  └───────────────┘         └───────────────┘             │
│                                                           │
│  Shared data structures:                                  │
│  ├── /skills/{hash}/SKILL.md     (skill content)         │
│  ├── /skills/{hash}/metadata     (name, desc, author)    │
│  ├── /feedback/{hash}/{peer}     (rating, comment)       │
│  ├── /tips/{skill-hash}/{id}     (troubleshooting tips)  │
│  └── /reputation/{peer}          (trust score)           │
└──────────────────────────────────────────────────────────┘
```

### Data Model (HyperDB)

```typescript
// Skill shared to the network
interface SharedSkill {
  id: string           // Content hash of SKILL.md
  name: string
  description: string
  content: string      // Full SKILL.md
  author: string       // Peer public key
  version: string
  tags: string[]
  createdAt: number
  updatedAt: number
}

// Feedback on a skill
interface SkillFeedback {
  skillId: string
  peerId: string       // Who submitted feedback
  rating: 1 | 2 | 3 | 4 | 5
  comment: string
  context: string      // What task they were doing
  outcome: 'success' | 'partial' | 'failed'
  timestamp: number
}

// Troubleshooting tip
interface TroubleshootingTip {
  skillId: string
  peerId: string
  title: string
  problem: string
  solution: string
  platform: string     // macos, linux, windows
  modelUsed: string    // Which model was used
  timestamp: number
}
```

### P2P Sharing Flow

**Publishing a skill:**

```
1. Agent creates a skill after solving a hard problem
2. User reviews and approves sharing
3. Skill is written to local HyperDB
4. HyperDB replicates to peers via Hyperswarm
5. Other peers' agents discover new skills in their feed
```

**Discovering skills:**

```
1. Agent hits a problem it can't solve
2. Searches local skill registry — no match
3. Searches P2P network: p2p_search_skills("deploy kubernetes")
4. Finds matching skills from peers
5. Shows user: "Found community skill 'k8s-deploy' (⭐4.2, 15 users)"
6. User approves → skill installed locally
7. Agent uses skill to solve the problem
8. Agent submits feedback to the network
```

**Feedback loop:**

```
1. User's agent uses a community skill
2. Outcome is tracked (success/partial/failed)
3. After task: agent submits structured feedback
4. Feedback replicates across the network
5. Skill rating updates based on aggregated feedback
6. Low-rated skills get flagged or deprioritized
7. Highly-rated skills get promoted in search results
```

### Security Model

- **Content hashing** — skills are identified by content hash
- **Peer signatures** — all content signed by author's public key
- **Reputation system** — built from accumulated feedback
- **Security scanning** — same as Hermes (check for exfiltration, prompt injection)
- **User approval required** — never auto-install from P2P without user consent
- **Trust tiers**: local > verified-peer > community > unknown

### Skill Discovery Topics

```typescript
// Well-known Hyperswarm topics for skill categories
const SKILL_TOPICS = {
  'unstoppable:skills:all': 'General skill discovery',
  'unstoppable:skills:p2p': 'P2P networking skills',
  'unstoppable:skills:ai': 'AI/inference skills',
  'unstoppable:skills:data': 'Database/storage skills',
  'unstoppable:skills:mobile': 'Mobile development skills',
  'unstoppable:skills:devops': 'DevOps/deployment skills',
}
```

---

## Skill System Design

### Format: agentskills.io Compatible

We adopt the agentskills.io standard (also used by Hermes, Claude, skills.sh):

```
skill-name/
├── SKILL.md          # Required: metadata + instructions
├── scripts/          # Optional: executable code
├── references/       # Optional: documentation
├── assets/           # Optional: templates, resources
└── feedback/         # NEW: P2P feedback data (local)
    ├── ratings.json  # Aggregated from network
    └── tips.json     # Community troubleshooting tips
```

### SKILL.md Extensions for P2P

```yaml
---
name: deploy-pear-desktop
description: Deploy a Pear Desktop app with auto-updates
version: 1.2.0
license: MIT
platforms: [macos, linux]
metadata:
  unstoppable:
    stack_modules: [pear, hyperswarm]   # Which stack modules this uses
    model_requirements:                  # Minimum model capabilities
      tool_calling: true
      min_context: 4096
    p2p:
      shared: true                       # Available on the network
      author_key: "abc123..."            # Author's public key
      content_hash: "sha256:..."         # For integrity verification
      network_rating: 4.2                # Aggregated from feedback
      usage_count: 47                    # How many peers have used it
---
```

### Progressive Disclosure (3 tiers)

**Tier 0: Category discovery** (~100 tokens)
```
skills_categories() → [{ name: "p2p", count: 5 }, { name: "ai", count: 8 }, ...]
```

**Tier 1: Skill listing** (~3k tokens for all skills)
```
skills_list("ai") → [{ name: "add-ai-chat", description: "..." }, ...]
```

**Tier 2: Full skill** (varies, <5000 tokens recommended)
```
skill_view("add-ai-chat") → full SKILL.md content + linked files list
```

**Tier 3: Reference files** (on demand)
```
skill_view("add-ai-chat", "references/tool-calling-example.md")
```

### Auto-Activation

Based on our existing `skill-rules.json` pattern:

```json
{
  "rules": [
    {
      "keywords": ["p2p", "swarm", "peer", "discovery"],
      "skill": "add-p2p-networking"
    },
    {
      "keywords": ["inference", "llm", "ai", "chat", "completion"],
      "skill": "add-ai-chat"
    },
    {
      "file_patterns": ["**/p2p/**", "**/swarm/**"],
      "skill": "add-p2p-networking"
    }
  ]
}
```

### Skill Creation by Agent

When the agent completes a complex task:

1. Detect complexity (5+ tool calls, errors overcome, corrections applied)
2. Generate SKILL.md from the successful trajectory
3. Ask user: "I figured out how to [X]. Want me to save this as a skill?"
4. If approved, create skill via `skill_manage`
5. Optionally ask: "Share this skill with the P2P network?"

---

## Implementation Plan

### Phase 1: Local Agent MVP (2-3 weeks)

**Goal**: A working CLI agent that uses QVAC for inference with basic tools.

```
packages/agent/
├── src/
│   ├── index.ts              # CLI entry point
│   ├── agent/
│   │   ├── loop.ts           # ReAct agent loop
│   │   ├── budget.ts         # Iteration budget
│   │   └── prompt-builder.ts # System prompt construction
│   ├── providers/
│   │   ├── interface.ts      # LLMProvider interface
│   │   ├── qvac.ts           # QVAC SDK provider
│   │   ├── ollama.ts         # Ollama provider
│   │   └── openai-compat.ts  # Generic OpenAI-compatible
│   ├── tools/
│   │   ├── registry.ts       # Tool registry
│   │   ├── file-tools.ts     # read, write, patch, search, glob
│   │   ├── terminal-tool.ts  # Shell execution
│   │   └── skill-tools.ts    # skills_list, skill_view, skill_manage
│   ├── skills/
│   │   ├── loader.ts         # Load skills from ~/.unstoppable/skills/
│   │   ├── manager.ts        # Create/edit/delete skills
│   │   └── auto-activate.ts  # Keyword-based auto-activation
│   └── state/
│       ├── session.ts        # SQLite session storage
│       └── memory.ts         # MEMORY.md persistence
├── package.json
└── tsconfig.json
```

**Deliverables:**
- [ ] Agent loop with streaming responses
- [ ] QVAC provider (chat + tool calling)
- [ ] File tools (read, write, patch, search)
- [ ] Terminal tool (shell execution with safety)
- [ ] Skill system (list, view, create/edit)
- [ ] Session persistence (SQLite)
- [ ] CLI interface (basic readline or ink)

### Phase 2: Skill System + Memory (1-2 weeks)

- [ ] Full skill CRUD via agent tool
- [ ] Auto-activation from keywords/file patterns
- [ ] Memory persistence (MEMORY.md)
- [ ] Context compression for small model context windows
- [ ] Skill creation from successful trajectories
- [ ] Import from agentskills.io / GitHub / skills.sh

### Phase 3: P2P Knowledge Sharing (2-3 weeks)

- [ ] HyperDB schema for skills, feedback, tips
- [ ] Hyperswarm discovery topics
- [ ] p2p_share_skill tool
- [ ] p2p_search_skills tool
- [ ] p2p_feedback tool
- [ ] Security scanning for P2P skills
- [ ] Reputation system (basic)
- [ ] User approval flow for P2P installs

### Phase 4: Delegated Inference + Training (2-3 weeks)

- [ ] QVAC delegated inference provider
- [ ] delegate_inference tool (offload to powerful peer)
- [ ] Trajectory saving (JSONL format, Hermes-compatible)
- [ ] Trajectory compression for RL training
- [ ] Model switching based on task complexity

### Phase 5: Polish + Integration (1-2 weeks)

- [ ] TUI interface (ink or blessed)
- [ ] Integration with `us` CLI
- [ ] Website documentation
- [ ] Agent pack updated with new skills
- [ ] Pear Desktop wrapper (run agent as Pear app)

---

## Open Questions

### Technical

1. **TypeScript or Python?** — TS aligns with our stack (QVAC, Hyperswarm) but Hermes/CoPaw are Python. TS is the right choice for integration.

2. **QVAC context limits** — Qwen 3 4B has ~32K context. How do we handle large codebases? Answer: aggressive context compression + skill-based knowledge injection.

3. **Tool call reliability** — Small models make more errors. How many retries? Answer: JSON repair + 3 retries + fallback to cloud if available.

4. **Multi-file editing** — Small models struggle with multi-file changes. Answer: break into sub-tasks, use skills for structured guidance.

5. **KV Cache management** — QVAC's KV cache helps with multi-turn, but how to manage across sessions? Answer: session-based cache IDs, clear on new conversation.

### Product

6. **P2P skill moderation** — How to prevent malicious skills? Answer: content hash + signature + scanning + reputation + user approval.

7. **Offline-only mode** — Should the agent work 100% offline? Answer: yes, P2P sync happens when peers are available, otherwise local-only.

8. **Model download UX** — First-time users need to download models. Answer: guided setup in CLI, show model sizes, recommend based on hardware.

9. **Hybrid mode** — Can users mix QVAC + cloud? Answer: yes, use QVAC for simple tasks, cloud for complex ones. Auto-detect based on task complexity.

10. **Naming** — "Unstoppable Agent"? "Unstoppable Code"? "ucode"? TBD.

### Research Gaps

11. **agentskills.io P2P extension** — No standard exists for P2P skill sharing. We'd be defining it.

12. **RL training pipeline** — How to go from trajectories to better QVAC models? Needs Hermes' Atropos integration or custom pipeline.

13. **Benchmark** — How does QVAC Qwen 3 4B compare to cloud models on coding tasks? Needs benchmarking.

---

## References

### Projects Studied

| Project | URL | Key Files Analyzed |
|---------|-----|-------------------|
| Hermes Agent | https://github.com/NousResearch/hermes-agent | `run_agent.py`, `model_tools.py`, `toolsets.py`, `tools/skills_tool.py`, `tools/skill_manager_tool.py`, `hermes_state.py`, `trajectory_compressor.py` |
| CoPaw | https://github.com/agentscope-ai/CoPaw | README, skills docs, architecture |
| OpenCode | https://github.com/anomalyco/opencode | README, architecture overview |

### Standards

| Standard | URL | Relevance |
|----------|-----|-----------|
| agentskills.io | https://agentskills.io/specification | Skill format standard |
| skills.sh | https://skills.sh/ | Skill discovery hub |
| OpenAI tool calling | https://platform.openai.com/docs/guides/function-calling | Tool definition format |

### Models

| Model | Source | Best For |
|-------|--------|---------|
| Qwen3-Coder-Next 3B MoE | Alibaba/HuggingFace | Best local coding model (2026) |
| Qwen 3.1 7B Instruct | QVAC constant | Tool calling |
| Qwen 3 4B Instruct | QVAC constant | Fast chat + basic tools |
| GTE Large | QVAC constant | Code embeddings for RAG |

### AutoResearch (Karpathy)

| Project | URL | Relevance |
|---------|-----|-----------|
| autoresearch | https://github.com/karpathy/autoresearch | Autonomous experimentation pattern |

---

## Addendum: Provider Strategy — QVAC vs Local Model Servers

### The Reality (March 2026)

QVAC SDK ships excellent models for general chat and tool calling (Qwen 3.1 7B, Qwen 3 4B), but the **best coding models** available today are larger MoE architectures that QVAC doesn't yet package:

| Model | Active Params | Total Params | Score | tok/s (MLX) | Context |
|-------|--------------|-------------|-------|-------------|---------|
| **Qwen3-Coder-30B-A3B** | 3B | 30.5B | 96 | ~90 | 262K |
| **Qwen3-30B-A3B-Instruct** | 3B | 30.5B | 94 | ~90 | 262K |
| **GPT-OSS-20B** | 20B | 21.5B | 93 | ~83 | 131K |
| **Moonlight-16B-A3B** | 3B | 16B | 91 | ~130 | 163K |
| **DeepSeek-Coder-V2-Lite** | — | 16B | 92 | ~125 | 131K |
| Qwen2.5-Coder-14B-Instruct | 14B | 14.8B | 80 | ~10 | 32K |
| Qwen2.5-Coder-7B-Instruct | 7B | 7.6B | 80 | ~20 | 32K |

**Qwen3-Coder-30B-A3B** is the standout — 30B total params but only 3B active (MoE), scoring 96 on benchmarks at ~90 tok/s on Apple Silicon with MLX 4-bit quant. 262K context window.

### Strategy: Multi-Provider from Day One

Instead of QVAC-only, the agent should support multiple local providers on day one:

```
┌─────────────────────────────────────────────────────────┐
│                 Provider Abstraction                     │
│                                                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────┐  │
│  │ LM Studio│  │  Ollama  │  │   QVAC   │  │ Cloud  │  │
│  │ (MLX/    │  │ (GGUF/   │  │ (native  │  │ (Open  │  │
│  │  local)  │  │  local)  │  │  P2P)    │  │ Router)│  │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └───┬────┘  │
│       │              │              │             │       │
│       └──────────────┴──────┬───────┴─────────────┘       │
│                             │                             │
│                   OpenAI-Compatible API                   │
│              (all expose /v1/chat/completions)             │
└─────────────────────────────────────────────────────────┘
```

All local model servers (LM Studio, Ollama, llama.cpp server, vLLM) expose an **OpenAI-compatible API**. The agent only needs one HTTP client that speaks `/v1/chat/completions` with tool calling.

QVAC adds unique P2P capabilities (delegated inference, model sharing) but for the POC, an OpenAI-compatible HTTP provider covers everything.

### Provider Priority for POC

1. **OpenAI-compatible** (LM Studio / Ollama / llama.cpp) — use the best local coding model
2. **QVAC** — for P2P-specific features (delegated inference, model sharing)
3. **OpenRouter** — cloud fallback for complex tasks
4. **Anthropic / OpenAI** — direct cloud APIs

### Recommended POC Model

**Qwen3-Coder-30B-A3B-Instruct** via LM Studio (MLX 4-bit):
- 3B active params (fast), 30B total (smart)
- ~90 tok/s on Apple Silicon
- 262K context window (more than enough)
- Score: 96 on coding benchmarks
- Tool calling support: native

---

## Addendum: AutoResearch (Karpathy) Integration

### What AutoResearch Is

[AutoResearch](https://github.com/karpathy/autoresearch) (35k stars) is Karpathy's 630-line framework for autonomous ML experimentation. The agent:

1. Reads `program.md` (human-written instructions — essentially a **skill**)
2. Modifies `train.py` (the experiment code)
3. Runs training for exactly 5 minutes
4. Checks `val_bpb` metric (lower = better)
5. Keeps improvement or discards and reverts
6. Loops forever until human stops it

The key insight: **`program.md` is a skill**. Humans don't write Python — they write instructions for the agent in Markdown. The agent does the actual research.

### How It Fits the Unstoppable Agent

AutoResearch fits beautifully in three ways:

#### 1. Autonomous Experimentation as a Skill

The autoresearch experiment loop is a natural skill for our agent:

```yaml
---
name: autonomous-experiment
description: Run autonomous ML experiments with keep/discard logic
metadata:
  unstoppable:
    stack_modules: [qvac]
---
# Autonomous Experimentation

## When to Use
When the user wants to improve a model, optimize hyperparameters,
or explore architecture changes autonomously.

## Procedure
1. Read the experiment instructions (program.md equivalent)
2. Establish baseline metrics
3. Loop: modify → run → evaluate → keep/discard
4. Log all results to results.tsv
5. Never stop until interrupted
```

This pattern isn't limited to training — it works for:
- **Optimizing QVAC model configs** — test different quantizations, context lengths, batch sizes
- **Benchmarking skills** — automatically test if a skill works with different models
- **Improving generated code** — agent writes code, runs tests, keeps or discards

#### 2. P2P Research Sharing

The autoresearch results can flow through our P2P network:

```
User A runs autoresearch overnight
    ↓
Results shared via HyperDB:
  /research/{topic}/results.tsv
  /research/{topic}/best_config.json
  /research/{topic}/program.md
    ↓
User B discovers: "Someone found a 15% better config for Qwen 3 4B!"
    ↓
User B applies the finding locally
    ↓
User B runs more experiments, shares improvements
    ↓
Collective autonomous research across the network
```

**This is distributed autonomous research via P2P.** Multiple machines running experiments overnight, sharing results. No central server. No coordination needed beyond Hyperswarm.

#### 3. Training Better Local Models

The trajectory compression system (from Hermes) + autoresearch loop = a pipeline for training better QVAC-compatible models:

```
Agent trajectories (from real coding tasks)
    ↓
Trajectory compression (Hermes-style)
    ↓
Training data for fine-tuning
    ↓
AutoResearch loop: train → eval → keep/discard
    ↓
Better local model (shared via P2P Hyperdrive)
    ↓
Community uses the improved model
    ↓
More trajectories → better training data → repeat
```

### Implementation: AutoResearch Skill

For the POC, we'd create an `autonomous-research` skill that:

1. Takes a `program.md` (experiment instructions)
2. Takes a metric function (what to optimize)
3. Runs the modify → execute → evaluate → keep/discard loop
4. Logs results to a structured format
5. Optionally shares results via P2P

This is powerful because it means our agent can **improve itself** — run experiments on its own skill quality, model configs, or even training data curation.

### Summary: AutoResearch + Unstoppable Agent

| Concept | AutoResearch | Our Application |
|---------|-------------|-----------------|
| `program.md` | Human writes research instructions | Skills are the instructions |
| `train.py` | Agent modifies ML code | Agent modifies any target code |
| Metric | `val_bpb` | Any measurable output (tests, benchmarks, perf) |
| Loop | Single GPU, overnight | Single machine or **distributed P2P** |
| Results | Local `results.tsv` | P2P shared via HyperDB |
| Sharing | None (single repo) | **P2P network-wide** |

---

### Internal References

| Resource | Path | Content |
|----------|------|---------|
| QVAC SDK docs | `research/qvac-docs/` | Full SDK documentation |
| QVAC examples | `research/qvac-examples/` | 50 working example scripts |
| Agent pack skills | `packages/agent-pack/src/skills/` | 17 existing skills |
| Agent pack components | `packages/agent-pack/src/components/ai/` | ModelManager, ChatSession, tool-runner |
| Reference apps | `reference-apps/` | Battle-tested patterns (desktop, mobile, health) |
| Tool runner | `packages/agent-pack/src/components/ai/tool-runner.ts` | Existing tool-calling loop implementation |
