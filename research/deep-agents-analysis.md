# Deep Agents — Architecture Analysis

> Source: https://github.com/langchain-ai/deepagents
> ~15k stars, MIT licensed, built on LangGraph by LangChain
> Self-described as "inspired by Claude Code"

---

## 1. Agent Loop Architecture

**Pattern: LangGraph ReAct loop via `create_agent()`**

Deep Agents does NOT implement its own agent loop. It delegates entirely to LangChain's `create_agent()` which builds a LangGraph `CompiledStateGraph`. The loop is a standard ReAct pattern:

1. LLM generates text + tool calls
2. Tools execute and return results
3. Results fed back to LLM
4. Repeat until LLM responds with no tool calls

**Key architectural decision**: Everything is a middleware. The `create_deep_agent()` function assembles a stack of middleware layers that wrap around the core `create_agent()`:

```python
# Middleware stack order (from graph.py):
deepagent_middleware = [
    TodoListMiddleware(),           # 1. Planning
    MemoryMiddleware(...),          # 2. Persistent memory (AGENTS.md)
    SkillsMiddleware(...),          # 3. Skills system
    FilesystemMiddleware(...),      # 4. File operations + execution
    SubAgentMiddleware(...),        # 5. Task delegation
    SummarizationMiddleware(...),   # 6. Context window management
    AnthropicPromptCachingMiddleware(...),  # 7. Provider optimization
    PatchToolCallsMiddleware(),     # 8. Dangling tool call repair
]
```

Each middleware can:
- Add tools to the agent
- Inject text into the system prompt (via `wrap_model_call`)
- Run code before/after the agent step (via `before_agent`)
- Modify the model request/response
- Extend the agent state schema

**Recursion limit**: Set to 1000 iterations, allowing very long agent runs.

**Takeaway**: The middleware pattern is extremely composable. Each concern (files, planning, subagents, summarization) is isolated in its own middleware class with its own state schema. This is a much cleaner architecture than having a monolithic agent class.

---

## 2. Tool System

**Definition**: Tools are defined as `StructuredTool` instances using `StructuredTool.from_function()`. Each tool provides both sync and async implementations:

```python
return StructuredTool.from_function(
    name="ls",
    description=tool_description,
    func=sync_ls,
    coroutine=async_ls,
)
```

**Parameter schema**: Uses Python type annotations with `Annotated` for descriptions:

```python
def sync_ls(
    runtime: ToolRuntime[None, FilesystemState],
    path: Annotated[str, "Absolute path to the directory to list. Must be absolute, not relative."],
) -> str:
```

**Tool runtime**: Every tool receives a `ToolRuntime` object providing:
- `runtime.state` — current agent state (files, todos, etc.)
- `runtime.tool_call_id` — for correlating responses
- `runtime.store` — persistent store access
- `runtime.config` — runtime configuration
- `runtime.stream_writer` — for streaming output

**Return types**: Tools can return:
- `str` — simple text result
- `ToolMessage` — rich content (images, structured data)
- `Command` — state mutations (file writes, todo updates) via LangGraph's Command pattern

**Tool result eviction**: When a tool result exceeds `tool_token_limit_before_evict` (default 20k tokens), the result is:
1. Saved to the filesystem at `/large_tool_results/`
2. Replaced with a truncated preview showing head + tail
3. Agent can use `read_file` to paginate through the saved result

Certain tools are excluded from eviction: `ls`, `glob`, `grep` (they self-truncate), `read_file` (would cause infinite loops), `edit_file`/`write_file` (small results).

**Built-in tools**: `ls`, `read_file`, `write_file`, `edit_file`, `glob`, `grep`, `execute`, `task`, `write_todos`, `compact_conversation`

**Takeaway**: The `Command` return pattern for state mutations is clever — it lets tools update state without side effects, making the system deterministic and checkpointable.

---

## 3. Subagent / Delegation

**Two types of subagents**:

### Synchronous (local) — `SubAgentMiddleware`

