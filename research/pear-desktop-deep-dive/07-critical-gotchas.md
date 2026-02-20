# 07 — Critical Gotchas (Hard-Won Lessons)

These are the issues that cost hours to debug, extracted from our battle-tested builds (`sandbox/coffee-assistant-ui/fixes/`). Every one of them is a critical blocker that prevents the app from working.

## Gotcha 1: Node/Bare Modules in the Renderer

**Symptom**: App crashes on load with `ERR_UNKNOWN_URL_SCHEME` or `MODULE_NOT_FOUND`.

**Cause**: The renderer (Chromium) tried to import a module that uses `node:net`, `bare-process`, or similar.

**How it happens silently**: Barrel exports (`index.ts` files that re-export everything) pull in modules you don't directly use. Example:

```typescript
// src/lib/index.ts — barrel export
export { createServer } from "./p2p-connection"   // uses hyperswarm
export { createAgent } from "./ai-agent"           // uses @qvac/sdk
export { formatMessage } from "./utils"            // pure JS

// src/App.tsx — only needs formatMessage, but crashes
import { formatMessage } from "../lib"  // ← also imports p2p + ai transitively
```

**Fix**: Import from specific files, never from barrels that include P2P/AI modules:

```typescript
import { formatMessage } from "../lib/utils"  // ← direct import, safe
```

**Severity**: Critical. App won't start.

---

## Gotcha 2: Worker Files Served as Web Pages

**Symptom**: Opening the app shows raw JavaScript source code instead of the UI.

**Cause**: `"routes": "."` in pear config makes ALL files web-routable. The worker JS file gets served to Chromium as a web page.

**Fix**: Add `"unrouted"` to exclude worker files:

```json
{
  "pear": {
    "routes": ".",
    "unrouted": [
      "/dist/worker/index.js"
    ]
  }
}
```

**Severity**: Critical. UI doesn't load.

---

## Gotcha 3: Writing to stdout Instead of the Pipe

**Symptom**: Worker logs show messages being sent, but UI never receives them.

**Cause**: `pear-run` creates the communication pipe on **fd 3**, not stdin/stdout. Writing to `process.stdout` goes to the terminal.

**Fix**: Use `Pear.worker.pipe()` in workers:

```typescript
// WRONG
import process from "bare-process"
process.stdout.write(JSON.stringify(msg) + "\n")  // goes to terminal

// RIGHT
const pipe = await Pear.worker.pipe()
pipe.write(JSON.stringify(msg) + "\n")  // goes to renderer
```

**Severity**: Critical. UI stuck waiting forever.

---

## Gotcha 4: TextEncoder in Bare Runtime

**Symptom**: `ReferenceError: TextEncoder is not defined` in worker.

**Cause**: `TextEncoder` is a Web API. Bare runtime doesn't have it.

**Fix**: Use `charCodeAt` or `b4a`:

```typescript
// WRONG
const bytes = new TextEncoder().encode(str)

// RIGHT (pure JS)
const bytes = new Uint8Array(str.length)
for (let i = 0; i < str.length; i++) {
  bytes[i] = str.charCodeAt(i) & 0xff
}

// RIGHT (b4a)
import b4a from "b4a"
const bytes = b4a.from(str, "utf-8")
```

**Severity**: Critical. Worker crashes on startup.

---

## Gotcha 5: `bare-process` Not Installed

**Symptom**: `MODULE_NOT_FOUND: Cannot find module 'bare-process'`.

**Cause**: Unlike Node.js, `process` is not a global in Bare. It's an npm package.

**Fix**: Install explicitly:

```bash
npm install bare-process
```

Same for all `bare-*` modules (`bare-os`, `bare-fs`, `bare-path`, `bare-crypto`). They must all be in `package.json` dependencies.

**Severity**: Critical. Worker crashes on startup.

---

## Gotcha 6: Worker Ready Timeout

**Symptom**: UI shows "Worker init timeout" error, even though worker eventually starts fine.

