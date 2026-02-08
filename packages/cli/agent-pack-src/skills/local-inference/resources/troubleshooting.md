# Local Inference — Troubleshooting

## Model constant not found / import error
- Only use constants verified for `@qvac/sdk@0.6.0` (see model-guide.md)
- `QWEN_2_5_*` and `QWEN_2_5_CODER_*` do NOT exist — use `QWEN_3_1_7B_INST_Q4`, `QWEN_3_4B_INST_Q4_K_M`, or `QWEN3_0_6B_INST`
- If a constant doesn't exist, use an explicit `modelSrc` URL string instead

## Model load fails
- Confirm the model file format matches the model type (LLM uses `.gguf`)
- Check disk space — models can be 0.5-4GB
- Verify runtime has access to the model storage directory

## Model describes tool usage in text but never actually calls tools
- **Most common cause**: `tools: true` is NOT set in `modelConfig` at load time
- Without `tools: true`, the model doesn't know how to format `<tool_call>` blocks
- **Fix**: Always include `tools: true` in `modelConfig` when calling `loadModel()`

## Streaming stalls
- Verify the runtime has enough memory for the model size
- Check that no other inference is running (one model at a time)
- Try a smaller model if memory is constrained

## Context overflow errors
- Use `n_discarded: N` in `modelConfig` for automatic sliding-window discard (e.g., `n_discarded: Math.floor(ctx_size / 10)`)
- Use `kvCache: sessionId` to avoid resending full history
- Trim old messages: keep system prompt + last N turns
- Switch to a larger model if you need more context

## Slow first response
- First inference includes model warmup — subsequent calls are faster
- Use `kvCache: sessionId` for multi-turn conversations
- Consider pre-loading the model at app startup

## Qwen 3 model outputs garbage `<think>` blocks
- This is normal — Qwen 3 models reason internally
- Add `/no_think` to the end of your system prompt to suppress
- Filter from output: `text.replace(/<think>[\s\S]*?<\/think>/g, '').trim()`
- Think tokens still count against context window

## `<tool_call>` blocks visible in chat output
- Use the `createTokenFilter()` pattern to strip tool call blocks from visible tokens
- See `skill-qvac-tool-calling` for the implementation
