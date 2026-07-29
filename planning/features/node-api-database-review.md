# Unstoppable Node API and Resource Review

> Status: reviewed — release-critical security findings implemented; larger v0.5 protocol work remains
> Reviewed: 2026-06-12; implementation update: 2026-07-29
> Scope: app-facing Node API, data/file resources, sync, AI, status, permissions,
> storage policy, export/import, and robustness/safety risks

## Implementation Update — 2026-07-29

The current implementation now addresses the review's immediate safety chain:

- Pair identity is bound to the Noise transport key, and post-pair requests use
  the authenticated socket session instead of message-supplied app IDs.
- Status, logical storage usage, registration, inspection, heartbeat, and AI
  handlers require their corresponding grant.
- App-facing status and storage responses are scoped to the requesting app;
  full management state remains local to the daemon/dashboard.
- Pairing grants only the intersection of requested and available capabilities.
- Inspection is limited to app-owned resources with server-side hard limits.
- Control frames are size-limited, and pending client requests fail cleanly on
  disconnect. Streaming AI supports timeout and caller cancellation.

Still intentionally deferred: the canonical v0.5 capability envelope,
installation IDs and safe cross-device linking, app-owned restore APIs,
encrypted payload backup, explicit retention/delete semantics, AI scheduling
and rate limits, and resource manifests/redaction.

## Reviewer Prompt

Please review this architecture note as a second model. Focus on whether the
Node API is robust, safe, and flexible enough for many different app types that
need data sync, file storage/retrieval, delegated AI, status, permissions,
storage policy, and future Node services.

Review questions:

- Should the Node remain schema-blind for primary app data?
- Should files be exposed as replicated Hyperdrive resources only, or should the
  Node also provide app-facing file read/write/retrieve helpers?
- Is the proposed capability API the right abstraction for app interaction?
- Are there missing safety boundaries around permissions, status visibility,
  file reads, debug reads, quotas, exports/imports, AI, or migrations?
- Which Node features should be app-facing, and which should remain dashboard /
  local-management only?
- What would you change before this becomes the v0.5 API direction?

## Files Consulted

- `packages/node-client/src/index.js`
- `packages/node-client/src/client.js`
- `packages/node-client/src/protocol.js`
- `packages/node-client/src/errors.js`
- `packages/node/src/node.js`
- `packages/node/src/protocol.js`
- `packages/node/src/registry.js`
- `packages/node/src/replication.js`
- `packages/node/src/config.js`
- `packages/node/src/ai-provider.js`
- `packages/node/src/export.js`
- `packages/node/src/index.js`
- `packages/node-client/README.md`
- `packages/node/README.md`
- `planning/status/node/README.md`
- `planning/features/node-technical.md`
- `planning/features/node-capability-api.md`
- `planning/features/node-pairing-protocol.md`
- `planning/features/node-v0.4-spec.md`

## Executive Summary

The strongest boundary is to treat the Unstoppable Node as a local capability
host for app resources, not as a shared business database or central file
server.

Apps should keep their own schemas in app-owned Hyperbee, HyperDB, Hypercore,
or Hyperdrive resources. Apps should also keep file layout and file write
semantics in app-owned Hyperdrives. The Node should replicate, seed, back up,
report status, enforce storage policy, manage permissions, provide bounded
inspection/retrieval helpers, and optionally provide AI. It should not become
responsible for interpreting every app's business records or owning arbitrary
file path semantics across apps.

Recommended v0.5 direction:

- Keep existing SDK helpers working: `connectToNode()`, `getNodeStatus()`,
  `getDiskUsage()`, `peekCore()`, `peekDrive()`, and `requestInference()`.
- Bind app identity to the transport key at pair time and resolve identity from
  the socket on every request — never from message fields.
- Require pairing (and later grants) before any handler executes, including
  status, disk usage, and peeks.
- Add a canonical `capabilityRequest` / `capabilityResponse` envelope under the
  hood.
