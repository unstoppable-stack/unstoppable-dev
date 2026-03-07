---
name: add-ai-chat
description: Add local AI inference using QVAC SDK with streaming chat,
  context management, and optional tool calling. Use when the user wants
  to add AI capabilities — chatbot, assistant, function calling, or any
  LLM-powered feature. This is the core AI skill.
---

# Add AI Chat (QVAC)

## When to Use
- User wants local AI inference (chat, assistant, agent)
- User mentions "AI", "LLM", "model", "inference", "chatbot", or "tool calling"
- User needs offline AI capabilities without cloud APIs

## Prerequisites
- `@qvac/sdk` (`^0.7.0`) and `zod` (`^4.0.0`) installed
- Supported runtime: Node.js, Bare, or physical device for Expo

> **CRITICAL — Pear Desktop Apps:** `@qvac/sdk` CANNOT run in the renderer
> (browser context). It MUST run in a **worker process** started via `pear-run`.
> The UI communicates with the worker via NDJSON over `Pear.worker.pipe()`.
> See the `setup-pear-desktop` skill → `resources/worker-pattern.md` for the
> full worker bridge implementation.

## Included Components

Your project includes battle-tested components in `src/ai/`:

- **`src/ai/model-manager.ts`** — Load/unload models with progress, context config, memory cleanup
- **`src/ai/chat-session.ts`** — Streaming chat with KV cache, history trimming, `<think>` filtering
- **`src/ai/tool-runner.ts`** — Tool-calling loop with Zod schemas and error handling

## Steps

1. **Install dependencies**:
   ```bash
   pnpm add @qvac/sdk zod@^4
   ```
   > **IMPORTANT**: Install Zod v4 (not v3) — `@qvac/sdk` depends on Zod v4 internally.

2. **Choose the right model** (verified constants from `@qvac/sdk@0.7.0`):

   | Use Case | Model Constant | Size |
   |----------|---------------|------|
   | Tool calling (best) | `QWEN_3_1_7B_INST_Q4` | ~4GB |
   | Tool calling (lighter) | `QWEN_3_4B_INST_Q4_K_M` | ~2.5GB |
   | Tool calling (small) | `LLAMA_TOOL_CALLING_3_2_1B_INST_Q4_K` | ~1GB |
   | General chat (small) | `LLAMA_3_2_1B_INST_Q4_0` | ~1GB |
   | General chat (quality) | `SALAMANDRATA_2B_INST_Q8` | ~2GB |
   | Mobile (tiny) | `QWEN3_0_6B_INST` | ~0.5GB |

   > **IMPORTANT**: Only use model constants listed above. `QWEN_2_5_*` and `QWEN_2_5_CODER_*` do NOT exist in `@qvac/sdk@0.7.0`. The SDK exports Qwen 3 models.

3. **Use the included components**:
   ```ts
   import { ModelManager } from './ai/model-manager.js'
   import { ChatSession } from './ai/chat-session.js'
   ```

4. **Wire into your app**:
   ```ts
   const model = new ModelManager({
     onProgress: (p) => console.log(`${p.percentage.toFixed(1)}%`),
   })
   await model.load()

   const chat = new ChatSession({
     modelId: model.id,
     systemPrompt: 'You are a helpful assistant.',
     sessionId: 'main',
   })

   for await (const token of chat.send('Hello!')) {
     process.stdout.write(token)
   }

   await model.destroy()  // always cleanup
   ```

---

## Tool Calling (Optional)

If your app needs the LLM to call local functions:

### Enable `tools: true`

**Always set `modelConfig.tools: true`** when using tool-calling models. This
activates the model's native tool-calling template. The model can still generate
free text — it is NOT constrained to JSON-only output.

```ts
const modelId = await loadModel({
  modelSrc: QWEN_3_1_7B_INST_Q4,
  modelType: 'llm',
  modelConfig: {
    ctx_size: 4096,
    n_discarded: Math.floor(4096 / 10),
    tools: true, // REQUIRED for tool calling
  },
})
```

