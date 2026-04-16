# OpenCode Architecture Deep Dive

**Repo**: https://github.com/anomalyco/opencode  
**Stars**: 124K+ | **Language**: TypeScript | **Default Branch**: `dev`  
**Package Manager**: Bun | **Key Libraries**: Vercel AI SDK, Effect, Zod, SolidJS, Drizzle ORM  
**Architecture**: Client/Server (TUI, Web, Desktop clients; headless API server)

---

## 1. Agent Loop Architecture

### Core Design
The agent loop is in `packages/opencode/src/session/processor.ts`. It's a **streaming loop with automatic continuation**.

**Flow**: User message → `SessionProcessor.create()` → `processor.process()` → Vercel AI SDK `streamText()` → handle stream events → loop if tool calls need continuation.

### Key Data Structures

```typescript
// processor.ts creates an info object with:
{
  message: MessageV2.Assistant,         // the current assistant message being built
  partFromToolCall(toolCallID: string), // maps tool call IDs to parts
  async process(streamInput: LLM.StreamInput): Promise<"continue" | "stop" | "compact">
}
```

### Multi-step Reasoning

The `process()` method contains a `while (true)` loop:

```typescript
while (true) {
  try {
    const stream = await LLM.stream(streamInput)
    for await (const value of stream.fullStream) {
      // Handle: start, reasoning-start/delta/end, text-start/delta/end,
      //         tool-input-start/delta/end, tool-call, tool-result, tool-error,
      //         start-step, finish-step, finish
    }
  } catch (e) {
    // Error handling with retry logic
    const retry = SessionRetry.retryable(error)
    if (retry !== undefined) {
      attempt++
      const delay = SessionRetry.delay(attempt, error)
      await SessionRetry.sleep(delay, input.abort)
      continue  // retry the loop
    }
  }
  // After stream completes, return "continue", "stop", or "compact"
}
```

**Continuation logic** is in `session/index.ts` (the caller). When `process()` returns:
- `"continue"` → re-invoke with updated messages (tool results are now in context)
- `"stop"` → end the turn (user blocked a permission, or error)
- `"compact"` → trigger compaction before continuing

### Agent Step Tracking
Each LLM call is a "step". Before each step, a snapshot is taken of the workspace. After each step, a diff patch is computed showing what files changed:

```typescript
case "start-step":
  snapshot = await Snapshot.track()

case "finish-step":
  const patch = await Snapshot.patch(snapshot)
  if (patch.files.length) {
    await Session.updatePart({ type: "patch", hash: patch.hash, files: patch.files })
  }
```

### Doom Loop Detection
Detects when the same tool is called 3 times in a row with identical inputs:

```typescript
const DOOM_LOOP_THRESHOLD = 3
const lastThree = parts.slice(-DOOM_LOOP_THRESHOLD)
if (lastThree.every(p =>
  p.type === "tool" && p.tool === value.toolName &&
  JSON.stringify(p.state.input) === JSON.stringify(value.input)
)) {
  await PermissionNext.ask({ permission: "doom_loop", patterns: [value.toolName], ... })
}
```

---

## 2. Tool System

### Tool Definition Pattern

Tools use a `Tool.define()` factory with Zod schemas:

```typescript
// tool/tool.ts
export namespace Tool {
  export interface Info<Parameters, M> {
    id: string
    init: (ctx?: InitContext) => Promise<{
      description: string
      parameters: Parameters        // Zod schema
      execute(args, ctx: Context): Promise<{ title: string; metadata: M; output: string }>
      formatValidationError?(error: z.ZodError): string
    }>
  }

  export function define<Parameters, M>(
    id: string,
    init: Info<Parameters, M>["init"] | Awaited<ReturnType<Info<Parameters, M>["init"]>>,
  ): Info<Parameters, M>
}
```

