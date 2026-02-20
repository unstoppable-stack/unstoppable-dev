# Pear Desktop Deep Dive — Presentation

> The 10 things you need to know before building a Pear Desktop app.

---

## 1. The Fundamental Model: Two Processes

A Pear Desktop app is **not** a single-process Node.js app. It runs as two separate processes:

- **Renderer** — A Chromium browser window (via `pear-electron`). This is where React, DOM, and CSS live. It has zero access to Node.js or Bare APIs.
- **Worker** — A Bare runtime process (via `pear-run`). This is where P2P networking, AI inference, file system access, and all native modules run.

They communicate over a **pipe** using Newline-Delimited JSON (NDJSON).

**Why this matters**: If you try to import `hyperswarm`, `@qvac/sdk`, or even `bare-fs` in the renderer, the app crashes. Every non-trivial Pear app needs this split.

---

## 2. Why You Need a Worker (Decision Matrix)

| Feature | Needs Worker? | Reason |
|---------|:----------:|--------|
| React UI only | No | Renderer is a browser, works fine |
| Hyperswarm (P2P) | **Yes** | Uses `node:net` under the hood |
| HyperDB / Hyperbee | **Yes** | Uses Hypercore (native) |
| QVAC SDK (AI) | **Yes** | Compiled for Bare, not browser |
| File system access | **Yes** | `bare-fs`, not available in browser |
| RPC over P2P | **Yes** | `bare-rpc` is Bare-only |
| HTTP fetch to APIs | No | Browser `fetch()` works |
| localStorage | No | Browser API, works in renderer |

**Bottom line**: Any module that starts with `bare-*` or `hyper*`, or is `@qvac/sdk`, **must** run in a worker.

---

## 3. The Communication Pipe

Workers talk to the renderer through `Pear.worker.pipe()` (fd 3):

```
Renderer                    Worker
   │                          │
   │── JSON + "\n" ──────────>│  (pear-run pipe, fd 3)
   │                          │
   │<── JSON + "\n" ──────────│  (Pear.worker.pipe())
   │                          │
```

**Critical gotcha**: `process.stdout` goes to the terminal, NOT to the renderer. The pipe is on a separate file descriptor. This was our most confusing bug — the worker looked like it was working (terminal showed messages) but the UI received nothing.

---

## 4. The `unrouted` Config is Mandatory for Workers

`"routes": "."` makes ALL files web-routable (served to Chromium). Without `"unrouted"`, worker JavaScript gets served as a web page:

```json
{
  "pear": {
    "routes": ".",
    "unrouted": ["/dist/worker/index.js"]
  }
}
```

Without this, opening the app shows raw JavaScript instead of your React UI.

---

## 5. Bare Runtime is Minimal — Install Everything

Bare is not Node.js. It ships with almost nothing:

- No `Buffer` — use `Uint8Array` or `b4a`
- No `TextEncoder` — use `charCodeAt()` or `b4a`
- No `process` — install `bare-process`
- No `fs` — install `bare-fs`
- No `crypto` — install `bare-crypto`

Every `bare-*` module must be in your `package.json`. Forgetting one gives a `MODULE_NOT_FOUND` crash.

---

## 6. Send `workerReady` BEFORE Slow Operations

Slow operations in Pear apps:
- DHT announce (`discovery.flushed()`) — 30+ seconds
- Model download — minutes on first run
- Autobase sync — variable

If you send `workerReady` after these, the UI timeout fires and the app looks broken.

**Pattern**: Send ready immediately, then do slow work in the background:

```
send(workerReady) → UI starts
                  → P2P join (background)
                  → Model load (background)
                  → send(status updates)
```

---

## 7. The Entry Point Chain

```
package.json "pear" config
  │
  ├── index.js          ← Main process: pear-electron + pear-bridge
  │     └── loads index.html
  │
  ├── index.html        ← UI shell: <pear-ctrl> + <div id="root">
  │     └── loads dist/src/live-reload.js
  │           └── imports ./index (React app)
  │
  └── worker/index.ts   ← Worker: spawned by pear-run from renderer
        └── Pear.worker.pipe() for communication
```

