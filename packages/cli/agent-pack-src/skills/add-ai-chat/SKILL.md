---
name: add-ai-chat
description: Local AI inference with QVAC SDK — streaming, context, tool calling.
when_to_use: User wants AI capabilities (chatbot, assistant, function calling, LLM inference) running locally without cloud APIs.
paths: ["src/ai/**", "src/inference/**"]
version: "2026-04-14"
---

# Add AI Chat (QVAC)

## When to Use
- User wants local AI inference (chat, assistant, agent)
- User mentions "AI", "LLM", "model", "inference", "chatbot", or "tool calling"
- User needs offline AI capabilities without cloud APIs

## Prerequisites
- `@qvac/sdk` (`^0.8.0`) and `zod` (`^4.0.0`) installed
- Supported runtime: Node.js, Bare, or Expo mobile (native dev build required)
- Verify model constants against the installed SDK version before coding

> **CRITICAL — Pear Desktop Apps:** `@qvac/sdk` CANNOT run in the renderer
> (browser context). It MUST run in a **worker process** started via `pear-run`.
> The UI communicates with the worker via NDJSON over `Pear.worker.pipe()`.
> See the `setup-pear-desktop` skill → `resources/worker-pattern.md` for the
> full worker bridge implementation.

> **CRITICAL — Expo Mobile Apps with Bare Worklets:** `@qvac/sdk` MUST run in
> the **Expo/React Native runtime**, NOT inside the Bare worklet. If the app
> has a custom Bare worklet for P2P/storage, keep QVAC separate. The assistant
> reply is sent back through the P2P message transport via RPC.
> See the `setup-mobile-app` skill and the `qvac-mobile-expo` recipe for the
> full architecture.

## Reference Components (Optional)

The agent-pack includes reusable component files in `components/ai/` that wrap common
patterns (model lifecycle, chat sessions, tool runner). You can copy them into your
project's `src/ai/` if needed. For simple apps, using `@qvac/sdk` directly is easier.

## Steps

1. **Install dependencies**:
   ```bash
   npm i @qvac/sdk zod@^4
   ```
   > **IMPORTANT**: Install Zod v4 (not v3) — `@qvac/sdk` depends on Zod v4 internally.

2. **Choose the right model** (verified constants from `@qvac/sdk@0.8.0`):

   | Use Case | Model Constant | Size |
   |----------|---------------|------|
   | Tool calling (best) | `QWEN_3_1_7B_INST_Q4` | ~4GB |
   | Tool calling (lighter) | `QWEN_3_4B_INST_Q4_K_M` | ~2.5GB |
   | Tool calling (small) | `LLAMA_TOOL_CALLING_3_2_1B_INST_Q4_K` | ~1GB |
   | General chat (small) | `LLAMA_3_2_1B_INST_Q4_0` | ~1GB |
   | General chat (quality) | `SALAMANDRATA_2B_INST_Q8` | ~2GB |
   | Mobile (tiny) | `QWEN3_600M_INST_Q4` | ~0.5GB |

   > **IMPORTANT**: Only use model constants listed above. `QWEN_2_5_*` and `QWEN_2_5_CODER_*` do NOT exist in `@qvac/sdk@0.8.0`. The SDK exports Qwen 3 models.

3. **Use `@qvac/sdk` directly** — this is the actual npm package API:
   ```ts
   import { loadModel, completion, unloadModel, LLAMA_3_2_1B_INST_Q4_0 } from '@qvac/sdk'
   ```

4. **Wire into your app** — complete working example:
   ```ts
   import { loadModel, completion, unloadModel, LLAMA_3_2_1B_INST_Q4_0 } from '@qvac/sdk'
   import * as readline from 'readline'

   async function main() {
     // Load model (downloads on first use)
     console.log('Loading model...')
     const modelId = await loadModel({
       modelSrc: LLAMA_3_2_1B_INST_Q4_0,
       modelType: 'llm',
       modelConfig: { ctx_size: 2048, n_discarded: 200 },
       onProgress: (p) => process.stdout.write(`\r${p.percentage.toFixed(1)}%`),
     })
     console.log('\nModel ready!')

     const history: Array<{ role: string; content: string }> = []
     const rl = readline.createInterface({ input: process.stdin, output: process.stdout })

     const ask = () => rl.question('You: ', async (input) => {
       if (input.trim().toLowerCase() === 'exit') {
         await unloadModel(modelId)
         rl.close()
         return
       }

       history.push({ role: 'user', content: input })

       const { tokenStream } = await completion({
         modelId,
         history,
         systemPrompt: 'You are a helpful assistant.',
         stream: true,
         kvCache: 'main',
       })

       let reply = ''
       process.stdout.write('AI: ')
       for await (const token of tokenStream) {
         const text = typeof token === 'string' ? token : token.text ?? ''
         process.stdout.write(text)
         reply += text
       }
       console.log()

       history.push({ role: 'assistant', content: reply })
       ask()
     })
     ask()
   }

   main().catch(console.error)
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

---

## Mobile Expo with QVAC

When adding QVAC to an Expo mobile app (especially one with a Bare worklet),
follow these additional rules.

### Runtime Placement

- QVAC inference runs in **Expo/React Native**, not the Bare worklet
- The Bare worklet owns P2P transport and local-first storage only
- Assistant replies are sent back through the existing message transport via RPC

### Static Imports Required

For the main inference path in Expo mobile, use static imports:

```ts
import { LLAMA_3_2_1B_INST_Q4_0, completion, loadModel, unloadModel } from '@qvac/sdk'
```

Do NOT use `import('@qvac/sdk')` (dynamic import). In the Expo + Metro + Hermes
setup, lazy imports can fail with `identifier expected in declaration`. The
reference workbench uses static imports for its main inference path.

### Simulator Guidance

- Physical device is the primary validation target for QVAC inference
- But do NOT assume simulator failure means QVAC is unsupported
- First compare: SDK version, import strategy, plugin path, dependency surface
- The reference workbench ran on simulator after reference alignment

### Diagnostics-First Workflow

Before changing prompts, models, CPU/GPU flags, or retry logic, expose
diagnostics for each stage:

1. Config initialization
2. SDK import success/failure
3. Model load progress and result
4. Completion start/stream/end
5. Any error with the exact failure boundary

This is a **required workflow**, not an optional tip. The biggest Phase 2
debugging loops happened because the failure boundary was unknown.

### Version Alignment

Before debugging, compare the app to a known-good reference:
1. Check the reference workbench SDK version
2. Match it if the reference is known-good
3. Install companion Expo modules the SDK version expects (e.g., `expo-device`)

See the `qvac-mobile-expo` recipe for the complete integration pattern.

---

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
- On Expo mobile: use static imports, not dynamic `import('@qvac/sdk')`
- On Expo mobile: do NOT put `@qvac/sdk` in the Bare worklet

## Deep Dive
- Model selection guide: read `resources/model-guide.md`
- Full chat example with progress: read `resources/chat-example.md`
- Tool calling with token filtering and JSON repair: read `resources/tool-calling-example.md`
- Schema best practices: read `resources/schema-guide.md`
- Troubleshooting: read `resources/troubleshooting.md`
- Mobile QVAC integration: read recipe `qvac-mobile-expo`
