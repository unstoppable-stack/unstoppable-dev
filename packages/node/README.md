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
// `client.getNodeStatus()` from `@unstoppable-stack/node-client`.
const status = await node.getStatus()

// Toggle services live.
await node.enableAI({ mock: true })
await node.disableAI()

// Pause / resume per-app replication without unpairing.
await node.pauseApp('my-app')
await node.resumeApp('my-app')

// Set an advisory per-app quota in bytes; null returns to the default.
await node.setAppQuota('my-app', 1024 * 1024 * 1024)
```

## CLI usage

```bash
unstoppable-node start --storage ./my-storage --ai-mock
unstoppable-node export ./node-backup.uns --storage ./my-storage
unstoppable-node inspect ./node-backup.uns
unstoppable-node import ./node-backup.uns --storage ./restored-storage
```

| Flag                | Effect                                        |
| ------------------- | --------------------------------------------- |
| `--ai`              | Load the real QVAC AI provider                |
| `--ai-mock`         | Use the mock AI provider (no model download)  |
| `--ai-model <src>`  | QVAC model source (preset name or URL)        |

Storage path comes from positional arg or `--storage`.

## Export/import

Export/import currently writes a JSON `.uns` bundle containing:

- Node config (`node-config.json` contents)
- Paired-app registry records, including registered cores/drives, grants, paused
  state, and per-app quota overrides
- Dashboard trust decisions (`trust-registry.json`)

The dashboard previews bundle metadata, app list, config presence, and trust
counts before importing. The CLI can print the same read-only summary with
`unstoppable-node inspect <backup.uns>`. Importing overwrites existing paired-app
records with the same app IDs and replaces config/trust files included in the
bundle.

This is not a full data archive yet. It does not include encrypted Corestore
data, stable node identity seeds, or replicated app payloads.

## Storage quotas

Quotas are advisory safety limits, not hard write barriers. The daemon tracks
replicated bytes, reports quota state in `getStatus().storage.quotas`, and pauses
app announcements when an app exceeds its configured limit. Existing local data
is not deleted, and writes already flowing through Hypercore/Corestore may still
arrive.

Quota sources:

| Scope | Where to set it |
| ----- | --------------- |
| Global total | Dashboard Config → Global storage quota |
| Default per-app | Dashboard Config → Per-app storage quota |
| Specific app | Dashboard app row → Quota, or `node.setAppQuota(appId, bytes)` |

Use `null` for unlimited/default values. Resume an over-quota app after raising
or clearing its quota with `node.resumeApp(appId)` or the dashboard Resume
button.

## Quickstart

```bash
npm install -g unstoppable-node
npx unstoppable-node start --ai-mock
```

In another terminal, run an app that uses `@unstoppable-stack/node-client` with
`requireServices: ['ai']`. The node will pair with the app, register its cores
and drives, and stream mock inference without downloading a model.

## Tests

```bash
npm test       # default Node.js tests; real QVAC test is skipped unless opted in
```

Discovery stability can be stress-tested against one long-lived daemon and many
fresh clients:

```bash
npm run discovery:stress
```

Optional knobs:

| Env var                      | Effect                                        |
| ---------------------------- | --------------------------------------------- |
| `NODE_DISCOVERY_RUNS`        | Pairing attempts, defaults to 20              |
| `NODE_DISCOVERY_TIMEOUT_MS`  | Per-client timeout, defaults to 5000          |
| `NODE_DISCOVERY_WARMUP_MS`   | Daemon ready warmup delay, defaults to 0      |
| `NODE_DISCOVERY_TOPIC`       | `isolated` or `default`, defaults to isolated |

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
