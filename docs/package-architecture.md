# Packages and release boundaries

The release uses a CLI, one P2P library and two assistant plugin distributions.
Personal Node is a separate optional application. QVAC and wallet functionality
come from upstream SDKs, not separately published Unstoppable wrapper packages.

| Component | Responsibility | Status |
| --- | --- | --- |
| `@unstoppable-stack/cli` | Workspace setup, app scaffolding, diagnostics and compatibility checks | `0.4.0-beta.1` published under `beta`; `latest` remains `0.3.0` |
| `@unstoppable-stack/p2p` | Identity, discovery, pairing, permissions, RPC, streaming and optional replication | `0.6.0-alpha.1` published under `alpha` |
| Claude and Codex `unstoppable-stack` plugins | Shared workflows and integration guidance | Public repository catalogs and downloadable previews; no official host directory listing |
| `unstoppable-node` | Personal Node daemon, local administration, replication and optional delegated QVAC inference | `0.4.0` published; reorganized `0.6.0-alpha.1` source unpublished and deferred |
| `runtime-ai` | Tested lifecycle helpers copied into generated desktop/Node apps | Private implementation, not a public dependency |
| Website, agent-pack source, desktop applications | Documentation, shared guidance/builds and app shells | Private npm packages |
| Memory and Search | Retained experimental implementations | Excluded from this release |

Claude, Codex and the raw CLI remain the three intended starting paths. A plugin
provides guidance and uses the CLI for scaffolding. Installing it does not install
native runtimes or models. See [local plugin setup](../packages/agent-pack/PLUGIN.md).

## One P2P library

```js
import { createNode } from '@unstoppable-stack/p2p'
import { syncPack } from '@unstoppable-stack/p2p/sync'
```

The root entry does not import replication or QVAC. The `/sync` module owns
replication, persisted resource manifests and peer-scoped status. Both entry
points share one version and one install. Storage dependencies are installed
with the package even when only RPC is used; separate entry points avoid loading
the storage implementation, not installing its dependencies.

The P2P library has no inference or wallet dependency. Apps define their domain
capabilities as ordinary handlers; permissions and streaming stay in P2P.

## Direct AI and wallet integration

Generated Node apps use QVAC's SDK directly through a small private adapter.
Bare desktop workers use QVAC inference and native plugin registration. Keep
those runtime-specific integrations; the SDK import for one runtime is not
automatically valid in another. The maintained lifecycle helper preserves
loading, cancellation, concurrency and shutdown behavior and is copied into
`.unstoppable/runtime-ai/`, not installed as a public wrapper package.

Personal Node owns `src/ai/`, a thin internal adapter that exposes local QVAC
inference over granted P2P methods. It is not exported as a public library API.
QVAC remains an opt-in host installation; data-only peers do not load it. Model
availability, resource policy and native cancellation acceptance are separate
from protocol tests using mocks.

Wallet integration will call the upstream WDK SDK directly. Current wallet
generators remain explicit stubs; this restructuring adds no payment or remote
signing capability. Memory and Search are not enabled in the published CLI's
minimal build and are not included in either Node release artifact.

## Migration from the unpublished split packages

| Previous source import | New source import |
| --- | --- |
| `@unstoppable-stack/node-core` | `@unstoppable-stack/p2p` |
| `@unstoppable-stack/node-core/errors` | `@unstoppable-stack/p2p/errors` |
| `@unstoppable-stack/node-core/protocol` | `@unstoppable-stack/p2p/protocol` |
| `@unstoppable-stack/node-caps-sync` | `@unstoppable-stack/p2p/sync` |
| `@unstoppable-stack/node-caps-sync/replication` | `@unstoppable-stack/p2p/sync/replication` |
| `@unstoppable-stack/node-caps-sync/resource-manifest` | `@unstoppable-stack/p2p/sync/resource-manifest` |
| `@unstoppable-stack/node-caps-ai` | Internal Personal Node `src/ai/`; no replacement public AI package |

The three split packages were unpublished. Their source and tests were moved,
not duplicated into compatibility packages. Published Node `0.4.0` remains a
different API and is not silently upgraded by these source changes.

Generated profiles increment their revisions for the dependency change. Existing
apps retain their recorded profiles and vendored runtime. Use `us compatibility
check -o <app>` to inspect differences; update imports, dependency and lockfile
explicitly. Preserve app edits and do not regenerate an existing app with
`--force`. The new npm dependency cannot be installed from the registry until
the P2P alpha is published.

## Development and release assembly

For the canonical public packages (CLI and P2P), use the
[public release preparation](public-release.md). It also builds the separate
Claude/Codex plugin download. The commands below concern the optional
Personal Node composition, outside the canonical public release.

There is no root package-manager workspace. Install and test per package:

```sh
npm ci --prefix packages/p2p
npm ci --prefix packages/node
npm test --prefix packages/p2p
npm test --prefix packages/node
node scripts/node-release-gate.mjs
```

Source development uses `file:../p2p`; public consumers install
`@unstoppable-stack/p2p@0.6.0-alpha.1`. After
maintained source changes, run `node scripts/sync-stack-assets.mjs` to update
compatibility guidance and the CLI-bundled pack. Rebuild local plugin artifacts
with `node packages/agent-pack/scripts/build-plugin.mjs`.

```sh
node scripts/pack-node-release.mjs /absolute/path/to/artifacts
node scripts/release-artifacts.mjs /absolute/path/to/artifacts
node scripts/test-node-artifacts.mjs /absolute/path/to/artifacts
```

The packer copies only shipped files into temporary staging, replaces the exact
known Personal Node development link with the matching P2P semver range, rejects
other local production dependencies and leaves source manifests/locks untouched.
The artifact checker records checksums and verifies shipped files. The consumer
smoke installs both tarballs outside the repository and exercises pairing,
replication calls, permission revocation and mock AI streaming.

The manual Node workflow validates both tarballs, requires the identical P2P
version to have been published through the canonical workflow, and publishes
only the optional Personal Node app. It does not republish P2P or publish the
CLI, plugins, Memory, Search or desktop applications. This changes
package assembly; it does not complete native inference, platform, independent
pilot, marketplace publication or desktop signing acceptance.
