# Unstoppable Node — Generic Capability API

> Status: v0.4 compatibility foundation implemented; generic request envelope remains future work
> Goal: keep the Node generic enough for many app types while shipping a solid first surface
> Related: `node.md`, `node-technical.md`, `node-pairing-protocol.md`, `node-v0.4-spec.md`

## Principle

The Node is a **local capability host**. It should not know about a specific app's domain model. Apps pair with it, request capabilities, register resources, and call capability methods through stable primitives.

The current concrete services are still valid:

- Data replication
- File replication
- AI inference
- Status/config/permissions

But the public API should model them as capabilities, not bespoke one-off features. That lets future features add methods without redesigning pairing or discovery.

---

## Common App Use Cases

### 1. Personal Data Backup And Seeding

Apps need:

- Register one or more append-only logs or databases.
- Have the Node replicate and keep announcing them even when the app is closed.
- Query whether the Node is caught up.
- Restore by reusing the same key or asking the Node for known resources.

Starting primitives:

- `resource.register` for `hypercore`, `hyperbee`, `hyperdrive`.
- `resource.status` for length, byte length, peer count, paused/quota state.
- `resource.pause` / `resource.resume`.
- `resource.peek` for debugging only, read-only.

### 2. File Attachments And Media

Apps need:

- Register drives for attachments, photos, local documents, exports.
- Show storage consumption by app/resource.
- Selectively sync or pause large resources later.

Starting primitives:

- `resource.register` with `kind: 'hyperdrive'`.
- `storage.usage` global and per app.
- Future: `resource.policy.update` for include/exclude paths.

### 3. Local AI Delegation

Apps need:

- Discover whether AI is available.
- Request streaming inference.
- Fail fast if the Node cannot satisfy required AI capability.
- Later: choose model, embedding vs LLM, tool-call support, privacy policy.

Starting primitives:

- `capability.call` with `capability: 'ai'`, `method: 'completion.stream'`.
- Existing `requestInference()` can be the convenience wrapper over this.
- `capabilities.ai` advertises `{ enabled, modes, models, streaming }` rather than just `true`.

### 4. App Health And Background Status

Apps need:

- Send heartbeat/status hints.
- Subscribe to Node-side events: service changed, quota exceeded, resource paused, replication error.
- Render simple UI like "backed up", "Node offline", "AI unavailable".

Starting primitives:

- `heartbeat` remains simple.
- `event.subscribe` for Node-originated events.
- `status.get` for current snapshot.

### 5. User-Controlled Permissions

Apps need:

- Request access to capabilities at pair time.
- Be denied cleanly or receive reduced permissions.
- Recover when user later grants/revokes access.

Starting primitives:

- `pairRequest.requestedCapabilities`.
- `pairAccepted.grants`.
- `permission.update` emitted by Node when dashboard changes permissions.

### 6. Node Configuration

Users need:

- Configure the Node from the dashboard, not only launch flags.
- Persist defaults across restarts.
- Know which changes apply live and which require restart.

Starting primitives:

- `config.get`.
- `config.update` with validation.
- Capability-scoped config sections, e.g. `capabilities.ai`, `capabilities.storage`, `pairing`, `notifications`, `ui`.

### 7. Future Capabilities

Likely later needs:

- Search/indexing over replicated resources.
- Export/import and restore flows.
- Payments/wallet signing.
- Cross-device Node-to-Node sync.
- Scheduled jobs or local automations.
- Remote coding/build workers.

These should plug into the same capability envelope instead of adding new top-level protocols each time.

---

## Capability Model

### Node Hello

Replace a flat boolean service map over time:

```json
{
  "type": "nodeHello",
  "protocolVersion": "v1",
  "nodePublicKey": "...",
  "capabilities": {
    "resources": {
      "version": 1,
      "kinds": ["hypercore", "hyperbee", "hyperdrive"],
      "methods": ["register", "status", "pause", "resume", "peek"]
    },
    "storage": {
      "version": 1,
      "methods": ["usage"]
    },
    "ai": {
      "version": 1,
      "enabled": true,
      "modes": ["mock", "qvac"],
      "methods": ["completion.stream"]
    },
    "config": {
      "version": 1,
      "methods": ["get", "update"]
    },
    "events": {
      "version": 1,
      "methods": ["subscribe"]
    }
  }
}
```