- Add a versioned app resource manifest for data and file metadata, policy,
  redaction, restore, and optional indexes, while keeping primary data schema
  and file layout ownership inside each app.

The verified safety priority for v0.5 is a chain, in this order:
**authentication** (unpaired peers should not reach handlers at all) →
**authorization** (paired sockets are bound to an identity and checked against
grants) → **filtering** (responses scoped to the requesting app). Per-app
status filtering only matters once the first two layers exist.

## Current App API

Apps currently use `@unstoppable/node-client` to find and pair with a local
Node over Hyperswarm.

Example:

```js
import { connectToNode } from '@unstoppable/node-client'

const client = await connectToNode({
  appId: 'my-app',
  appName: 'My App',
  cores: [{ key: bee.core.key, type: 'hyperbee', name: 'data' }],
  drives: [{ key: drive.key, name: 'files' }],
  requireServices: ['data'],
  reconnect: true
})
```

The app-facing surface is:

| Area | Surface | Role |
| --- | --- | --- |
| Discovery | `localDiscoveryTopic()`, `nodeHello` | Find a local Node and learn `protocolVersion`, services, and capabilities. |
| Pairing | `pairRequest`, `pairAccepted`, `pairDenied` | App identifies itself, requests capabilities, receives grants. |
| Resources | `register` | App registers Hypercore, Hyperbee, or Hyperdrive keys for replication. |
| Status | `getNodeStatus()`, `nodeStatus` | Snapshot of services, apps, cores, drives, storage, and AI readiness. |
| Storage | `getDiskUsage()`, quotas | Measure bytes, enforce advisory global/per-app limits by pausing replication. |
| Debug | `peekCore()`, `peekDrive()` | Best-effort read-only inspection, not a business query API. |
| AI | `requestInference()` | Streaming tokens through the Node when AI is granted and enabled. |

This surface should be reviewed as a full resource API:

- Data resources: Hypercore, Hyperbee, HyperDB/Autobase-derived feeds.
- File resources: Hyperdrive registration, replication, seeding, listing, and
  future retrieval/restore helpers.
- Compute resources: AI inference now; future search/indexing, scheduled jobs,
  remote build/coding workers, or wallet/payment signing.
- Management resources: status, config, permissions, quotas, pause/resume,
  export/import, and dashboard-only controls.

## Current Wire/Capability Model

The current code already has a capability foundation:

- `nodeHello` includes `protocolVersion`, `nodePublicKey`, `services`, and
  `capabilities`.
- `pairRequest` includes `requestedCapabilities`.
- `pairAccepted` includes `capabilities` and `grants`.
- `planning/features/node-capability-api.md` proposes
  `capabilityRequest` / `capabilityResponse` as the canonical future path.

This direction is sound. It lets the Node grow from data/files/AI into a
general local capability host without adding a new bespoke top-level message
for every feature.

The main design improvement is to make permission enforcement capability-first:

- Pair requests should ask for specific capabilities and methods.
- Pair acceptance should grant only requested and approved methods.
- Every capability request should check the app's grants before executing.
- Existing convenience helpers should map to capability methods internally.

## Resource Direction

### Core Principle

The Node should host capabilities over resources. It should not own the app's
domain model. The same principle applies to database records, files, AI, and
future services:

- Apps own writes and business semantics.
- The Node owns replication, availability, policy, and observability.
- App-facing APIs should be narrow, permissioned, versioned, and explicit.
- Dashboard/CLI management APIs can be more powerful, but should not be exposed
  automatically to every paired app.

## Data Resource Direction

### Recommended: Schema-Blind Resource Host

Apps own schemas in their Hyperbees, HyperDBs, or Hyperdrives. The Node
replicates, seeds, backs up, reports status, enforces quotas, and grants
capabilities.

Why this is best for v0.5:

- Different apps can have incompatible schemas without requiring Node changes.
- App migrations remain app-owned.
- The Node avoids becoming a central multi-tenant database with cross-app data
  leakage risk.
