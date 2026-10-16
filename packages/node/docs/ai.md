# Personal Node QVAC adapter

> **Release status:** deferred alpha. This adapter is not part of the core
> developer preview, and its npm installation path is not approved yet.

Delegated local inference as a capability pack for
`@unstoppable-stack/p2p`. A peer with the appropriate grant can stream a
completion from a model running on the host node.

## Modes

- Real mode dynamically imports `@qvac/sdk`, loads the configured model, and
  streams completion output.
- Mock mode emits deterministic `Mock: ...` output for protocol and UI tests.
  Mock output must remain visibly identified and is not release evidence for
  local inference.

`@qvac/sdk` is loaded directly by Personal Node only on hosts intended to run
models. This is internal application code, not a separately published package.

## Usage

```js
import { createNode } from '@unstoppable-stack/p2p'
// Internal Personal Node implementation; no public AI-wrapper package.
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

Real QVAC validation requires SDK 0.15.0 and an explicit model source:

```bash
npm install --no-save @qvac/sdk@0.15.0
QVAC_MODEL_SRC=/path/or/url/to/model npm run test:qvac
```

The real-model command validates model loading and non-empty streaming over the
capability bus. It does not by itself establish cancellation, offline restart,
resource, or multi-platform support.

## License

MIT