Compatibility note: keep `services: { data, files, ai }` during v0.4 as a derived compatibility view. New code should prefer `capabilities`.

### Pair Request

```json
{
  "type": "pairRequest",
  "appId": "notes",
  "appName": "Notes",
  "deviceName": "laptop",
  "publicKey": "...",
  "requestedCapabilities": {
    "resources": ["register", "status"],
    "storage": ["usage"],
    "ai": ["completion.stream"]
  }
}
```

### Pair Accepted

```json
{
  "type": "pairAccepted",
  "nodePublicKey": "...",
  "capabilities": { "...": "advertised capability object" },
  "grants": {
    "resources": ["register", "status"],
    "storage": ["usage"],
    "ai": []
  }
}
```

### Generic Request Envelope

Capability methods should share one request/response shape:

```json
{
  "type": "capabilityRequest",
  "requestId": "r1",
  "capability": "resources",
  "method": "register",
  "params": {}
}
```

```json
{
  "type": "capabilityResponse",
  "requestId": "r1",
  "ok": true,
  "result": {}
}
```

Streaming uses events with the same `requestId`:

```json
{ "type": "capabilityEvent", "requestId": "r2", "event": "token", "data": "h" }
{ "type": "capabilityEvent", "requestId": "r2", "event": "done" }
```

Compatibility note: existing messages (`register`, `status-request`, `inference`, `peek-core`, `peek-drive`) can remain in v0.4 as convenience wrappers. Internally they should map to capability handlers when we refactor.

---

## Starting Capability Surface For v0.4

### `resources`

Methods:

- `register({ resources })`
- `list()`
- `status({ resourceId? })`
- `pause({ appId, resourceId? })`
- `resume({ appId, resourceId? })`
- `peek({ resourceId, limit })`

Resource descriptor:

```json
{
  "id": "orders",
  "kind": "hyperbee",
  "key": "hex",
  "name": "Orders",
  "encoding": { "key": "utf-8", "value": "json" },
  "metadata": {}
}
```

Data is the hardest part because every app has its own schema. The Node should avoid schema knowledge in v0.4. It can replicate, measure, pause, seed, and provide debug peeks, but it should not interpret business data.

### `storage`

Methods:

- `usage({ appId?, resourceId? })`
- Future: `quota.update({ appId?, bytes })`

### `ai`

Methods:

- `completion.stream({ messages, model?, options? })`
- Future: `models.list()`, `embeddings.create()`, `tools.call()` if QVAC support is confirmed.

### `config`

Methods:

- `get()`
- `update({ patch })`

Sections:

- `capabilities.ai`
- `capabilities.storage`
- `pairing`
- `permissions`
- `notifications`
- `ui`

### `events`

Methods:

- `subscribe({ events })`

Events:

- `capability.changed`
- `resource.registered`
- `resource.paused`
- `resource.resumed`
- `storage.quotaExceeded`
- `ai.ready`
- `ai.error`
- `permission.changed`

---

## Implementation Strategy

### v0.4

- Done: keep current message API working.
- Done: add `capabilities` alongside `services` in `nodeHello`, `pairAccepted`, and status.
- Done: add `requestedCapabilities` to pair requests, default to current behavior if omitted, and surface the request to `pairRequest` / approval handlers.
- Done: add `grants` to `pairAccepted`.
- Add capability-scoped config planning and UI-editable config as F12a.
- Treat existing `requestInference`, `getNodeStatus`, `getDiskUsage`, and peek helpers as SDK convenience methods.

### v0.5

- Add `capabilityRequest` / `capabilityResponse` as the canonical SDK path.
- Move daemon command handling behind capability handlers.
- Add permission enforcement per capability/method.
- Add schema/version negotiation for capability methods.

### v0.6+

- Add optional capability plugins.
- Add cross-device Node-to-Node capability sync.
- Add search/indexing and restore capability.

---

## Design Constraints

- Offline-first: every capability should fail locally and explicitly, not require cloud coordination.
- User-controlled: pairing grants and config live in the Node and are editable from the dashboard.
- App-agnostic: the Node stores and replicates resources, but does not understand app business schema.
- Capability-scoped permissions: no all-or-nothing trust once the first v0.4 preview is stable.
- Backward compatible within v0.x where practical: wrappers can remain while canonical primitives mature.