- The local-first model stays intact: apps keep working offline and do not need
  the Node for normal writes.

Trade-off:

- The Node cannot answer arbitrary cross-app business queries unless a later
  optional indexing/search layer is added.

### Optional Next Layer: Resource Manifest and Indexes

Apps can publish a versioned manifest that describes resources without handing
business semantics to the Node.

Suggested manifest fields:

```json
{
  "appId": "notes",
  "appName": "Notes",
  "manifestVersion": 1,
  "resources": [
    {
      "id": "notes",
      "kind": "hyperbee",
      "key": "hex",
      "name": "Notes database",
      "encoding": { "key": "utf-8", "value": "json" },
      "schemaVersion": "2026-06-12",
      "sensitivity": "private",
      "redaction": "metadata-only",
      "quotaClass": "documents",
      "indexes": []
    }
  ]
}
```

The manifest should be metadata for UX, policy, restore flows, and optional
derived indexes. It should not be the authority for interpreting primary app
records.

Threat model note: manifests are app-supplied and must be treated as untrusted
input. Redaction rules cannot protect data from the app that wrote them; they
protect against dashboard/peek exposure and future cross-app surfaces. The Node
must validate manifest fields and must never let a manifest grant access — only
narrow it.

Possible uses:

- Dashboard labels and grouping.
- Safer peeks with redaction rules.
- Restore/import UI.
- Search/indexing plugins later.
- Per-resource quota policies.

### Avoid: Central Shared Query Database

Avoid making the Node accept app schemas and expose generic CRUD/query APIs over
a central multi-tenant store for primary data.

Risks:

- App schema migrations become Node compatibility problems.
- Permissions become row/document-level rather than capability-level.
- Data leaks between apps become much easier.
- The Node becomes a required runtime dependency for writes.
- A generic CRUD API would compete with Hyperbee/HyperDB instead of hosting
  them.

## File Resource Direction

Files should follow the same ownership rule as data: apps own file layout,
paths, writes, and app-specific metadata. The Node should host, replicate,
seed, inspect, retrieve, and restore file resources through Hyperdrive.

### Current Model

The current code supports file sync by registering drives:

```js
const client = await connectToNode({
  appId: 'photo-app',
  appName: 'Photo App',
  drives: [{ key: drive.key, name: 'photos' }],
  requireServices: ['files']
})
```

The Node opens the Hyperdrive against its shared Corestore, joins the drive
discovery key, replicates underlying cores through `store.replicate(socket)`,
tracks stats with `getDriveStats()`, and exposes `peekDrive()` for bounded
directory listing.

### Recommended App-Facing File API

The Node should not become a generic mutable filesystem service where apps send
arbitrary `writeFile(path, bytes)` calls to the Node as the primary write path.
Apps should write to their own Hyperdrive locally, and the Node should replicate
that drive.

Good app-facing file capabilities:

- `files.registerDrive({ id, key, name, manifest? })`
- `files.status({ driveId? })`
- `files.list({ driveId, path, limit, recursive? })`
- `files.get({ driveId, path, range? })` for restore/retrieval of replicated
  content.
- `files.createReadStream({ driveId, path, range? })` if the SDK grows stream
  helpers.
- `files.pause({ driveId })` and `files.resume({ driveId })`
- `files.policy.update({ driveId, include, exclude })` later for selective sync.

Avoid or defer:

- Node-owned primary file writes for app data.
- Cross-app path namespaces like `/apps/<app>/...` as the canonical app API.
- Arbitrary recursive reads without grants, limits, and manifest redaction.
- Serving files across the network before auth, grants, and audit events exist.

### Retrieval and Restore

Apps do need a way to retrieve files from the Node when local state is missing
or a device is being restored. This should be modeled as restore/retrieval from
a replicated Hyperdrive, not as central cloud storage.

Suggested behavior:

