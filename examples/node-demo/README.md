# Personal Node smoke demo

An experimental fixture for pairing, Hyperbee replication, and streamed AI.
It uses the local P2P library and a running Personal Node. This is outside the
core developer preview; mock inference does not validate a native AI model.

From the repository root, install dependencies in `packages/p2p`,
`packages/node`, `packages/node-desktop`, and `examples/node-demo` with
`npm install`. With Bare installed, run the headless harness:

```bash
npm --prefix packages/node-desktop run test:smoke
```

For manual use, start `node packages/node/src/index.js --ai-mock`, then run
`npm --prefix examples/node-demo run demo`. Demo data stays in `tmp-storage/`
inside the example directory.