**Key features**:
- `init` can be sync (object literal) or async (factory function) - async allows runtime configuration
- Automatic output truncation via `Truncate.output()` - writes large outputs to temp files
- Automatic Zod validation with custom error formatting
- `InitContext` passes the agent info so tools can adapt behavior per-agent

### Tool Context (execution context)

```typescript
type Context = {
  sessionID: SessionID
  messageID: MessageID
  agent: string
  abort: AbortSignal
  callID?: string
  messages: MessageV2.WithParts[]          // full conversation history
  metadata(input: { title?; metadata? }): void  // stream metadata to UI
  ask(input): Promise<void>                      // request permission
}
```

### Tool Registry

`tool/registry.ts` aggregates all tools:

```typescript
// Built-in tools:
InvalidTool, QuestionTool, BashTool, ReadTool, GlobTool, GrepTool,
EditTool, WriteTool, TaskTool, WebFetchTool, TodoWriteTool, WebSearchTool,
CodeSearchTool, SkillTool, ApplyPatchTool, LspTool, BatchTool, PlanExitTool

// Custom tools loaded from:
// 1. .opencode/{tool,tools}/*.{js,ts} files in config directories
// 2. Plugin-registered tools via @opencode-ai/plugin
```

**Model-specific tool selection**: GPT models use `apply_patch` (unified diff format); Claude/others use `edit`+`write` (string replace).

### Tool Description Pattern
Each tool has a `.txt` file with its description (loaded as text import). Descriptions are templates with `${variable}` substitution at init time.

### Tool Call Repair
When a model sends an invalid tool name, it's automatically repaired:

```typescript
experimental_repairToolCall(failed) {
  const lower = failed.toolCall.toolName.toLowerCase()
  if (lower !== failed.toolCall.toolName && tools[lower]) {
    return { ...failed.toolCall, toolName: lower }
  }
  return { ...failed.toolCall, toolName: "invalid", input: JSON.stringify({ error: ... }) }
}
```

---

## 3. Subagent / Task Delegation

### Architecture
Subagents are defined as agent configs with `mode: "subagent"`. They execute in **separate sessions** (child sessions) via the `TaskTool`.

### Built-in Agents

| Agent | Mode | Purpose |
|-------|------|---------|
| `build` | primary | Default agent, full tool access |
| `plan` | primary | Read-only, disallows edits except plan files |
| `general` | subagent | Multi-step tasks, parallel work |
| `explore` | subagent | Fast codebase exploration (read-only) |
| `compaction` | primary (hidden) | Summarizes conversation for context management |
| `title` | primary (hidden) | Generates session titles |
| `summary` | primary (hidden) | Generates session summaries |

### Task Tool Implementation

```typescript
// tool/task.ts
const TaskTool = Tool.define("task", async (ctx) => {
  const agents = await Agent.list().then(x => x.filter(a => a.mode !== "primary"))
  return {
    parameters: z.object({
      description: z.string(),
      prompt: z.string(),
      subagent_type: z.string(),
      task_id: z.string().optional(),  // resume previous task
    }),
    async execute(params, ctx) {
      // 1. Create child session (or resume existing)
      const session = await Session.create({ parentID: ctx.sessionID, ... })

      // 2. Run prompt in child session
      const result = await SessionPrompt.prompt({
        sessionID: session.id,
        agent: agent.name,
        parts: promptParts,
      })

      // 3. Return last text output
      return { output: `task_id: ${session.id}\n${text}` }
    }
  }
})
```

**Key design decisions**:
- Subagents run in their own session with their own permission ruleset
- TodoWrite/TodoRead are denied for subagents (only primary agent manages todos)
- Subagents can be resumed by passing `task_id` back
- The `explore` subagent has a restricted permission set (only search/read tools)
- User can invoke subagents directly with `@general` or `@explore` syntax

### Agent Configuration
Agents are fully configurable via `opencode.json`:

