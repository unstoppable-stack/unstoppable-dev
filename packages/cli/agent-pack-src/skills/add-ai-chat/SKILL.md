---
name: add-ai-chat
description: Local AI inference with QVAC SDK — streaming, context, tool calling, multimodal.
when_to_use: User wants AI capabilities (chatbot, assistant, function calling, LLM inference) running locally without cloud APIs.
paths: ["src/ai/**", "src/inference/**"]
version: "2026-05-21"
---

# Add AI Chat (QVAC)

**Validation:** 5 October 2026 · macOS Apple Silicon · CLI 0.4.0-beta.1 source · QVAC SDK 0.15.0, pear-runtime 1.3.1, Electron 40.10.6. Real desktop UI inference, model failure/retry, Stop/recovery, cached-model network-isolated restart, and storage persistence passed. This is local source/example evidence; frozen release artifacts and independent assistant pilots remain unverified.

## When to Use
- User wants local AI inference (chat, assistant, agent)
- User mentions "AI", "LLM", "model", "inference", "chatbot", or "tool calling"
- User needs offline AI capabilities without cloud APIs

## Prerequisites
- `@qvac/sdk` (`^0.15.0`) and `zod` (`^4.3.0`) installed
- Node.js ≥ 22.17, Bare ≥ 1.24, or Expo ≥ 54 (Expo needs a native dev build)
- Optional `qvac.config.json` at the project root (required only when also
  using the `@qvac/cli` HTTP server)
- Verify model constants against the installed SDK version before coding
- For Unstoppable Node delegated inference, validate the real provider with
  `QVAC_MODEL_SRC=<model> npm run test:qvac` in `packages/node` before release;
  default tests cover only the mock provider.

