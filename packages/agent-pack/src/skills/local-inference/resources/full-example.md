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
- Use `delegate` in `loadModel()` for P2P delegated inference.
- Use `kvCache: true` to avoid resending context in multi-turn conversations.