```typescript
Agent.Info = {
  name: string,
  description: string,
  mode: "subagent" | "primary" | "all",
  permission: PermissionNext.Ruleset,
  model?: { providerID, modelID },  // override model
  prompt?: string,                    // custom system prompt
  temperature?: number,
  steps?: number,                     // max steps
  options: Record<string, any>,       // provider-specific options
}
```

---

## 4. Planning System

### Plan Mode Agent
The `plan` agent is a primary agent (switchable via Tab key) that:
- **Denies all edit tools** except writes to `.opencode/plans/*.md`
- Has a `plan_exit` tool that asks the user to switch to build mode
- Creates a plan file and writes structured plans to it

### Plan Enter/Exit Flow
```
User in build mode → Tab → switches to plan agent
Plan agent reads codebase → writes plan to .opencode/plans/plan.md
Plan agent calls plan_exit → asks "Switch to build agent?"
User says Yes → new user message created with "Execute the plan"
Build agent reads plan and implements
```

The plan exit tool creates a synthetic user message to bridge the transition:
```typescript
await Session.updatePart({
  type: "text",
  text: `The plan at ${plan} has been approved, you can now edit files. Execute the plan`,
  synthetic: true,
})
```

---

## 5. Session Management

### Storage
Sessions use **SQLite via Drizzle ORM** with the following tables:
- `session` - session metadata (id, title, parentID, timestamps)
- `message` - messages (role, model, agent, tokens, cost)
- `part` - message parts (text, tool calls, reasoning, patches, etc.)
- `permission` - approved permissions per project

### Message Parts (V2 system)
Messages are composed of typed parts:

```typescript
type Part = TextPart | ToolPart | ReasoningPart | StepStartPart | StepFinishPart |
            PatchPart | FilePart | CompactionPart
```

Each part has `id`, `messageID`, `sessionID`, and type-specific fields. Parts stream in real-time via delta updates:

```typescript
await Session.updatePartDelta({
  sessionID, messageID, partID,
  field: "text",
  delta: value.text,  // incremental text
})
```

### Context Window Management / Compaction

**Overflow detection** (`compaction.ts`):
```typescript
const COMPACTION_BUFFER = 20_000
const usable = model.limit.input
  ? model.limit.input - reserved
  : context - ProviderTransform.maxOutputTokens(model)
return count >= usable
```

**Two-stage compaction**:

1. **Pruning** - walks backwards through tool call outputs, keeping the last 40K tokens of tool results, erasing older ones:
```typescript
const PRUNE_MINIMUM = 20_000
const PRUNE_PROTECT = 40_000
// Marks old tool outputs as compacted (they become empty in the context)
```

2. **Summarization** - creates a compaction message using the compaction agent:
   - Uses a structured template: Goal, Instructions, Discoveries, Accomplished, Relevant files
   - Replays the last user message after compaction so the agent can continue
   - If compaction itself overflows, reports error

**Auto-compaction**: Triggered automatically when `finish-step` detects token usage exceeding the model's context limit. Can be disabled via `config.compaction.auto = false`.

### Session Revert
`session/revert.ts` enables reverting to a previous state using git snapshots.

---

## 6. Permission System

### Architecture
The permission system uses **wildcard pattern matching** with three actions: `allow`, `deny`, `ask`.

### Rule Evaluation

```typescript
// permission/service.ts
function evaluate(permission: string, pattern: string, ...rulesets: Ruleset[]): Rule {
  const rules = rulesets.flat()
  const match = rules.findLast(
    rule => Wildcard.match(permission, rule.permission) && Wildcard.match(pattern, rule.pattern)
  )
  return match ?? { action: "ask", permission, pattern: "*" }
}
```

Rules are evaluated **last-match-wins** (like CSS specificity). Each agent has a merged ruleset from:
1. Default permissions (built-in)
2. User permissions (from config)
3. Agent-specific permissions

### Permission Categories

