# Demo: node-desktop pre-launch smoke test

**Date:** 2026-05-22 · **Result:** PASSED — after 5 ship-blocking bugs were fixed in source.

A small client app (`sandbox/node-demo/demo.js`) paired with a live Pear Desktop
dashboard (`pear run -d packages/node-desktop -- --ai-mock`), registered a
Hyperbee core for replication, and streamed a mock-AI inference response —
end-to-end, single machine.

---

## Final demo output

```
▸ Node Demo (node-demo-usgz2m)

▸ Phase 1 — local Hyperbee
· core 2a65d0e00bd763d0…  entries before: 0
✓ wrote 3 entries  (version: 4)
✓ announced core on DHT (replication ready)

▸ Phase 2 — pair with the Node
✓ paired in 541ms
· node key: 531d2e7c7d933e85…
· services: data=true files=true ai=true
· registered core: notes (2a65d0e00bd7…)

▸ Phase 3 — remote inference
· prompt: "Reply with one short sentence: what year is it?"
Mock: Reply with one short sentence: what year is it?
✓ streamed 53 tokens in 118ms

▸ Phase 4 — hold open 5s for byte replication
✓ replication window elapsed

✓ demo PASSED
```

---

## Bugs found (all ship-blockers, all fixed during this session)

The four commits that make up the v0.3.0 launch never actually exercised the
Pear/Bare path of `node-desktop`. The unit tests pass (48/48) because they all
run under Node.js, which has the builtins Bare doesn't ship. Booting `pear run`
exposed a chain of issues, each of which the previous one masked:

### 1. `import { EventEmitter } from 'events'` — Bare has no `events` builtin

- **Symptom:** `MODULE_NOT_FOUND: Cannot find module 'events'` on launch.
- **Files:** `packages/node/src/node.js:4`, `packages/node/src/ai-provider.js:22`,
  `packages/node-client/src/client.js:3`.
- **Fix:** Switched to `bare-events` (works in both runtimes; transitively
  available, also added as a direct dep in `packages/node` and
  `packages/node-client`).

### 2. `import { createHash } from 'crypto'` — Bare has no `crypto` builtin

- **Symptom:** `MODULE_NOT_FOUND: Cannot find module 'crypto'` on launch
  (after the events fix).
- **Files:** `packages/node/src/protocol.js:1`,
  `packages/node-client/src/protocol.js:1`.
- **Fix:** Switched to `hypercore-crypto`'s `hash()` (BLAKE2b-256, also
  32-byte output, Bare-portable, already a transitive dep). Added as
  direct dep in both packages.

### 3. `localDiscoveryTopic()` falls back to literal `'bare-runtime'`

- **Symptom:** Dashboard daemon and Node.js client compute different topics on
  the same machine — they never find each other on the DHT.
- **Cause:** `await import('os')` rejects in Bare → catch → `host = 'bare-runtime'`.
  Node side gets the real hostname (`Mac-0211.speedport.ip`). Different
  inputs → different SHA-256 → different topic.
- **Fix:** Try `bare-os` first, then Node's `os`. Both report identical
  hostnames on the same machine. `bare-os` added as `optionalDependencies`.

### 4. `process.env.USER` is `undefined` in Bare → user falls back to `'default'`

- **Symptom:** Even after fix #3 (matching hostname), Bare and Node still
  computed different topics. Bare topic encoded `default@<host>`; Node encoded
  `simon.iribarren@<host>`.
- **Cause:** `typeof process !== 'undefined'` is `false` in pure Bare; the
  whole `proc?.env` chain returned undefined.
- **Fix:** Try `bare-env` first (Bare module that exposes env vars), then fall
  back to Node's `process.env`. `bare-env` added as `optionalDependencies`.

### 5. `bridge.js` spawns the worker with empty args — `--ai-mock` never reaches the worker

- **Symptom:** `services.ai === false` in `nodeHello` despite launching with
  `pear run -d . --ai-mock`. The demo's `requireServices: ['ai']` rejects
  the connection.
- **Cause:** `packages/node-desktop/app/bridge.js:7` passed `[]` as the
  worker arg list. The worker reads `Pear.config.args`, which gets a fresh
  empty array. `aiEnabled` and `aiMock` were always false.
