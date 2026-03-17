# Unstoppable Agent — Status

**Phase:** 1 (POC)
**Status:** Architecture complete, output quality limited by model
**Last updated:** 2026-03-17

## Summary

The agent has a working agentic loop with planning, multi-step execution, tool calling, skill integration, and a `/learn` reflection command. The architecture is solid. However, output quality with DeepSeek-Coder-V2-Lite (16B) is poor — the model makes coding errors, hallucinates APIs, and struggles with multi-step reasoning.

The core bet: this architecture will produce good results once paired with a capable local model (30B+ coding model). The 16B model validates that the plumbing works end-to-end.

## What's Implemented

### Core Agent Loop
- [x] ReAct loop with plan → execute → verify → summarize workflow
- [x] Continuation injection after every tool round (prevents early stop)
- [x] Incomplete response detection (pushes model to keep going)
- [x] Budget pressure at 70%/90% of tool rounds (Hermes pattern)
- [x] Loop detection (stops after 2 identical consecutive calls)
- [x] Text buffering per round (suppresses hallucinated tool tags)

### Provider
- [x] OpenAI-compatible HTTP streaming (SSE)
- [x] Tool call accumulation from stream deltas
- [x] SSE error event handling (LM Studio)
- [x] Health check with timeout

### Tool System (17 tools total)
- [x] File tools: read, write, patch, list, search (5)
- [x] Terminal: shell execution with timeout, auto-creates workdir (1)
- [x] Skill tools: list, view, resources — read-only (3)
- [x] Memory tools: read, write persistent MEMORY.md (2)
- [x] Knowledge tools: module docs, recipes, core docs (3)
- [x] Skill CRUD: create, edit, add_resource — behind /learn (3)
- [x] Toolset-based filtering (excluded toolsets, per-message)
- [x] Toolset lookup via registry

### Fallback Tool Call Parsing
- [x] DeepSeek `<｜tool▁calls▁begin｜>` format
- [x] XML `<tool_call>` format
- [x] Raw JSON `{"name":"...","arguments":{...}}` format
- [x] JSON repair for incomplete responses

### System Prompt
- [x] Compact mode for small context windows
- [x] Full mode with detailed guidelines
- [x] Dynamic tool listing
- [x] Dynamic skill listing
- [x] Project context loading (CLAUDE.md, README.md, package.json)
- [x] Module detection and skill suggestions
- [x] Persistent memory integration
- [x] Skill adaptation warning (don't copy internal paths)

### Session Management
- [x] History management with max message limit
- [x] Tool call/result pair preservation during trimming
- [x] Session save/load

### UI
- [x] Interactive terminal with readline
- [x] Multi-line input (triple backtick toggle)
- [x] /help, /tools, /skills, /learn, /model, /clear, /save, /compact, /exit
- [x] Single-message mode (-c flag) with tool event output
- [x] Streaming text output with think block filtering

### /learn (Reflection Mode)
- [x] Reviews session history
- [x] Temporarily enables skill CRUD tools
- [x] Sends reflection prompt for pattern extraction
- [x] Auto-disables CRUD after completion

## Known Issues

### Model Quality (Primary Blocker)
- DeepSeek-Coder-V2-Lite produces poor code (wrong vars, missing imports)
- Model doesn't understand the relationship between npm install and running code
- Error recovery often introduces new errors instead of fixing the original
- Model hallucinates non-existent packages (commander-cli, etc.)
- Context fills up with error output, degrading quality in later rounds

### Context Window
- LM Studio defaults to 4096 context — our prompt alone needs ~3K tokens
- Must manually increase in LM Studio settings
- No automatic context negotiation

### Continuation Injection Side Effects
- Sometimes causes model to repeat the same step
- Can lead to "echo loops" where the model summarizes the continuation message
- The "Continue" messages eat into context budget

## Recently Completed (2026-03-17)

1. **Agentic loop** — Plan/Execute/Verify/Summarize workflow with continuation injection
2. **SSE error handling** — Catches LM Studio `event: error` responses
3. **Compact system prompt** — Fits in 4K context window
4. **DeepSeek format support** — Parses proprietary tool call tags
5. **Text buffering** — Suppresses hallucinated tool output during intermediate rounds
6. **Loop detection** — Stops infinite tool call repeats
7. **Skill CRUD isolation** — Moved behind /learn to prevent confusion
8. **Updated add-ai-chat skill** — Uses actual @qvac/sdk imports instead of internal paths
9. **Auto-create workdir** — Terminal tool creates directories as needed
10. **Budget pressure** — Warns model at 70%/90% of tool rounds

## Next Up

1. **Test with better model** — Qwen3-Coder-30B or similar 30B+ coding model (High priority)
   - This is the single most impactful next step
   - Everything else is architecture work on top of a model that can't code well
   - Effort: Small (just need hardware + model download)

2. **Context compression** — Summarize middle turns to free up context (Medium)
   - Critical for multi-step tasks that generate lots of tool output
   - Hermes pattern: summarize rounds 2-N, keep first and last

3. **QVAC provider** — Native @qvac/sdk as second provider (Medium)
   - For P2P deployments where LM Studio isn't available
   - Blocked on QVAC having good coding models

4. **Post-session sub-agent** — Auto-propose skills after task completion (Medium)
   - Instead of manual /learn, run automatically when session ends
   - Use a separate (possibly different) model for reflection

5. **P2P skill sharing** — HyperDB for shared skills (Large)
   - Publish approved skills to a P2P network
   - Other agents can discover and sync skills
   - The "autoresearch" distributed learning vision

## Architecture Notes for Future Development

### Adding a new provider
1. Implement the `stream()`, `listModels()`, `healthCheck()` interface
2. Add to `providers/index.ts` factory
3. Add provider type to `ProviderConfig` in `types.ts`

### Adding a new tool
1. Create handler in `tools/` following the `ToolHandler` interface
2. Register in `index.ts` with `registry.registerAll()`
3. Choose appropriate toolset name

### Adding a new command
1. Add to `COMMANDS` dict in `ui/terminal.ts`
2. Add handler in `handleCommand()` switch