| Permission | Controls |
|-----------|----------|
| `bash` | Shell command execution (patterns are command text) |
| `edit` | File editing (patterns are file paths) |
| `read` | File reading (`*.env` files require ask) |
| `external_directory` | Access outside project root |
| `doom_loop` | Repeated identical tool calls |
| `question` | Asking user questions |
| `task` | Subagent delegation |
| `skill` | Skill invocation |
| `plan_enter` / `plan_exit` | Plan mode transitions |

### Permission UX with Effect
Uses **Effect library's Deferred** for async permission requests:

```typescript
const deferred = yield* Deferred.make<void, Error>()
pending.set(id, { info, deferred })
Bus.publish(Event.Asked, info)  // UI shows permission dialog
return yield* Deferred.await(deferred)  // blocks until user responds
```

When user replies "always", the pattern is added to the approved ruleset and all pending matching permissions are auto-approved.

### Error Types
```typescript
RejectedError   // user clicked deny
CorrectedError  // user denied with feedback message
DeniedError     // rule explicitly denies (no prompt shown)
```

---

## 7. Streaming

### Vercel AI SDK Integration
OpenCode wraps the Vercel AI SDK's `streamText()` function (`session/llm.ts`):

```typescript
return streamText({
  model: wrapLanguageModel({ model: language, middleware: [...] }),
  tools,
  messages: [...system, ...input.messages],
  maxOutputTokens,
  abortSignal: input.abort,
  // ... temperature, topP, topK, headers, telemetry
})
```

### Stream Event Types Handled
```
start, reasoning-start/delta/end, text-start/delta/end,
tool-input-start/delta/end, tool-call, tool-result, tool-error,
start-step, finish-step, finish, error
```

### Real-time Part Updates
Parts are written to the database and broadcast via a Bus (event system):

```typescript
// Delta updates for streaming text
await Session.updatePartDelta({
  field: "text",
  delta: value.text,  // just the new characters
})

// Tool metadata streaming (e.g., bash output)
ctx.metadata({
  metadata: { output: currentOutput, description: "running npm install" }
})
```

### Token Accumulation
Token usage is tracked per step via `finish-step` events:

```typescript
case "finish-step":
  const usage = Session.getUsage({ model, usage: value.usage, metadata: value.providerMetadata })
  msg.cost += usage.cost
  msg.tokens = usage.tokens  // { input, output, reasoning, cache: { read, write } }
```

---

## 8. Error Handling & Retries

### Retry Logic (`session/retry.ts`)

```typescript
const RETRY_INITIAL_DELAY = 2000
const RETRY_BACKOFF_FACTOR = 2
const RETRY_MAX_DELAY_NO_HEADERS = 30_000

function delay(attempt: number, error?: APIError) {
  // Priority: retry-after-ms header → retry-after header → exponential backoff
  if (headers["retry-after-ms"]) return parseFloat(retryAfterMs)
  if (headers["retry-after"]) return parsedSeconds * 1000
  return RETRY_INITIAL_DELAY * Math.pow(RETRY_BACKOFF_FACTOR, attempt - 1)
}
```

### Retryable Errors
```typescript
function retryable(error): string | undefined {
  if (ContextOverflowError.isInstance(error)) return undefined  // not retryable
  if (APIError.isInstance(error)) {
    if (!error.data.isRetryable) return undefined
    if (error.data.responseBody?.includes("FreeUsageLimitError")) return "Free usage exceeded"
    return error.data.message.includes("Overloaded") ? "Provider is overloaded" : error.data.message
  }
  // Also handles: too_many_requests, rate_limit, exhausted, unavailable
}
```

### In the processor loop:
```typescript
const retry = SessionRetry.retryable(error)
if (retry !== undefined) {
  attempt++
  SessionStatus.set(sessionID, { type: "retry", attempt, message: retry, next: Date.now() + delay })
  await SessionRetry.sleep(delay, input.abort)
  continue  // retry the while(true) loop
}
// Non-retryable: set error on message, publish error event, stop
```

