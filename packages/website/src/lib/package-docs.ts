import type { DocPage } from "@/lib/docs";

const source = "https://github.com/unstoppable-stack/unstoppable-dev/blob/main";
const verifiedOn = "16 October 2026";

export const packageDocs: DocPage[] = [
  {
    slug: "p2p/rpc",
    title: "Typed RPC",
    description: "Schema-backed procedures and inferred clients over the existing P2P connection.",
    category: "Packages",
    verifiedOn,
    blocks: [
      { type: "callout", title: "Experimental alpha API", body: "The optional /rpc entry is implemented in unpublished source. Existing plain packs, peer.call, peer.stream and peer.api remain available. No tRPC or validator package is required." },
      { type: "lead", text: "Define a capability once and share its runtime contract with clients. Query and mutation methods return ordinary promises; stream methods return async iterables. TypeScript infers inputs and results while runtime schemas check peer data." },
      { type: "code", language: "ts", code: `import { defineCapability, procedure } from '@unstoppable-stack/p2p/rpc'

const noteId = (value: unknown): { id: string } => {
  if (typeof (value as { id?: unknown })?.id !== 'string') throw new Error('Expected id')
  return { id: (value as { id: string }).id }
}
const notes = defineCapability({
  name: 'notes', version: 1,
  methods: {
    get: procedure.input(noteId).query(({ input }) => ({ id: input.id, text: 'Hello' }))
  },
  defaultGrants: ['get']
})
// Host: createNode({ storage, capabilities: [notes] })
// Client: obtain a paired peer and use the shared contract.
const api = peer.client(notes.contract)
const note = await api.get({ id: 'n1' })` },
      { type: "list", items: [
        "Use procedure.input(schema).output(schema).query(handler), .mutation(handler) or .stream(handler). Validators can be parser functions, parse() objects or Standard Schema implementations.",
        "Input transformations run once on the host. Output schemas must be idempotent JSON wire validators; stripped fields are removed before transmission and clients validate received output again.",
        "Return JSON values: dates, maps, undefined, cycles and nonfinite numbers are rejected. Use null for an action with no result data.",
        "Binding checks service version, method presence and kind. Partial grants are valid; ungranted calls still fail with NOT_GRANTED. Type inference does not authorize a peer.",
        "Calls accept signal and timeout. Cancellation is cooperative; no mutation or stream is replayed automatically after reconnect. Obtain the replacement peer and bind a fresh client.",
      ] },
      { type: "paragraph", text: "Keep contracts and validators in a shared application module. Bind the P2P client in the worker and expose app-owned IPC to the renderer; validator functions cannot be sent as JSON. Streams retain finite request and output budgets and do not implement durable subscriptions." },
      { type: "actions", items: [{ label: "Full RPC guide", href: `${source}/packages/p2p/docs/rpc.md` }] },
    ],
  },
  {
    slug: "p2p/database",
    title: "Database prototype",
    description: "An experimental Autobase adapter for offline writes, writer membership and convergence.",
    category: "Packages",
    verifiedOn,
    blocks: [
      { type: "callout", title: "Prototype with explicit engine opt-in", body: "Install autobase@7.28.2 to use /db. The root P2P import does not load it, and ordinary consumers do not install this optional peer automatically. This prototype is separate from the existing experimental Autobee scaffold." },
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
      { type: "actions", items: [{ label: "Database API and runnable example", href: `${source}/packages/p2p/docs/db.md` }] },
    ],
  },
  {
    slug: "p2p",
    title: "P2P runtime API",
    description: "One symmetric library for any app to host and consume permissioned services.",
    category: "Packages",
    verifiedOn,
    blocks: [
      { type: "callout", title: "Unpublished alpha", body: "This reference describes @unstoppable-stack/p2p 0.6.0-alpha.1 source. Use a locally packed tarball until publication. Published Personal Node 0.4.0 uses a different API." },
      { type: "lead", text: "Every app can be a node and a client at the same time. createNode owns stable identity, discovery, pairing, grants, capability calls, streaming and shutdown. A Personal Node is optional; two apps can pair and call each other directly." },
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
      { type: "actions", items: [{ label: "Full runtime contract", href: `${source}/packages/p2p/docs/api.md` }, { label: "Runnable P2P notes example", href: `${source}/examples/p2p-notes/README.md` }] },
      { type: "cards", items: [{ title: "Typed RPC", body: "Validated procedures, inferred clients and normal async return values.", href: "/docs/p2p/rpc" }, { title: "Replication API", body: "Manifests, protection states and caller-scoped storage.", href: "/docs/p2p/sync" }, { title: "Database prototype", body: "Experimental collaborative writer logs and app-owned views.", href: "/docs/p2p/database" }, { title: "Capability roadmap", body: "Which cloud-like services exist and which remain planned.", href: "/docs/p2p/roadmap" }] },
    ],
  },
  {
    slug: "p2p/sync",
    title: "Replication API",
    description: "The optional /sync entry of the P2P library: data, files and protection status.",
    category: "Packages",
    verifiedOn,
    blocks: [
      { type: "lead", text: "syncPack replicates Hypercores, Hyperbees and Hyperdrives and keeps seeding registered resources after the owner disconnects. It shares the P2P package's unpublished alpha version and connection lifecycle." },
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
