# Notebook + Briefing + Personal Node

Two small, independent command-line apps share data and functionality through the
current P2P contract. Personal Node keeps replicas available when the source app
is closed. **Experimental source example**, outside the core preview.

- **Notebook** owns a single-writer Hyperbee of explicitly shared notes. It
  exposes a versioned descriptor query, word-count summary, and cancellable
  checkpoint stream.
- **Briefing** imports only the shared contract, calls Notebook's summary service,
  and builds its own report by reading a validated replica at a known checkpoint.
- **Personal Node** mirrors Notebook's notes and Briefing's reports as separately
  owned resources. The optional native test uses the actual desktop Bare daemon
  and its command bridge.

```text
Notebook ── granted describe / summary / watch ──> Briefing
   │                                               │
   │ register notes                       register reports
   ▼                                               ▼
                  Personal Node
          verified copies of both datasets
                       │
          Notebook can now be stopped
                       ▼
          fresh Briefing reads known notes
```

The node hosts replication, not Notebook's domain handlers. Live summary/watch
calls require Notebook to be reachable. Briefing can compute its report locally
from a downloaded checkpoint without Notebook. This is deliberate separation
between shared functionality and shared data.

## When to use this architecture

Use this pattern when an app needs another copy of explicitly shared data, or
another compatible app must read that copy while the original writer is closed.
Keep basic use and writes local. Direct peer RPC alone does not need a Personal
Node, and the node does not automatically host your app's domain handlers.

For your own app, follow [the runtime](src/runtime.js): attach `syncPack({ store })`
to its existing P2P runtime, pair using a desktop-created invitation, and register
the complete intended resource manifest with stable IDs and `mirror` protection.
Wait for the intended checkpoint to be protected before claiming it is copied.
Persist the paired node key for reconnects; handle denial, quotas, cancellation,
and missing peers. Keep networking and storage in the worker for desktop apps.
Use [the shared contract](src/contract.js) to see how app schemas and capabilities
are agreed independently of transport and pairing.

This is an experimental source integration, not an automatic scaffold feature.
Same-computer replicas do not protect against losing that computer. Full backup,
retention, recovery, and physical-device acceptance remain separate work.

## Reproduce the automated proof

From the repository root, using Node 22.17+ and npm:

```bash
npm ci --prefix packages/p2p
npm ci --prefix packages/node
npm ci --prefix examples/personal-node-ecosystem
npm run demo --prefix examples/personal-node-ecosystem
npm test --prefix examples/personal-node-ecosystem
```

The demo runs actual library and daemon instances with separate identities and
storage directories over an isolated localhost DHT. It needs permission to bind
local sockets; it does not depend on public discovery, a model download, or a
running desktop. Temporary storage is removed when it finishes.

Expected demo milestones:

1. Briefing calls Notebook's summary service: one note, five words.
2. Personal Node reports Notebook's checkpoint as protected.
3. All apps and the node stop. The node restarts with its persisted identity.
4. A fresh Briefing, with no downloaded notes and only the previously shared
   descriptor, retrieves the checkpoint from the node while Notebook stays off.
5. Briefing registers its own report; the node has two resource owners.
6. With no connected peers, Briefing reopens its report and Notebook accepts an
   offline edit.
7. Remembered identities reconnect with explicit capability requests. The updated
   checkpoint reaches Briefing through the node after Notebook stops again.

The regression suite additionally checks unknown-peer denial, ungranted methods,
incompatible capability and data versions, stream cancellation and subsequent
reuse, persistent revocation, missing-checkpoint timeout/cancellation, and
rejection of a second app claiming another app's resource.

## Verify the desktop worker

After installing desktop dependencies:

```bash
npm ci --prefix packages/node-desktop
RUN_ELECTRON_SIDECAR_E2E=1 npm test --prefix examples/personal-node-ecosystem
```

This launches the desktop's real `createDaemonHost` through `bare-sidecar`, using
the existing local-DHT fixture. It creates scoped invitations over the desktop
command bridge, mirrors notes, stops the source apps, restarts the worker, and
downloads notes into a fresh Briefing before mirroring its report.

On 20 October 2026, all five integration tests passed on the maintainer's macOS
machine, including this Bare worker test. The ordinary suite skips that one test
unless explicitly enabled. The daemon tests run the two app runtimes in one Node
process; the native test moves the desktop daemon into its own Bare process.
The CLI entry points below can run as independent processes.

This worker test is **not** evidence of Electron UI, signed installer, real AI, physical
cross-device, public DHT, or operating-system-wide offline acceptance. CI is
configured to run the native test on the desktop platform matrix; local success
does not assert those CI results.

## Use the actual desktop dashboard

The dashboard flow is also automated against the real Electron app, its Bare
worker, and independently running Notebook/Briefing CLI processes:

```bash
# From the repository root, after the installs above:
pnpm --dir packages/cli install --frozen-lockfile
node scripts/personal-node-dashboard-e2e.mjs --output /tmp/personal-node-dashboard-results
# Keep the final dashboard and both app processes connected for inspection:
node scripts/personal-node-dashboard-e2e.mjs --keep-open --output /tmp/personal-node-dashboard-results
```

