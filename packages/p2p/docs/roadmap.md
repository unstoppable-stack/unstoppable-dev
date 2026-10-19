# Capability inventory and consolidation roadmap

> Reconciled against source on 16 October 2026. P2P alpha.1 is published; `/rpc` and `/db` require alpha.2;
> Personal Node and its desktop app are deferred. Planned names below are design
> vocabulary, not callable methods or release commitments.

See the [16 October review and improvement proposal](review-2026-10-16.md)
for concrete robustness findings, dependency candidates and a proposed typed RPC
and database integration design.

## The original goal

Any app can host capabilities and consume another app's capabilities. A Personal
Node offers an optional persistent home for replication and compute. Local data
and ordinary app use remain available without it. This gives apps selected
cloud-like services on chosen devices; it does not supply managed availability,
central accounts, durable queues or global infrastructure automatically.

The design progressed from a daemon/client API, through a generic capability
envelope and resource/security review, to a symmetric embeddable runtime with
optional packs. The later package consolidation put that runtime and replication
in one P2P library. Earlier milestones used different package and method names;
their “future” labels cannot be read as current implementation status.

## Feature inventory

| Intended service | Current implementation | Remaining work and owner |
| --- | --- | --- |
| Any node/client communication | Symmetric `createNode`, bidirectional `call` / `stream`, one muxed connection | Shared contract stays in P2P; no separate client library |
| Stable device identity | Seed-backed keys and key-scoped peer registry | Identity recovery and user/device identity UX need an explicit design |
| Discovery and device linking | Local topic, invitations, direct-key reconnect, named app networks | QR/deep-link onboarding and recovery UX belong to apps; directory/routing/federation remain deferred |
| Permissioned APIs | Per-direction method grants, scoped invites, revocation and cancellation | Fine-grained domain/data policies belong to handlers; no built-in accounts or role system |
| Generic service plugins | Plain packs plus optional `/rpc` procedures, runtime schemas, inferred clients and exact capability-version checks | Service directory and broader cross-version negotiation remain deferred |
| Data replication and seeding | `/sync`: Hypercore, Hyperbee and Hyperdrive, persisted peer-owned manifests | Schema-aware database query/search is not provided; apps own schemas |
| Collaborative databases | Experimental `/db` Autobase adapter: app-owned reducers/views, explicit writer membership and convergence tests | General shared-resource hosting, schema migration and complete database backup remain acceptance work |
| Protection confidence | Mirror/metadata-only policy, progress and locally checked protection state | Independent recovery acceptance and complete backup guarantees remain open |
| Resource lifecycle | Preflighted/staged `sync.manifest.replace`, status, persisted discovery/mirroring pause and bounded peeks | Full channel suspension, resource-level pause, selective paths, retention/GC and purge choices need design |
| File storage and retrieval | Hyperdrive replication and `sync.peek.drive` diagnostics | No built-in `files.list/read/readStream`, range service or partial-data restore contract |
| Storage accounting and quotas | Peer-scoped logical `sync.usage`; Personal Node local disk view, per-peer/global quotas | Generic P2P hosts supply admission policy; quota accounting is not a hard filesystem cap |
| Delegated AI | Personal Node internal `ai.completion.stream`; opt-in QVAC or labelled mock, bounded admission | Model listing, embeddings, vision, transcription, RAG and scheduling require separate validation |
| Status and live events | Local runtime events, `sync.status`, Personal Node operator status | No general remote `status.get` / `events.subscribe`; add a scoped pack only when a consumer needs it |
| Configuration and permissions UI | Personal Node local config, trust, grant and quota administration | No remote global config/admin capability; keep operator authority separate |
| Backup/export and restore | Personal Node settings, identity seed and peer/revocation metadata export/import; replicas can be reopened with known keys | No full encrypted payload/identity archive, restore planner or per-file restore API |
| Search and indexing | Separate retained Memory experiments; app-defined handlers are possible | No built-in P2P search/index pack; index ownership and schema contracts remain unresolved |
| Wallets and payments | Scaffold stubs; upstream WDK is the intended SDK | No remote signing/payment API; requires explicit application design and user approval semantics |
| Jobs, automation and remote workers | Unary/streaming bus can carry app-defined requests | No durable queue, scheduler, execution sandbox or remote-coder pack |
| Large artifacts and federation | Transport can multiplex pack-owned channels | No stable public binary-transfer helper or pack federation protocol |

## One library, clear ownership

The reusable communication code is already consolidated:

```text
App worker / Node process
  @unstoppable-stack/p2p       identity, trust, discovery, RPC, streams
    /sync                     optional replication capability
  app-defined packs           domain methods and validation

Personal Node                 P2P + /sync + internal QVAC adapter + local policy
Desktop shell                 operator UI + IPC + Bare sidecar hosting Personal Node
runtime-ai                    private lifecycle helpers vendored into generated apps
```

Keep one package/version for transport and replication. Separate imports avoid
loading storage code from the root, but storage dependencies are still installed.
The older goal of an RPC-only install without storage dependencies was superseded
by the one-package decision; it is not a current property.

Keep inference SDKs, wallets, renderer IPC, global config, OS integration and
export/import out of P2P. Their ownership is application/runtime-specific.
Sharing a capability contract does not require merging all implementations into
one dependency. Revisit extraction of a host service only after multiple real
consumers need the same policy and lifecycle.

## Suggested sequence

1. Maintain the [runtime reference](api.md), [sync contract](sync.md) and this
   inventory together. Website task guides should link to these source contracts.
2. Specify a scoped restore/file retrieval flow with a runnable consumer. Decide
   when ordinary Hyperdrive replication suffices and when a new streaming API is
   needed; include missing/partial/stale data, range limits and cancellation.
3. Define retention and recovery before claiming complete protection: explicit
   keep/delete choices, shared-core ownership, purge behavior and encrypted identity recovery.
4. Add remote status/events only for concrete UI needs, using the same capability
   bus and authenticated peer scope. Keep node-wide administration local.
5. Validate native compute and cross-device UX separately. Design search, durable
   workers, payments or federation when an app establishes their requirements.

No additional runtime consolidation is needed to make two nodes communicate.
Missing service contracts and acceptance evidence are the next work; moving
application code into P2P alone would not provide them.

## Evidence and documentation ownership

Current behavior is grounded in [node lifecycle](../src/node.js),
[peer calls](../src/peer.js), [capability dispatch](../src/capabilities.js),
[sync handlers](../src/sync/index.js), [manifest validation](../src/sync/resource-manifest.js),
[replication](../src/sync/replication.js),
[Personal Node](../../node/src/personal-node.js) and its
[AI adapter](../../node/docs/ai.md). Public docs must remain usable without
local historical notes. Tests and [artifact checks](../../../docs/validation.md)
have narrower claims than native, offline and packaged release acceptance.