- **Fix:** Forward `Pear.config.args || []` to the worker.

### Bonus deprecation (not blocking, worth tracking)

The worker boots with two warnings:
```
[ DEPRECATED ] Pear.worker is deprecated and will be removed. Use pear-run & pear-pipe
[ DEPRECATED ] Pear.worker.pipe() is deprecated. Use pear-pipe
```

These come from `worker.js:18` (`Pear.worker.pipe()`). Functional today,
will break in a future Pear release. Out of scope for v0.3.0 but track it.

---

## Why none of these were caught earlier

The 48/48 node tests + 218/218 CLI tests give the impression of strong
coverage, but **every test in `packages/node/test/` runs under Node.js**.
The Pear/Bare environment was zero-percent exercised by automation. That's
how five separate Bare-portability bugs and one bridge wiring bug shipped
to `main`.

The deck (`planning/presentations/2026-05-v0.3.0-launch/deck.html`) and
`planning/status/README.md` claim "Bare-runtime portable now: `node-client`
and the daemon's `protocol.js` both lazy-load `os` and guard
`process.pid`/`process.uptime()` — the full stack (including `NodeDaemon`)
now runs inside Bare/Pear workers without patches." The lazy-load was real
but incomplete (only `os`, only the protocol module — `node.js`, `ai-provider.js`,
and `client.js` were never touched), and "without patches" is false.

---

## Recommended action before tagging v0.3.0

1. **Commit the 5 fixes** as `fix(node, node-client, node-desktop): make the daemon Bare-portable end-to-end + forward launch args` (or split into `fix(node)` + `fix(node-desktop)`).
2. **Add a CI job** that boots `pear run -d packages/node-desktop -- --ai-mock` and runs `sandbox/node-demo/demo.js` against it. Without this, regression #2 will happen the next time someone touches the daemon.
3. **Update the deck** to remove the "Bare-runtime portable now" line — that was the assumption that masked all of this. Either leave it implicit or rephrase as "Bare-runtime portable, verified by the node-demo smoke test."
4. **Verify the documented scaffold path** (`us scaffold app -p node-cli -n demo -f node-sync` → `npm install` → `npm run dev`). The earlier scout report flagged two likely problems (missing DHT join in the generator, `@unstoppable/node-client` not published to npm). I cancelled that branch of the demo because we already had enough evidence to halt the launch — but it should be confirmed before tag.
5. **Verify byte-level replication** with a second client (the demo above proved pairing + registration + the streaming inference protocol; it didn't strictly prove that bytes of the registered Hyperbee actually replicated to the Node's Corestore — that's covered by `replication.test.js` at unit level, but a second-client smoke is cheap and rounds out the demo).

---

## How to re-run this demo

```bash
# Terminal 1 — dashboard with mock AI
cd packages/node-desktop
npm install              # one-time
pear run -d . --ai-mock  # leaves a window open; flags MUST come after `.`

# Terminal 2 — the demo client
cd sandbox/node-demo
npm install              # one-time (file:../../packages/node-client)
node demo.js             # runs all three phases
node demo.js --store-only   # skip inference (works against a node without --ai*)
node demo.js --infer-only   # skip Hyperbee setup
```

The demo files:
- `sandbox/node-demo/demo.js` — the client (~150 lines, well-commented)
- `sandbox/node-demo/package.json` — local file: link to `@unstoppable/node-client`

---

## Files touched by the fixes

```
packages/node/src/node.js                    bare-events
packages/node/src/ai-provider.js             bare-events
packages/node/src/protocol.js                bare-events*  bare-os  bare-env  hypercore-crypto
packages/node/package.json                   deps + optionalDeps
packages/node-client/src/client.js           bare-events
packages/node-client/src/protocol.js         bare-os  bare-env  hypercore-crypto
packages/node-client/package.json            deps + optionalDeps
packages/node-desktop/app/bridge.js          forward Pear.config.args to worker
```

(*) Indirect — `node.js` and `ai-provider.js` were the actual `events` consumers
in `packages/node/`; `protocol.js` only changed for crypto/os/env.