The runner uses a separate temporary Electron profile and app stores, creates
pairing codes by clicking the dashboard, checks verified copies and live
connections, pauses in Simple and resumes in Advanced, changes a storage limit,
and propagates an offline edit into a new Briefing report. It checks that the
view choice survives reload, the dismissed welcome guide stays closed, and
switching views preserves permissions. It captures both views and both data
inspectors. `--keep-open` leaves the verified scene running until Ctrl+C; the
runner then closes its own apps and removes its temporary stores.

This flow passed on the maintainer's macOS machine on 20 October 2026 using
public DHT discovery with all processes on the same computer. It is an explicit
network-dependent acceptance command, not a deterministic CI gate. It does not
establish physical-device, signed-installer, or real-AI acceptance.

Use disposable demo notes. From this example directory:

```bash
node notebook.js put launch "Launch plan" "Ship a useful local app"
```

Start Personal Node Desktop as described in its
[README](../../packages/node-desktop/README.md). In Simple view, choose
**Connect an app** to create a single-use, short-lived data-sharing code.
Advanced also offers **Create pairing code** with configurable permissions.
Keep the dashboard open.

In terminal A, replace `NODE_CODE_FOR_NOTEBOOK` with that code:

```bash
node notebook.js serve --node-invite NODE_CODE_FOR_NOTEBOOK
```

Wait for `verified checkpoint`. The command prints the node's public key and a
separate one-use Notebook invitation. In terminal B, use that Notebook code:

```bash
node briefing.js link --invite NOTEBOOK_CODE
```

This calls the summary service and saves the dataset descriptor, without
downloading note payloads. Stop Notebook with Ctrl+C in terminal A.

Create a **new** one-use pairing code in the desktop for Briefing, then run:

```bash
node briefing.js sync --node-invite NODE_CODE_FOR_BRIEFING
```

Briefing downloads the known note checkpoint from the desktop and registers its
own report. The dashboard should show **Notebook** and **Briefing** with distinct
resources and verified copies. This command exits after syncing, so Briefing
then appears offline while its verified copy remains available.

To see both apps **connected** at the same time, restart Notebook with
`node notebook.js serve --node-key NODE_PUBLIC_KEY`, and run
`node briefing.js sync --node-key NODE_PUBLIC_KEY --stay-open` in another terminal.
The dashboard distinguishes each app's connection from its verified-copy state
and labels pairing-code authorization without asking for redundant approval.
Stop the app processes and desktop before reading the saved result:

```bash
node briefing.js show
node notebook.js show launch
```

For another revision, keep Notebook stopped while writing:

```bash
node notebook.js put launch "Revised plan" "Edits work without the desktop"
```

Restart the desktop and run `node notebook.js serve --node-key NODE_PUBLIC_KEY`.
While Notebook is serving, run `node briefing.js link` to refresh the descriptor
using its saved Notebook identity; then stop Notebook and run
`node briefing.js sync --node-key NODE_PUBLIC_KEY`. Reconnecting explicitly
requests the contract methods, bounded by the saved grants.

These commands use public discovery and need reachable peers. A lost
invitation, denied grant, unreachable peer, or incompatible contract fails
explicitly; it does not trigger automatic mutation replay.

Each app defaults to its own ignored `.data/notebook` or `.data/briefing`
directory. Use `--storage PATH` for another installation, consistently on every
command. Never run two processes against the same app storage simultaneously.
The CLI does not print or copy private identity seeds; treat pairing codes and
dataset keys as sensitive and do not commit local state.

## Compatibility and security boundaries

- [contract.js](src/contract.js) owns capability version 1, dataset schema version
  1, and record validation. Briefing does not import Notebook's implementation.
  Change versions deliberately; no schema negotiation or migration is implied.
- The summary is a real app-defined RPC, not AI or a mock. `watch` coalesces edits,
  obeys cancellation, and releases its listener. It is not a durable subscription.
- Only Notebook writes the notes core. Briefing reads a pinned checkpoint and
  commits a report only after all records validate. Errors leave the previous
  report intact.
- `/sync` administration is scoped to the authenticated owner. Briefing cannot
  inspect Notebook's node manifest or register its key as its own resource.
- The shared core is **not application-encrypted**. Knowing its key grants read
  access to available blocks, independent of control-plane RPC grants. Sharing
  a descriptor means sharing that dataset. Reports retain the source descriptor;
  sharing the report dataset also discloses that source key.
- Revoking a peer prevents further granted calls; it cannot erase downloaded
  notes or revoke a known data key. Use only explicitly shareable demo data.
  Private sharing requires a separate encryption/key-rotation design.
- A protected checkpoint is a verified replica, not a complete backup or an
  assurance about later writes. This does not add multi-writer hosting, purge,
  identity recovery, or remote execution of arbitrary app code.

See the [desktop review](../../docs/personal-node-review.md) and
[validation boundaries](../../docs/validation.md) for remaining work.
