# Agent Architecture Comparison: Deep Agents vs OpenCode vs Unstoppable Agent

> Research date: 2026-03-17

---

## Executive Summary

**Deep Agents** (LangChain) and **OpenCode** (Anomaly) represent the two most mature open-source agent harnesses. Both follow the same core pattern — tool-calling loop with skills — but differ significantly in architecture. Our **Unstoppable Agent** implements the basics but misses several critical patterns that both projects have converged on independently.

**The three biggest gaps in our agent:**
1. **No subagents / context isolation** — Both DA and OC treat this as essential, not optional
2. **No `write_todos` planning tool** — System prompt alone isn't enough; planning needs to be a first-class tool
3. **Skills don't follow agentskills.io spec** — Both DA and OC adopted the shared standard

**What we have that they don't:**
- Fallback tool call parsing for local models (DeepSeek, XML, JSON formats)
- P2P skill sharing vision (Hyperswarm + HyperDB)
- Learn mode for post-session skill extraction
- Compact prompt mode for small context windows

---

## Feature Matrix

| Feature | Deep Agents | OpenCode | Unstoppable Agent |
|---------|-------------|----------|-------------------|
| **Language** | Python | Go | TypeScript |
| **Core loop** | LangGraph runtime | Custom Go runtime | Custom TS loop |
| **Planning tool** | `write_todos` (TodoListMiddleware) | `todo` (built-in) | ❌ System prompt only |
| **Subagents** | `task` tool, configurable per-agent | `task` tool (General, Explore, custom) | ❌ Single agent |
| **Context isolation** | Subagents return only summary | Child sessions with navigation | ❌ Everything in one context |
| **Skills spec** | agentskills.io | agentskills.io | Custom format |
| **Skill loading** | Progressive disclosure (frontmatter → full) | Progressive disclosure | Full list in system prompt |
| **Middleware** | Composable pipeline (7+ built-in) | Built-in with hooks | ❌ Hard-coded |
| **Auto-summarization** | SummarizationMiddleware | Hidden compaction agent | ❌ Trim only |
| **Memory** | AGENTS.md (always loaded at startup) | AGENTS.md | MEMORY.md (custom) |
| **Permissions** | Human-in-the-loop per tool | allow/deny/ask per tool, per bash cmd, glob | ❌ None |
| **Multi-model** | Per-subagent model override | Per-agent model override | Single model |
| **Agent definition** | Code (dict/CompiledSubAgent) | JSON config or Markdown files | ❌ Hard-coded |
| **Filesystem backend** | Pluggable (state/local/store/sandbox/composite) | Local filesystem | Local filesystem only |
| **Sandboxed execution** | Modal, Daytona, Deno, Runloop | ❌ | ❌ |
| **Streaming** | Full LangGraph streaming with agent metadata | TUI with session navigation | SSE streaming with chalk UI |
| **Connection resilience** | Auto-retry with exponential backoff (6 retries) | Provider-level | ❌ Single attempt |
| **Local model support** | Via LangChain integrations | Via provider config | ✅ First-class (LM Studio, Ollama) |
| **Fallback tool parsing** | ❌ (relies on structured API) | ❌ | ✅ DeepSeek/XML/JSON |
| **Think block filtering** | ❌ | ❌ | ✅ `<think>` tag handling |
| **Learn mode** | ❌ | ❌ | ✅ Post-session skill extraction |
| **P2P sharing** | ❌ | ❌ | Vision (not implemented yet) |
| **Compact prompt** | ❌ | ❌ | ✅ For small context windows |
| **Budget pressure** | ❌ | `steps` config + system prompt at limit | ✅ At 70%/90% |
| **Loop detection** | ❌ | Subagent call budgets + depth limits | ✅ Signature-based |

---

## Deep Dive: What They Do Better

### 1. Subagents & Context Isolation (Critical Gap)

**Deep Agents approach:**
```
Main Agent → task("research-agent", "Find all React patterns") → Subagent
Subagent: 10 web searches, 5 file reads, complex analysis
Main Agent receives: "Here are the 3 key patterns: ..."
```

