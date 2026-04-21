# Local Inference — Full Example

```js
import { loadModel, LLAMA_3_2_1B_INST_Q4_0, completion, unloadModel } from '@qvac/sdk'

const modelId = await loadModel({
  modelSrc: LLAMA_3_2_1B_INST_Q4_0,
  modelType: 'llm',
  onProgress: (progress) => {
    console.log(`${progress.percentage.toFixed(1)}% (${progress.downloaded}/${progress.total})`)
  }
})

const history = [
  { role: 'user', content: 'Explain quantum computing in one sentence' }
]
const result = completion({ modelId, history, stream: true })

for await (const token of result.tokenStream) {
  process.stdout.write(token)
}

await unloadModel({ modelId })
```

## Variations

- Use `downloadAsset()` first to pre-cache models for offline use.
- Use `delegate` in `loadModel()` for P2P delegated inference. Pass
  `healthCheckTimeout: 2000` to RPC-ping the provider before the load attempt.
- Use `kvCache: true` to avoid resending context in multi-turn conversations.
- Tune sampling with `generationParams` (new in 0.9):

  ```js
  const result = completion({
    modelId,
    history,
    stream: true,
    generationParams: { temp: 0.7, top_p: 0.9, top_k: 40 },
  })
  ```

- Attach an image for multimodal models (new in 0.9 — no more base64 data URLs):

  ```js
  const result = completion({
    modelId,
    history: [
      {
        role: 'user',
        content: "What's in this image?",
        attachments: [{ path: '/absolute/path/to/photo.jpg' }],
      },
    ],
    stream: true,
  })
  ```

- Health-check before loading: `await heartbeat()` (replaces `ping()`).
