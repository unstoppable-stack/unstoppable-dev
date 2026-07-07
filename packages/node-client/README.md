# @unstoppable-stack/node-client

> SDK for [Unstoppable Stack](https://unstoppable.dev) apps to connect to a
> local [`unstoppable-node`](https://www.npmjs.com/package/unstoppable-node)
> for data replication, file sync, and delegated AI inference.

Works under Node.js, Bare (Pear Desktop / Expo Bare), and any runtime that
ships Hyperswarm.

## Install

```bash
npm install @unstoppable-stack/node-client
```

Start a local node in another terminal:

```bash
npx unstoppable-node start --ai-mock
```

## Usage

```js
import { connectToNode } from '@unstoppable-stack/node-client'

const client = await connectToNode({
  appId: 'my-app',
  appName: 'My App',
  cores: [{ key: bee.core.key, type: 'hyperbee', name: 'data' }],
  drives: [{ key: drive.key, name: 'files' }],
  requireServices: ['data'],   // fail fast if the node doesn't offer this
  reconnect: true,             // opt-in: re-pair on disconnect with backoff
})

// Snapshot of the node's state (paired apps, services, storage, AI).
const status = await client.getNodeStatus()

// Walk the storage directory for actual bytes-on-disk (slow).
const usage = await client.getDiskUsage()

// Stream AI tokens through the node.
for await (const token of client.requestInference({
  messages: [{ role: 'user', content: 'hi' }]
})) {
  process.stdout.write(token)
}

await client.close()
```

## Events

| Event              | Payload                                                                |
| ------------------ | ---------------------------------------------------------------------- |
| `searching`        | nothing — fired each time we (re)join the discovery topic              |
| `candidateFound`   | `{ publicKey }` — a peer answered, awaiting `nodeHello`                |
| `nodeHello`        | `{ nodePublicKey, services, protocolVersion }`                         |
| `registered`       | `{ replicating }` — pairing + registration done                        |
| `pairDenied`       | `{ reason }`                                                           |
| `nodeStatus`       | full status snapshot (also returned by `getNodeStatus()`)              |
| `disconnected`     | nothing — socket dropped                                               |
| `reconnecting`     | `{ attempt, delayMs }` — only when `reconnect` is enabled              |
| `reconnected`      | `{ attempts }`                                                         |
| `reconnectFailed`  | `{ attempts }` — `maxAttempts` reached                                 |

## Typed errors

Every rejection is a `NodeClientError` (or subclass) with a stable `.code`:

```js
import {
  connectToNode,
  NodeNotFoundError,
  NodeDeniedError,
  NodeMissingServiceError,
  InvalidOptionError,
  ClientClosedError,
  InferenceError,
} from '@unstoppable-stack/node-client'

try {
  await connectToNode({ appId, appName, requireServices: ['ai'] })
} catch (err) {
  if (err.code === 'NODE_NOT_FOUND') { /* tell user to start the node */ }
  if (err.code === 'NODE_MISSING_SERVICE') {
    console.log('missing:', err.missing)
    console.log('advertised:', err.services)
  }
}
```

| Code                    | Class                       |
| ----------------------- | --------------------------- |
| `NODE_NOT_FOUND`        | `NodeNotFoundError`         |
| `NODE_DENIED`           | `NodeDeniedError`           |
| `NODE_MISSING_SERVICE`  | `NodeMissingServiceError`   |
| `INVALID_OPTION`        | `InvalidOptionError`        |
| `CLOSED`                | `ClientClosedError`         |
| `INFERENCE_ERROR`       | `InferenceError`            |

## Discovery topic

By default the client and node both compute the topic from
`${user}@${hostname}` so two processes on the same machine pair automatically
with zero configuration. Override with `topic: Buffer` if you need a
non-default rendezvous (multi-user, custom deployments, tests).

## License

MIT
