---
name: local-inference
description: Add local AI inference using QVAC SDK with streaming token output
allowed-tools: Read, Grep, Edit, Write, Bash(npm *), Bash(pnpm *)
---

# Local AI Inference

## When to Use
- User wants to run an LLM locally without cloud APIs
- User mentions "AI", "inference", "chat", "LLM", or "model"
- User needs offline AI capabilities

## Prerequisites
- QVAC SDK installed (`@qvac/sdk`)
- Supported runtime: Node.js, Bare, or physical device for Expo

## Included Components

Your project includes battle-tested components in `src/ai/`:

- **`src/ai/model-manager.ts`** — Load/unload models with progress, context config, memory cleanup
- **`src/ai/chat-session.ts`** — Streaming chat with kv-cache, history trimming, `<think>` filtering
- **`src/ai/tool-runner.ts`** — Tool-calling loop with Zod schemas and error handling

## Steps

1. **Install dependencies**:
   ```bash
   pnpm add @qvac/sdk zod@^4
   ```

2. **Use the included components** — they handle the common gotchas:
   ```ts
   import { ModelManager } from './ai/model-manager.js'
   import { ChatSession } from './ai/chat-session.js'
   ```

3. **Choose the right model** (verified constants from `@qvac/sdk@0.6.0`):
   | Use Case | Model Constant | Size |
   |----------|---------------|------|
   | Tool calling (best) | `QWEN_3_1_7B_INST_Q4` | ~4GB |
   | Tool calling (lighter) | `QWEN_3_4B_INST_Q4_K_M` | ~2.5GB |
   | Tool calling (small) | `LLAMA_TOOL_CALLING_3_2_1B_INST_Q4_K` | ~1GB |
   | General chat (small) | `LLAMA_3_2_1B_INST_Q4_0` | ~1GB |
   | General chat (quality) | `SALAMANDRATA_2B_INST_Q8` | ~2GB |
   | Mobile (tiny) | `QWEN3_0_6B_INST` | ~0.5GB |

   > **IMPORTANT**: Only use model constants listed above. `QWEN_2_5_*` and `QWEN_2_5_CODER_*` constants do NOT exist in `@qvac/sdk@0.6.0`. The SDK exports Qwen 3 models.

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

5. **Customize** — change the model, system prompt, and add tools via `tool-runner.ts`

## Qwen 3 Models: `<think>` Token Handling

Qwen 3 models (`QWEN_3_1_7B_INST_Q4`, `QWEN_3_4B_INST_Q4_K_M`, `QWEN3_0_6B_INST`) emit `<think>...</think>` blocks for internal reasoning.

- **Suppress reasoning**: Add `/no_think` to the end of your system prompt
- **Filter from output**: `text.replace(/<think>[\s\S]*?<\/think>/g, '').trim()`
- **Context impact**: Think tokens count against the context window even when filtered

## System Prompt Engineering for Local Models

Small local models need **different prompting** than cloud APIs:

- **Embed reference data directly**: Put menus, schemas, lists, and other reference data directly in the system prompt rather than using a tool to fetch them. This reduces tool calls and improves reliability.
- **Keep prompts structured**: Use clear headers, numbered rules, and explicit formatting instructions. Local models follow structure better than implicit instructions.
- **Use fewer tools**: Each tool increases grammar complexity and reduces reliability. Combine related functions where possible.
- **Be explicit about output format**: Specify exactly how the model should respond (e.g., "Respond with JSON only", "Use bullet points").
- **Model size matters for tasks**:
  - 0.6B-1B: Simple text generation, basic Q&A (unreliable for tool calling)
  - 3B: Adequate tool calling, good structured output
  - 7B: Reliable tool calling, complex reasoning, best overall quality

## Key Gotchas
- Model downloads can be large (0.5-4GB); use `onProgress` for UX
- Always `unloadModel()` when done to free memory
- **Always set `tools: true` in `modelConfig`** when using tool-calling models — without it, tools silently don't work
- Do NOT create a "respond" or "reply" tool — the model generates free text naturally with `tools: true`
- Use `kvCache: sessionId` in `completion()` for multi-turn conversations
- Set `n_discarded` in `modelConfig` **at load time** (not in completion): `n_discarded: Math.floor(ctx_size / 10)`
- **`completion()` does NOT accept `modelConfig`** — set `ctx_size`, `n_discarded`, `tools: true` at load time
- Process `tokenStream` and `toolCallStream` in parallel via `Promise.all`, not sequentially
- Filter `<tool_call>` blocks from visible token output using a stateful token filter
- Small models (1B) have limited reasoning; use 3B+ for complex tasks
- 1B models are unreliable for tool calling; use 3B+ minimum

## Deep Dive
- Full example with progress: read `resources/full-example.md`
- Model selection guide: read `resources/model-guide.md`
- Troubleshooting: read `resources/troubleshooting.md`