### Context Overflow Handling
When context overflow is detected (either from token count or API error), triggers compaction instead of retrying:
```typescript
if (MessageV2.ContextOverflowError.isInstance(error)) {
  needsCompaction = true  // breaks the stream loop, returns "compact"
}
```

---

## 9. Prompt Engineering

### System Prompt Structure
The system prompt is assembled in `session/llm.ts`:

```
[1] Agent prompt (or provider-specific prompt)
[2] Custom system prompts from the stream input
[3] User's custom system prompt from message
```

The first part is kept separate for **prompt caching** (Anthropic). If plugins modify the system prompt, the 2-part structure is maintained when possible.

### Agent-Specific Prompts
- `build`: Uses the default provider prompt (full system prompt with all tools)
- `plan`: Default prompt but with edit restrictions
- `explore`: Custom prompt focused on file search
- `compaction`: Custom prompt for summarization
- `title`: Custom prompt for title generation
- `summary`: Custom prompt for session summaries

### Tool Descriptions Pattern
Each tool has a `.txt` file loaded as a text import:
- `bash.txt` - 9.6KB of detailed bash instructions
- `edit.txt` - String replace semantics with strict rules
- `apply_patch.txt` - Unified diff format for GPT models
- `read.txt` - File reading with line numbers
- `task.txt` - Subagent delegation with agent list template

### Provider-Specific Adaptations
Via `ProviderTransform`:
- Different `maxOutputTokens` per model
- Model-specific options (e.g., `store: false` for OpenAI OAuth)
- Temperature/topP/topK defaults vary by provider
- OpenAI Codex sessions use `options.instructions` instead of system messages

### Custom Instructions
Users can add instructions via:
- `opencode.json` → `instructions` field
- `.opencode/instructions.md` or similar config files
- CLAUDE.md / AGENTS.md files (loaded via `session/instruction.ts`)
- Per-agent `prompt` field in config

---

## 10. Code Quality & Organization

### Monorepo Structure
```
packages/
├── opencode/        # Core: agent, session, tools, config, LSP, permissions
├── app/             # Web UI (SolidJS)
├── desktop/         # Tauri desktop app
├── desktop-electron/ # Electron desktop app
├── console/         # Admin console
├── sdk/             # TypeScript SDK for the API
├── plugin/          # Plugin API (@opencode-ai/plugin)
├── ui/              # Shared UI components
├── web/             # Marketing website
├── docs/            # Documentation site
├── extensions/      # Editor extensions
├── enterprise/      # Enterprise features
├── function/        # Serverless functions
├── identity/        # Auth/identity
├── containers/      # Container support
├── util/            # Shared utilities
└── slack/           # Slack integration
```

### Patterns Used

1. **Namespace pattern**: Every module is a TypeScript namespace (`export namespace Session {}`)
2. **Effect library**: Used for dependency injection, error handling, and async flows (especially in permissions)
3. **Zod schemas**: All data types defined with Zod, shared between server and client
4. **Event bus**: `Bus.publish()` / `Bus.subscribe()` for decoupled communication
5. **Instance.state()**: Lazy singleton pattern - state is computed once per project instance
6. **Text imports**: Tool descriptions and prompts loaded from `.txt` files
7. **ULID IDs**: Monotonically increasing, sortable IDs via `ulid` library
8. **Plugin system**: Hooks for `chat.params`, `tool.definition`, `shell.env`, etc.

### Style
- No semicolons
- `const` only (no `let`)
- Early returns instead of `else`
- Dot notation instead of destructuring
- Single-word variable names preferred
- Bun APIs preferred (`Bun.file()`)

---

## 11. File Operations

### Read Tool (`tool/read.ts`)
- Reads files with line numbers (`1: content`)
- Supports offset/limit for partial reads
- Handles binary detection, image files, PDFs
- Auto-truncates large output to temp files

