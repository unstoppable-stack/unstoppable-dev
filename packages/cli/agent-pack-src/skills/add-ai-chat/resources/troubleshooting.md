# QVAC Chat App — Troubleshooting

## Model constant not found
- Only use constants from `@qvac/sdk@0.7.0` — see the model guide
- `QWEN_2_5_*` and `QWEN_2_5_CODER_*` do NOT exist
- Use `QWEN_3_1_7B_INST_Q4`, `QWEN_3_4B_INST_Q4_K_M`, or `QWEN3_0_6B_INST`

## Zod type errors with ToolInput
- `@qvac/sdk` requires Zod v4, not v3
- Run `pnpm add zod@^4` to fix

## Model describes tool usage in text but never actually calls tools
- **Most common cause**: `tools: true` is NOT set in `modelConfig` at load time
- The model will say "I've placed your order" without actually calling `placeOrder`
- **Fix**: Always include `tools: true` in `modelConfig` when calling `loadModel()`
- This is extremely confusing because the output *looks* correct

## Developer created a "respond" or "reply" tool
- This is unnecessary — remove it
- The model generates free text naturally even with `tools: true` enabled
- If you need a tool just to let the model reply, you've misunderstood how `tools: true` works

## `<tool_call>` blocks visible in chat output
- Use the `createTokenFilter()` pattern to strip them from visible tokens
- The filter maintains state to track when inside a tool call block
- See the full example for implementation

## Tool calls parsed but handler not invoked
- Ensure tools have `handler` functions attached (use `ToolInput`, not raw `Tool`)
- Use `call.invoke()` to execute — it runs the handler automatically
- For fallback-parsed calls, look up the handler manually from the tools array

## Context overflow
- Set `n_discarded` in `modelConfig` at load time: `n_discarded: Math.floor(ctx_size / 10)`
- Use `kvCache: sessionId` with a stable key
- Keep tool outputs compact
- Avoid returning large data blobs as tool results
- `n_discarded` eliminates the need for manual history trimming

## `<think>` blocks appearing in output
- Add `/no_think` to the end of the system prompt
- Filter with `text.replace(/<think>[\s\S]*?<\/think>/g, '').trim()`
- Use `createTokenFilter()` or `isInsideThinkBlock()` during streaming
- Think tokens still count against context window

## Memory not freed after conversation
- Call `await deleteCache({ kvCacheKey: sessionId })` when done
- Call `await unloadModel({ modelId })` to free model memory
- Handle SIGINT to ensure cleanup runs on Ctrl+C

## Slow first token
- First inference includes model warmup — subsequent calls are faster
- Using `kvCache` speeds up multi-turn conversations significantly
- Pre-load the model at app startup before accepting user input

## TypeScript errors with untyped packages
- Create a `types.d.ts` file for packages like `hyperswarm`, `bare-rpc`
- Use `moduleResolution: "Bundler"` and `allowImportingTsExtensions: true` with `tsx`
- Install `@types/node` alongside `typescript`

## Tool calling works but responses are low quality
- Embed reference data directly in the system prompt (menus, prices, lists)
- Don't use a tool to fetch static data — put it in the system prompt
- Keep tool count low — each additional tool reduces reliability
- Use 7B model for best quality (`QWEN_3_1_7B_INST_Q4`)
