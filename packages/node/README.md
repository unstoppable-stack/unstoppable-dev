# unstoppable-node

> Personal sync node for [Unstoppable Stack](https://unstoppable-stack.dev) apps —
> replicates and seeds declared P2P data.

> **Deferred alpha:** the Personal Node is outside the core public preview.
> Registration starts replication; only a resource reported as `protected` has
> a locally verified copy. Export/import is settings metadata, not app-data backup.

A long-running Node.js / Bare process that:

- Joins a local Hyperswarm topic so your apps can find it without configuration
- Requires approval or a scoped invitation before granting capability access
- Replicates Hypercores and Hyperdrives the peers register with it
- Optionally serves AI inference (mock or QVAC-backed)
- Persists a registry of paired peers under its storage directory

As of 0.6 this is a **composition, not an implementation**: it is
[`@unstoppable-stack/p2p`](../p2p) with its
[sync module](../p2p/docs/sync.md) and an [internal QVAC adapter](docs/ai.md),
plus the CLI, config, and settings export/import surface. Any app can build the same thing —
that is the point. See the [P2P library](../p2p/README.md) for the shared runtime API.

Internal/full CLI builds can manage `unstoppable-node` with a wrapper. Those
commands are not part of the minimal public-preview CLI:

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

The Personal Node desktop app bundles pinned QVAC inference 0.21.0 inside its Bare sidecar. When
running the daemon from this source checkout, install the same SDK beside the
node package before enabling real AI:

```bash
cd packages/node
npm install --no-save --package-lock=false @qvac/sdk@0.21.0
```

The standalone npm package does not currently bundle QVAC. Use `--ai-mock` for
standalone development unless `@qvac/sdk` is resolvable from the node package.

## Usage (programmatic)

```js
import { PersonalNode } from 'unstoppable-node/personal-node'

const node = new PersonalNode('./storage', {
  ai: { mock: true },               // or { modelSrc: '...' } for QVAC
  approvePairing: async (req) => {  // omit to auto-approve every pair
    return 'approve-remember'
  }
})

node.on('listening', ({ publicKey }) => console.log('ready', publicKey))
node.on('pairRequest', (req) => console.log('pair from', req.profile?.appName))
node.on('paired', (info) => console.log('paired', info.publicKey))

await node.start()

// Operator-side snapshot. Peers get their own scoped view through the `sync`
// capability and never see this node's storage path or other peers.
const status = await node.getStatus()

// Pair a phone or a second computer.
const invite = await node.createInvite({ uses: 1, expiresIn: 15 * 60_000 })
console.log(invite.code)

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

New storage starts with a 10 GiB node-wide and 1 GiB per-peer logical replication budget. Existing explicit settings, including `null` for unlimited, are preserved. Set limits through Config or `setPeerQuota(publicKey, bytes)`; `null` on the peer override uses the configured default.

Admission runs before registration/resume and after metadata arrives before mirror downloads. A one-second background check runs even without status polling. Exceeding a quota pauses discovery and cancels the active mirror range; resume is refused until the quota is raised or usage is below it. Resource manifests allow 128 resources per peer and 512 registered resources node-wide. Manifest changes serialize and refuse overlap rather than queueing arbitrary work.

These are logical replication budgets, not hard filesystem quotas: retained blocks, metadata overhead, and bytes already in flight are not reclaimed. No per-peer purge or general backup/recovery is promised.

## Pairing trust boundary

Standalone/headless Personal Node denies direct unknown-peer pairing unless `approvePairing` is supplied or the operator explicitly disables `pairing.requireApproval` for development. Use a scoped invitation for unattended operation. The desktop gate prompts and remembers decisions, with 32 pending decisions and a 30-second expiry. Revoked peers remain denied across restart and cannot bypass revocation with another invite. Clearing denial is an explicit local operator action. Remembered grants remain a ceiling across reconnect.

The desktop’s embedded headless binary follows the same policy. Its `--dev-auto-approve` flag is solely an explicit development/test opt-in; smoke fixtures supply it deliberately. Local discovery and self-reported device names do not prove local identity; `autoApproveLocal` grants no bypass.

The shared bus enforces request/frame/stream limits documented in [P2P](../p2p/README.md). AI additionally admits one completion, at most 64 text messages / 64 KiB prompt, 256 KiB output, and 60 seconds of inference. Native cancellation must finish before admission is reusable. Settings exports retain revoked keys; importing an older export without this field preserves existing denials.

## Resource manifests

Node Client `0.5` can replace an app installation's complete generic resource
manifest. Descriptors have stable IDs, bounded untrusted string metadata, and a
protection mode:

- `metadata-only` preserves the previous sparse replication behavior.
- `mirror` downloads all blocks for each observed Hypercore/Hyperbee checkpoint
  and every file blob in each observed Hyperdrive checkpoint.

Manifest replacement reconciles resources: omitted keys stop replicating, but
their stored blocks are retained. App-scoped status exposes protection state,
checkpoints, remaining blocks/bytes where measurable, completion time, and the
last mirror error. The Node reports `protected` only after it has observed a
source peer and verified the current checkpoint locally.

## Disconnecting, unpairing, and retained data

- A disconnect only pauses communication. It does not erase either device.
- Pausing an app stops its announcements; already downloaded blocks remain.
- Unpairing (the desktop **Remove app** action) revokes the peer, forgets its
  registered resources, and stops their replication. Already downloaded blocks
  still remain in the Node's storage.
- This alpha has no supported per-app purge. Do not use **Remove app** as an
  erasure control. If a test profile must be discarded, stop the Node first and
  remove the entire configured storage directory (`~/.unstoppable-node` for the
  default headless CLI; the desktop's Electron user-data `node` directory for
  the packaged app). That resets every paired app and Node-local setting, so
  keep the source app's data and any needed settings export elsewhere first.

## Quickstart

```bash
npm install -g unstoppable-node
npx unstoppable-node start --ai-mock
```

In another terminal, run an app built on
[`@unstoppable-stack/p2p`](../p2p) that calls
`discover()` and then `peer.stream('ai', 'completion.stream', …)`. The node
pairs with the app, replicates the resources it registers, and streams mock
inference without downloading a model.

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

Real QVAC validation lives with the AI capability pack and is opt-in because it
requires `@qvac/sdk` and a model source. Use a local path, preset, or URL
accepted by QVAC:

```bash
cd ../node
npm install --no-save @qvac/sdk@0.15.0
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

### Local package development

Source development uses a local P2P link. Install P2P and then Personal Node.
`node scripts/node-package-smoke.mjs` packs the two release artifacts with the
known link replaced by a matching semver range, then verifies them in an
isolated consumer. The AI adapter lives in `src/ai/`; native QVAC inference is
an opt-in host dependency and requires its own acceptance checks.
