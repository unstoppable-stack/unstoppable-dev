# QVAC Tool Calling — Troubleshooting

## Zod version mismatch: ToolInput types are incompatible
- `@qvac/sdk` internally depends on Zod v4
- If your project has `zod@^3`, the `ToolInput` types produce confusing TypeScript errors
- **Fix**: Install `zod@^4` — run `pnpm add zod@^4`

## Model outputs text describing tool usage but never actually calls tools
- **Most common cause**: `tools: true` is NOT set in `modelConfig` at load time
- Without `tools: true`, the model doesn't know how to format `<tool_call>` blocks
- It will describe actions ("I've placed your order") without actually calling the tool
- **Fix**: Always set `modelConfig: { tools: true }` in `loadModel()`
- This is extremely confusing because the text output *looks* correct

## Model outputs tool calls but `toolCalls` is empty
- Check for `<tool_call>` blocks in the raw text — use fallback parsing
- Ensure you pass `tools` (definitions array) to `completion()`
- The SDK's parser needs the tool definitions to match against
- If parsing still fails, use the `parseFallbackToolCalls()` function with JSON repair

## `<tool_call>` blocks appearing in user-visible output
- The raw token stream includes `<tool_call>...</tool_call>` XML blocks
- Use the `createTokenFilter()` pattern to strip them from visible output
- The filter maintains state to track when it's inside a tool call block

## Model never calls tools (only outputs text)
- Ensure `tools: true` is set in `modelConfig` at load time
- Try adding `/no_think` to the system prompt to reduce reasoning
- Use 3B+ model — 1B models are unreliable for tool calling
- `QWEN_3_1_7B_INST_Q4` is the most reliable for tool calling
- Ensure tool descriptions are clear and specific

## Tool params are missing or malformed
- Keep tool schemas flat and explicit
- Use only base Zod types (string, number, boolean, object, array)
- Validate constraints inside the handler, not in the schema
- Fewer tools = more reliable (each tool increases complexity)
- Small models (3-4B) may produce slightly malformed JSON — use `repairJson()`

## Developer created a "respond" or "reply" tool (antipattern)
- This is unnecessary — the model generates free text naturally with `tools: true`
- Remove the "respond" tool; the model can reply directly
- If you need a tool to speak, you've likely misunderstood how `tools: true` works

## `z.number().integer()` throws
- Zod refinements are not supported in ToolInput schemas
- Use `z.number()` and check `Math.floor(n) === n` in the handler

## Context overflow after a few tool rounds
- Tool calling adds history rapidly (request + response per call)
- Use `n_discarded` in `modelConfig` for automatic sliding window (e.g., `n_discarded: Math.floor(ctx_size / 10)`)
- Use `kvCache: sessionId` with a stable key for the entire tool-calling loop
- Keep tool outputs compact (don't return entire objects)
- Avoid returning large data as tool results — summarize instead

## Qwen 3 model outputs `<think>...</think>` blocks
- This is Qwen 3's reasoning behavior — it's normal
- **Suppress**: Add `/no_think` to the end of your system prompt
- **Filter**: Use `text.replace(/<think>[\s\S]*?<\/think>/g, '').trim()` before displaying
- Think tokens still count against context window even when suppressed

## Model calls wrong tools or ignores tools
- Improve tool descriptions to be specific and unambiguous
- Use system prompt to guide tool preference
- Reduce number of tools — fewer tools = more reliable calls
- Embed reference data (menus, schemas, lists) directly in the system prompt rather than using a tool to fetch them
- 1B models struggle with complex tool routing; use 3B+ minimum, 7B recommended

## `deleteCache` doesn't seem to free memory
- `deleteCache()` removes the KV cache files on disk
- Pass the same `kvCacheKey` you used in `completion()`
- Also call `unloadModel()` to fully free model memory
- Import: `import { deleteCache } from '@qvac/sdk'`
- Usage: `await deleteCache({ kvCacheKey: sessionId })`
