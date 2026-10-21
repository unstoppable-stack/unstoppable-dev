---
name: add-p2p-sync
description: Managed JSON replication or P2P sync capabilities for existing resources, preserving app storage.
---

# Extend P2P replication

Inspect the target app manifest, installed exports and actual entrypoints. Read
`modules/p2p.mdc` and `modules/managed-data.mdc`.

For a new single-writer JSON dataset use `openCollection` from
`@unstoppable-stack/p2p/data` (alpha.2 or later). It owns storage, discovery and
cleanup; no separate DHT, Corestore or swarm setup is needed. Use a dedicated
directory, write/read locally offline, share the dataset key and version, and
let readers use bounded `sync({ version, signal, timeoutMs })` before reading.
Network announcement is not evidence of remote download. Use network diagnostics
and cancellation; never block local startup on peers.

For several writers follow [multi-writer sync](../add-multi-writer-sync/SKILL.md).
For mirroring existing Hypercores, Hyperbees or Hyperdrives use `/sync`:
attach `syncPack` to the existing node and share the existing store. Pair with
explicit grants and declare the complete resource manifest with protection
modes. Read the installed docs for status and ownership semantics. `/sync`
does not mirror an Autobase graph and is not a complete backup service.

Keep existing generated Autobee/HyperDB stores, deterministic reducers, private
namespaces and replication managers intact. Direct replication instructions
are advanced existing-store references, not the default for new apps. Do not
silently convert storage or add a second swarm/store around managed helpers.
Personal Node is not required for peer-to-peer sharing.

Native resources stay in Node or the desktop Bare worker behind IPC. Test two
real peers, disconnect/reconnect, bounded cancellation, offline reads after
restart and convergence. Local loopback evidence does not prove public-network,
packaged Bare, mobile or backup acceptance.
