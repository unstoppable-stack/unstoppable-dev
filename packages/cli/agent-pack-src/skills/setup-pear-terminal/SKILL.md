---
name: setup-pear-terminal
description: Scaffold a Pear Terminal app — a headless P2P service with no UI.
  Use when the user wants a background daemon, CLI tool, or backend engine
  that runs on the Pear/Bare runtime with P2P distribution.
---

# Setup Pear Terminal App

## When to Use
- User wants a headless P2P service or background daemon
- User mentions "terminal app", "CLI service", "backend engine", "Pear terminal"
- User needs a process that runs without a GUI but uses P2P networking
- User wants Pear distribution (pear:// links) for a non-UI app

## Prerequisites
- `pear` CLI installed globally (`npm i -g pear`)
- Pear bin in PATH: `export PATH="$HOME/Library/Application Support/pear/bin:$PATH"`

## Architecture Overview

A Pear Terminal app is **simpler than desktop** — no renderer/worker split needed.
All code runs directly in the Bare runtime. Native modules (Hyperswarm, QVAC, etc.)
work directly without a worker bridge.

```
┌── Bare Runtime ──────────────┐
│  P2P (hyperswarm)            │
│  Storage (hyperbee/hyperdb)  │
│  AI (@qvac/sdk)              │
│  stdin/stdout for I/O        │
└──────────────────────────────┘
```

### File Structure

```
my-service/
├── index.js              # Entry point (runs in Bare)
├── package.json          # pear.type: "terminal"
├── src/
│   ├── app.ts            # Application logic
│   ├── p2p/              # P2P networking (if needed)
│   └── data/             # Storage (if needed)
└── README.md
```

## Steps

1. **Configure `package.json`**:

   ```json
   {
     "name": "my-service",
     "version": "0.1.0",
     "pear": {
       "name": "my-service",
       "type": "terminal"
     },
     "type": "module",
     "scripts": {
       "dev": "pear run -d .",
       "stage": "pear stage .",
       "seed": "pear seed .",
       "release": "pear release"
     },
     "dependencies": {}
   }
   ```

   **Key difference from desktop:**
   - `"type": "terminal"` — no renderer, no `pre`, no `routes`, no `gui`
   - No `pear-electron`, `pear-bridge`, or `pear-run` dependencies
   - No SWC build step (code runs directly in Bare)
   - No worker — your entry point IS the process

2. **Create `index.js`** — the entry point:

   ```js
   import Pear from 'pear'

   console.log('Service started')
   console.log('Public key:', Pear.config.key?.toString('hex'))

   // Your app logic here
   // e.g., start Hyperswarm, load QVAC model, etc.

   Pear.teardown(async () => {
     console.log('Shutting down...')
     // Cleanup: destroy swarm, unload model, close DB
   })
   ```

3. **Add P2P/AI/Storage** as needed — no worker bridge required:
   ```js
   import Hyperswarm from 'hyperswarm'
   import { loadModel, completion } from '@qvac/sdk'

   // These work directly — no worker needed
   const swarm = new Hyperswarm()
   ```

4. **Run the app**:
   ```bash
   pear run -d .
   ```

## vs Desktop vs Node.js CLI

| Feature | Pear Terminal | Pear Desktop | Node.js CLI |
|---------|--------------|-------------|------------|
| UI | None (stdin/stdout) | Chromium window | None (stdin/stdout) |
| Runtime | Bare | Bare (worker) + Chromium (renderer) | Node.js |
| Native modules | Direct | Worker only | Direct |
| P2P distribution | Yes (`pear://`) | Yes (`pear://`) | No (npm only) |
| Worker needed | No | Yes (for native modules) | No |
| Complexity | Low | High | Lowest |

## When to Use Pear Terminal vs Node.js CLI

- **Pear Terminal**: You want P2P distribution via `pear://` links, or your app
  will run alongside other Pear apps and share the Pear ecosystem.
- **Node.js CLI**: You just want a simple tool distributed via npm. No need for
  Pear's distribution model.

## Critical Rules
- **No UI/renderer** — this is all Bare runtime. Don't import browser APIs, DOM, React, or `pear-electron`. There is no window.
- **No worker bridge needed** — unlike Pear Desktop, native modules (Hyperswarm, QVAC, etc.) run directly in the main process. Don't create a worker.
- **`pear.type` must be `"terminal"`** — using `"desktop"` causes Pear to look for a renderer and crash. Double-check `package.json`.
- **Use `Pear.teardown()` for cleanup, not `process.on('exit')`** — the Bare runtime lifecycle is different from Node.js. `process.on('exit')` may not fire.
- **Don't use Node.js built-ins** — no `Buffer`, no `TextEncoder`, no `crypto`, no `node:*` imports. Use `b4a`, `bare-encoding`, `bare-crypto`, and `bare-*` equivalents.
- **Don't forget to install `bare-*` modules** — they are NOT built-in. Missing them produces `MODULE_NOT_FOUND`.

## Validation
1. `pear run -d .` starts without errors
2. Console output appears in the terminal (stdout works)
3. P2P connections establish (if using Hyperswarm: peers discover each other)
4. Data operations work (if using Hyperbee/HyperDB: reads and writes succeed)
5. `Pear.teardown()` callback executes on exit (cleanup message appears)
6. No `MODULE_NOT_FOUND` errors for `bare-*` dependencies

## Key Gotchas
- No `TextEncoder` in Bare — use `charCodeAt()` or `bare-encoding`
- No `Buffer` global — use `Uint8Array` or `b4a`
- No `crypto` module — install `bare-crypto`
- No `node:*` URL scheme — install `bare-*` equivalents
- Use `Pear.teardown()` for cleanup (not `process.on('exit')`)
- See `modules/bare.mdc` for the full Bare API availability cheatsheet

> **Status**: This skill is based on Pear documentation. Not yet validated
> with a battle-tested reference app. Core patterns are proven (Bare runtime
> works the same as in desktop workers), but the Pear Terminal-specific
> config and lifecycle have not been exercised in a real project.
