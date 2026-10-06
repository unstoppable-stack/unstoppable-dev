---
name: setup-pear-desktop
description: Build a desktop app with Electron, Pear OTA (pear-runtime), and a Bare worker for P2P, storage, and local AI.
---

# Set Up Pear Desktop

**Migration:** 6 October 2026 · macOS Apple Silicon · QVAC inference 0.21.0 + llama.cpp 0.55.0, Pear Runtime 1.3.1, Electron 44.5.1. Release evidence must identify the new candidate/artifact; prior 0.15 checks do not approve this update.

Use the current Pear OTA architecture. `pear run`, the ambient `global.Pear`
API, `pear-electron`, `pear-bridge`, `pear-run`, `pear.pre`, and `pear release`
are legacy APIs removed by Pear v3. Never add them to a new desktop app.

## Architecture

1. **Electron main process** owns the native window and embeds `pear-runtime`.
2. **Bare worker** owns Hyperswarm, Corestore, Hyperbee/HyperDB, and QVAC.
   Start it with `pear.run(workerPath, [pear.storage])`.
3. **Preload bridge** exposes a narrow, context-isolated IPC API.
4. **Renderer** contains browser-safe UI code only.

The communication path is:

`renderer -> preload -> Electron IPC -> pear-runtime worker -> Bare.IPC`

## Required files

```text
app/
├── package.json
├── index.html
├── electron/
│   ├── main.js
│   └── preload.cjs
├── worker.js
└── app/
    ├── bridge.js
    └── index.js
```

## Package configuration

```json
{
  "type": "module",
  "main": "electron/main.js",
  "upgrade": "pear://<VALID_DEVELOPMENT_LINK>",
  "scripts": {
    "dev": "electron .",
    "start": "electron ."
  },
  "dependencies": {
    "pear-runtime": "^1.3.1"
  },
  "devDependencies": {
    "electron": "^44.5.1"
  }
}
```

Create the real upgrade link with `pear touch` before enabling OTA updates.
Local development should disable updates unless `--updates` is explicitly
passed, so an OTA build cannot replace local source unexpectedly.

Do not emit the removed `pear.pre`, `pear.routes`, `pear.unrouted`, or
`pear.gui` fields.

## Electron host

- Instantiate `new PearRuntime({ name, version, upgrade, dir, app, updates })`.
- Await `pear.ready()` before starting the worker.
- Start the worker with `pear.run()` and pass `pear.storage` as its first arg.
- Forward worker data through Electron IPC.
- Use `contextIsolation: true`, `nodeIntegration: false`, and `sandbox: true`.
- Close the worker and `pear.close()` during application shutdown.
- Open external links with Electron's `shell`; deny new renderer windows.

See [resources/build-setup.md](resources/build-setup.md) for a complete host
and preload pattern.

## Bare worker

The worker receives its channel and storage from Pear OTA:

```js
const pipe = Bare.IPC
const storagePath = Bare.argv[2]

pipe.on('data', onData)
pipe.write(JSON.stringify({ type: 'workerReady' }) + '\n')
```

QVAC plugins must be registered explicitly in a direct Bare worker before its
first SDK call:

```js
const [{ llmPlugin }, { registerPlugin }] = await Promise.all([
  import('@qvac/inference/llamacpp-completion/plugin'),
  import('@qvac/inference/plugins'),
])
registerPlugin(llmPlugin)
```

For streaming inference, send a request ID across the bridge and implement Stop
with `cancel({ operation: 'inference', modelId })`. Ignore late stream events
whose request ID is no longer active, and cancel before model unload on exit.

Use newline-delimited JSON or a typed RPC protocol. Never use stdout as the
application IPC channel. Call `Bare.exit()` only after P2P, storage, model,
and other resources have closed.

See [resources/worker-pattern.md](resources/worker-pattern.md) for the message
bridge and lifecycle pattern.

## Renderer bridge

Expose only explicit operations from `electron/preload.cjs`, such as
`startWorker`, `sendToWorker`, and `onWorkerMessage`. Do not expose
`ipcRenderer`, filesystem access, or arbitrary channel names to the renderer.

## Development and validation

```bash
npm install
npm run dev
```

Validate all of the following:

1. Electron opens without a `pear.pre` timeout or `pear run` warning.
2. The worker sends `workerReady`, then `init-complete`.
3. A KV put/get round trip succeeds.
4. Closing the app closes the worker and runtime.
5. The app also starts when installed as an npm workspace member.

Workspace hoisting is supported by the standard Electron + pear-runtime host;
do not require a private `node_modules` directory or symlink dependencies.

For failures, use [resources/troubleshooting.md](resources/troubleshooting.md).

## Deployment

Development runs through Electron, not the Pear CLI. The Pear CLI remains the
deployment tool:

1. Package OS-specific Electron builds.
2. Use `pear build` to assemble the deployment directory.
3. Use `pear stage` for development or preview deployment.
4. Use `pear provision` and `pear multisig` for production.

Do not generate `pear release`; it was removed in Pear v3.

## QVAC 0.21 Bare integration

Use Node >=22.17 for development tooling. Install `@qvac/inference@0.21.0`, `@qvac/llm-llamacpp@0.55.0` and `bare-process@^4.5.1`. Set `globalThis.process` from bare-process before dynamically importing inference. Configuration files now load through dynamic import; remove the 0.15 global require shim.

Use generated `chat-context.js` to bound recent requests and recover from SDK overflow before streaming. The removed `n_discarded` option must not be generated. Native addons and the embedded Bare runtime must be tested together; keep inference outside Electron/renderer Node code.