- Exposed as a `task` tool with `description` and `subagent_type` parameters
- Each subagent is a full `create_agent()` graph with its own middleware stack
- Subagents get isolated context: only the task description as a `HumanMessage`
- State is filtered — `messages`, `todos`, `structured_response`, `skills_metadata`, `memory_contents` are excluded from subagent state
- Only the **final message** from the subagent is returned to the parent
- A `general-purpose` subagent is always included by default (same tools as parent)

```python
# Subagent invocation (from subagents.py):
subagent_state = {k: v for k, v in runtime.state.items() if k not in _EXCLUDED_STATE_KEYS}
subagent_state["messages"] = [HumanMessage(content=description)]
result = subagent.invoke(subagent_state)
# Only final message returned:
message_text = result["messages"][-1].text.rstrip()
```

### Asynchronous (remote) — `AsyncSubAgentMiddleware`

- Runs on remote LangGraph servers via the LangGraph SDK
- 5 tools: `launch_async_subagent`, `check_async_subagent`, `update_async_subagent`, `cancel_async_subagent`, `list_async_subagent_jobs`
- Non-blocking: returns job ID immediately, agent continues working
- Jobs tracked in state with `_jobs_reducer` for merging updates
- Supports sending updates to running jobs (interrupts and restarts on same thread)
- Terminal statuses (`cancelled`, `success`, `error`, `timeout`, `interrupted`) skip live status fetches

**Critical prompt engineering for subagents**: The system prompt includes extensive examples of when to use and NOT use subagents, with concrete scenarios. Key rules:
- Parallelize independent tasks as concurrent subagent calls
- Use for complex multi-step work that benefits from isolated context
- Don't use for trivial tasks (few tool calls)
- Results are NOT visible to the user — parent must summarize

**Takeaway**: The two-tier subagent model (sync local + async remote) is a strong pattern. The sync model is great for context isolation, while async enables long-running distributed workflows. The state exclusion logic prevents context leakage between parent and child.

---

## 4. Planning (Todos)

**Implementation**: Via `TodoListMiddleware` (from `langchain.agents.middleware`). Exposed as a `write_todos` tool.

The tool is referenced in `create_deep_agent()` as the first middleware in the stack, meaning todos are always available.

The base system prompt instructs the agent on planning behavior:
- "Understand first — read relevant files, check existing patterns"
- "Act — implement the solution"
- "Verify — check your work against what was asked"

**Takeaway**: Planning is treated as a first-class middleware rather than baked into the prompt. The `TodoListMiddleware` from langchain handles the state management, making it reusable across different agent configurations.

---

## 5. Session / Context Management

**Automatic summarization** (`SummarizationMiddleware`):

Trigger conditions (configurable):
- Token-based: `("tokens", 170000)` — when messages exceed token count
- Fraction-based: `("fraction", 0.85)` — when 85% of context window used
- Message-count: `("messages", N)`

When triggered:
1. Messages are partitioned into "to summarize" and "to keep"
2. Messages to summarize are offloaded to `/conversation_history/{thread_id}.md`
3. An LLM call generates a summary of the evicted messages
4. Summary replaces evicted messages as a `HumanMessage` with `lc_source='summarization'`
5. The summary includes a reference to the offloaded file

```python
content = f"""You are in the middle of a conversation that has been summarized.
The full conversation history has been saved to {file_path} should you need to refer back to it for details.
A condensed summary follows:
<summary>
{summary}
</summary>"""
```

**Argument truncation** (pre-summarization optimization):
- Before full summarization kicks in, large tool-call arguments (e.g., `write_file` content, `edit_file` patches) in older messages are truncated to `max_length` (default 2000 chars)
- Only `write_file` and `edit_file` args are truncated
- Recent messages are always preserved

**Compact conversation tool**: An explicit `compact_conversation` tool lets the agent (or user) trigger context compaction on demand, useful when switching tasks.

**Context overflow recovery**: If the model call raises `ContextOverflowError`, the middleware automatically falls back to summarization and retries.

**Chained summarization**: When summarization happens multiple times, previous summary messages are filtered from offloading to avoid redundant storage.

**Model-aware defaults**:
```python
# Models with profile (known context window):
trigger=("fraction", 0.85), keep=("fraction", 0.10)

# Models without profile:
trigger=("tokens", 170000), keep=("messages", 6)
```

