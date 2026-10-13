# Electron + Pear OTA setup

Use a standard Electron main process and embed `pear-runtime`.

```js
import { app, BrowserWindow } from 'electron'
import PearRuntime from 'pear-runtime'
import { join } from 'node:path'

const pear = new PearRuntime({
  name,
  version,
  upgrade,
  dir: join(app.getPath('userData'), 'pear'),
  app: app.isPackaged ? process.execPath : null,
  updates: app.isPackaged
})

await pear.ready()
const worker = pear.run(join(import.meta.dirname, '..', 'worker.js'), [pear.storage])
```

Create the BrowserWindow with a preload file and:

```js
webPreferences: {
  preload,
  contextIsolation: true,
  nodeIntegration: false,
  sandbox: true
}
```

Development is `electron .`. There is no `pear run`, `pear-electron/pre`,
`pear-bridge`, or renderer-side `pear-run` step.

For OTA deployment, set a real `upgrade` link, package Electron for each OS,
assemble the deployment folder with `pear build`, then use `pear stage`. Promote
production builds with `pear provision` and `pear multisig`.
