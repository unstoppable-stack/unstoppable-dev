# Personal Node internal QVAC adapter

> **Release status:** deferred alpha. This adapter belongs to the optional
> Personal Node app. It has no separately published AI-wrapper package.

Delegated local inference as a capability pack for
`@unstoppable-stack/p2p`. A peer with the appropriate grant can stream a
completion from a model running on the host node.

## Modes

- Real mode uses `@qvac/sdk@0.21.0` in Node or `@qvac/inference@0.21.0` in Bare, loads the configured model, and
  streams completion output.
- Mock mode emits deterministic `Mock: ...` output for protocol and UI tests.
  Mock output must remain visibly identified and is not release evidence for
  local inference.

`@qvac/sdk` is intentionally not a production dependency of the capability
pack. Install the SDK beside Personal Node only on a host intended to run models.

## Usage

```js
import { createNode } from '@unstoppable-stack/p2p'
// Internal implementation; not a standalone public integration API.
import { aiPack } from '../src/ai/index.js'

const node = createNode({
  storage: './.my-node',
  capabilities: [aiPack({ modelSrc: '/path/or/url/to/model' })]
})

await node.ready()
await node.listen()
```

From an approved peer with the `ai.completion.stream` grant:

```js
for await (const token of peer.stream('ai', 'completion.stream', {
  messages: [{ role: 'user', content: 'Summarize this note.' }]
})) {
  process.stdout.write(token)
}
```

## Tests

The default suite uses mock mode and skips the costly real-model test:

```bash
npm test
```

Real QVAC validation requires SDK 0.21.0 and an explicit model source:

```bash
npm install --no-save @qvac/sdk@0.21.0
QVAC_MODEL_SRC=/path/or/url/to/model npm run test:qvac
```

The real-model command validates model loading and non-empty streaming over the
capability bus. It also checks peer cancellation and a subsequent completion on the same model. Offline restart, resource budgets and broader platform support require separate evidence.

## License

MIT

Bare hosts install inference 0.21.0, llama.cpp 0.55.0, bare-process and the eager language/audio helpers. The Personal Node desktop app supplies these. QVAC is an optional peer so data-only installs do not pull model addons. The default model is Qwen 3.5 0.8B with context 4096 and reasoning disabled. Each provider accepts one active completion; overlapping requests receive a busy error. Early consumer return or peer abort cancels the native request before freeing that slot. This does not replace admission, trust or durable resource-budget gates.

## Admission limits

All providers, including mocks and injected providers, share one active completion slot. Requests allow up to 64 text messages (user/assistant/system), 64 KiB UTF-8 JSON prompt, 256 KiB output and 60 seconds of inference. The capability bus additionally bounds frames, requests and consumer buffers. `RESOURCE_LIMIT` reports overload/size refusal; `REQUEST_TIMEOUT` reports the host deadline. Cancellation, grant revocation and peer disconnect abort provider work; capacity remains busy until iterator cleanup finishes. Providers must honor their AbortSignal. No arbitrary plugin can be forcibly preempted in-process.
