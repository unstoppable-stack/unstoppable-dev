# Sync JSON data between apps

Source-candidate examples for `@unstoppable-stack/p2p/data` (alpha.2, not
available in published alpha.1). Node 20+; collaborative storage is experimental.

From the repository root:

```sh
npm install --prefix packages/p2p
npm install --prefix examples/p2p-data
npm run mirror --prefix examples/p2p-data
npm run collaborate --prefix examples/p2p-data
```

The mirror and collaborate programs create two independent app instances, print
`{ text: 'Hello from another app' }` or `{ text: 'Written by Bob' }`, and clean up
their temporary directories. They use real public peer discovery and need UDP
network access; bounded waits fail if discovery is unavailable. No DHT setup is
required in application code. Keep directories instead of deleting them in a
real app; use a separate directory per dataset and device.

`mirror.js` has one writer and a read-only replica. Share the writer's key and
version with the other app. `sync({ version })` downloads that version locally;
it does not guarantee future changes or remote backups.

`collaborate.js` adds a second writer explicitly. Share the database key first,
then verify and admit the joining device's writer key. Knowing the dataset key
permits reading; it does not permit writing. Concurrent changes to the same key
use the last operation in Autobase's deterministic order, not wall-clock order
or text merging. The founder is the sole administrator and indexer.

These convenience APIs own storage, discovery and cleanup. The older
[p2p-notes](../p2p-notes/README.md) and
[p2p-database](../p2p-database/README.md) examples show advanced service composition
and custom reducers. See the [data API guide](../../packages/p2p/docs/data.md).

## Use two devices

Install the same checkout/candidate on both devices using the commands above.
No bootstrap configuration is needed for ordinary public discovery. Each device
keeps its own directory. Run these commands from the repository root.

One writer and one reader:

```sh
# Device A: leave running; copy the SHARE key and version to Device B.
npm run device --prefix examples/p2p-data -- mirror-host ./notes-writer

# Device B: replace KEY and VERSION with the values Device A printed.
npm run device --prefix examples/p2p-data -- mirror-read ./notes-reader KEY VERSION
```

Device B prints `DOWNLOADED {"text":"Hello from another device"}` after it has
the requested data locally. Ctrl+C on Device A closes safely. Data directories
are retained. Run the same commands again to reopen them.

Collaborative database:

```sh
# Device A: leave running; send the printed DATABASE key to Device B.
npm run device --prefix examples/p2p-data -- db-host ./alice

# Device B: replace KEY with Device A's DATABASE key; leave running.
npm run device --prefix examples/p2p-data -- db-join ./bob KEY
```

Device B prints a WRITER key. Verify it belongs to the intended collaborator,
then paste that key into Device A's running terminal and press Enter. Device B
writes its note after permission arrives. Wait for Device A to print
`OBSERVED {"text":"Written on another device"}` before stopping either process.
A local write message on B alone is not evidence that A received it.

## Diagnose discovery

Set `P2P_DEBUG=1` when running a device command to print discovery and
database progress every ten seconds. This helps distinguish an unreachable
network from a connected peer still waiting for writer approval or history.

`await data.network.ready({ timeoutMs: 60000, signal })` waits for a successful
DHT announcement before a host advertises its sharing information. This is a
separate step from local open and does not confirm a peer connection.
`data.network.status()` reports `announced`, `connections` and `dhtPeers`.
Discovery retries with backoff when no peers are connected. `announced` records
a successful announcement in this session, not a continuous connectivity check.

Timeouts distinguish no reachable DHT nodes, a reachable DHT without a data
peer, and a connected peer without the requested data/permission. DNS resolving
or web browsing working does not establish UDP connectivity. If no DHT nodes
are reachable, check network/VPN/firewall policy for UDP (including the official
bootstrap servers on port 49737), or try another permitted network. Do not
assume two devices on the same Wi-Fi discover one another without the DHT.
Some networks/NAT combinations cannot connect even with a reachable DHT;
this API does not provide an HTTP/WebSocket fallback or guarantee all-network
connectivity.

For an explicitly configured private DHT, set `P2P_BOOTSTRAP` to the same JSON
array of `{ "host": "...", "port": 12345 }` endpoints on both devices. This is
optional advanced configuration, not a workaround that disables authorization.
The regression tests use it with isolated loopback peers; they do not prove
cross-device/public-network acceptance.
