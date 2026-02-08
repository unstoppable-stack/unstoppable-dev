---
id: p2p-data-sync
name: P2P Data Synchronization
category: recipe
requires: [hyperdb, hyperswarm]
tags: [sync, replication, data]
---

# Recipe: P2P Data Sync

## Problem

Synchronize a shared data log between peers so messages persist while peers are
offline.

## Prerequisites

- Hypercore and Hyperswarm installed.
- Node.js or Bare runtime set up for ESM modules.

## Solution

Use Hypercore for the append-only log and Hyperswarm for discovery and
replication.

## Full Example

```js
// writer.js
import Hypercore from "hypercore";
import Hyperswarm from "hyperswarm";
import b4a from "b4a";

const core = new Hypercore("./writer-storage");
await core.ready();

const swarm = new Hyperswarm();
swarm.on("connection", (conn) => core.replicate(conn));
swarm.join(core.discoveryKey);

console.log("share key:", b4a.toString(core.key, "hex"));

process.stdin.on("data", (data) => core.append(data));
```

```js
// reader.js
import Hypercore from "hypercore";
import Hyperswarm from "hyperswarm";
import b4a from "b4a";

const keyHex = process.argv[2];
const core = new Hypercore("./reader-storage", b4a.from(keyHex, "hex"));
await core.ready();

const swarm = new Hyperswarm();
swarm.on("connection", (conn) => core.replicate(conn));
const discovery = swarm.join(core.discoveryKey, { server: true, client: true });
await discovery.flushed();

await core.update();
for await (const block of core.createReadStream({
  start: core.length,
  live: true,
})) {
  console.log(block.toString());
}
```

## Variations

- Replace Hypercore with Hyperbee to store key-value state.
- Use a shared topic (Hyperswarm) instead of direct keys if you need many
  writers.

## Troubleshooting

- If peers never connect, ensure both sides join with `{ server: true, client: true }`
  and wait for `discovery.flushed()` (NOT `swarm.flush()`).
- If reads hang, call `await core.update({ wait: true })` after connecting.