**Cause**: Worker sent `workerReady` only after completing slow initialization (DHT announce: 30+ seconds, model download: minutes).

**Fix**: Send `workerReady` immediately, before slow operations:

```typescript
// WRONG
await initP2P()         // 30+ seconds
await loadModel()       // minutes
send({ type: "workerReady" })  // too late, UI timed out

// RIGHT
send({ type: "workerReady" })  // UI unblocks
await initP2P()                // background
await loadModel()              // background
send({ type: "modelStatus", status: "ready" })  // status update
```

**Severity**: High. App appears broken on first use.

---

## Gotcha 7: P2P Connection Errors Crashing the Worker

**Symptom**: Worker crashes with `ETIMEDOUT` or `ECONNRESET` during P2P operations.

**Cause**: Hyperswarm connection errors propagate as uncaught exceptions. In a browser, these would be caught. In Bare, they crash the process.

**Fix**: Catch P2P errors globally with a cooldown:

```typescript
process.on("uncaughtException", (error) => {
  const isP2P = error.code === "ETIMEDOUT" || error.code === "ECONNRESET"
  if (isP2P) {
    // Suppress — SDK handles reconnection
    return
  }
  // Report non-P2P errors to UI
  pipe.write(JSON.stringify({ type: "error", error: error.message }) + "\n")
})
```

**Severity**: High. Worker dies and takes the app with it.

---

## Gotcha 8: Large Message Buffers

**Symptom**: Worker crashes or messages get truncated when sending large data (audio files).

**Cause**: Default buffer handling doesn't account for data arriving in chunks, or the buffer overflows.

**Fix**: Implement proper NDJSON buffering with a size limit:

```typescript
let messageBuffer = ""
const MAX_BUFFER_SIZE = 200 * 1024 * 1024  // 200MB

pipe.on("data", (data) => {
  if (messageBuffer.length + data.length > MAX_BUFFER_SIZE) {
    send({ type: "error", error: "Buffer overflow" })
    return
  }
  messageBuffer += Buffer.from(data).toString()
  // Process complete messages...
})
```

**Severity**: Medium. Affects audio/file features.

---

## Gotcha 9: Model Config Parameters That Crash the SDK

**Symptom**: `CommonParamsParse: invalid argument` when loading a model.

**Cause**: Certain LLM config parameters (`top_k`, `repeat_penalty`, `presence_penalty`, `frequency_penalty`) are not supported by the current llama.cpp addon.

**Fix**: Filter out unsupported parameters before passing to SDK:

```typescript
const { top_k, repeat_penalty, presence_penalty, frequency_penalty, ...safeConfig } = modelConfig
```

**Severity**: Medium. Model won't load with certain configurations.

---

## Gotcha 10: CSP Blocking External URLs

**Symptom**: `fetch()` calls to external APIs fail silently or with CSP errors.

**Cause**: Pear's Content Security Policy blocks requests to URLs not listed in `pear.links`.

**Fix**: Add allowed domains to `pear.links` in `package.json`:

```json
{
  "pear": {
    "links": [
      "https://huggingface.co/*",
      "https://cdn-lfs.hf.co/*",
      "https://api.example.com/*"
    ]
  }
}
```

**Severity**: Medium. External integrations silently fail.

---

## Quick Reference: "My App Doesn't Work" Checklist

1. Does the renderer import any `bare-*` or `hyperswarm`/`@qvac/sdk` modules? → Move to worker
2. Is the worker file listed in `pear.unrouted`? → Add it
3. Does the worker use `process.stdout` or `Pear.worker.pipe()`? → Use `Pear.worker.pipe()`
4. Are all `bare-*` modules installed as npm dependencies? → `npm install bare-process bare-fs ...`
5. Does the code use `TextEncoder`, `URL`, `fetch` in the worker? → Replace with Bare alternatives
6. Does the worker send `workerReady` before slow operations? → Move it earlier
7. Are external URLs listed in `pear.links`? → Add them