- App provides the drive key and proves it is paired/authorized.
- Node reports whether it has the file and which version.
- App requests a path or range.
- Node streams bytes back over the capability protocol or helps the app
  reconnect to the replicated Hyperdrive.
- The API returns typed errors for missing drive, missing file, permission
  denied, partial data, timeout, and quota/pause state.

This keeps offline-first behavior intact: normal app writes happen locally,
while Node retrieval is a backup/restore path.

### File Manifest Fields

The resource manifest should support files, not only databases:

```json
{
  "id": "photos",
  "kind": "hyperdrive",
  "key": "hex",
  "name": "Photo library",
  "schemaVersion": "2026-06-12",
  "sensitivity": "private",
  "redaction": "paths-only",
  "quotaClass": "media",
  "filePolicy": {
    "sync": "all",
    "include": ["/albums/**"],
    "exclude": ["/raw/**"]
  },
  "contentTypes": ["image/jpeg", "image/png"],
  "restore": {
    "allowPathRead": true,
    "allowRangeRead": true
  }
}
```

The manifest should help the Node display, redact, quota, and restore files.
It should not make the Node the source of truth for app-specific file semantics.

## Other Node Feature Surfaces

### AI Provider

Current app-facing helper: `client.requestInference({ messages })`.

Recommended capability shape:

- `ai.completion.stream({ messages, model?, options? })`
- Future: `ai.models.list()`
- Future: `ai.embeddings.create()` if QVAC support is validated.
- Future: `ai.vision.analyze()`, `ai.transcription.create()`, or `ai.rag.query()`
  only after the agent pack and reference apps validate those patterns.

Safety concerns:

- AI requests should require an explicit grant.
- Status should advertise model readiness without leaking other apps' prompts.
- The Node should expose rate/queue limits before becoming a shared AI host.
- Prompt/log retention policy should be explicit. Default should be no prompt
  persistence unless the user enables diagnostics.

### Status and Events

Current helpers: `client.getNodeStatus()` and `nodeStatus` event.

Recommended capability shape:

- `status.get({ scope: "self" })` for apps.
- `status.get({ scope: "management" })` only for dashboard/CLI trusted local
  management surfaces.
- `events.subscribe({ events })` for changes like service availability, quota
  exceeded, app paused, permission changed, AI ready/error, resource replicated.

The app-facing status API should be filtered. Apps need to know their own
resources and aggregate Node health; they do not need other apps' names, keys,
or grants.

### Config and Permissions

Config and permission APIs are powerful and should be split by audience.

App-facing:

- Read own grants.
- Request additional capabilities.
- Receive permission changed events.
- Maybe update app-owned resource manifests.

Management-only:

- Toggle AI.
- Change global quotas.
- Change per-app quotas.
- Approve/revoke/forget apps.
- Export/import Node state.
- Change pairing policy.

### Storage, Quotas, Pause/Resume

Storage policy spans data and files. Quotas should be reported per app and per
resource where possible.

Capabilities:

- `storage.usage({ scope: "self" })`
- `storage.usage({ scope: "management" })`
- `resources.pause({ resourceId? })`
- `resources.resume({ resourceId? })`
- Future: `storage.quota.requestIncrease({ reason })`

Quotas remain advisory in the current architecture. The Node can stop
announcing or pause replication, but it cannot stop an app from writing to its
own local feeds.

### Export, Import, Backup, and Restore

Current export/import writes a JSON `.uns` bundle containing config, paired-app
registry records, and trust decisions. It does not yet include encrypted
Corestore data, stable Node identity seeds, or replicated app payloads.

Recommended split:

- Management-only `backup.exportMetadata()`
- Management-only `backup.importMetadata()`
- Future management-only encrypted full archive export.
- App-facing `resources.restorePlan({ appId })` or
  `files.get({ driveId, path })` for restoring app-owned resources.

App-facing export/import should be narrow. Full Node backup contains other apps'
metadata and should stay dashboard/CLI only.

