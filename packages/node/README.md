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
npm install -g unstoppable-node
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
unstoppable-node start --storage ./my-storage --ai-mock
```

| Flag                | Effect                                        |
| ------------------- | --------------------------------------------- |
| `--ai`              | Load the real QVAC AI provider                |
| `--ai-mock`         | Use the mock AI provider (no model download)  |
| `--ai-model <src>`  | QVAC model source (preset name or URL)        |

Storage path comes from positional arg or `--storage`.

## Quickstart

```bash
npm install -g unstoppable-node
npx unstoppable-node start --ai-mock
```

In another terminal, run an app that uses `@unstoppable/node-client` with
`requireServices: ['ai']`. The node will pair with the app, register its cores
and drives, and stream mock inference without downloading a model.

## Tests

```bash
npm test       # default Node.js tests; real QVAC test is skipped unless opted in
```

Real QVAC validation is opt-in because it requires `@qvac/sdk` and a model
source. Use a local path, preset, or URL accepted by QVAC:

```bash
npm install @qvac/sdk
QVAC_MODEL_SRC=/path/or/url/to/model npm run test:qvac
```

Optional knobs:

| Env var             | Effect                                  |
| ------------------- | --------------------------------------- |
| `QVAC_MODEL_SRC`    | Required model source for real QVAC     |
| `QVAC_MODEL_TYPE`   | Model type, defaults to `llm`           |
| `QVAC_TEST_TIMEOUT` | Test timeout in ms, defaults to 300000  |

## License

MIT
