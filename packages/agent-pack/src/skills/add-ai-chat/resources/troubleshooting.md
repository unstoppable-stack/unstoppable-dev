# QVAC Chat App — Troubleshooting

## Model constant not found
- Only use constants from `@qvac/sdk@0.11.0` — see the model guide
- `QWEN_2_5_*` and `QWEN_2_5_CODER_*` do NOT exist
- Use `QWEN_3_1_7B_INST_Q4`, `QWEN_3_4B_INST_Q4_K_M`, or `QWEN3_600M_INST_Q4`
- Legacy multi-file Parakeet constants (`PARAKEET_TDT_ENCODER_INT8`, etc.) and 32 `NMT_Q0F16*`/`NMT_Q4_0*` Marian Opus constants were REMOVED in 0.11 — use the GGUF Parakeet constants and IndicTrans/Bergamot instead
- Enumerate at runtime: `modelRegistryList()` / `modelRegistrySearch({ query })`

## Zod type errors with ToolInput
- `@qvac/sdk` requires Zod v4, not v3
- Run `npm i zod@^4` to fix

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
- **Renamed in 0.9**: `call.call()` → `call.invoke()`. Upgrading from 0.5-0.8?
  Update every `.call()` usage.
- For fallback-parsed calls, look up the handler manually from the tools array

## `INVALID_TOOLS_ARRAY` or schema validation error on `completion()`
- You're likely passing sampling params (`temp`, `top_p`, etc.) inside
  `modelConfig` or at the top level of `completion()`
- **Fix**: Move them to `generationParams`:
  ```ts
  completion({ modelId, history, generationParams: { temp: 0.7, top_p: 0.9 } })
  ```
- `generationParams` only accepts `temp`, `top_p`, `top_k`, `predict`, `seed`,
  `frequency_penalty`, `presence_penalty`, `repeat_penalty` — nothing else

## Multimodal image input ignored / TypeScript error on `image_url`
- The old `content: [{ type: 'image_url', image_url: { url: 'data:...' } }]`
  payload no longer works in 0.9
- **Fix**: attach via file path on the history message:
  ```ts
  history: [{
    role: 'user',
    content: "What's in this?",
    attachments: [{ path: '/abs/path/to/photo.jpg' }],
  }]
  ```
- Only multimodal models (e.g., `SMOLVLM2_2_500M_MULTIMODAL_Q8_0`) can consume
  attachments — others will ignore them

## `ping is not a function` / `ping()` import fails
- `ping()` was removed in 0.8.1
- **Fix**: `import { heartbeat } from '@qvac/sdk'`; call `await heartbeat()`
- For remote providers: `await heartbeat({ delegate: { topic, providerPublicKey } })`

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

---

## Mobile Expo — QVAC-Specific Errors

### `MODULE_NOT_FOUND: Cannot find module '@qvac/infer-base'`
(also `@qvac/dl-base`, `tinyld/heavy`, and similar transitive packages)
- **Cause**: pnpm worker-bundling cannot resolve QVAC transitives
- **Fix**: Add `public-hoist-pattern=*` to `.npmrc`
- Do NOT chase each missing module by adding direct dependencies one at a time

### `Unable to resolve "expo-device" from @qvac/sdk`
- **Cause**: The chosen QVAC SDK version expects `expo-device` but the app doesn't declare it
- **Fix**: `npx expo install expo-device`
- Always align with the reference workbench's SDK version and its required companion modules

### `ADDON_NOT_FOUND: Cannot find addon '.' imported from bare-type/binding.js`
- **Cause**: Addon manifest only describes one runtime (QVAC or chat), not both
- **Fix**: Generate a combined addon manifest that includes both Bare worklet and QVAC addons
- Also verify CocoaPods support scripts reference the framework (see below)

### `ADDON_NOT_FOUND` even though `.xcframework` exists on disk
- **Cause**: CocoaPods support scripts don't copy/embed the framework into the `.app` bundle
- **Fix**: Inspect and patch these files under `ios/Pods/Target Support Files/`:
  - `react-native-bare-kit-xcframeworks.sh`
  - `react-native-bare-kit-xcframeworks-input-files.xcfilelist`
  - `react-native-bare-kit-xcframeworks-output-files.xcfilelist`
  - `Pods-<AppName>-frameworks.sh`
- The `link-bare-addons.mjs` script should handle this automatically

### `identifier expected in declaration` (during QVAC inference)
- **Cause**: Dynamic `import('@qvac/sdk')` failed in the Expo + Metro + Hermes setup
- **Fix**: Switch the main inference path to static imports from `@qvac/sdk`
- Compare to the reference workbench's import pattern before changing prompts or models
- This error often looks like a parser issue but is actually an import-boundary problem

### QVAC inference fails but prompt/model tweaks don't help
- **Cause**: The failure is likely at the build/runtime level, not the prompt level
- **Fix**: Add diagnostics at each stage before changing prompts:
  1. Config initialization → logged?
  2. SDK import → succeeded?
  3. Model load → started?
  4. Completion → first token received?
- The decisive failures in battle testing were import path and dependency surface issues, not prompt shape

### Model constant not found (mobile)
- The installed SDK version may export different constants than documented
- Always verify constants from the actual installed `@qvac/sdk` package exports
- Always verify constants from the actual installed `@qvac/sdk` package exports