### Edit Tool (`tool/edit.ts`)
**String replace** approach (not diff):

```typescript
parameters: z.object({
  file_path: z.string(),
  old_string: z.string(),
  new_string: z.string(),
  replaceAll: z.boolean().optional(),
})
```

- Requires `old_string` to be unique in the file (errors on multiple matches)
- Supports `replaceAll` for rename operations
- 21KB implementation with LSP integration (diagnostics after edit)
- Records file snapshots for revert capability

### Write Tool
- Creates new files or overwrites existing ones
- Similar permission checking to edit

### Glob Tool (`tool/glob.ts`)
- Pattern-based file search using the `glob` npm package
- Respects `.gitignore`

### Grep Tool (`tool/grep.ts`)
- Regex search via `rg` (ripgrep) subprocess
- Returns matching lines with context

---

## 12. Terminal / Shell Execution

### Bash Tool Architecture (`tool/bash.ts`)

**Shell selection**: Uses `Shell.acceptable()` to find the best available shell.

**Command parsing with tree-sitter**: Parses bash commands using `web-tree-sitter` + `tree-sitter-bash` to:
- Extract individual commands for permission patterns
- Detect paths that go outside the project directory
- Build "always allow" patterns from command prefixes

```typescript
const tree = await parser().then(p => p.parse(params.command))
for (const node of tree.rootNode.descendantsOfType("command")) {
  // Extract command name and args
  // Check if paths go outside project
  // Build permission patterns
}
```

**Process management**:
```typescript
const proc = spawn(params.command, {
  shell,
  cwd,
  stdio: ["ignore", "pipe", "pipe"],
  detached: process.platform !== "win32",
})
```

- Default timeout: 2 minutes (configurable per-call)
- Kills process tree on timeout or abort
- Streams stdout/stderr in real-time via `ctx.metadata()`
- Metadata truncated at 30KB for UI (full output available to agent)

**Environment injection**: Plugins can inject env vars via `shell.env` hook.

### PTY Support
The `src/pty/` directory suggests support for pseudo-terminal sessions (persistent shells), though the bash tool uses `spawn()` for individual commands.

---

## 13. UI/UX

