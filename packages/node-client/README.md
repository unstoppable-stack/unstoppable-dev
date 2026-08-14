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
  requestedCapabilities: {
    resources: ['register', 'status'],
    storage: ['usage'],
    ai: ['completion.stream']
  }
})

// This app's resources and logical storage use; other apps are never included.
const status = await client.getNodeStatus()

// This app's logical replicated bytes (not the node's path or global use).
const usage = await client.getDiskUsage()

// Stream AI tokens through the node. AbortSignal and a timeout are supported.
const controller = new AbortController()
for await (const token of client.requestInference({
  messages: [{ role: 'user', content: 'hi' }],
  signal: controller.signal,
  timeout: 120_000
})) {
  process.stdout.write(token)
}

await client.close()
```

## Resource manifests and verified retention

For apps with dynamic writer sets or resources that must be retained in full,
prefer a complete resource manifest over the legacy `cores` / `drives` arrays:

```js
const client = await connectToNode({
  appId: 'my-app',
  appName: 'My App',
  reconnect: true,
  resourceManifest: {
    schemaVersion: 1,
    resources: [
      {
        id: 'catalog-writer-phone',
        kind: 'hyperbee',
        key: catalog.core.key,
        name: 'Catalog writer',
        metadata: { role: 'catalog-writer' },
        protection: { mode: 'mirror' }
      },
      {
        id: 'originals',
        kind: 'hyperdrive',
        key: originals.key,
        name: 'Original files',
        metadata: { role: 'originals' },
        protection: { mode: 'mirror' }
      }
    ]
  }
})

// Replace the complete set when a writer/resource is added or removed.
await client.replaceResourceManifest(nextManifest)

const { resources } = await client.getProtectionStatus()
const protectedNow = resources.every(({ protection }) =>
  protection?.state === 'protected'
)
```

`mirror` downloads and verifies every block in the currently observed core or
drive checkpoint. `metadata-only` registers and seeds metadata without forcing
all sparse content to be retained. Removing a descriptor stops replication but
does not delete retained bytes. A protected checkpoint says nothing about
future writes; applications should keep polling status or react to their own
write lifecycle before presenting durable-protection claims.

## Client methods

| Method | Purpose |
| ------ | ------- |
| `getNodeStatus()` | Fresh app-scoped service, resource, storage, quota, and AI status |
| `getProtectionStatus()` | Normalized protection state for this app's cores and drives |
| `getDiskUsage()` | This app's logical replicated bytes; no node path or global use |
| `replaceResourceManifest()` | Replace the installation's complete resource set |
| `requestInference()` | Stream tokens from the node with timeout and abort support |
| `peekCore()` / `peekDrive()` | Debug an owned resource; requires an explicit `resources.peek` grant |
| `sendHeartbeat()` | Send the app uptime while paired |
| `close()` | Stop reconnecting, close discovery, and reject pending operations |

## Events

| Event              | Payload                                                                |
| ------------------ | ---------------------------------------------------------------------- |
| `searching`        | nothing — fired each time we (re)join the discovery topic              |
| `candidateFound`   | `{ publicKey }` — a peer answered, awaiting `nodeHello`                |
| `nodeHello`        | `{ nodePublicKey, services, protocolVersion }`                         |
| `paired`           | `{ nodePublicKey, services, capabilities, grants }`                    |
| `registered`       | `{ replicating }` — pairing + registration done                        |
| `pairDenied`       | `{ reason }`                                                           |
| `syncStatus`       | node-sent replication status update                                    |
| `nodeStatus`       | app-scoped status snapshot (also returned by `getNodeStatus()`)        |
| `resourceManifestReplaced` | `{ manifest, resources }` after a successful replacement       |
| `disconnected`     | nothing — socket dropped                                               |
| `reconnecting`     | `{ attempt, delayMs }` — only when `reconnect` is enabled              |
| `reconnected`      | `{ attempts }`                                                         |
| `reconnectFailed`  | `{ attempts }` — `maxAttempts` reached                                 |
| `nodeError`        | node or control-frame error                                            |
| `closed`           | nothing — client resources have closed                                |

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

Request-specific failures are also `NodeClientError` instances and use codes
such as `CAPABILITY_DENIED`, `STATUS_TIMEOUT`, `PEEK_TIMEOUT`,
`MANIFEST_TIMEOUT`, or `INVALID_RESOURCE_MANIFEST`.

## Discovery topic

By default the client and node both compute the topic from
`${user}@${hostname}` so two processes on the same machine pair automatically
with zero configuration. Override with `topic: Buffer` if you need a
non-default rendezvous (multi-user, custom deployments, tests).

The default topic is intentionally machine-local. A phone or second computer
will not discover it automatically. A product should add an explicit,
authenticated device-linking flow before sharing an override topic between
devices; the SDK does not yet provide that onboarding flow.

## License

MIT
