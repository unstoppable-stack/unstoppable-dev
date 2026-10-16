# Pear OTA desktop troubleshooting

## `pear run` is deprecated or removed

The project uses the legacy runtime. Replace `pear run`, `pear-electron`,
`pear-bridge`, `pear-run`, `pear.pre`, and the ambient `Pear` global with an
Electron host that embeds `pear-runtime`.

## `pear.pre did not respond with configuration data in time`

This is a legacy `pear-electron/pre` failure, commonly exposed by workspace
hoisting. Do not work around it with symlinked or duplicated `node_modules`.
Migrate the desktop host to `pear-runtime`; the current architecture has no
pre-script.

## Worker never becomes ready

1. Register the renderer listener before invoking `startWorker`.
2. Await `pear.ready()` before calling `pear.run()`.
3. Pass `[pear.storage]` and read it from `Bare.argv[2]`.
4. Use `Bare.IPC`, not stdout or `Pear.worker.pipe()`.
5. Buffer NDJSON across chunks.
6. Forward worker stderr to the Electron console.

## Modules fail inside the worker

Keep P2P, storage, and QVAC dependencies in the desktop package's dependencies.
The worker is Bare, so do not import Node-only built-ins. Test the installed
workspace layout as well as a standalone scaffold.

If QVAC reports missing plugins, inspect the app's recorded adapter/profile. The maintained Bare adapter registers llama.cpp before loading the model. Native engine imports and registration belong there; avoid adding a second registration path to the renderer or worker command handler.

## Window is blank

Verify the preload path, `contextIsolation: true`, the exposed API name, and
that `index.html` loads `app/index.js`. Check both Electron's main-process
output and renderer DevTools.

## App hangs on exit

Send a shutdown message, close worker resources, call `Bare.exit()`, wait for
the worker exit event with a timeout, then call `pear.close()`.