### TUI (Terminal UI)
**NOT Bubble Tea** (that's Go). Built with **SolidJS + [opentui](https://github.com/sst/opentui)** - a terminal UI framework for SolidJS.

Located at `packages/opencode/src/cli/cmd/tui/`.

### Multi-client Architecture
OpenCode uses a **client/server architecture**:
- **Server**: Headless API server (Hono framework, port 4096 default)
- **TUI client**: SolidJS + opentui
- **Web client**: SolidJS web app
- **Desktop client**: Tauri (wraps web app)
- **Slack client**: Bot integration

### Key UI Features
- Tab key switches between agents (build ↔ plan)
- `@agent` syntax to invoke subagents inline
- Real-time streaming of text, reasoning, and tool output
- Permission dialogs inline in the terminal
- Session status display (busy, retry with countdown, idle)

### Event-driven Updates
The Bus pattern enables real-time UI updates:
```typescript
Bus.publish(Session.Event.Error, { sessionID, error })
Bus.publish(SessionCompaction.Event.Compacted, { sessionID })
Bus.publish(PermissionEffect.Event.Asked, request)
```

---

## 14. Skill System

### Discovery
Skills are discovered from multiple locations, in order:

1. **Global external dirs**: `~/.claude/skills/`, `~/.agents/skills/` (Claude Code compatible)
2. **Project external dirs**: `.claude/skills/`, `.agents/skills/` (walks up directory tree)
3. **OpenCode config dirs**: `.opencode/skill/`, `.opencode/skills/`
4. **Config paths**: Custom paths from `skills.paths` in config
5. **Remote URLs**: Skills fetched from URLs via `skills.urls` config

### Skill Format
Skills are SKILL.md files with YAML frontmatter:

```markdown
---
name: my-skill
description: What this skill does
---

# Skill content (markdown)

Instructions for the agent when this skill is invoked...
```

### Remote Skill Discovery (`skill/discovery.ts`)
```
GET {url}/index.json → { skills: [{ name, files: ["SKILL.md", ...] }] }
```
Downloads skill files to `~/.cache/opencode/skills/{name}/` with concurrency control (4 skills, 8 files).

### Skill Tool
The `SkillTool` (`tool/skill.ts`) lets agents invoke skills by name. Skills are read as markdown content and injected into the conversation.

### Cross-agent Compatibility
By scanning `.claude/skills/` and `.agents/skills/`, OpenCode is compatible with skills written for Claude Code and other agents. This is a significant interop feature.

---

## 15. Configuration System

### Config File Format
`opencode.json` (or `.opencode/config.json`) - JSON with extensive schema:

```typescript
// Key config sections:
{
  "model": "provider/model-name",        // default model
  "default_agent": "build",
  "instructions": "Custom instructions",
  "permission": { ... },                  // global permission rules
  "agent": {                              // per-agent config
    "build": { "model": "...", "prompt": "...", "permission": { ... } }
  },
  "lsp": {                                // LSP server config
    "custom-lsp": { "command": ["cmd", "args"], "extensions": [".ext"] }
  },
  "skills": {
    "paths": ["~/my-skills"],
    "urls": ["https://skills.example.com/"]
  },
  "compaction": {
    "auto": true,
    "prune": true,
    "reserved": 20000
  },
  "experimental": {
    "batch_tool": false,
    "openTelemetry": false,
    "continue_loop_on_deny": false,
    "primary_tools": []
  }
}
```

### Config Directories
Config is loaded from multiple locations (merged):
1. Global: `~/.opencode/`
2. Project: `.opencode/` (walked up from cwd to git root)

### Environment Variables / Flags (`flag/flag.ts`)
```
OPENCODE_CLIENT                         # cli, app, desktop
OPENCODE_EXPERIMENTAL_LSP_TOOL          # enable LSP tool
OPENCODE_EXPERIMENTAL_PLAN_MODE         # enable plan mode
OPENCODE_EXPERIMENTAL_BASH_DEFAULT_TIMEOUT_MS
OPENCODE_ENABLE_QUESTION_TOOL
OPENCODE_ENABLE_EXA                     # enable web search
OPENCODE_DISABLE_EXTERNAL_SKILLS
```

### Model Selection
Models are configured via string format `"provider/model"` and resolved via the `Provider` module. The project fetches model definitions from https://github.com/anomalyco/models.dev.

---

## 16. LSP Integration

### Architecture (`lsp/index.ts`)
OpenCode runs **actual LSP servers** as child processes and communicates via JSON-RPC. This is a major differentiator from other coding agents.

### Server Registry (`lsp/server.ts` - 65KB)
Contains definitions for many language servers:
- TypeScript (tsserver/tsgo)
- Python (pyright, ty)
- Go (gopls)
- Rust (rust-analyzer)
- And many more

### Client Implementation (`lsp/client.ts`)
Manages the JSON-RPC connection:
```typescript
LSPClient.create({ serverID, server, root })
// Methods: diagnostics, hover, definition, references, implementation
// Notifications: open, close, didChange
```

### LSP Tool (`tool/lsp.ts`)
Exposes LSP capabilities to the agent as a tool:
- Get diagnostics for edited files
- Symbol search
- Go to definition
- Find references

### Automatic Diagnostics
After file edits, the edit tool automatically:
1. Notifies the LSP server of the change
2. Waits for diagnostics
3. Includes error/warning info in the tool result

### Custom LSP Configuration
Users can add custom LSP servers in config:
```json
{
  "lsp": {
    "my-lsp": {
      "command": ["my-lsp-server", "--stdio"],
      "extensions": [".myext"],
      "env": { "MY_VAR": "value" }
    }
  }
}
```

---

## 17. Diff/Patch System

### Two Approaches

**1. String Replace (Edit Tool)** - Default for Claude and most models:
```typescript
// tool/edit.ts
parameters: z.object({
  file_path: z.string(),
  old_string: z.string(),
  new_string: z.string(),
  replaceAll: z.boolean().optional(),
})
```
Simple find-and-replace. Requires `old_string` to be unique. 21KB of implementation handles edge cases, LSP notifications, and snapshots.

**2. Apply Patch (for GPT models)** - A custom diff format:
```
*** Begin Patch
*** Update File: src/app.py
*** Move to: src/main.py
@@ def greet():
-print("Hi")
+print("Hello, world!")
*** End Patch
```

Selected automatically based on model:
```typescript
const usePatch = model.modelID.includes("gpt-") && !model.modelID.includes("oss") && !model.modelID.includes("gpt-4")
if (t.id === "apply_patch") return usePatch
if (t.id === "edit" || t.id === "write") return !usePatch
```

### Patch Module (`patch/index.ts` - 20KB)
The `src/patch/` module handles:
- Parsing the custom patch format
- Applying patches with fuzzy matching
- Supporting file creation, deletion, and rename
- Context-line matching (lines starting with space or `@@ `)

### Snapshot System
Uses git to track file changes per step:
```typescript
Snapshot.track()        // creates a git stash/commit point
Snapshot.patch(hash)    // computes diff since snapshot
// Returns: { hash, files: [{ path, additions, deletions }] }
```

---

## Key Architectural Takeaways

### What OpenCode Does Well

1. **Provider-agnostic**: Supports 15+ AI providers via Vercel AI SDK adapters
2. **LSP integration**: Real code intelligence, not just text search - huge quality advantage
3. **Permission system**: Granular, pattern-based, with "always allow" escalation
4. **Compaction**: Sophisticated context management with pruning + summarization
5. **Plugin system**: Extensible via hooks (`chat.params`, `tool.definition`, `shell.env`)
6. **Skill interop**: Compatible with Claude Code skills (`.claude/skills/`)
7. **Client/server split**: TUI is just one client; API is headless
8. **Model-adaptive tools**: Different edit tools for different models
9. **Tree-sitter bash parsing**: Permission patterns are extracted from AST, not regex
10. **Snapshot/revert**: Every step has a git snapshot for safe rollback

### Architecture Patterns Worth Adopting

| Pattern | Implementation | Benefit |
|---------|---------------|---------|
| Tool `.txt` descriptions | Separate file per tool description | Easy to iterate on prompts |
| `Tool.define()` factory | Zod schema + init function | Type-safe, lazy initialization |
| Agent as config | Agents defined as permission rulesets | Composable, user-configurable |
| Doom loop detection | Compare last N tool calls | Prevents infinite loops |
| Output truncation | Write to temp file, return path | Handles massive outputs gracefully |
| Part-based messages | Messages composed of typed parts | Rich streaming, fine-grained updates |
| Snapshot per step | Git-based tracking | Safe rollback, diff visualization |
| Two-stage compaction | Prune old tool outputs + LLM summary | Efficient context management |

### Differences from Our Agent Pack

1. **Not Go, it's TypeScript** - Full Bun/TypeScript stack, not the Go codebase we assumed
2. **SolidJS TUI, not Bubble Tea** - Uses [opentui](https://github.com/sst/opentui) for terminal rendering
3. **Vercel AI SDK, not raw HTTP** - Handles streaming, tool calling, multi-provider via `ai` package
4. **Effect library** - Heavy use of Effect for dependency injection and async error handling
5. **SQLite via Drizzle** - Full relational storage for sessions, messages, parts
6. **Event bus architecture** - Decoupled communication between server components
7. **Plugin API** - `@opencode-ai/plugin` package for third-party extensions