## Cloud API Patterns To Borrow (uncited — refresh before publication)

Live web research could not run in this environment because `parallel-cli` was
missing. This section is an uncited design comparison and should be refreshed
with cited source research before publication.

Patterns worth borrowing:

| Pattern | How it works | Lesson for the Node |
| --- | --- | --- |
| Supabase/PostgREST | Database schema becomes the API; row-level security is the safety boundary. | If the Node ever becomes schema-aware, permissions must be data-level, not only app-level. |
| Firebase/Firestore | Document collections are flexible; rules enforce per-path access; clients can work offline. | A manifest plus rules model fits local-first better than central SQL. |
| Hasura | Metadata maps existing schemas to GraphQL with role permissions. | Introspection and permissions are product features, not implementation details. |
| S3-style object storage | Object API is schema-blind; apps bring metadata, prefixes, policies, and signed access. | Good analogy for Hyperdrive and Hypercore hosting without business semantics. |
| Sync-first databases | Local replica drives app UX; server/cloud sync is transport plus policy. | The Node should preserve app offline behavior and never become required for writes. |
| Cloud backup APIs | Backup metadata, restore points, object contents, and account-level management are usually separated. | Keep app restore helpers separate from full Node export/import. |

## Robustness Review

Findings are ordered by the safety chain: authentication first (who can reach a
handler at all), then authorization (what a bound identity may do), then
filtering (what a response reveals). Code references were verified against
`packages/node/src` on 2026-06-12.

### High: No Identity Binding After Pairing (appId Is Spoofable)

Pairing stores a self-claimed `msg.publicKey` and never verifies it matches the
Noise transport key (`remoteKey`) of the socket that sent it. After pairing,
every handler resolves the app from the message field, not the socket:
`_handleInference` and `_handleRegister` both call
`registry.getApp(msg.appId)`. Any connected peer can send `inference` or
`register` with another app's `appId` and inherit that app's grants. The
requested-capabilities field on the wire is therefore not a security boundary
today.

Recommendation:

- Bind `appId → remoteKey` at pair time (or require `publicKey === remoteKey`,
  or add a challenge/signature proving key ownership).
- Resolve app identity from the socket on every request. Never trust `appId`
  or `publicKey` fields in post-pairing messages.
- Decide re-pairing semantics explicitly: `registerApp` currently upserts by
  `appId`, so a second device claiming the same `appId` can overwrite an
  existing registration (subject only to the approval gate).
- Fold this into the v0.5 capability envelope: the envelope should carry no
  identity fields at all; identity comes from the connection.

### High: Unauthenticated Status, Disk Usage, and Peeks

`status-request`, `disk-usage-request`, `peek-core`, and `peek-drive` handlers
perform no pairing or grant checks. Any device on the local network that finds
the discovery topic and connects receives the full `getStatus()` snapshot
(all paired apps, names, keys) and can peek any replicated core or drive by
key. The v0.4 spec says app-facing status should be filtered so an app only
sees its own registered cores/drives and non-identifying aggregate Node state;
today it is neither filtered nor gated. The only handler that checks grants is
`inference`.

Recommendation:

- Require pairing before any handler executes.
- Track `appId` per paired socket (see identity binding above).
- Filter status responses for client RPCs to the requesting app's resources
  plus non-identifying aggregate health.
- Keep the full `getStatus()` snapshot available only to local dashboard,
  headless CLI, and trusted management surfaces.

### High: Schema Drift

If the Node interprets app records, every app migration becomes a Node
compatibility problem.

Recommendation:

- Keep primary data opaque.
- Put schema version and encoding in the resource manifest.
- Let apps provide optional, versioned index builders later if the Node adds
  search.

### Medium: Overbroad Grants

`defaultCapabilityGrants()` grants every enabled method. Worse, the pairing
handler computes grants from Node capabilities alone and ignores
`msg.requestedCapabilities` entirely — even on the approval path, requested
capabilities are dead weight on the wire. That is convenient for the first
preview but not a robust permission model.

