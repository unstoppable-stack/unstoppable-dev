# P2P Data Sync — Troubleshooting

## Peers never connect
- Ensure both sides join the same `discoveryKey`
- Both peers should join with `{ server: true, client: true }` for reliable mutual discovery
- Use `const discovery = swarm.join(topic); await discovery.flushed()` (NOT `swarm.flush()`)
- Check firewall/NAT settings if on restricted network

## Reads hang or return nothing
- Call `await core.update({ wait: true })` after connecting to peers
- Use `core.createReadStream({ live: true })` for real-time updates
- Verify the key passed to the reader matches the writer's public key

## Data doesn't persist
- Ensure the storage path is writable
- Don't forget to call `await core.close()` on shutdown for clean writes

## Multiple writers
- Hypercore is single-writer by default
- For multi-writer, use Autobase or HyperDB instead
- Use a shared Hyperswarm topic for peer discovery when multiple cores are involved