Without `tools: true`, the model describes tool usage in plain text instead of
actually calling them. This is the #1 cause of "tool calling doesn't work."

> **Do NOT create a "respond" or "reply" tool.** The model generates free text
> naturally with `tools: true` enabled.

### Define tools with Zod schemas

```ts
import { z } from 'zod'
import type { ToolInput } from '@qvac/sdk'

const tools: ToolInput[] = [{
  name: 'get_time',
  description: 'Return current time',
  parameters: z.object({}),
  handler: async () => ({ now: new Date().toISOString() }),
}]
```

- Use only base Zod types (string, number, boolean, object, array)
- Avoid `.integer()`, `.min()`, `.regex()` — validate in the handler instead
- Keep tool count low (each tool increases grammar complexity)

### API Surface — What Goes Where

| Parameter | Set in `loadModel()` | Set in `completion()` |
|-----------|---------------------|----------------------|
| `ctx_size` | `modelConfig.ctx_size` | — |
| `n_discarded` | `modelConfig.n_discarded` | — |
| `tools: true` | `modelConfig.tools` | — |
| Tool definitions | — | `tools: [...]` |
| KV cache | — | `kvCache: sessionId` |
| History | — | `history: [...]` |
| Streaming | — | `stream: true` |

**`completion()` does NOT accept `modelConfig`** — set everything at load time.

### Tool-calling loop

Use the `tool-runner.ts` component or implement the loop:
1. Call `completion()` with tools
2. Process `tokenStream` + `toolCallStream` in **parallel** via `Promise.all`
3. If `toolCalls` returned, execute handlers and feed results back
4. Repeat until the model responds with text only (max 10 rounds)

See `resources/tool-calling-example.md` for the complete implementation.

---

## Qwen 3 Models: `<think>` Token Handling

Qwen 3 models emit `<think>...</think>` blocks for internal reasoning.

- **Suppress reasoning**: Add `/no_think` to the end of your system prompt
- **Filter from output**: `text.replace(/<think>[\s\S]*?<\/think>/g, '').trim()`
- **Context impact**: Think tokens count against the context window even when filtered

## System Prompt Engineering for Local Models

Small local models need **different prompting** than cloud APIs:

- **Embed reference data directly** in the system prompt (menus, schemas, lists)
- **Keep prompts structured** with clear headers, numbered rules
- **Use fewer tools** — each increases complexity and reduces reliability
- **Be explicit about output format** ("Respond with JSON only", "Use bullet points")
- **Model size matters**:
  - 0.6B-1B: Simple text generation, basic Q&A (unreliable for tool calling)
  - 3B: Adequate tool calling, good structured output
  - 7B: Reliable tool calling, complex reasoning, best overall quality

## Key Gotchas

- Model downloads can be large (0.5-4GB); use `onProgress` for UX
- Always `unloadModel()` when done to free memory
- **Always set `tools: true` in `modelConfig`** when using tool-calling models
- Do NOT create a "respond" or "reply" tool
- Use `kvCache: sessionId` in `completion()` for multi-turn conversations
- Set `n_discarded` in `modelConfig` at load time: `Math.floor(ctx_size / 10)`
- **`completion()` does NOT accept `modelConfig`**
- Process `tokenStream` and `toolCallStream` in parallel, not sequentially
- Filter `<tool_call>` blocks from visible token output
- 1B models are unreliable for tool calling; use 3B+ minimum
- Install `zod@^4`, not v3

## Deep Dive
- Model selection guide: read `resources/model-guide.md`
- Full chat example with progress: read `resources/chat-example.md`
- Tool calling with token filtering and JSON repair: read `resources/tool-calling-example.md`
- Schema best practices: read `resources/schema-guide.md`
- Troubleshooting: read `resources/troubleshooting.md`