The main agent's context stays clean. The subagent's intermediate work (tool calls, errors, retries) never enters the parent's history.

**OpenCode approach:**
- `General` subagent: Full tool access, runs in isolated child session
- `Explore` subagent: Read-only, fast codebase exploration
- Custom subagents via Markdown files or JSON config
- Subagent-to-subagent delegation with call budgets and depth limits
- Session navigation (parent/child/sibling)

**Our problem:**
Every tool call and result goes into one conversation. After 5-6 tool calls, the context is bloated with file contents, error messages, and terminal output. The model's quality degrades because it can't focus. With a 4K-16K local model, this is catastrophic.

**What we should adopt:**
- A `task` tool that spawns an isolated processing loop
- The subagent gets its own conversation history
- Only the final result is returned to the parent
- Even with a single model, this dramatically improves context management

### 2. Planning as a Tool, Not Just a Prompt (High Impact)

**Deep Agents' `write_todos`:**
- A literal tool the model calls: `write_todos([{content: "Install deps", status: "pending"}, ...])`
- The tool is a "no-op" functionally — it doesn't execute anything
- But it forces the model to externalize its plan as structured data
- The plan persists in tool call history, visible across rounds
- The model can update status: `pending → in_progress → completed`
- LangChain calls this "context engineering" — it works because models are better at following plans they've written down

**OpenCode's `todo`:**
- Similar built-in tool
- The todo list is shown to the model in subsequent rounds
- At the `steps` limit, the model is told to summarize remaining work

**Our approach:**
- System prompt says "output a numbered plan first"
- But the plan is just text in the conversation — it's not structured
- The model frequently ignores it, especially smaller models
- We inject "Continue executing" messages, but this is fragile

**What we should adopt:**
- A `write_todos` tool that stores a structured plan
- The plan is injected into the system prompt or prepended to messages
- The model sees its own checklist and can update it
- This is especially valuable for small models that lose track

### 3. Auto-Summarization (High Impact)

**Deep Agents:**
- `SummarizationMiddleware` condenses message history when conversations grow long
- Also has agent-triggered summarization (between tasks)
- Large tool outputs are stored in the filesystem, not in conversation

**OpenCode:**
- Hidden `compaction` agent that auto-summarizes context
- Runs transparently when needed
- The model doesn't know it happened — it just sees cleaner context

**Our approach:**
- `trimIfNeeded()` just removes old messages, losing context entirely
- No summarization — we either have the full context or we've thrown it away

**What we should adopt:**
- When approaching context limit, summarize the middle of the conversation
- Keep the system prompt + first exchange + last N exchanges intact
- Replace the middle with a summary: "Previously: installed deps, created files X Y Z, encountered error with Z, fixed by..."
- Even a simple template-based summary is better than hard truncation

### 4. Skills Following agentskills.io Spec (Medium Impact)

