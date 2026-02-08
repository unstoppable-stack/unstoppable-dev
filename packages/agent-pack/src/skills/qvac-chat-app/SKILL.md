---
name: qvac-chat-app
description: Build a complete QVAC chat app with tool calling, context management, and streaming
allowed-tools: Read, Grep, Edit, Write, Bash(npm *), Bash(pnpm *)
---

# QVAC Chat App (End-to-End)

## When to Use
- User wants to build a chat application with local AI
- User mentions "chatbot", "AI assistant", "conversational agent"
- User needs a complete working QVAC app with tool calling
- User wants an AI agent that can call functions and manage context

## Prerequisites
- Node.js 20+ with ESM support
- `@qvac/sdk` (`^0.6.0`) and `zod` (`^4.0.0`) installed

> **CRITICAL — Pear Desktop Apps:** `@qvac/sdk` CANNOT run in the renderer
> (browser context). It MUST run in a **worker process** started via `pear-run`.
> The UI communicates with the worker via NDJSON over `Pear.worker.pipe()`.
> See the `pear-desktop-app` skill → `resources/worker-pattern.md` for the
> full worker bridge implementation and a complete AI chat worker example.

## Steps

1. **Install dependencies**:
   ```bash
   pnpm add @qvac/sdk zod@^4
   pnpm add -D typescript @types/node tsx
   ```
   > **IMPORTANT**: Install Zod v4 (not v3) for `ToolInput` type compatibility.

2. **Set up TypeScript** — use `moduleResolution: "Bundler"` with `tsx`

3. **Define tools** with `ToolInput` (Zod schemas + handlers)

4. **Load model with `tools: true`** — REQUIRED for tool calling

5. **Implement the tool-calling loop** with parallel stream processing

6. **Configure context management** — `kvCache` session key + `n_discarded` sliding window

7. **Add token filtering** — strip `<tool_call>` blocks from visible output

8. **Handle Qwen 3 `<think>` tokens** — filter or suppress with `/no_think`

9. **Add graceful shutdown** — `unloadModel()` + `deleteCache()`

## Quick Implementation

See `resources/full-example.md` for a complete working app.

## Key Architecture Decisions

### `tools: true` is REQUIRED

**Always set `modelConfig.tools: true`** when using tool-calling models. This
activates the model's native tool-calling template. The model can still generate
free text — it is NOT constrained to JSON-only output.

Without `tools: true`, the model describes tool usage in plain text instead of
actually calling tools. This is the #1 cause of "tool calling doesn't work."

> **Do NOT create a "respond" or "reply" tool.** The model generates free text
> naturally with `tools: true` enabled.

### Model Selection
- `QWEN_3_1_7B_INST_Q4` — best for tool calling (7B, ~4GB)
- `QWEN_3_4B_INST_Q4_K_M` — good balance of quality and size (4B, ~2.5GB)
- Do NOT use 1B models for tool calling — unreliable

### Context Management
- Set `ctx_size`, `n_discarded`, and `tools: true` in `modelConfig` at **load time**
- **`completion()` does NOT accept `modelConfig`**
- `n_discarded: Math.floor(ctx_size / 10)` — 10% sliding window (matches workbench)
- Use `kvCache: sessionId` in `completion()` with a stable session key
- Call `deleteCache()` when the session ends

### Streaming & Token Filtering
- Process `tokenStream` and `toolCallStream` in **parallel** via `Promise.all`
- Filter `<tool_call>` blocks from the visible token stream
- Use `toolCallStream` for real-time "calling X..." UI feedback

### Prompt Engineering
- Embed reference data in the system prompt (don't use tools to fetch static data)
- Add `/no_think` to suppress Qwen 3 reasoning tokens
- Keep tool count low (each tool increases complexity)
- Structure system prompts with clear headers and rules

## Key Gotchas
- **Always set `tools: true` in `modelConfig`** — without it, tools silently don't work
- **Do NOT create a "respond" tool** — the model generates free text naturally
- Install `zod@^4`, not v3
- Only use verified model constants from `@qvac/sdk` (see model guide)
- **`completion()` does NOT accept `modelConfig`** — set everything at load time
- `n_discarded` (set at load time) eliminates need for manual history trimming
- Filter `<tool_call>` blocks from streaming output (use `createTokenFilter()`)
- Process `tokenStream` and `toolCallStream` in parallel, not sequentially
- Think tokens count against context window even when filtered
- Always `unloadModel()` and `deleteCache()` on shutdown

## Deep Dive
- Complete working example: read `resources/full-example.md`
- Troubleshooting: read `resources/troubleshooting.md`
