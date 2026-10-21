---
name: add-file-storage
description: Share existing Hyperdrives using the P2P sync capability and explicit resource manifests.
---

# Add P2P file storage

Read `modules/p2p.mdc` and the installed `@unstoppable-stack/p2p/sync` docs/types.
Use `syncPack` attached to an existing root `createNode` for resource mirroring;
reuse an app-owned Corestore via `syncPack({ store })`. A host without a store
can let the pack own one through `syncPack({ storage })`. Do not add another
Hyperswarm or manual replication listener around the pack.

Apps still own file operations: use version-matched Hyperdrive APIs for local
put/get/list/streams and optional filesystem mirroring. Direct Hyperdrive and
Corestore dependencies are appropriate for these operations. The P2P package
provides transport and resource replication, not a complete file-manager API.

Pair through a scoped invitation. Attach the sync pack on both the source and
replica host. Call the replica peer's `sync` capability `manifest.replace` with
`{ manifest: { schemaVersion: 1, resources: [...] } }`. Each resource needs an
id, `kind: 'hyperdrive'`, its actual core key, name and explicit protection mode.
Use `protection: { mode: 'mirror' }` to request full observed payloads; the
default metadata-only mode does not download all files. A replacement is the
caller's complete resource set, not an incremental addition. Inspect `status`
and `usage` for that peer. `/sync` does not mirror an Autobase graph.

Do not promise file read/range RPC, selective path ACLs, secure purge or complete
backup from this API. Resource keys permit replication; RPC grant revocation
does not erase downloaded copies. For remote business operations on files,
define app-owned validated procedures through [RPC](../add-p2p-rpc/SKILL.md).

Keep drives/storage/networking in Node or the desktop Bare worker. Replicate
before remote reads, use streaming for large files and close all owned handles
on shutdown. Test writer/reader transfer, source-offline replica restart,
permission denial, manifest replacement and clean shutdown. A protected
checkpoint is not proof of future durability or complete backup. Legacy
standalone file examples apply only to existing custom storage/transport.