**Takeaway**: The three-tier approach (argument truncation → auto-summarization → manual compaction) is well thought out. The fraction-based triggers are model-aware, and the filesystem offloading means nothing is truly lost.

---

## 6. Permission System / Human-in-the-Loop

**Model**: "Trust the LLM" — the agent can do anything its tools allow. Security is enforced at the tool/sandbox level.

**Human-in-the-loop** (CLI only):
- Configurable per tool via `interrupt_on`:
  ```python
  interrupt_on={"edit_file": True}
  ```
- Uses LangGraph's `HumanInTheLoopMiddleware` + `InterruptOnConfig`
- Requires a checkpointer (for state persistence during approval wait)

**Sandbox execution**: The `execute` tool only works if the backend implements `SandboxBackendProtocol`. The default `StateBackend` does NOT support execution — you need a sandbox backend (Docker, remote, etc.)

**Timeout enforcement**: `max_execute_timeout` defaults to 3600s (1 hour). Per-command timeouts that exceed this are rejected.

**Takeaway**: The security model is pragmatic — rather than trying to make the LLM self-police, enforce boundaries at the infrastructure level. The per-tool interrupt config is a clean API for approval workflows.

---

## 7. Streaming

Deep Agents returns a `CompiledStateGraph` (LangGraph), which natively supports streaming:
- `agent.stream()` — stream events (tool calls, messages, state changes)
- `agent.astream()` — async streaming
- Studio integration — works with LangGraph Studio for visual debugging

The CLI adds a "rich terminal interface with streaming responses" on top.

Each tool runtime includes a `stream_writer` for tools that want to stream partial results.

**Takeaway**: Streaming is handled by the LangGraph runtime, not by Deep Agents itself. This is a good separation of concerns.

---

## 8. Error Handling & Retries

**Dangling tool calls** (`PatchToolCallsMiddleware`):
When a message is interrupted mid-tool-call (e.g., user sends a new message), orphaned tool calls get patched with a synthetic `ToolMessage`:

```python
tool_msg = f"Tool call {tool_call['name']} with id {tool_call['id']} was "
           "cancelled - another message came in before it could be completed."
```

This runs as `before_agent`, ensuring the LLM always sees paired tool_call → tool_result messages.

**Context overflow**: `SummarizationMiddleware` catches `ContextOverflowError` and automatically falls back to summarization + retry.

**Backend errors**: All backend operations return structured result types (`ReadResult`, `WriteResult`, `EditResult`, etc.) with an `error` field. Tools check this and return user-friendly error messages.

**File operation guards**:
- `write_file` errors if file already exists (must use `edit_file`)
- `edit_file` errors if file hasn't been read first
- `edit_file` errors if `old_string` is not unique (unless `replace_all=True`)
- Path validation rejects relative paths (must start with `/`)

**Takeaway**: The `PatchToolCallsMiddleware` solving dangling tool calls is particularly clever — it's a common failure mode in agentic systems where interruptions can corrupt the message history.

---

## 9. Prompt Engineering

**Base system prompt** (`BASE_AGENT_PROMPT` in `graph.py`):

Key principles:
- "Be concise and direct. Don't over-explain unless asked."
- "NEVER add unnecessary preamble ('Sure!', 'Great question!', 'I'll now...')"
- "Don't say 'I'll now do X' — just do it."
- "Prioritize accuracy over validating the user's beliefs"
- "If something fails repeatedly, stop and analyze *why*"

**Prompt composition**: The system prompt is built by layering:
1. User-provided `system_prompt` (prepended)
2. `BASE_AGENT_PROMPT` (core behavior)
3. `FILESYSTEM_SYSTEM_PROMPT` (file tool instructions)
4. `EXECUTION_SYSTEM_PROMPT` (shell tool instructions)
5. `TASK_SYSTEM_PROMPT` (subagent instructions with examples)
6. `SKILLS_SYSTEM_PROMPT` (available skills)
7. `MEMORY_SYSTEM_PROMPT` (loaded AGENTS.md content)
8. `SUMMARIZATION_SYSTEM_PROMPT` (compact_conversation tool)

Each middleware injects its section via `append_to_system_message()`.

