---
name: add-p2p-networking
description: Connect apps using the Unstoppable P2P library, scoped invitations and managed sessions.
---

# Connect P2P apps

Inspect package.json, `.unstoppable/project.json` and actual entrypoints first.
Read the bundled `modules/p2p.mdc` reference for API selection and ownership.
Use the installed `@unstoppable-stack/p2p` exports/types; helpers require alpha.2
or later. Preserve existing profiles rather than upgrading dependencies silently.

For a remote business service, follow [RPC](../add-p2p-rpc/SKILL.md): `/service`
owns startup, pairing and typed client binding. No separate swarm setup is needed.
For shared JSON, follow [sync](../add-p2p-sync/SKILL.md): `/data` owns discovery,
storage and cleanup. Neither path requires Personal Node.

For several capabilities or bidirectional calls, use root `createNode` with a
persistent `storage` directory and app-owned capability packs. Call `listen()`,
issue `createInvite({ grants, uses: 1 })`, and redeem through the other node's
`pair(code)`. After pairing, save the peer key and reconnect via `connect(key)`
with the same local identity. Use installed types for requested grants and
pairing policy. Deny unknown peers unless an explicit invitation or operator
approval authorizes them. A named `joinNetwork` topic is discoverable, not an
access boundary; set explicit grants and approval policy.

Keep networking in Node or the desktop Bare worker behind existing IPC. Close
owned sessions/nodes on shutdown; tolerate disconnects and reconnect explicitly.
Keep local startup and data access independent of peer availability. Do not add
a raw Hyperswarm, manual DHT bootstrap or new socket protocol for this path.
Existing raw transports/custom protocols can retain their version-matched
implementation; do not replace edited managers without a migration.

Validate two peers, denied/ungranted calls, disconnect/reconnect, persisted
identity after restart and clean shutdown. Isolated loopback tests do not prove
public discovery, NAT traversal, packaged Bare or mobile acceptance.

For root-node saved-peer recovery, use the library reconnect policy and bounded foreground connections in both directions without blocking local startup. A timed-out connect call and a later reconnected event are different outcomes. See [device sync diagnosis](../diagnose-stack-runtime/resources/device-sync.md) for lifecycle, route and first-attempt acceptance.

## Bundled integration references

For app ownership and runtime boundaries, load only the relevant [foundation](../unstoppable-foundations/SKILL.md), [module](../unstoppable-modules/SKILL.md), or [recipe](../unstoppable-recipes/SKILL.md) reference. Bundled links resolve from this skill; app paths resolve from the selected target.
