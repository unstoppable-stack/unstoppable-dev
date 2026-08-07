# Full example

The CLI generator is the canonical complete example:

```bash
us scaffold app -p pear-desktop -n my-app
cd my-app
npm install
npm run dev
```

The generated project contains the Electron main process, sandboxed preload,
renderer bridge, Bare worker, P2P network, and local KV storage. Add optional
features with `-f local-ai`, `-f node-sync`, or `-f multi-writer`.

Do not copy examples containing `pear-electron`, `pear-bridge`, `pear-run`,
`Pear.worker.pipe()`, or `pear run`; those target the removed Pear v1 runtime.
