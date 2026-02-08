---
id: bare
name: Bare Runtime
category: module
requires: []
tags: [runtime, minimal, javascript]
priority: high
---

# Bare Runtime

## Overview
Bare is a small, modular JavaScript runtime for desktop and mobile with a minimal core and userland modules (prefixed `bare-`). It targets embedded and cross-device P2P apps, providing V8 bindings via libjs and async I/O via libuv.

## Version Notes
- Bare runtime version not pinned in local sources.
- Mobile tooling seen in local sources: `bare-pack` 1.5.1 and `react-native-bare-kit` 0.11.5 (qvac-health-dev).

## Installation
```bash
npm i -g bare
```

## Quick Start
```js
// hello.mjs
console.log("Hello from Bare")
```

```bash
bare hello.mjs
```

## Core Concepts
- Minimal runtime: most APIs come from modules like `bare-fs`, `bare-path`, `bare-rpc`.
- Embedding: C API (`include/bare.h`) for embedding Bare on mobile and desktop.
- Suspension: `Bare.suspend()` / `Bare.resume()` for mobile lifecycle.

## API Reference
- CLI: `bare [flags] <filename> [...args]` (`--eval`, `--print`, `--inspect`).
- JS: `Bare.suspend()`, `Bare.resume()` lifecycle hooks.
- Module system: CJS/ESM via `bare-module`.

## Integration with Other Modules
- Pear uses Bare as the runtime binary under the hood.
- P2P modules like Hyperswarm and Hypercore run on Bare via their standard Node-style APIs.
- Mobile apps use Bare with `react-native-bare-kit` and `bare-pack` bundles.

## Common Patterns
```js
import RPC from "bare-rpc"
import fs from "bare-fs"
// run P2P logic in a Bare worklet and communicate via RPC
```

```bash
# bundle Bare backend for mobile
npx bare-pack --target ios --target android --linked --out app/app.bundle.mjs backend/backend.mjs
```

## Pitfalls & Gotchas
- Bare has no built-in Node.js stdlib; install `bare-*` modules instead.
- Mobile apps require bundling with `bare-pack` and a Worklet host.

## Resources
- https://docs.pear.holepunch.to/reference/bare-overview
- https://github.com/holepunchto/bare
- https://github.com/holepunchto/bare-pack