**Notable prompt patterns**:

- Task tool uses XML-like tags for examples: `<correct_usage>`, `<incorrect_usage>`, `<reasoning>`
- Memory prompt teaches the agent when to save vs. not save (very specific examples)
- File tool instructs pagination: "First scan: read_file(path, limit=100)"
- Execute tool forbids using `cat`, `grep`, `find` (should use built-in tools instead)

**Takeaway**: The modular prompt composition via middleware is much more maintainable than a single monolithic prompt. Each middleware owns its own prompt section and can be added/removed independently.

---

## 10. Code Quality & Organization

**Repository structure**:
```
libs/
├── deepagents/        # Core SDK (Python)
│   └── deepagents/
│       ├── graph.py            # create_deep_agent() entry point
│       ├── _models.py          # Model resolution
│       ├── backends/           # File storage backends
│       │   ├── protocol.py     # BackendProtocol ABC
│       │   ├── state.py        # StateBackend (ephemeral)
│       │   ├── filesystem.py   # FilesystemBackend (disk)
│       │   ├── composite.py    # Route-based multi-backend
│       │   └── utils.py        # Shared utilities
│       └── middleware/         # All capabilities as middleware
│           ├── filesystem.py   # File + execute tools
│           ├── subagents.py    # Sync task delegation
│           ├── async_subagents.py  # Remote async delegation
│           ├── summarization.py    # Context management
│           ├── memory.py       # AGENTS.md loading
│           ├── skills.py       # SKILL.md system
│           └── patch_tool_calls.py # Dangling call repair
├── cli/               # Terminal UI
└── (deepagentsjs)     # JS/TS version (separate repo)
```

**Patterns used**:
- Protocol/ABC pattern for backends (pluggable storage)
- Middleware pattern for agent capabilities (composable)
- Factory pattern for backends (lazy initialization from runtime)
- TypedDict for structured config (SubAgent, CompiledSubAgent, SkillMetadata)
- Dataclass for result types (ReadResult, WriteResult, etc.)
- Annotated types for tool parameter schemas
- Command pattern (LangGraph) for state mutations

**Quality indicators**:
- Comprehensive docstrings with examples
- Type hints everywhere (mypy/pyright compatible)
- Both sync and async implementations for all tools
- Deprecation warnings for API evolution
- Logging throughout (not print statements)
- Tests in separate test directory

---

## 11. File Operations

**Tools**: `ls`, `read_file`, `write_file`, `edit_file`, `glob`, `grep`

**Backend abstraction** (`BackendProtocol`):
All file operations go through a backend that can be:
- `StateBackend` — ephemeral, stored in LangGraph agent state
- `FilesystemBackend` — persistent, reads/writes to disk
- `CompositeBackend` — route-based (e.g., `/memories/` to store, everything else to state)
- Custom sandbox backends (Docker, remote)

**Read file features**:
- Pagination via `offset`/`limit` (default: 100 lines from start)
- Line numbers in `cat -n` format (for edit correlation)
- Long lines (>5000 chars) split with continuation markers (5.1, 5.2, etc.)
- Image support: `.png/.jpg/.jpeg/.gif/.webp` returned as multimodal content blocks
- Empty file detection with system warning

**Edit file features**:
- Exact string replacement (old_string → new_string)
- Must read before editing (enforced)
- `replace_all` option for bulk replacements
- Uniqueness check (old_string must be unique unless replace_all)

**Write file features**:
- Creates new files only (errors if file exists)
- Returns `Command` for state-backed writes

**Takeaway**: The backend abstraction is the most powerful pattern here. It decouples the agent tools from storage, allowing the same tools to work with in-memory state (for testing), local filesystem (for development), or remote sandboxes (for production).

---

## 12. Terminal / Shell Execution

**Tool**: `execute` — only available when backend implements `SandboxBackendProtocol`

**Timeout handling**:
- Default timeout from backend
- Per-command timeout via `timeout` parameter
- Max timeout enforced: `max_execute_timeout` (default 3600s)
- `timeout=0` may disable timeouts on supporting backends
- Introspection check: `execute_accepts_timeout()` verifies backend supports timeout kwarg

