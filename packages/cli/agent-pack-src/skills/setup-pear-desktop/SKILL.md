---
name: setup-pear-desktop
description: Build a desktop app with Electron, Pear OTA (pear-runtime), and a Bare worker for P2P, storage, and local AI.
---

# Set Up Pear Desktop

Read the app’s `.unstoppable/project.json` and generated compatibility table before changing native dependencies. The maintained local AI session lives in `.unstoppable/runtime-ai/`; preserve its lifecycle contract when extending the worker.
Use the current Pear OTA architecture. `pear run`, the ambient `global.Pear`
API, `pear-electron`, `pear-bridge`, `pear-run`, `pear.pre`, and `pear release`
are legacy APIs removed by Pear v3. Never add them to a new desktop app.

## Architecture

1. **Electron main process** owns the native window and embeds `pear-runtime`.
2. **Bare worker** owns P2P library sessions, native storage and QVAC.
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

## Generated host configuration

Keep package scripts, dependency versions and Electron/Pear initialization in the generated host. Inspect the app's compatibility profile before changing them. Configure a real Pear upgrade link before enabling OTA; keep local updates opt-in so a deployed build cannot replace development source unexpectedly.

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

For new P2P features use `@unstoppable-stack/p2p/data` for shared JSON and
`/rpc` with `/service` for remote calls. Read `modules/p2p.mdc`. Reuse existing
node/store owners; raw Holepunch modules are advanced existing-store references.

The worker receives its channel and storage from Pear OTA:

```js
const pipe = Bare.IPC
const storagePath = Bare.argv[2]

pipe.on('data', onData)
pipe.write(JSON.stringify({ type: 'workerReady' }) + '\n')
```

For local AI, use the generated `.unstoppable/runtime-ai/index.js` session. Its Bare adapter owns native imports and plugin registration. The app owns prompts and IPC messages; send request IDs across the bridge, stream through the session, call `cancel(requestId)` for Stop, and await `close()` during shutdown. Keep consuming or return the iterator so cancellation can settle.

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

## Native compatibility

Use the recorded profile for host requirements and coupled native dependencies. The session owns bounded recent history and overflow recovery; preserve displayed conversation in app code. Test the native graph, actual streaming, Stop/reuse and cached offline startup together. Keep inference outside the Electron renderer and use installed types and version-matched upstream documentation for advanced SDK APIs.
