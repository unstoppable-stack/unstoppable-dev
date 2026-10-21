# Offline-First App — Troubleshooting

> **Legacy custom transport/storage reference only.** New apps use
> `@unstoppable-stack/p2p` through `/service`, `/rpc`, `/data` or `/sync`.
> Read the parent skill first. These snippets do not implement the library
> protocol or its pairing/grants; do not layer them around managed helpers.


## Updates don't appear from peers
- Ensure both peers replicate the same Hypercore
- Call `core.update({ wait: true })` to wait for remote data
- Use `db.watch()` for change notifications instead of polling

## Sync is slow
- Confirm swarm has at least one connection: `swarm.connections.size`
- Consider prefetching with `core.download({ start: 0, end: -1 })`
- Use `swarm.flush()` to wait for initial peer discovery

## App blocks on startup waiting for peers
- Don't await sync on startup — read local data first
- Use `core.findingPeers()` + `swarm.flush()` pattern for non-blocking sync
- Show local data immediately, update UI when sync completes