**Result format** (`ExecuteResponse`):
```python
@dataclass
class ExecuteResponse:
    output: str          # Combined stdout + stderr
    exit_code: int | None
    truncated: bool      # Whether output was truncated
```

**Prompt instructions** for execute:
- Forbids `cat`, `head`, `tail` (use `read_file`)
- Forbids `find`, `grep` shell commands (use `glob`, `grep` tools)
- Requires absolute paths
- Commands chained with `&&` or `;`, not newlines
- Must verify directories exist before creating files

**Takeaway**: The execute tool is intentionally limited to prevent the LLM from bypassing the structured file tools. This ensures all file operations go through the tracked backend.

---

## 13. UI/UX (CLI)

The CLI (`deepagents-cli`) adds:
- **Rich terminal interface** with streaming responses
- **Conversation resume** — pick up across sessions
- **Web search** — ground in live information
- **Remote sandboxes** — LangSmith, Daytona, Modal, Runloop
- **Persistent memory** — agent remembers across conversations
- **Custom skills** — slash commands
- **Headless mode** — for scripting and CI
- **Human-in-the-loop** — approve/reject tool calls

The CLI is a separate package (`deepagents-cli`) from the SDK (`deepagents`).

---

## 14. Configuration

**Entry point**: `create_deep_agent()` with these options:

```python
create_deep_agent(
    model="openai:gpt-4o",          # Provider:model format
    tools=[my_tool],                 # Custom tools (added to built-ins)
    system_prompt="You are...",      # Prepended to base prompt
    middleware=[...],                # Additional middleware
    subagents=[...],                 # Sync subagent specs
    async_subagents=[...],           # Remote async subagent specs
    skills=["/skills/user/"],        # Skill source paths
    memory=["/memory/AGENTS.md"],    # Memory file paths
    response_format=...,             # Structured output
    checkpointer=...,               # State persistence
    store=...,                       # Persistent key-value store
    backend=...,                     # File storage backend
    interrupt_on={"edit_file": True}, # Human-in-the-loop
    debug=True,                      # Debug mode
    name="my-agent",                 # Agent name
    cache=...,                       # Response cache
)
```

**Model resolution**: Strings in `provider:model` format auto-resolved via `init_chat_model()`. OpenAI models default to Responses API.

**Default model**: `claude-sonnet-4-6` (Anthropic).

---

## Key Takeaways for Unstoppable Stack

### Architecture patterns to adopt:

1. **Middleware pattern for capabilities** — Instead of a monolithic agent, compose capabilities as independent middleware that inject tools + prompt sections. This would work well for our agent pack's modular design.

2. **Backend abstraction for file operations** — The `BackendProtocol` pattern decouples tools from storage. We could use this for P2P file operations (Hyperdrive as a backend, HyperDB as another).

3. **Subagent context isolation** — The state filtering (`_EXCLUDED_STATE_KEYS`) and clean message handoff pattern is worth copying. Only the task description goes in, only the final result comes out.

4. **Tool result eviction** — When tool results are too large, save to filesystem and replace with a preview + file reference. Critical for agents working with large P2P datasets.

5. **Dangling tool call repair** — The `PatchToolCallsMiddleware` pattern of patching orphaned tool calls prevents a whole class of errors.

6. **Prompt composition via middleware** — Each middleware owns its own system prompt section. Much better than a single monolithic prompt file.

7. **Three-tier context management** — Argument truncation → auto-summarization → manual compaction. Progressive degradation as context grows.

8. **Command pattern for state mutations** — Tools return `Command` objects for state changes rather than mutating state directly. Makes the system deterministic and checkpointable.

### Specific implementation ideas:

- **P2P Backend**: Implement `BackendProtocol` for Hyperdrive/HyperDB, giving agents P2P file access with the same tool interface
- **Skill system**: Their SKILL.md format (YAML frontmatter + markdown) is exactly what we already use — validates our approach
- **Memory system**: AGENTS.md loading with edit-to-learn pattern could be adapted for persistent P2P agent memory
- **Model agnosticism**: The `provider:model` string format with `init_chat_model()` is a clean API for supporting multiple LLM providers