Both Deep Agents and OpenCode follow the [agentskills.io](https://agentskills.io/specification) specification:

```
skill-name/
├── SKILL.md          # Required: YAML frontmatter + instructions
├── scripts/          # Optional: executable code
├── references/       # Optional: docs
└── assets/           # Optional: templates, resources
```

Frontmatter fields: `name`, `description`, `license`, `compatibility`, `metadata`, `allowed-tools`

Key principle: **Progressive disclosure**
1. At startup: only `name` + `description` (~100 tokens per skill)
2. When activated: full `SKILL.md` body (<5000 tokens recommended)
3. When needed: reference files loaded individually

**Our approach:**
- Similar directory structure but custom parsing
- No `allowed-tools` field
- We dump all skill names in the system prompt (wasting tokens)
- No `scripts/` or `assets/` directories
- `resources/` instead of `references/` (minor naming difference)

**What we should adopt:**
- Rename to match agentskills.io: `resources/ → references/`
- Add `scripts/` and `assets/` support
- Implement proper progressive disclosure in system prompt (only names+descriptions)
- Add `allowed-tools` to frontmatter
- Validate skill names with the spec regex: `^[a-z0-9]+(-[a-z0-9]+)*$`

### 5. Composable Middleware (Architecture)

**Deep Agents middleware stack:**
1. `PatchToolCallsMiddleware` — Fix interrupted tool calls
2. `AnthropicPromptCachingMiddleware` — Reduce redundant tokens
3. `SummarizationMiddleware` — Condense long conversations
4. `SubAgentMiddleware` — Spawn and coordinate subagents
5. `FilesystemMiddleware` — File operations
6. `TodoListMiddleware` — Planning
7. `SkillsMiddleware` — Skill loading
8. `MemoryMiddleware` — Persistent memory
9. `HumanInTheLoopMiddleware` — Approval gates

Each middleware can:
- Add tools to the agent
- Modify messages before/after the model call
- Transform tool results
- Inject system prompt sections

**Our approach:**
- Everything hard-coded in `agent.ts` and `system-prompt.ts`
- Adding a new feature means editing core files

**What we should adopt (long-term):**
- Not necessarily a full middleware system (our codebase is simpler)
- But a plugin pattern where features can hook into the agent loop:
  - `beforeRound(messages)` — modify messages
  - `afterRound(result)` — process results
  - `getTools()` — contribute tools
  - `getSystemPromptSection()` — contribute prompt sections

### 6. Agent Definition Format (Medium)

**OpenCode's Markdown agent files:**
```markdown
---
description: Reviews code for quality
mode: subagent
model: anthropic/claude-sonnet-4
permission:
  edit: deny
  bash:
    "git diff": allow
---

You are a code reviewer. Focus on security and performance.
```

**Deep Agents' dict-based config:**
```python
research_subagent = {
    "name": "research-agent",
    "description": "Used to research more in depth questions",
    "system_prompt": "You are a great researcher",
    "tools": [internet_search],
    "model": "openai:gpt-5.2",
    "skills": ["/skills/research/"],
}
```

**Our approach:**
- No agent definition format at all
- Single hard-coded agent

**What we should adopt:**
- Markdown-based agent definitions (aligns with our existing SKILL.md pattern)
- Place in `.unstoppable/agents/` or `.agents/`
- At minimum: `name`, `description`, `prompt`, `model`, `tools`, `skills`

### 7. Permission System (Medium)

**OpenCode's approach:**
```json
{
  "permission": {
    "edit": "ask",
    "bash": {
      "*": "ask",
      "git status": "allow",
      "rm -rf *": "deny"
    },
    "skill": {
      "internal-*": "deny"
    }
  }
}
```

Three states: `allow`, `deny`, `ask` (human approval)
Glob patterns for fine-grained control.

**Deep Agents' approach:**
```python
interrupt_on={
    "write_file": True,     # Requires approval
    "read_file": False,     # Auto-approve
    "send_email": {"allowed_decisions": ["approve", "reject"]},
}
```

**Our approach:**
- No permissions at all
- All tools are always available (minus excluded toolsets)

**What we should adopt:**
- At minimum: an `ask` mode for destructive operations (delete, terminal commands)
- Glob-based deny lists for sensitive bash commands
- This becomes important when users trust the agent with real projects

### 8. Connection Resilience (Small)

**Deep Agents:** Auto-retry with exponential backoff, configurable up to 15 retries.

**Our approach:** Single attempt, fail on error.

Should add: retry with backoff for provider calls (simple to implement).

---

## What We Do Better (Our Unique Strengths)

### 1. Local Model Compatibility
Neither DA nor OC handle the messy reality of local models:
- DeepSeek's proprietary `<｜tool▁calls▁begin｜>` format
- XML `<tool_call>` fallback
- Raw JSON extraction
- `<think>` block filtering
- Hallucinated tool result suppression
- Text buffering to prevent leaking model tags

This is valuable and should be preserved.

### 2. Learn Mode
Neither project has post-session reflection that extracts reusable skills. Our `/learn` command is unique and fits the P2P vision perfectly — learn locally, share globally.

### 3. Compact Prompt Mode
Neither project optimizes for 4K-8K context windows. Our compact mode is essential for running with smaller local models.

### 4. Budget Pressure
While OpenCode has `steps` limits, our graduated pressure at 70%/90% is more nuanced and gives the model a chance to wrap up gracefully.

### 5. P2P Vision
Neither project has any concept of decentralized skill sharing. This remains our unique differentiator.

---

## Recommended Improvements (Priority Order)

### Phase 1: High Impact, Medium Effort
1. **Add `write_todos` planning tool** — A structured plan the model can write and check off. This alone would dramatically improve multi-step execution with small models.
2. **Add subagent / `task` tool** — Even a simple version that runs the same model with isolated context would help. The parent sends a task description, the subagent works independently, returns a summary.
3. **Add auto-summarization** — When context exceeds N tokens, summarize middle turns instead of hard-truncating.

### Phase 2: Standards Alignment
4. **Adopt agentskills.io spec** — Rename directories, add proper frontmatter validation, implement progressive disclosure properly.
5. **Add AGENTS.md support** — Load `AGENTS.md` as persistent memory (in addition to our `MEMORY.md`).
6. **Add retry with backoff** — Simple exponential backoff on provider calls.

### Phase 3: Architecture
7. **Agent definition format** — Markdown-based agent configs, at least for subagents.
8. **Permission system** — `allow`/`deny`/`ask` per tool.
9. **Plugin hooks** — `beforeRound`/`afterRound`/`getTools`/`getPromptSection` for extensibility.

### Phase 4: P2P (Our Differentiator)
10. **P2P skill sharing** — Hyperswarm topic for skill discovery, HyperDB for storage/replication.
11. **P2P learn loop** — Share skills extracted via `/learn` with the network.
12. **AutoResearch integration** — Distributed skill validation and improvement.

---

## Architecture Diagram: Target State

```
┌─────────────────────────────────────────────────────────┐
│                        CLI / UI                          │
├─────────────────────────────────────────────────────────┤
│                    Main Agent Loop                        │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────────┐ │
│  │ write_todos   │ │ task(sub)    │ │ skill(load)      │ │
│  │ Plan tracking │ │ Context      │ │ Progressive      │ │
│  │               │ │ isolation    │ │ disclosure       │ │
│  └──────────────┘ └──────────────┘ └──────────────────┘ │
├─────────────────────────────────────────────────────────┤
│                    Plugin Hooks                           │
│  beforeRound │ afterRound │ getTools │ getPromptSection  │
├─────────────────────────────────────────────────────────┤
│  Summarization │ Permissions │ Think Filter │ Fallback  │
│  (auto)        │ (per-tool)  │ (local model) │ Parser   │
├─────────────────────────────────────────────────────────┤
│                    Provider Layer                         │
│  OpenAI-compatible │ QVAC │ Retry + Backoff             │
├─────────────────────────────────────────────────────────┤
│  Session │ Skills (agentskills.io) │ Memory │ Agents    │
├─────────────────────────────────────────────────────────┤
│                    P2P Layer (Future)                     │
│  Hyperswarm │ HyperDB │ Skill Sync │ Learn Network      │
└─────────────────────────────────────────────────────────┘
```

---

## Key Quotes / Insights

**Deep Agents on planning:**
> "The `write_todos` tool is essentially a 'no-op' from a functional perspective — it doesn't execute anything — but serves as a context engineering strategy to keep agents focused and organized over longer time horizons."

**Deep Agents on subagents:**
> "Subagents solve the context bloat problem. When agents use tools with large outputs, the context window fills up quickly with intermediate results. Subagents isolate this detailed work — the main agent receives only the final result, not the dozens of tool calls that produced it."

**OpenCode on agent steps:**
> "When the limit is reached, the agent receives a special system prompt instructing it to respond with a summarization of its work and recommended remaining tasks."

**agentskills.io on progressive disclosure:**
> "Skills should be structured for efficient use of context: (1) Metadata ~100 tokens loaded at startup, (2) Instructions <5000 tokens loaded on activation, (3) Resources loaded only when required."