Recommendation:

- Default grants should be the intersection of requested capabilities,
  available capabilities, and user approval.
- Dashboard approval should show requested methods.
- Apps should receive reduced grants cleanly and be able to adapt.

### Medium: Unbounded Debug Reads

`peekCore()` and `peekDrive()` are useful for diagnostics, but they can expose
private data if broadly available. The documented limits (5 blocks, 50 entries)
are defaults only: the handlers pass the client-supplied `msg.limit` straight
through with no server-side clamp, so a client can request arbitrarily large
reads. Combined with the missing pairing check above, peeks are currently an
open read API for any local peer that knows a resource key.

Recommendation:

- Gate peeks behind a specific `resources.peek` grant.
- Clamp `limit` server-side with small hard caps, regardless of client input.
- Apply manifest redaction when available.
- Treat peeks as diagnostics, not query API.

### Medium: File Retrieval Boundaries

File retrieval is useful for restore, but it can easily become a broad file
exfiltration API if every paired app can list and read every replicated drive.

Recommendation:

- Gate file list/read/stream methods behind `files.list` and `files.read`
  grants.
- Filter by app-owned drives.
- Support range reads and limits.
- Return typed partial-data errors when a file is not fully replicated.
- Treat dashboard browse as management-only unless the user grants app access.

### Medium: Quota Semantics

Current quotas are advisory. The Node pauses app announcements when quota is
exceeded, but existing data is not deleted and writes already flowing through
Hypercore/Corestore may still arrive.

Recommendation:

- Keep this behavior, but document it plainly in app-facing API docs.
- Consider quota events like `storage.quotaExceeded`.
- Let apps render clear "Node backup paused" states.

### Medium: AI Privacy and Abuse Controls

The Node can become a shared local AI provider. That introduces prompt privacy,
resource contention, and app abuse risks.

Recommendation:

- Require explicit `ai.completion.stream` grants.
- Add queue/rate limits before multi-app AI is promoted.
- Keep prompt persistence disabled by default.
- Expose only aggregate AI health to apps, not other apps' inference activity.

### Medium: Export/Import Scope

Full Node export/import contains cross-app metadata and trust decisions. It is
not equivalent to an app-owned restore API.

Recommendation:

- Keep full export/import management-only.
- Add app-facing restore capabilities that are scoped to the requesting app's
  registered resources.
- Encrypt any future full Corestore archive and make identity/key semantics
  explicit.

### Medium: Resource Lifecycle and Data Retention

The API covers register/pause/resume but not unregister/remove, and nothing
defines what happens to replicated data when the user forgets an app. Does the
Node delete the app's cores and drives, keep seeding them, or keep the bytes
but stop announcing? Forgetting an app without deleting its data is a privacy
surprise; deleting silently is a data-loss surprise.

Recommendation:

- Add `resources.unregister` (app-facing, scoped to own resources).
- Make forget-app a management-only action with an explicit data choice:
  keep, stop announcing, or delete replicated data.
- Document retention/GC semantics in app-facing API docs alongside quotas.

### Low: Protocol Hardening

Framing is newline-delimited JSON with an unbounded accumulation buffer per
connection — a peer can send a long line with no newline and grow Node memory
without limit. Malformed JSON is silently swallowed, so abuse and bugs are
invisible.

Recommendation:

- Enforce a max frame size and drop/penalize connections that exceed it.
- Count and surface malformed-message and unknown-message events per peer.
- Add per-connection rate limits as part of the v0.5 envelope work.

### Low: Protocol Growth

One-off messages will sprawl as features grow.

Recommendation:

- Make `capabilityRequest` / `capabilityResponse` canonical in v0.5.
- Keep existing helpers as SDK wrappers.
- Version each capability separately.

## Proposed v0.5 API Contract

Canonical wire request:

