# P2P documentation

Reviewed against source on 16 October 2026. All APIs here describe the unpublished
`0.6.0-alpha.2` source candidate. Published P2P `0.6.0-alpha.1` has no `/rpc`
or `/db` exports; published Personal Node `0.4.0` uses a different API.

| Read | Purpose |
| --- | --- |
| [Runtime and peer API](api.md) | Identity, discovery, invites, bidirectional calls, streams, grants and lifecycle |
| [Typed RPC](rpc.md) | Shared runtime contracts, procedure builders, schemas and TypeScript inference |
| [Replication](sync.md) | The optional `/sync` module, manifests, ownership and protection |
| [Database prototype](db.md) | Explicitly experimental Autobase adapter, membership and offline convergence |
| [Capability roadmap](roadmap.md) | Reconciled feature inventory, missing services and consolidation decisions |
| [P2P review and improvement proposal](review-2026-10-16.md) | Parallel transport, RPC and database review; dependency updates and proposed APIs |
| [Package architecture](../../../docs/package-architecture.md) | Package ownership, old import migration and release boundaries |
| [Personal Node](../../node/README.md) | Optional daemon composition and local administration |
| [Desktop shell](../../node-desktop/README.md) | Dashboard, Bare worker and packaged application |
| [P2P notes example](../../../examples/p2p-notes/README.md) | Runnable calls, streaming, replication and offline replica restart |
| [Collaborative notes example](../../../examples/p2p-database/README.md) | Runnable admission, offline writes, restart, conflict convergence and removal |
| [Desktop RPC example](../../../examples/ecommerce-assistant/README.md) | Private local storage and scoped receipt queries in a Bare worker |
| [Validation](../../../docs/validation.md) | Reproduction commands and separate acceptance gates |

This directory owns the shared P2P contract and its roadmap. The website provides
task guides and links to these references. Application administration and native
AI adapter documentation stay with their owning packages.
