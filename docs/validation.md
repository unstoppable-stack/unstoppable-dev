# Validation and release checks

This page describes reproducible checks, not certification of a release.
The core preview covers assistant setup and app scaffolding. See
[SUPPORT.md](../SUPPORT.md) for scope. Planning notes and historical local
reports are not required to build or test a public checkout.

## Maintained assets and CLI

From the repository root, after installing CLI dependencies:

```bash
node scripts/sync-stack-assets.mjs
node scripts/sync-stack-assets.mjs --check
node scripts/check-agent-pack.mjs
node --test packages/runtime-ai/test/*.test.js
pnpm --dir packages/cli typecheck
pnpm --dir packages/cli test
pnpm --dir packages/cli build
```

Runtime tests exercise lifecycle contracts with test adapters. CLI tests cover
scaffolds, assistant output, and compatibility checks. These checks do not prove
that a fresh native SDK/model installation works on every platform.

See [CLI testing](../packages/cli/README.md#development) for platform-specific
E2E commands. Mock runs verify wiring and UI flows; they do not validate model
loading, native cancellation/reuse, or offline inference.

## Release artifacts and native acceptance

The P2P correctness/API work has a standalone installed-consumer gate:

```bash
npm test --prefix packages/p2p
npm run test:types --prefix packages/p2p
node scripts/p2p-artifact-smoke.mjs
npm ci --prefix examples/p2p-database
npm test --prefix examples/p2p-database
npm run demo --prefix examples/p2p-database
BARE_BIN=/absolute/path/to/supported/bare node scripts/p2p-artifact-smoke.mjs --bare
```

It packs the library into a temporary directory, installs it outside the checkout,
checks that ordinary consumers do not install the optional Autobase engine, tests
notes replication/offline restart and typed RPC, explicitly installs Autobase
7.28.2, then runs the experimental database acceptance tests. The optional Bare
step verifies native storage, advisory locks, ownership and sync attach/reopen.
Fresh dependency resolution requires Bare >=1.32.0; the maintained desktop
sidecar's Bare 1.34.1 was exercised. A global Bare 1.28.6 passes the older locked
source tree but fails current registry resolution, so it is not a fresh-install
acceptance runtime. These checks do not publish artifacts or validate native AI.

The database prototype tests cover actual Autobase offline convergence,
authenticated membership, adversarial log entries, writer removal, encrypted
fresh-reader reconstruction and coexistence with RPC on a paired connection.
They do not establish complete database backup, administrator recovery, schema
migration or support for the `multi-writer` + `node-sync` combination.

The [canonical package preparation](public-release.md) tests the CLI beta and
P2P alpha as installed tarballs outside the repository. The P2P notes example
covers granted RPC/streaming, denied access, real replication, and offline
replica restart. Its workflow also checks a Node 20 consumer. The allowlist,
archive checks and exact artifact hashes keep deferred packages out of this
release. This flow prepares packages; it does not publish them.

The [public preview workflow](../.github/workflows/public-preview.yml) builds
and tests the installed CLI artifact and generated desktop UI on macOS arm64.
Its optional `real_model` input enables real-model and offline checks.
[scripts/release-smoke.sh](../scripts/release-smoke.sh) implements the flow;
[scripts/release-artifacts.mjs](../scripts/release-artifacts.mjs) records
checksums and verifies packed manifests. Consult the actual workflow run and
artifact records for results on a specific commit.

Fresh native installation, real inference, cancellation/reuse, offline restart,
and platform coverage remain separate acceptance gates. Expo needs
physical-device validation of its complete native graph. Personal Node remains
outside the core preview; its release gate and signed desktop packaging checks
are documented in the [desktop README](../packages/node-desktop/README.md).

Compatibility profile validation strings may summarize historical maintainer
runs. This page documents their public reproduction paths; it does not publish
the internal reports or claim those runs have been repeated for a new checkout.

## Personal Node ecosystem example

The [Notebook + Briefing example](../examples/personal-node-ecosystem/README.md)
tests two different app implementations using a shared versioned contract and
separate stores. After installing P2P and Personal Node dependencies:

```bash
npm ci --prefix examples/personal-node-ecosystem
npm run demo --prefix examples/personal-node-ecosystem
npm test --prefix examples/personal-node-ecosystem
# After installing packages/node-desktop dependencies:
RUN_ELECTRON_SIDECAR_E2E=1 npm test --prefix examples/personal-node-ecosystem
```

Tests use an isolated local DHT, real RPC and Hyperbee replication. They cover a
fresh reader retrieving a checkpoint from the restarted node with the writer
stopped, app-owned reports, offline local reopen/edits, explicit reconnect grants,
permission denial, version rejection, cancellation and persistent revocation.
The optional native case runs the actual desktop daemon in a Bare sidecar.
No AI, Electron UI, signed artifact, public-network, physical-device or
operating-system-wide offline acceptance is implied. Personal Node remains alpha.

For a separate actual-dashboard acceptance run, also install desktop and CLI
development dependencies (the CLI supplies Playwright), then run:

```bash
node scripts/personal-node-dashboard-e2e.mjs --output /tmp/personal-node-dashboard-results
```

This opens Electron with an isolated profile and launches the two CLI apps as
separate processes. It clicks dashboard pairing controls, verifies both replicas,
checks source-offline retrieval, connection/authorization labels, Simple-to-Advanced
pause/resume, storage-limit validation, unchanged grants across view switches,
saved view selection and dismissed onboarding after reload, and propagation of
an offline edit. It captures both views, resource inspectors, and a result file.
The Simple browser must also display the updated Notebook note and Briefing
report as readable content without switching to Advanced.
Public discovery must be reachable; this is a same-computer acceptance flow,
not a signed-installer or physical-device gate. Add `--keep-open` to inspect
both connected apps after success; Ctrl+C performs cleanup.

## Assistant plugins

Published CLI beta.3 exposes `us plugin install claude|codex` and
`us plugin status [claude|codex]`. The [registry acceptance record](../release/registry-acceptance-2026-10-20-beta3.json) binds the fresh npm install to the tested CI tarball. CLI tests cover
native command arguments, repeat installs, disabled plugins, catalog conflicts,
legacy-host fallback, malformed output and partial failures through host
fixtures. They do not change real user plugin installations. Status is read-only:

```bash
node packages/cli/dist/us.js plugin status
node packages/cli/dist/us.js plugin status codex --json
```

Missing hosts or unavailable status return exit 1; a verified absent plugin
returns exit 0. Before release, use isolated assistant configurations to install
from a built CLI, repeat the install, inspect enabled/disabled status, then
start a new session in a separate workspace and invoke the entry skill. Record
host/plugin/CLI versions and results. The [20 October 2026 live CLI check](../release/plugin-cli-2026-10-20.json) records real installation and explicit skill invocation in fresh Codex and Claude sessions, including reads of the installed CLI-install resource. A passing command fixture or native list is not evidence of session activation or successful app building.

```bash
node packages/agent-pack/scripts/build-plugin.mjs
node --test packages/agent-pack/scripts/build-plugin.test.mjs
node packages/agent-pack/scripts/smoke-plugin-hosts.mjs
```

The host smoke needs installed Codex and Claude executables. See
[plugin setup and limitations](../packages/agent-pack/PLUGIN.md). Plugin manifest
and discovery checks do not establish the quality of an assistant-driven app.

## Public checkout hygiene

Internal plans, copied research, sandbox results, and local assistant settings
are ignored. CI fixtures live in `examples/`; public CI must not depend on
ignored directories. Upstream reference checkouts are local maintainer material and are not included
in the public repository.

Removing a file from the current tree does not remove older Git objects. Review
the intended published history separately before changing repository visibility.

## Ecommerce desktop example

The database example uses paired peers over a local DHT, destroys both
transports before offline edits, restarts from disk, compares derived views and
observes writer removal. It does not establish public discovery, full backup,
Bare or desktop database acceptance.

The [Local Goods example](../examples/ecommerce-assistant/README.md) replaces
Coffee Assistant with a catalog, persistent cart, local demo checkout, and
catalog-aware assistant. Checkout has no payment or fulfillment integration.
After installing the example, P2P and CLI development dependencies:

```bash
node --test examples/ecommerce-assistant/test/*.test.js
node scripts/ecommerce-example-e2e.mjs
ECOMMERCE_TEST_PUBLIC_DHT=1 node scripts/ecommerce-example-e2e.mjs
```

The default desktop check uses real app instances and an isolated local DHT.
A separate device starts and checks out with an unreachable loopback bootstrap,
confirming local startup does not wait for DHT announcement. This is not full
operating-system offline or offline-inference acceptance.
It checks catalog filtering, quantity changes, cart restart persistence,
checkout totals, duplicate-reference rejection, receipt persistence, peer
retrieval, visible disconnect and a new order after reconnect. It does not
load a model or prove public Internet discovery. Native shopping responses,
offline inference and packaged-artifact acceptance remain separate checks.

The Local Goods RPC flow uses a single-use, 15-minute invitation and persistent
peer grants. Its desktop regression checks private `_cart` reference rejection
and retrieval after full host restart. It does not replicate the private store.
Receipt field allowlisting and malformed stored-record rejection are covered by
its application tests. These checks do not establish customer identity or payments.

### Managed P2P data: discovery and two-device acceptance

`npm test --prefix packages/p2p` includes data-only connection lifetime beyond
an RPC handshake deadline, bounded discovery retries, offline open, network
wait cancellation, and the host/join CLI flow in separate processes. The process
test uses an isolated loopback DHT; it is not public-internet or two-device proof.
`node scripts/p2p-artifact-smoke.mjs` also checks managed data against a packed
installation outside the checkout.

On 20 October 2026, a [manual published-package test](../release/public-discovery-2026-10-20.json)
on one Mac on a home network passed both examples using default public discovery
with no private bootstrap. The reader printed `DOWNLOADED`; after explicit writer
approval, the founder printed `OBSERVED`. Discovery reported 75–100 DHT peers.
This demonstrates public DHT reachability and data exchange between separate
processes; it does not establish cross-device or cross-network connectivity.

For cross-device public-network acceptance, follow the
[two-device example](../examples/p2p-data/README.md#use-two-devices) on two physical
devices. Record runtime versions, whether devices are on the same/different
networks, the writer's successful announcement, the reader's `DOWNLOADED`
result, and the founder's `OBSERVED` result after explicit writer approval.
Keep the host alive through transfer. Repeat after restarting with retained
storage, and after disconnecting/reconnecting the network. Do not publish dataset
or writer keys from private application data in validation logs.

If `DATA_NETWORK_TIMEOUT` reports zero DHT peers, test bootstrap UDP reachability
before diagnosing database convergence. DNS and HTTPS success are insufficient.
A failed public probe must remain a failed/unverified acceptance boundary even
when local tests pass; changing a timeout or using a private loopback bootstrap
is not evidence that the public path works.