```json
{
  "type": "capabilityRequest",
  "requestId": "r1",
  "capability": "resources",
  "method": "register",
  "params": {}
}
```

Canonical wire response:

```json
{
  "type": "capabilityResponse",
  "requestId": "r1",
  "ok": true,
  "result": {}
}
```

Streaming events:

```json
{ "type": "capabilityEvent", "requestId": "r2", "event": "token", "data": "h" }
{ "type": "capabilityEvent", "requestId": "r2", "event": "done" }
```

Initial capabilities, tagged by audience. App-facing methods are scoped to the
requesting app's own resources and require grants; management methods are
dashboard/CLI only and must not be exposed to paired apps:

| Capability | Audience |
| --- | --- |
| `resources.register` | app |
| `resources.unregister` | app |
| `resources.list` | app (own resources) |
| `resources.status` | app (own resources) |
| `resources.pause` / `resources.resume` | app (own) + management (any) |
| `resources.peek` | app (own, gated grant) + management |
| `files.registerDrive` | app |
| `files.status` | app (own drives) |
| `files.list` | app (own drives, gated grant) |
| `files.read` / `files.readStream` | app (own drives, gated grant) |
| `files.policy.update` | app (own drives) |
| `storage.usage` | app (`scope: self`) + management (global) |
| `ai.completion.stream` | app (gated grant) |
| `ai.models.list` | app |
| `config.get` | app (own grants only) + management (full) |
| `config.update` | management only |
| `events.subscribe` | app (own events) + management (all) |
| `backup.exportMetadata` | management only |
| `backup.importMetadata` | management only |
| `restore.plan` | app (own resources) |
| `restore.readResource` | app (own resources) |

Every capability request resolves the calling app from the authenticated
socket, never from request fields, and is checked against that app's grants
before executing.

SDK convenience methods can remain:

- `connectToNode()`
- `client.getNodeStatus()`
- `client.getDiskUsage()`
- `client.peekCore()`
- `client.peekDrive()`
- `client.listFiles()`
- `client.getFile()`
- `client.requestInference()`

## Open Questions

- Should the app resource manifest be stored in the app's Hyperbee, sent during
  registration, or both?
- Should file manifests be required before app-facing file reads are allowed,
  so redaction and sensitivity are explicit?
- Should `appId` represent an app globally, or an app installation/device pair?
- Should management APIs be exposed to paired apps at all, or only dashboard and
  CLI?
- Do we need a first-class restore API before search/indexing?
- How should grants change when the user edits permissions while an app is
  connected?
- Should file retrieval stream bytes over the control socket, or should the Node
  return enough information for the app to reconnect to the Hyperdrive and read
  through normal replication?
- How should partial replication be represented for files: missing, pending,
  partial range available, or stale version?
- Should AI provider usage have per-app quotas distinct from storage quotas?
- When the user forgets an app, should the Node delete its replicated data,
  stop announcing it, or keep seeding it? Who chooses, and is it reversible?
- Should identity binding require `publicKey === remoteKey`, or a separate
  challenge/signature so an app identity can move across transport keys?

## Bottom Line

The Node should be a local capability host and resource replication layer. Do
not make it a central schema-aware database, generic mutable file server, or
unscoped management API for paired apps.

The robust path is:

1. Authenticate first: bind app identity to the transport key at pair time and
   require pairing before any handler runs.
2. Enforce least-privilege grants (requested ∩ available ∩ approved) on every
   capability request, resolving identity from the socket.
3. Filter app-facing status and resource listings by the authenticated app.
4. Keep app schemas and file layouts app-owned.
5. Add a generic capability envelope with no identity fields in messages.
6. Add optional manifests for data, files, metadata, redaction, restore, and
   future indexes — treated as untrusted input that can only narrow access.
7. Define resource lifecycle: unregister, forget-app retention, and deletion
   semantics.
8. Split app-facing restore/retrieval from dashboard/CLI full backup/export.
