import examples from "@/lib/library-examples.json";
import type { DocPage } from "@/lib/docs";

const source = "https://github.com/unstoppable-stack/unstoppable-dev/blob/main";
const verifiedOn = "16 October 2026";

export const packageDocs: DocPage[] = [
  {
    slug: "p2p/examples",
    title: "Choose a P2P example",
    description: "Working apps for scoped RPC, single-owner replication and collaborative offline databases.",
    category: "Packages",
    verifiedOn,
    blocks: [
      { type: "callout", title: "Version-matched source examples", body: "These examples use the 0.6.0-alpha.2 candidate through local source links. Published alpha.1 does not contain /rpc or /db. Run from a checkout until alpha.2 is published. All APIs remain experimental." },
      { type: "cards", items: [
        { title: "Simple data sync", body: "Start here: a JSON collection or collaborative database with managed storage and replication. Complete runnable examples on each page.", href: "/docs/p2p/sync" },
        { title: "Notes: RPC and sync", body: "Start here for schema-validated calls, streams and invitation grants. Then replicate a single-owner Hyperbee and read it after the writer disconnects and the replica restarts.", href: "/docs/examples#replicate-notes-between-peers" },
        { title: "Collaborative notes: Autobase", body: "Approve a writer, edit while both transports are closed, restart and converge conflicting notes, then remove the writer. Node-only prototype with an explicitly installed engine.", href: "/docs/examples#merge-offline-edits" },
        { title: "Local Goods: desktop RPC", body: "A Bare worker owns a private cart and order database. A single-use invitation grants one device receipt queries; validated RPC returns selected fields without replicating the database.", href: "/docs/examples#build-a-local-shopping-assistant" },
      ] },
      { type: "heading", text: "Run the small examples" },
      { type: "code", language: "sh", code: `# From the repository root, Node 22.17+
npm ci --prefix packages/p2p
npm ci --prefix examples/p2p-notes
npm run demo --prefix examples/p2p-notes
npm ci --prefix examples/p2p-database
npm run demo --prefix examples/p2p-database` },
      { type: "paragraph", text: "Both small demos use an isolated real loopback DHT and temporary storage. They need no public discovery, Personal Node, account, model or wallet. Their tests establish the demonstrated local flows, not Internet reachability, full backup or production database acceptance." },
      { type: "heading", text: "Pick the data boundary" },
      { type: "list", items: [
        "RPC: the host owns data and decides which validated results to return. Both devices must be online for a fresh call. Use this for private app data and scoped business actions.",
        "Sync: devices retain single-owner datasets for offline reads. Giving the necessary dataset material can expose its contents independently of RPC method grants.",
        "Database prototype: admitted devices append offline operations and derive a deterministic view after reconnecting. Apps own conflict semantics, schemas and secret distribution; the founder currently owns administration and indexing.",
      ] },
      { type: "actions", items: [{ label: "Typed RPC", href: "/docs/p2p/rpc" }, { label: "Replication", href: "/docs/p2p/sync" }, { label: "Database prototype", href: "/docs/p2p/database" }] },
    ],
  },
  {
    slug: "p2p/rpc",
    title: "Typed RPC",
    description: "Schema-backed procedures and inferred clients over the existing P2P connection.",
    category: "Packages",
    verifiedOn,
    blocks: [
      { type: "callout", title: "Experimental alpha API", body: "The /rpc entry and /service helpers target the 0.6.0-alpha.2 source candidate; it is absent from published alpha.1. Existing plain packs, peer.call, peer.stream and peer.api remain available. No tRPC or validator package is required." },
      { type: "lead", text: "Define a capability once and share its runtime contract with clients. Query and mutation methods return ordinary promises; stream methods return async iterables. TypeScript infers inputs and results while runtime schemas check peer data." },
      { type: "heading", text: "When to use RPC" },
      { type: "paragraph", text: "Use RPC when a peer owns data or a service and should return a specific result: a receipt, a note or incremental output. Unlike replication, a call does not give the caller a local copy of the whole dataset. Both peers must be reachable for a fresh call." },
      { type: "heading", text: "Your first peer call" },
      { type: "paragraph", text: "Use Node 22.17+ and npm. This quick start uses the new serve/connect helpers in the alpha.2 source candidate; published alpha.1 does not include them. The /service entry handles identity, discovery, encryption and pairing; /rpc defines the shared contract. Your app supplies a service, a storage directory and an invitation." },
      { type: "code", language: "bash", code: "git clone https://github.com/unstoppable-stack/unstoppable-dev.git rpc-source\ncd rpc-source\nnpm ci --prefix packages/p2p\nmkdir rpc-demo\ncd rpc-demo\nnpm init -y\nnpm install ../packages/p2p" },
      { type: "heading", text: "1. Define what the app can do" },
      { type: "paragraph", text: "Save notes.mjs. A capability is a named set of methods. This shared file contains a single query and its contract; it does not start networking when imported." },
      { type: "code", language: "js", code: examples.rpc.files[0].code },
      { type: "heading", text: "2. Offer the service" },
      { type: "paragraph", text: "Save host.mjs. serve() starts the service and owns its node. invite(['get']) creates a code that permits only that method, usable once and valid for 15 minutes by default. Share it only with the intended peer." },
      { type: "code", language: "js", code: examples.rpc.files[1].code },
      { type: "heading", text: "3. Connect and call" },
      { type: "paragraph", text: "Save client.mjs. connect() handles pairing and contract binding. Calls look like ordinary async functions. close() releases the connection and its node; the identity remains on disk." },
      { type: "code", language: "js", code: examples.rpc.files[2].code },
      { type: "heading", text: "Run it" },
      { type: "code", language: "bash", code: examples.rpc.run },
      { type: "paragraph", text: "Keep the host running and copy its printed code into the client command. These programs use normal public peer discovery, so both need network access; no server account or DHT setup is required. Stop the host with Ctrl+C. Run it again to issue a fresh invitation, or reconnect with the saved host public key as described below." },
      { type: "heading", text: "Expected result" },
      { type: "code", language: "text", code: examples.rpc.expected },
      { type: "paragraph", text: "The host returns a fixed note to make the first call easy to understand. Replace its handler with your app's local data lookup. Session integration tests cover real calls over an isolated local DHT; that evidence does not establish public-network reachability on every network." },
      { type: "heading", text: "Session API" },
      { type: "list", items: [
        "serve({ storage, capability }): start one typed service. service.invite(['method']) returns a scoped code; service.close() shuts down its node.",
        "connect({ storage, invite, contract, timeout, signal }): pair and return connection.api. Setup defaults to a 20-second peer lookup timeout. Each method also accepts its own timeout and signal.",
        "For later sessions, persist connection.peer.publicKey and use connect({ storage, publicKey, contract }) with the same client storage. Existing grants still constrain access.",
        "Failed setup closes the node automatically. Call close() in your application's shutdown path after successful setup. Closing is safe to repeat.",
        "service.node and connection.node expose advanced administration and events. nodeOptions accepts existing transport/profile/limit options; normal apps need none of them. For multiple hosted capabilities or bidirectional services, use createNode directly.",
      ] },
      { type: "heading", text: "Define and share the contract" },
      { type: "paragraph", text: "Define a capability with a name, version and procedures. A query reads one result; a mutation changes state and returns one result; a stream yields multiple results. Builder calls are immutable. notes.contract contains method descriptions and validators without the handlers. Export that contract from a pure application module so clients do not import server storage." },
      { type: "list", items: [
        "Use procedure.input(schema).output(schema).query(handler), .mutation(handler) or .stream(handler). Validators can be parser functions, parse() objects or Standard Schema implementations.",
        "Input transformations run once on the host. Output schemas must be idempotent JSON wire validators; stripped fields are removed before transmission and clients validate received output again.",
        "Return JSON values: dates, maps, undefined, cycles and nonfinite numbers are rejected. Use null for an action with no result data.",
        "Binding checks service version, method presence and kind. Partial grants are valid; ungranted calls still fail with NOT_GRANTED. Type inference does not authorize a peer.",
        "Calls accept signal and timeout. Cancellation is cooperative; no mutation or stream is replayed automatically after reconnect. Obtain the replacement peer and bind a fresh client.",
      ] },
      { type: "paragraph", text: "Keep contracts and validators in a shared application module. Bind the P2P client in the worker and expose app-owned IPC to the renderer; validator functions cannot be sent as JSON. Streams retain finite request and output budgets and do not implement durable subscriptions." },
      { type: "heading", text: "Validate input and output" },
      { type: "paragraph", text: "Input schemas run on the host. Output schemas validate the host result before sending it and validate the wire value again on the client. Stripped fields never leave the host. Output validators must preserve their own JSON shape: normalization is fine, but incrementing a number on each validation is not. Keep validators pure." },
      { type: "paragraph", text: "Use parser functions, objects with parse(value), or Standard Schema validators. Standard Schema preserves different pre-transform input and handler types; simple parser functions use their returned type for the caller. Outputs must be JSON-compatible; return null for a successful action with no data." },
      { type: "heading", text: "Permissions and versioning" },
      { type: "paragraph", text: "Binding checks the advertised capability version, method names and method kinds. A matching contract does not grant access: if the invitation grants get but not list, the list call fails with NOT_GRANTED. Change the capability version when changing its contract; schema negotiation is not automatic." },
      { type: "heading", text: "Deadlines and cancellation" },
      { type: "paragraph", text: "Calls and streams accept signal and timeout. The caller's default total deadline is 30 seconds; timeout: 0 disables only that caller deadline, not host limits. Break stream iteration to cancel production, or abort its signal while waiting for an item. Handlers must observe the signal and release resources in finally." },
      { type: "paragraph", text: "Sessions do not reconnect automatically. Close a disconnected session and call connect again with the saved public key and same storage, or bind a fresh client when using createNode directly. The runtime does not replay operations. A disconnect after a mutation can leave its outcome unknown, so use application idempotency keys before retrying changes. These bounded streams are not durable event subscriptions." },
      { type: "heading", text: "Troubleshooting" },
      { type: "list", items: [
        "Package subpath /rpc is not exported: you installed alpha.1 instead of the alpha.2 source used above.",
        "NOT_GRANTED: inspect the invitation or peer grants; changing a TypeScript type will not authorize the method.",
        "INVALID_INPUT or INVALID_OUTPUT: check your validator and JSON wire shape; avoid undefined, BigInt, Dates, Maps, cycles and nonfinite numbers.",
        "INCOMPATIBLE_CAPABILITY or METHOD_KIND_MISMATCH: share a version-matched contract between peers.",
        "REQUEST_TIMEOUT, CANCELLED, CLOSED or RESOURCE_LIMIT: handle the operation state explicitly and do not replay mutations blindly.",
        "PEER_NOT_FOUND: check that the host is running, the code is current and the network permits peer discovery. Retry explicitly; no mutation is replayed for you.",
      ] },
      { type: "actions", items: [{ label: "P2P runtime", href: "/docs/p2p" }, { label: "Replicate notes instead", href: "/docs/examples#replicate-notes-between-peers" }, { label: "Library guides", href: "/docs/modules" }] },
    ],
  },
  {
    slug: "p2p/database",
    title: "Collaborative databases",
    description: "Shared JSON data with managed storage, explicit writers and deterministic conflict handling.",
    category: "Packages",
    verifiedOn: "19 October 2026",
    blocks: [
      { type: "lead", text: "Use openCollaborativeDatabase for a shared JSON key-value database. Storage, discovery, replication and the reducer are included. You explicitly approve which devices can write." },
      { type: "heading", text: "Create, approve, write" },
      { type: "code", language: "js", code: `import { openCollaborativeDatabase } from '@unstoppable-stack/p2p/data'
const alice = await openCollaborativeDatabase({ storage: './alice' })
const bob = await openCollaborativeDatabase({ storage: './bob', key: alice.key })
await alice.members.add(bob.writerKey)
await bob.waitFor(state => state.writable)
await bob.put('note', { text: 'Hello from Bob!' })
// At app shutdown: await bob.close(); await alice.close()` },
      { type: "paragraph", text: "In separate apps, share Alice’s database key with Bob, then verify Bob’s writer key before admitting it on Alice’s app. Knowing a database key permits reading but never automatically grants writing. The founder alone manages membership." },
      { type: "callout", title: "Alpha.2 source candidate", body: "The /data helpers are not in published alpha.1. Use this checkout or a locally packed candidate. Node 20+ is required for these examples; collaborative storage also needs autobase@7.28.2. P2P remains experimental." },
      { type: "heading", text: "Run it locally" },
      { type: "code", language: "sh", code: `npm install --prefix packages/p2p
npm ci --prefix examples/p2p-data
npm run collaborate --prefix examples/p2p-data` },
      { type: "paragraph", text: "This complete program waits for Alice to observe Bob’s edit, prints it, and closes both instances. It uses real public discovery, needs UDP access and bounds its waits to 60 seconds." },
      { type: "code", language: "js", code: examples.collaborative.files[0].code },
      { type: "heading", text: "Reads, writes and conflicts" },
      { type: "list", items: [
        "put(key, json), get(key), del(key): use JSON values without writing a reducer. Entry keys contain 1–1024 characters; operations are limited to 64 KiB. Missing entries and stored JSON null both read as null.",
        "Concurrent replacements and deletes use Autobase’s deterministic operation order. The last operation in that order wins; this is not wall-clock ordering or character-level text merging.",
        "Writes return local-applied receipts. Reads use the local view. update() processes available history; it is not a barrier that waits for all remote changes.",
        "members.add/remove(writerKey): founder-only writer management. A new writer is not an administrator or indexer. Removal propagates with history and cannot erase downloaded copies.",
        "watch(callback) observes local state and returns an unsubscribe function. waitFor(predicate, { timeoutMs, signal }) waits for a synchronous state condition, such as writable.",
        "Reopen with storage alone: the key is retained automatically. Use a dedicated directory per dataset and device. close() releases all owned resources and is safe to call twice.",
      ] },
      { type: "callout", title: "Experimental collaborative storage", body: "The founder is the sole indexer, so stable progress can depend on it returning online. Encryption keys, when used, must be supplied on every open and shared securely. Lost-admin recovery, key rotation, schema migrations and complete backup are not provided. For custom conflict rules, use the adapter API below." },
      { type: "heading", text: "Run on two devices" },
      { type: "code", language: "sh", code: "# On Device A, from the repository root.\nnpm run device --prefix examples/p2p-data -- db-host ./alice\n\n# On Device B, replace KEY with Device A’s DATABASE key.\nnpm run device --prefix examples/p2p-data -- db-join ./bob KEY" },
      { type: "paragraph", text: "Device A prints DATABASE. Device B joins and prints WRITER. Verify that writer key, then paste it into Device A\u2019s terminal and press Enter to approve. Keep both apps running until Device A prints OBSERVED. Ctrl+C closes safely without deleting data." },
      { type: "heading", text: "Public discovery and troubleshooting" },
      { type: "code", language: "js", code: `await data.network.ready({ timeoutMs: 60_000 })
console.log(data.network.status())
// { closed, announced, connections, dhtPeers }` },
      { type: "paragraph", text: "Here data is your collection or collaborative database. Local open stays usable offline. network.ready waits for a successful DHT announcement before you share a host’s key; it does not confirm a peer connection. Disconnected discovery retries with backoff. announced records a successful announcement during this session, not continuous connectivity." },
      { type: "list", items: [
        "DATA_NETWORK_TIMEOUT with dhtPeers: 0: check internet access, network/VPN/firewall UDP policy and bootstrap reachability. Working DNS or web browsing does not prove UDP works. Public bootstrap nodes use UDP port 49737.",
        "DHT peers present but no connection: verify both apps use the same dataset key and the host is still running. Check peer connectivity on both networks; some NAT/network combinations cannot connect.",
        "Connected but waiting for data: verify the writer version, or approve the collaborator’s writer key on the founder. A local write receipt does not prove the other device received it.",
        "There is no HTTP/WebSocket fallback and no guarantee of connectivity on every network. Try another permitted network if UDP is blocked. Local tests and separate processes on one machine do not establish cross-device acceptance.",
      ] },
      { type: "heading", text: "Advanced: custom views and reducers" },
      { type: "callout", title: "Prototype with explicit engine opt-in", body: "The /db prototype targets the alpha.2 source candidate. Install autobase@7.28.2 explicitly to use it. The root P2P import does not load it, and ordinary consumers do not install this optional peer automatically. This prototype is separate from the existing experimental Autobee scaffold." },
      { type: "lead", text: "Applications supply a deterministic reducer and local view. Autobase orders writer logs so devices can converge after offline edits; application rules still decide what conflicting edits or deletes mean." },
      { type: "list", items: [
        "autobaseAdapter({ openView, apply, validate, closeView }) defines application-owned view behavior. openDatabase({ node, store, adapter, key, encryptionKey }) opens a local database and attaches replication to the P2P swarm.",
        "append(operation) accepts a bounded JSON operation and returns a local-applied receipt. db.view provides application queries; update() processes available data without claiming every peer is caught up.",
        "members.add(writerKey) and members.remove(writerKey) are restricted to the founding writer. New writers are non-indexers and receive no membership administration rights.",
        "state(), watch(callback) and waitFor(predicate, { timeoutMs, signal }) expose local progress. Signed system checkpoints do not prove that a remote host retained every application resource.",
        "close() releases this database's discovery lease, view and child store session. Close databases before their node and root store; other sockets and caller-owned stores remain available.",
      ] },
      { type: "heading", text: "Distributed data boundaries" },
      { type: "paragraph", text: "Local writes can proceed offline, while stable progress depends on available indexers. Reducers must be replayable and deterministic. Writer removal takes effect as history synchronizes; it does not erase downloaded data or rotate encryption keys. Pairing at the RPC layer does not grant database write authority." },
      { type: "paragraph", text: "Real tests cover offline conflict convergence, writer admission/removal, encrypted reconstruction from a retained reader and coexistence with RPC on a paired P2P connection. They do not establish complete backup, lost-admin recovery, automatic schema migration or multi-writer plus Personal Node sync support." },
      { type: "actions", items: [{ label: "Database API guide", href: `${source}/packages/p2p/docs/db.md` }, { label: "Runnable collaborative notes", href: "/docs/examples#merge-offline-edits" }] },
    ],
  },
  {
    slug: "p2p",
    title: "P2P runtime API",
    description: "One symmetric library for any app to host and consume permissioned services.",
    category: "Packages",
    verifiedOn,
    blocks: [
      { type: "callout", title: "Alpha.2 source candidate", body: "This reference describes @unstoppable-stack/p2p 0.6.0-alpha.2 source. Alpha.1 is published; the new /rpc and /db APIs need source or an alpha.2 candidate tarball until publication. Published Personal Node 0.4.0 uses a different API." },
      { type: "lead", text: "Every app can be a node and a client at the same time. createNode owns stable identity, discovery, pairing, grants, capability calls, streaming and shutdown. A Personal Node is optional; two apps can pair and call each other directly." },
      { type: "actions", items: [{ label: "Start with serve and connect", href: "/docs/p2p/rpc" }] },
      { type: "paragraph", text: "For a single typed service, the /service entry owns startup, pairing, binding and cleanup. Use the lower-level createNode API below when composing several capabilities or implementing bidirectional services." },
      { type: "heading", text: "Connect and serve" },
      { type: "list", items: [
        "createNode({ storage, profile, capabilities, pairing, limits, reconnect }): configure identity persistence, app-defined handlers, trust and resource bounds.",
        "ready() initializes the runtime; listen() accepts connections by public key. listen({ topic }) additionally announces a discovery topic.",
        "pair(inviteCode, { requested }) redeems a scoped invite. connect(publicKey, { requested, reconnect }) dials a selected peer. discover({ topic }) finds a host; the default topic is machine-local.",
        "joinNetwork(id, { grants, requested, approve }) discovers multiple app instances; leaveNetwork(id) leaves discovery. A guessable network name is not authorization.",
        "close() cancels work and tears down peers, transport and packs. Local application data must remain usable while peers are offline.",
      ] },
      { type: "heading", text: "Define a service" },
      { type: "code", language: "js", code: `import { createNode } from '@unstoppable-stack/p2p'

const host = createNode({
  storage: './.echo-host',
  capabilities: [{
    name: 'echo', version: 1, defaultGrants: [],
    methods: { say: async ({ text }) => ({ text: String(text).slice(0, 200) }) }
  }]
})
await host.listen()
const invite = await host.createInvite({ grants: { echo: ['say'] }, uses: 1 })
// Share invite.code with the intended peer.
const client = createNode({ storage: './.echo-client' })
try {
  const peer = await client.pair(invite.code)
  console.log(await peer.call('echo', 'say', { text: 'Hello' }))
} finally {
  await client.close()
  await host.close()
}` },
      { type: "paragraph", text: "A capability pack has a name, version, methods, optional defaultGrants and lifecycle hooks. Unary handlers are async functions; streaming handlers are async generators. Handlers receive params and { peer, appId, grants, signal }. Validate domain parameters and use the authenticated peer key for ownership." },
      { type: "heading", text: "Calls, streams and permissions" },
      { type: "list", items: [
        "await peer.call(capability, method, params, { timeout, signal }) returns a unary result. for await over peer.stream(capability, method, params, { signal }) consumes incremental output.",
        "peer.api is built from advertised methods. Await a handle for unary output or iterate it for streaming. Dotted method names use brackets, such as peer.api.sync['manifest.replace'](...).",
        "Each direction has independent grants. Incoming direct pairing is denied without approval; scoped invitations authorize only their methods. Reconnects cannot exceed persisted grant ceilings.",
        "setPeerGrants changes access; unpair persists a denial. Grant removal, disconnect and cancellation abort work. Handlers must honor signal; in-process code cannot be forcibly terminated.",
        "createInvite, listInvites and revokeInvite manage codes. issueInvite writes an invite from a separate process without starting another node on the daemon's identity.",
      ] },
      { type: "heading", text: "Limits and operational behavior" },
      { type: "paragraph", text: "Defaults bound control peers (128), JSON frames (256 KiB), incoming requests (8 per peer / 64 per node), host request time (120 seconds), stream output (1 MiB) and consumer buffers (64 chunks / 1 MiB). Handle NodeError codes such as NOT_GRANTED, RESOURCE_LIMIT, REQUEST_TIMEOUT and CANCELLED. Local events expose pairing, disconnect and reconnect state; they are not a remote event subscription service." },
      { type: "paragraph", text: "The root has no QVAC or wallet dependency and does not load replication. The /sync entry adds replication, though npm installs its storage dependencies with the package. Keep networking in the app worker. Mobile validation, complete restore and managed availability remain separate concerns." },
      { type: "actions", items: [{ label: "Full runtime contract", href: `${source}/packages/p2p/docs/api.md` }, { label: "Runnable P2P notes example", href: "/docs/examples#replicate-notes-between-peers" }] },
      { type: "cards", items: [{ title: "Typed RPC", body: "Validated procedures, inferred clients and normal async return values.", href: "/docs/p2p/rpc" }, { title: "Replication API", body: "Manifests, protection states and caller-scoped storage.", href: "/docs/p2p/sync" }, { title: "Database prototype", body: "Experimental collaborative writer logs and app-owned views.", href: "/docs/p2p/database" }, { title: "Capability roadmap", body: "Which cloud-like services exist and which remain planned.", href: "/docs/p2p/roadmap" }] },
    ],
  },
  {
    slug: "p2p/sync",
    title: "Replication API",
    description: "Sync JSON between apps in a few lines, or mirror existing cores and files.",
    category: "Packages",
    verifiedOn: "19 October 2026",
    blocks: [
      { type: "lead", text: "Copy JSON data between apps with openCollection. It creates storage, discovers peers and wires replication for you. One app writes; the other apps keep read-only copies." },
      { type: "heading", text: "Write in one app" },
      { type: "code", language: "js", code: `import { openCollection } from '@unstoppable-stack/p2p/data'
const notes = await openCollection({ storage: './notes' })
await notes.put('welcome', { text: 'Hello!' })
console.log({ key: notes.key, version: notes.version })
// Keep the app running while the other app syncs.` },
      { type: "heading", text: "Read in another app" },
      { type: "paragraph", text: "Pass the printed key and version through your app’s sharing flow. Dataset keys permit reading; share them only with intended readers." },
      { type: "code", language: "js", code: `import { openCollection } from '@unstoppable-stack/p2p/data'
const notes = await openCollection({ storage: './notes-copy', key })
await notes.sync({ version })
console.log(await notes.get('welcome')) // { text: 'Hello!' }
await notes.close()` },
      { type: "callout", title: "Alpha.2 source candidate", body: "The /data helpers are not in published alpha.1. Use this checkout or a locally packed candidate. Node 20+ is required for these examples; collaborative storage also needs autobase@7.28.2. P2P remains experimental." },
      { type: "heading", text: "Run it locally" },
      { type: "code", language: "sh", code: `npm install --prefix packages/p2p
npm ci --prefix examples/p2p-data
npm run mirror --prefix examples/p2p-data` },
      { type: "paragraph", text: "This complete program runs two app instances, prints the copied value and cleans up its temporary data. Public discovery needs UDP network access; the wait fails after 60 seconds if the peer cannot be reached." },
      { type: "code", language: "js", code: examples.collection.files[0].code },
      { type: "heading", text: "Everyday API" },
      { type: "list", items: [
        "openCollection({ storage, key? }): create a dataset or join a shared key. On later opens, just storage reopens the saved dataset. Use one directory per dataset and device.",
        "put(key, json) and del(key): write locally on the original writer. Copies reject writes. get(key) reads local data; sync before reading a fresh copy. Missing entries and stored JSON null both return null.",
        "sync({ version, timeoutMs?, signal? }): download all blocks through a known writer version. The default timeout is 10 seconds; the maximum is 120 seconds. Cancellation and close stop the wait.",
        "key and version: share these with another app. Get a newer writer version and sync again to guarantee later changes. This API does not subscribe to or acknowledge future writes.",
        "close(): release owned storage and networking. Call it on each app at shutdown. Reopening retains downloaded data for offline reads.",
      ] },
      { type: "callout", title: "What sync confirms", body: "A local-downloaded receipt confirms that this device has the requested blocks. It is not proof of remote backup. Dataset-key discovery is separate from RPC pairing and grants; revoking an RPC grant does not revoke already shared data keys." },
      { type: "heading", text: "Run on two devices" },
      { type: "code", language: "sh", code: "# On Device A, from the repository root.\nnpm run device --prefix examples/p2p-data -- mirror-host ./notes-writer\n\n# On Device B, replace KEY and VERSION with Device A’s SHARE values.\nnpm run device --prefix examples/p2p-data -- mirror-read ./notes-reader KEY VERSION" },
      { type: "paragraph", text: "Install the same candidate and examples on both devices. Device A prints SHARE after announcing and must stay running. Device B prints DOWNLOADED after receiving the note. Ctrl+C closes the host safely; directories are retained for reopening." },
      { type: "heading", text: "Public discovery and troubleshooting" },
      { type: "code", language: "js", code: `await data.network.ready({ timeoutMs: 60_000 })
console.log(data.network.status())
// { closed, announced, connections, dhtPeers }` },
      { type: "paragraph", text: "Here data is your collection or collaborative database. Local open stays usable offline. network.ready waits for a successful DHT announcement before you share a host’s key; it does not confirm a peer connection. Disconnected discovery retries with backoff. announced records a successful announcement during this session, not continuous connectivity." },
      { type: "list", items: [
        "DATA_NETWORK_TIMEOUT with dhtPeers: 0: check internet access, network/VPN/firewall UDP policy and bootstrap reachability. Working DNS or web browsing does not prove UDP works. Public bootstrap nodes use UDP port 49737.",
        "DHT peers present but no connection: verify both apps use the same dataset key and the host is still running. Check peer connectivity on both networks; some NAT/network combinations cannot connect.",
        "Connected but waiting for data: verify the writer version, or approve the collaborator’s writer key on the founder. A local write receipt does not prove the other device received it.",
        "There is no HTTP/WebSocket fallback and no guarantee of connectivity on every network. Try another permitted network if UDP is blocked. Local tests and separate processes on one machine do not establish cross-device acceptance.",
      ] },
      { type: "heading", text: "Advanced: mirror existing cores and files" },
      { type: "lead", text: "syncPack replicates Hypercores, Hyperbees and Hyperdrives and keeps seeding registered resources after the owner disconnects. It shares the P2P package's connection lifecycle. These reference pages describe the alpha.2 candidate; alpha.1 is already published." },
      { type: "code", language: "js", code: `import { syncPack } from '@unstoppable-stack/p2p/sync'

// Add this pack to createNode({ capabilities: [...] }).
const sync = syncPack({ store: appStore })
// A host without a store can use syncPack({ storage: './.replicas' }).

// After pairing with the host and receiving sync grants:
await peer.call('sync', 'manifest.replace', {
  manifest: { schemaVersion: 1, resources: [
    { id: 'notes', kind: 'hyperbee', key: dataCoreKey,
      name: 'Notes', protection: { mode: 'mirror' } }
  ] }
})
const status = await peer.call('sync', 'status')
const { bytes } = await peer.call('sync', 'usage')` },
      { type: "heading", text: "Methods and ownership" },
      { type: "list", items: [
        "manifest.replace replaces the caller's complete resource set; omitted resources are unregistered. An empty list removes all its registrations. It is not a merge or disk purge.",
        "status reports only the calling peer's cores, drives and protection state. usage reports its logical replicated bytes, not physical host disk use.",
        "pause and resume act on the caller's resource set and persist across restart. Their scope is discovery-and-mirroring; existing replication channels may still transfer data. Personal Node uses an admit(ownerKey) callback for quota checks.",
        "peek.core and peek.drive are bounded diagnostics, excluded from default grants. They do not provide generic file downloads or database queries.",
        "Ownership follows the authenticated peer key. Two installations of one app have separate resource sets. Persisted manifests resume replication after host restart.",
      ] },
      { type: "heading", text: "Manifest and protection contract" },
      { type: "paragraph", text: "Version 1 manifests accept up to 128 resources with unique ids and 32-byte hex keys, supported kind, name and optional bounded string metadata. Protection defaults to metadata-only. mirror requests a full copy of the observed core length or drive version. Only locally checked checkpoints become protected; this does not promise future writes or independently tested recovery." },
      { type: "callout", title: "Restore remains a separate contract", body: "Apps write to their local stores and drives first. Ordinary replication can retrieve data when its keys and availability are known. Dedicated file reads/ranges, selective path sync, full encrypted archives, identity recovery and purge controls are not built-in services." },
      { type: "actions", items: [{ label: "Full sync contract", href: `${source}/packages/p2p/docs/sync.md` }, { label: "Validation boundaries", href: `${source}/docs/validation.md` }] },
    ],
  },
  {
    slug: "p2p/roadmap",
    title: "Capability roadmap",
    description: "Reconcile the original Node API plans with the consolidated library and optional applications.",
    category: "Architecture",
    verifiedOn,
    blocks: [
      { type: "lead", text: "The original goal was a generic capability host: any app can offer services to any authorized peer while continuing to work locally. That shared communication layer is already in one P2P library. A cloud-like service still needs its own handler, policy and acceptance evidence." },
      { type: "heading", text: "Implemented in source" },
      { type: "list", items: [
        "P2P: stable device keys, direct and topic discovery, transactional scoped invites, named app networks, reconnect, bidirectional calls, grants, cancellation and bounded admission; optional /rpc adds typed validated procedures.",
        "P2P /db: experimental Autobase adapter with local writes, app-owned views, founding-writer membership controls and real convergence tests. Collaborative backup and migration remain separate work.",
        "P2P /sync: persisted resource manifests, data/file replication, protection checkpoints, peer-scoped status/usage, pause/resume and diagnostics.",
        "Personal Node: local settings, trust and quota administration, metadata export/import, and optional delegated QVAC/mock completion streaming.",
        "Desktop shell: operator dashboard, approval and grant controls, tray lifecycle and Bare sidecar hosting the same Personal Node.",
      ] },
      { type: "heading", text: "Planned services with no built-in API" },
      { type: "list", items: [
        "Files and recovery: scoped list/read/range streaming, partial-data behavior, restore planning, encrypted payload/identity backups and explicit keep/delete retention.",
        "Status and events: a generic remote subscription service and service directory; current EventEmitter events are local.",
        "Compute: model listing, embeddings, vision, transcription, RAG, durable jobs and remote build workers. Completion streaming does not imply these services exist.",
        "Search/indexing, wallet payments/signing, stable binary artifact helpers and node federation. Existing experiments and scaffold stubs do not provide supported P2P packs.",
        "Cross-device onboarding and recovery UX, full schema/version negotiation and resource-level selective policies.",
      ] },
      { type: "heading", text: "Consolidation decisions" },
      { type: "paragraph", text: "The old node-core and node-caps-sync source became @unstoppable-stack/p2p and /sync; the separate client was absorbed into the symmetric runtime. The old AI pack became Personal Node internal code. Keep native AI, wallets, app schemas, renderer IPC and operator administration with their owners. Shared capability contracts belong in packages/p2p/docs; moving every host service into that dependency would not complete the missing APIs." },
      { type: "steps", items: [
        { title: "Specify restore with a consumer", body: "Choose normal replication or a scoped file stream, then define missing/partial/stale data, limits and cancellation." },
        { title: "Define retention and identity recovery", body: "Specify shared-resource ownership, explicit keep/delete choices and recovery evidence before claiming complete backup." },
        { title: "Extend the existing capability bus", body: "Add remote events or new compute services when real consumers establish their contracts. Validate native providers and packaged UI separately." },
      ] },
      { type: "actions", items: [{ label: "Full inventory and ownership map", href: `${source}/packages/p2p/docs/roadmap.md` }, { label: "Package migration", href: `${source}/docs/package-architecture.md` }] },
    ],
  },
  {
    slug: "runtime-ai",
    title: "AI lifecycle helpers",
    description: "Private maintained runtime copied into generated desktop and Node apps.",
    category: "Packages",
    verifiedOn,
    blocks: [
      { type: "lead", text: "packages/runtime-ai is maintained source, not a public AI dependency. Generators copy it into .unstoppable/runtime-ai/. Apps own prompts, schemas, UI, history and domain logic; runtime-specific adapters own native inference." },
      { type: "list", items: [
        "createAISession({ adapter, byteBudget }) owns model loading, bounded history, one active request, cancellation, error codes and unloading.",
        "load(options) prepares the model; stream(history, { requestId, signal, onTrim }) yields output; cancel(requestId) stops a request; close() releases resources.",
        "Cancellation keeps the session busy until native work settles. Consume or return the stream before waiting on cleanup; do not replay partially emitted output automatically.",
        "Bare and Node adapters load native modules lazily. Mock output is visibly labelled. Expo uses a separate experimental implementation.",
        "Existing apps retain their vendored runtime until explicitly migrated. Compatibility checks report differences; regeneration with --force is not an upgrade workflow.",
      ] },
      { type: "paragraph", text: "Personal Node's delegated completion adapter is a separate host composition. P2P transports granted calls; it does not own models. Contract tests do not prove real inference, native cancellation/reuse or cached offline startup." },
      { type: "actions", items: [{ label: "Session contract", href: `${source}/packages/runtime-ai/README.md` }, { label: "Delegated AI adapter", href: `${source}/packages/node/docs/ai.md` }] },
    ],
  },
  {
    slug: "node-desktop",
    title: "Personal Node Desktop",
    description: "Deferred Electron dashboard and Bare sidecar for the optional Personal Node.",
    category: "Packages",
    verifiedOn,
    blocks: [
      { type: "lead", text: "The desktop app embeds Personal Node in a Bare sidecar and gives its owner local controls. It consumes the same P2P library as other apps; it does not define a second node/client network API." },
      { type: "list", items: [
        "Home and storage: inspect paired apps, declared resources, verified protection states and storage use; set per-peer/global quota policy and pause/resume replication.",
        "Trust: approve requests, grant or revoke methods, create invitations and remove peers. Removal revokes access; existing blocks may remain on disk.",
        "AI: enable an optional local model, review readiness and control which peers may call it. Mock mode is a developer demonstration.",
        "Desktop lifecycle: tray Show/Pause/Resume/Quit controls, single-instance behavior, optional approval notifications and local advanced diagnostics.",
        "Packaging: Electron Forge artifacts for macOS, Windows and Linux; a legacy Pear shell remains available during migration. Signing, packaged execution and real-model platform validation have separate gates.",
      ] },
      { type: "callout", title: "Deferred alpha", body: "Invitation primitives exist, but a complete cross-device onboarding/recovery journey and production desktop acceptance remain unfinished. Settings export contains metadata, not a full app-data backup." },
      { type: "actions", items: [{ label: "Run and package the desktop app", href: `${source}/packages/node-desktop/README.md` }, { label: "Local management contract", href: `${source}/packages/node/docs/api.md` }] },
    ],
  },
  {
    slug: "experiments",
    title: "Deferred packages",
    description: "Retained experiments and their relationship to the public package boundary.",
    category: "Packages",
    verifiedOn,
    blocks: [
      { type: "lead", text: "Source availability does not make a package a supported part of the core preview. These implementations are retained for development and are excluded from the canonical CLI/P2P release." },
      { type: "list", items: [
        "memory: experimental memory storage and indexing implementation.",
        "memory-client: experimental app integration, including optional Node synchronization.",
        "memory-mcp: experimental MCP access to Memory.",
        "memory-desktop: experimental desktop shell for Memory.",
        "Search, Remote Coder, Flow and the standalone Agent: deferred feature areas, not built-in P2P service packs.",
        "Expo mobile and wallet scaffolds: experimental mobile path and wallet stubs; neither establishes a supported remote capability API.",
      ] },
      { type: "paragraph", text: "Do not merge these into the P2P dependency merely to expose their names. A reusable service needs a defined contract, authenticated ownership, limits, lifecycle and an executable consumer first. Shared transport already exists." },
      { type: "cards", items: [{ title: "Capability roadmap", body: "Missing services and proposed sequence.", href: "/docs/p2p/roadmap" }, { title: "Support boundaries", body: "Current preview scope and limitations.", href: "/docs/support" }] },
    ],
  },
];