> **CRITICAL — Pear Desktop Apps:** `@qvac/sdk` CANNOT run in the renderer
> (browser context). It MUST run in a **Bare worker** started by embedded `pear-runtime`.
> The worker uses `Bare.IPC`, bridged through Electron's sandboxed preload.
> See the `setup-pear-desktop` skill → `resources/worker-pattern.md` for the
> full worker bridge implementation.
>
> Bare does not auto-register QVAC inference plugins. Before the first SDK
> call, import `llmPlugin` from `@qvac/sdk/llamacpp-completion/plugin` and
> `registerPlugin` from `@qvac/sdk/plugins`, then call
> `registerPlugin(llmPlugin)`. Without this, `loadModel()` fails with “No
> plugins registered in the worker.” Node and Expo register their supported
> plugins automatically; this explicit step is for direct Bare workers.
>
> Give streamed completions a request ID and expose a Stop action that calls
> `cancel({ operation: 'inference', modelId })`. Clear the active request before
> awaiting cancellation so late tokens and terminal events are ignored, and
> cancel active inference before unloading the model during shutdown.

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
   npm i @qvac/sdk 'zod@^4.3'
   ```
   > **IMPORTANT**: Install Zod v4.3+ (not v3, not v4.0–4.2) — `@qvac/sdk@0.15`
   > requires zod ≥ 4.3 because finetune schemas use APIs only available there
   > (older minor versions crash at runtime with `z.xor is not a function`).

2. **Choose the right model** (verified constants from `@qvac/sdk@0.15.0`):

   | Use Case | Model Constant | Size |
   |----------|---------------|------|
   | Default / mobile / tiny | `QWEN3_5_0_8B_MULTIMODAL_Q4_K_M` | ~0.5GB |
   | Balanced | `QWEN3_5_2B_MULTIMODAL_Q4_K_M` | ~1.3GB |
   | Tool calling / quality | `QWEN3_5_4B_MULTIMODAL_Q4_K_M` | ~2.7GB |
   | Desktop, high quality | `QWEN3_5_9B_MULTIMODAL_Q4_K_M` | ~5.7GB |
   | General chat (legacy) | `LLAMA_3_2_1B_INST_Q4_0` | ~1GB |
   | General chat (quality, legacy) | `SALAMANDRATA_2B_INST_Q8` | ~2GB |
   | Multimodal | `SMOLVLM2_2_500M_MULTIMODAL_Q8_0` + projection | ~500MB + ~100MB |

   > **IMPORTANT**: Prefer the Qwen 3.5 family — it is what `tetherto/qvac-app`
   > ships on every tier, and it supports `reasoning_budget`. Only use model
   > constants listed above. `QWEN_2_5_*` and `QWEN_2_5_CODER_*` do NOT exist.
   >
   > To enumerate every model at runtime: `modelRegistryList()`, `modelRegistrySearch({ query })`, `modelRegistryGetModel({ name })`.

3. **Use `@qvac/sdk` directly** — this is the actual npm package API:
   ```ts
   import { loadModel, completion, unloadModel, LLAMA_3_2_1B_INST_Q4_0 } from '@qvac/sdk'
   ```

4. **Wire into your app** — complete working example:
   ```ts
   import { loadModel, completion, unloadModel, LLAMA_3_2_1B_INST_Q4_0 } from '@qvac/sdk'
   import * as readline from 'readline'

   async function main() {
     // Load model (downloads on first use). System prompt and context settings
     // go here, NOT in completion().
     console.log('Loading model...')
     const modelId = await loadModel({
       modelSrc: LLAMA_3_2_1B_INST_Q4_0,
       modelType: 'llm',
       modelConfig: {
         ctx_size: 2048,
         n_discarded: 200,
         system_prompt: 'You are a helpful assistant.',
       },
       onProgress: (p) => process.stdout.write(`\r${p.percentage.toFixed(1)}%`),
     })
     console.log('\nModel ready!')

     const history: Array<{ role: string; content: string }> = []
     const rl = readline.createInterface({ input: process.stdin, output: process.stdout })

     const ask = () => rl.question('You: ', async (input) => {
       if (input.trim().toLowerCase() === 'exit') {
         await unloadModel({ modelId })
         rl.close()
         return
       }

       history.push({ role: 'user', content: input })

       // 0.10 unified event stream: prefer `run.events` over the legacy
       // `tokenStream`. Sampling goes in `generationParams` (new in 0.9 —
       // used to be in modelConfig). `captureThinking: true` filters
       // <think> blocks out of content events automatically.
       const run = completion({
         modelId,
         history,
         stream: true,
         kvCache: 'main',
         generationParams: { temp: 0.7, top_p: 0.9 },
         captureThinking: true,
       })

       process.stdout.write('AI: ')
       for await (const event of run.events) {
         if (event.type === 'contentDelta') process.stdout.write(event.text)
         if (event.type === 'toolCall') {
           // event.call is a typed tool call — handle via .invoke() if you
           // attached handlers; see the Tool Calling section.
         }
       }
       console.log()

       const final = await run.final
       history.push({ role: 'assistant', content: final.contentText })
       ask()
     })
     ask()
   }

   main().catch(console.error)
   ```

> **Back-compat note:** the old `result.tokenStream` and `await result.stats`
> are still available in 0.10 as derived views — existing code keeps working.
> New code should prefer `run.events` / `run.final` because: (1) tool calls
> arrive as typed events in order rather than via a parallel
> `toolCallStream`; (2) `<think>` blocks can be captured via
> `captureThinking: true` instead of regex filtering; (3) `final` aggregates
> `contentText`, `thinkingText`, `toolCalls`, and `stats` in one await.

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
| `system_prompt` | `modelConfig.system_prompt` | — |
| Tool definitions | — | `tools: [...]` |
| MCP clients | — | `mcp: [{ client }]` |
| Sampling (`temp`, `top_p`, etc.) | — | `generationParams: {...}` |
| KV cache | — | `kvCache: sessionId` |
| History | — | `history: [...]` |
| Streaming | — | `stream: true` |
| Image/media attachments | — | `history[i].attachments: [{ path }]` |

**`completion()` does NOT accept `modelConfig`** — set context/system prompt at
load time. Sampling params moved out of `modelConfig` into `generationParams`
as of 0.9 (strict schema — no extra keys allowed).

### Tool-calling loop

Use the `tool-runner.ts` component or implement the loop:
1. Call `completion()` with tools
2. Process `tokenStream` + `toolCallStream` in **parallel** via `Promise.all`
3. If `toolCalls` resolves with calls, `await call.invoke()` on each (renamed
   from `.call()` in 0.9) and feed the result back as a `tool` message
4. Repeat until the model responds with text only (max 10 rounds)

```ts
for (const call of await result.toolCalls) {
  if (call.invoke) {
    const output = await call.invoke() // runs the handler you supplied
    history.push({
      role: 'tool',
      content: JSON.stringify(output),
    })
  }
}
```

See `resources/tool-calling-example.md` for the complete implementation.

### MCP (Model Context Protocol) clients

Pass an MCP client instead of / alongside inline tools — the SDK calls
`listTools`/`callTool` on the duck-typed client:

```ts
import { Client } from '@modelcontextprotocol/sdk/client/index.js'

const mcpClient = new Client({ name: 'my-app', version: '1.0.0' })
await mcpClient.connect(transport)

const run = completion({
  modelId,
  history,
  mcp: [{ client: mcpClient, includeResources: true }],
})
```

### Dynamic tools mode (0.10)

For agents that need to swap tool sets per turn (e.g. enable a tool only after
the user opts in, or rotate through different domains in the same session),
load the model with `toolsMode: TOOLS_MODE.dynamic`. The addon then trims the
previous tool block from the KV cache so changing tools doesn't invalidate
the cache:

```ts
import { loadModel, completion, TOOLS_MODE, QWEN_3_1_7B_INST_Q4 } from '@qvac/sdk'

const modelId = await loadModel({
  modelSrc: QWEN_3_1_7B_INST_Q4,
  modelType: 'llm',
  modelConfig: { ctx_size: 4096, tools: true, toolsMode: TOOLS_MODE.dynamic },
})