Key dependencies:
- `pear-electron` + `pear-bridge` = renderer shell
- `pear-run` = spawns worker
- `Pear.worker.pipe()` = worker communication
- `Pear.teardown()` = cleanup

---

## 8. Build Tooling: SWC, Not Bundlers

Pear apps use **SWC** for file-to-file transpilation (TypeScript → JavaScript). No bundling.

```bash
# Build both renderer and worker
bunx swc src -d dist --source-maps
bunx swc worker -d dist --source-maps

# Dev mode (watch + live reload)
concurrently "npm:watch:src" "npm:watch:worker" "pear run -d ."
```

Two SWC configs:
- `.swcrc` — Production (minified, no React Refresh)
- `.swcrc.dev` — Development (React Refresh enabled)

Module resolution happens at runtime (like Node.js), not at build time.

---

## 9. Production Architecture Patterns

The QVAC Workbench (our reference app) demonstrates mature patterns:

| Pattern | What | Why |
|---------|------|-----|
| **Message Router** | Builder-pattern router with Zod validation | Type-safe, extensible message handling |
| **Handler/Service split** | Handlers route, Services hold state | Testable, clean separation |
| **Factory DI** | `createModelHandler(deps)` | Easy testing with mocks |
| **Token batching** | Flush every 150ms, not per-token | Smooth streaming, no pipe flooding |
| **Pending requests map** | ID-based request/response over pipe | Async request/response semantics |
| **Multi-worker** | AI worker + Data worker | Isolation, independent lifecycles |
| **Scoped logging** | `createScopedLogger("Module")` | Debuggable logs |
| **Cleanup chain** | `Pear.teardown()` + SIGKILL fallback | No zombie processes |

---

## 10. The Pear Module Ecosystem

Key modules you'll use in every desktop app:

| Module | Role |
|--------|------|
| `pear-electron` | Electron BrowserWindow shell |
| `pear-bridge` | Local HTTP bridge for HTML loading |
| `pear-run` | Spawn worker processes |
| `pear-hotmods` | Live reload (dev only) |
| `pear-inspect` | Remote Chrome DevTools debugging |
| `pear-crasher` | Crash reporting |
| `pear-updates` | App update notifications |
| `pear-user-dirs` | User directories (Documents, Downloads) |

And the `bare-*` modules for the worker: `bare-process`, `bare-fs`, `bare-path`, `bare-os`, `bare-crypto`, `bare-env`, `bare-buffer`, `bare-net`, `bare-tls`, `bare-subprocess`.

---

## Quick-Start Checklist for a New Pear Desktop App

1. `pear init --type desktop` (or scaffold manually)
2. Add `pear-electron`, `pear-bridge`, `pear-run` as dependencies
3. Create `index.js` (main process bootstrap)
4. Create `index.html` with `<pear-ctrl>` and `#root`
5. Create `src/` for React renderer code
6. Create `worker/` for Bare runtime code
7. Configure `package.json` `pear` field:
   - Set `type: "desktop"`, `pre: "pear-electron/pre"`
   - Set `routes: "."` and `unrouted: ["/dist/worker/index.js"]`
   - Set `gui` dimensions
   - Set `stage.entrypoints` and `stage.ignore`
8. Install `bare-*` deps needed by worker
9. Set up SWC (`.swcrc` and `.swcrc.dev`)
10. Build: `bunx swc src -d dist && bunx swc worker -d dist`
11. Run: `pear run -d .`

---

## What Our Agent Pack Should Cover

Based on this research, our Pear Desktop skill needs to teach AI agents:

1. The two-process architecture (renderer vs worker)
2. What can/cannot run in each process
3. The `pear-run` / `Pear.worker.pipe()` communication pattern
4. NDJSON message protocol with Zod validation
5. The `unrouted` config requirement
6. Bare runtime constraints and `bare-*` module installation
7. SWC build setup (not bundlers)
8. The `workerReady` timing pattern
9. Error handling (P2P errors, uncaught exceptions)
10. Cleanup and teardown

All of these are documented in detail in the research documents alongside this presentation.
