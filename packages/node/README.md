# unstoppable-node

> Personal sync node for [Unstoppable Stack](https://unstoppable.dev) apps —
> replicates, backs up, and seeds your P2P data.

A long-running Node.js / Bare process that:

- Joins a local Hyperswarm topic so your apps can find it without configuration
- Pairs with apps that send a `pairRequest` (with an optional approval gate)
- Replicates Hypercores and Hyperdrives the apps register with it
- Optionally serves AI inference (mock or QVAC-backed)
- Persists a registry of paired apps under its storage directory

You don't usually run `unstoppable-node` directly — the
[`us` CLI](https://www.npmjs.com/package/@unstoppable-stack/cli) ships a
friendlier wrapper:

```bash
us node start --ai-mock    # spawn in background
us node status -n 20       # check it, tail recent log lines
us node stop               # SIGTERM the daemon
```

Or run the [Pear Desktop dashboard](../node-desktop) for a UI.

## Install

```bash
npm install unstoppable-node
```

For AI support, also install `@qvac/sdk` (optional peer dep):

```bash
npm install @qvac/sdk
```

## Usage (programmatic)

```js
import { NodeDaemon } from 'unstoppable-node/node'

const node = new NodeDaemon('./storage', {
  ai: { mock: true },               // or { modelSrc: '...' } for QVAC
  approvePairing: async (req) => {  // omit to auto-approve every pair
    return 'approve-remember'
  }
})

node.on('ready', ({ topic, publicKey }) => console.log('ready', topic, publicKey))
node.on('pairRequest', (req) => console.log('pair from', req.appId))
node.on('paired', (info) => console.log('paired', info.appId))

await node.start()

// Headless snapshot — also available over the wire via
// `client.getNodeStatus()` from `@unstoppable/node-client`.
const status = await node.getStatus()

// Toggle services live.
await node.enableAI({ mock: true })
await node.disableAI()

// Pause / resume per-app replication without unpairing.
await node.pauseApp('my-app')
await node.resumeApp('my-app')
```

## CLI usage

```bash
unstoppable-node --storage ./my-storage --ai-mock
```

| Flag                | Effect                                        |
| ------------------- | --------------------------------------------- |
| `--ai`              | Load the real QVAC AI provider                |
| `--ai-mock`         | Use the mock AI provider (no model download)  |
| `--ai-model <src>`  | QVAC model source (preset name or URL)        |

Storage path comes from positional arg or `--storage`.

## Tests

```bash
npm test       # 75 tests under Node.js
```

## License

MIT