// Turn 1 — weather tools
completion({ modelId, history, kvCache: 'session', stream: true,
  tools: [/* weather tools */] })

// Turn 2 — same kvCache, different tools. Free rotation.
completion({ modelId, history, kvCache: 'session', stream: true,
  tools: [/* horoscope tools */] })
```

Without dynamic mode, swapping `tools` on a cached session is undefined behavior.

### Tool-call dialect routing (0.10)

The SDK auto-routes between `hermes`, `pythonic`, and `json` framings. Llama
3.x fine-tunes that emit native pythonic headers will mis-parse under the
default `hermes` heuristic — force the parser explicitly:

```ts
const run = completion({
  modelId, history, tools, stream: true,
  toolDialect: 'pythonic', // 'hermes' | 'pythonic' | 'json'
})
```

### Structured output via `responseFormat` (0.10)

When you need JSON that's guaranteed to parse against a schema, pass
`responseFormat` on `completion()`. The output is grammar-constrained at the
addon level (no prompt engineering required, no post-hoc JSON repair):

```ts
const run = completion({
  modelId,
  history: [{ role: 'user', content: "I'm Alice, 30, data engineer." }],
  stream: true,
  responseFormat: {
    type: 'json_schema',
    json_schema: {
      name: 'Person',
      schema: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          age: { type: 'integer' },
          occupation: { type: 'string' },
        },
        required: ['name', 'age', 'occupation'],
        additionalProperties: false,
      },
    },
  },
})

const final = await run.final
const parsed = JSON.parse(final.contentText) // schema-valid
```

For non-JSON DSLs (regex-like grammars, custom syntaxes), use the lower-level
`generationParams.grammar` (raw GBNF string) instead. `responseFormat` and
`generationParams.grammar` are mutually exclusive within a single call.

---

## Qwen Models: Reasoning Control

Qwen models emit `<think>...</think>` blocks for internal reasoning.

- **Suppress entirely**: `reasoning_budget: 0` in `loadModel().modelConfig`
  (`-1` = unlimited). Engine-level, so the tokens are never generated and cost
  no context. Also accepted per-call in `completion().generationParams`.
- **Keep, but separated**: pass `captureThinking: true` to `completion()` — the
  SDK splits content and thinking into separate event channels, no regex
  needed. `final.thinkingText` holds the full thinking transcript.
- **Do not** add `/no_think` to the system prompt (advisory only, the model can
  ignore it) or strip the blocks out of a token stream by hand (partial tags
  split across chunks leak into the UI).
- **Context impact**: reasoning tokens count against the context window whenever
  they are generated, even if filtered from display. Only `reasoning_budget: 0`
  avoids the cost.

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

- **QVAC SDK 0.9 inference does NOT run on iOS Simulator / Android Emulator.**
  Per the [official QVAC Expo tutorial](https://docs.qvac.tether.io/sdk/tutorials/expo/):
  *"Due to limitations with `llamacpp`, QVAC currently does not run on
  emulators. You must use a physical device."*
- Use `expo-device`'s `Device.isDevice` to detect simulator and surface a
  clear, actionable error before calling `loadModel()` (otherwise llamacpp
  fails with a confusing native message).
- For UI development without a device, gate inference behind
  `EXPO_PUBLIC_QVAC_MOCK=1` and return canned token streams.
- Run on hardware with `npx expo run:ios --device` /
  `npx expo run:android --device`.

### Metro Config Pitfall — `unstable_enablePackageExports`

Do **NOT** set `config.resolver.unstable_enablePackageExports = true` in
`metro.config.js`. With this flag enabled, Metro strictly honors every
package's `exports` field — and React Native's `exports` map does not
re-expose `stacktrace-parser`, which `react-native/Libraries/Core/Devtools/parseErrorStack.js`
requires at runtime. The result: a red-screen `Unable to resolve module
stacktrace-parser` on app start.

The QVAC SDK's subpath exports (`@qvac/sdk/expo-plugin`,
`@qvac/sdk/worker.mobile.bundle`) work fine through Metro's default
subpath resolution. The QVAC reference mobile app
(`qvac-workbench-mobile`) ships without this flag.

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
- Always `unloadModel({ modelId })` when done to free memory
- **Always set `tools: true` in `modelConfig`** when using tool-calling models
- Do NOT create a "respond" or "reply" tool
- Use `kvCache: sessionId` in `completion()` for multi-turn conversations
- Set `n_discarded` in `modelConfig` at load time: `Math.floor(ctx_size / 10)`
- **`completion()` does NOT accept `modelConfig`** — sampling params now live in
  `generationParams` (strict, no extra keys)
- **Tool handler dispatch is `.invoke()` in 0.9** (renamed from `.call()`)
- **Multimodal: use `attachments: [{ path }]` on history messages**, not base64
  `image_url` — the old OpenAI-style payload is gone
- **`ping()` was removed in 0.8.1** — use `heartbeat()` for health checks
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
