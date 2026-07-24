---
name: setup-pear-desktop
description: Pear Desktop app with worker pattern and P2P/AI capabilities.
when_to_use: User is customizing a Pear Desktop app beyond what the scaffold provides, or debugging worker/bridge issues.
paths: ["index.html", "index.js", "worker.js", "app/**"]
version: "2026-04-14"
---

# Pear Desktop App

> **Start with the scaffold:** `us scaffold app -p pear-desktop -n <name> -f <features>`
>
> The scaffold generates a working Pear Desktop project with the correct `pear` config, worker bridge,
> and feature initialization. This skill covers customization, advanced patterns, and debugging.

## What the Scaffold Handles (do NOT redo manually)

The `us scaffold app -p pear-desktop` command generates:

- `package.json` with `pear` config block (type, gui, routes, unrouted)
- `index.html` with `<pear-ctrl>`, title bar, and script loading
- `index.js` with worker bridge (JSON pipe communication)
- `worker.js` with feature-specific initialization (P2P, storage, AI)
- `app/index.js` with status display UI

**Do NOT recreate these files manually.** Scaffold first, then customize.

## When to Read This Skill

- You already scaffolded and need to **add React, styled-components, or SWC builds**
- You need the **full React + worker architecture** (the scaffold generates a simpler vanilla JS version)
- You need to **debug worker communication** or build issues
- You need to understand **distribution** (pear stage / seed / release)

## Prerequisites
- `pear` CLI installed globally (`npm i -g pear`)
- `bun` installed (https://bun.sh — used for builds and scripts)
- Pear bin in PATH: `export PATH="$HOME/Library/Application Support/pear/bin:$PATH"`

## Architecture Overview

A Pear desktop app has two processes:

1. **Renderer (browser):** React UI + styled-components. Runs in Chromium.
   CANNOT use Node.js/Bare modules (hyperswarm, bare-rpc, @qvac/sdk, etc.).
2. **Worker (Bare runtime):** P2P, storage, AI logic. Started via `pear-run`.
   Communicates with the renderer via NDJSON over `Pear.worker.pipe()`.

```
┌── Renderer (Chromium) ──┐      ┌── Worker (Bare runtime) ──┐
│  React UI                │ pipe │  P2P (hyperswarm)          │
│  styled-components       │◄───►│  Storage (hyperbee)        │
│  worker-bridge/          │NDJSON│  AI (@qvac/sdk)            │
│  pear-run                │      │  Pear.worker.pipe()        │
└──────────────────────────┘      └────────────────────────────┘
```

> **CRITICAL:** If your app only has a UI with NO P2P/storage/AI (pure
> frontend), you don't need a worker. But the moment you use hyperswarm,
> hypercore, hyperbee, bare-rpc, or @qvac/sdk — you MUST use a worker.

### File Structure

```
my-app/
├── index.js              # Pear native entry — creates window via pear-electron + pear-bridge
├── index.html            # HTML entrypoint — loaded by bridge, loads compiled React
├── package.json          # pear.type: "desktop" + pear.gui + pre + routes + unrouted
├── .swcrc                # SWC config for production builds
├── .swcrc.dev            # SWC config for dev builds (React Refresh)
├── worker/
│   └── index.ts          # Worker entry — P2P, storage, AI (runs in Bare)
├── src/
│   ├── live-reload.ts    # Bootstrap: React Refresh init + dynamic import of ./index
│   ├── index.tsx          # React root — mounts to #root
│   ├── App.tsx            # Main app component
│   ├── worker-bridge/     # NDJSON pipe communication (both sides)
│   │   ├── types.ts       # WorkerPipeHandle, WorkerClientHandle
│   │   ├── worker-pipe.ts # createWorkerPipe() — worker side
│   │   └── worker-client.ts # createWorkerClient() — UI side
│   ├── styles/
│   │   ├── theme.ts       # Dark/light theme tokens
│   │   └── GlobalStyles.ts # CSS reset + global styles
│   ├── components/        # Reusable UI components
│   └── pages/             # Page-level components
├── dist/                  # SWC output (gitignored) — mirrors src/ + worker/ structure
└── assets/                # Static assets (fonts, images)
```

**CRITICAL — macOS case-insensitive filesystem**: Do NOT have files that differ
only by case (e.g., `app.ts` and `App.tsx`). SWC will compile both to the same
output file and one will overwrite the other. Use `live-reload.ts` for the
bootstrap (not `app.ts`).

## Steps

1. **Configure `package.json`** with Pear desktop config and bun scripts:

   ```json
   {
     "name": "my-app",
     "version": "0.1.0",
     "pear": {
       "name": "my-app",
       "type": "desktop",
       "pre": "pear-electron/pre",
       "routes": ".",
       "unrouted": [
         "/dist/worker/index.js"
       ],
       "gui": {
         "width": 1024,
         "height": 768,
         "minWidth": 600,
         "minHeight": 400,
         "backgroundColor": "#171817"
       }
     },
     "type": "module",
     "scripts": {
       "dev": "bun run build && concurrently \"npm:watch:src\" \"npm:watch:worker\" \"pear run -d .\"",
       "build": "bun run clean && bunx swc src -d dist --source-maps && bunx swc worker -d dist --source-maps",
       "watch:src": "bunx swc src -d dist --source-maps --watch --config-file .swcrc.dev",
       "watch:worker": "bunx swc worker -d dist --source-maps --watch",
       "clean": "rm -rf dist"
     },
     "dependencies": {
       "react": "^19.1.0",
       "react-dom": "^19.1.0",
       "styled-components": "^6.1.0",
       "pear-electron": "^1.7.0",
       "pear-bridge": "^1.2.4",
       "pear-run": "^1.0.7"
     },
     "devDependencies": {
       "@swc/cli": "^0.7.0",
       "@swc/core": "^1.3.0",
       "@types/react": "^19.1.0",
       "@types/react-dom": "^19.1.0",
       "chokidar": "^4.0.3",
       "concurrently": "^9.0.0",
       "pear-hotmods": "^1.0.0",
       "pear-interface": "^1.0.0",
       "react-refresh": "^0.17.0",
       "typescript": "^5.0.0"
     }
   }
   ```

   **Critical pear config fields:**
   - `"name"` — MUST be lowercase, no spaces (letters, numbers, hyphens only)
   - `"pre": "pear-electron/pre"` — required pre-script for desktop apps
   - `"routes": "."` — tells Pear to route all paths to current directory
   - `"unrouted"` — **REQUIRED** when using workers. Lists worker files that
     should NOT be served as web pages. Without this, the worker JS is
     displayed as text in the renderer.

   **Critical script patterns:**
   - `"dev"` — builds BOTH src + worker, then runs two watchers + pear concurrently
   - `"build"` compiles BOTH `src` and `worker` directories to `dist/`
   - `pear run -d .` — use `-d` flag (NOT `--dev`) for dev mode
   - `"watch:src"` uses `.swcrc.dev` for React Refresh; `"watch:worker"` uses default `.swcrc`
   - Worker watch does NOT use `.swcrc.dev` (no React Refresh needed)

   **Required dependencies:**
   - `"pear-run"` — required for spawning workers from the renderer
   - `"chokidar"` — required by `@swc/cli` for `--watch` mode

   **Adding P2P modules** (add to `dependencies`):
   ```json
   "hyperswarm": "^4.16.0",
   "bare-rpc": "^1.1.0",
   "bare-process": "^4.2.2"
   ```

   **Adding storage** (add to `dependencies`):
   ```json
   "hypercore": "^11.24.0",
   "hyperbee": "^2.27.3"
   ```

   **Adding AI** (add to `dependencies`):
   ```json
   "@qvac/sdk": "^0.15.0",
   "zod": "^4.3.0"
   ```

   See `core/verified-versions.md` for the full version reference.

2. **Create `index.js`** — the Pear native entry point (project root):

   ```js
   import Runtime from 'pear-electron'
   import Bridge from 'pear-bridge'

   const bridge = new Bridge({ waypoint: '/index.html' })
   await bridge.ready()

   const runtime = new Runtime()
   const pipe = await runtime.start({ bridge })
   pipe.on('close', () => Pear.exit())

   Pear.teardown(() => pipe.destroy())
   ```

   This file is NOT compiled by SWC — it runs directly in the Pear/Bare runtime.

3. **Create `index.html`** — the web entrypoint loaded by the bridge:

   ```html
   <!doctype html>
   <html>
     <head>
       <style>
         * { margin: 0; padding: 0; box-sizing: border-box; }
         html, body { height: 100%; overflow: hidden; }
         body {
           font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
           -webkit-font-smoothing: antialiased;
           background-color: #171817;
           color: #ECF1EE;
         }
         #bar {
           -webkit-app-region: drag;
           height: 24px;
           position: fixed;
           top: 0; left: 0; right: 0;
           z-index: 9999;
         }
         #bar:has(pear-ctrl[data-platform="darwin"]) {
           height: 24px;
         }
         #root { height: 100%; padding-top: 24px; }
         pear-ctrl[data-platform="darwin"] {
           margin-top: 6px;
           margin-left: 8px;
         }
       </style>
     </head>
     <body>
       <div id="bar"><pear-ctrl></pear-ctrl></div>
       <div id="root"></div>
       <script src="./dist/src/live-reload.js" type="module"></script>
     </body>
   </html>
   ```

   **Note:** The script src is `./dist/src/live-reload.js` — SWC compiles
   `src/live-reload.ts` to `dist/src/live-reload.js` (preserves directory structure).

4. **Create `src/live-reload.ts`** — bootstrap with React Refresh:

   ```ts
   declare global {
     interface Window {
       $RefreshReg$?: (type: unknown, id: string) => void
       $RefreshSig$?: () => (type: unknown) => unknown
     }
   }

   interface RefreshRuntime {
     injectIntoGlobalHook: (window: Window) => void
     register: (type: unknown, id: string) => void
     createSignatureFunctionForTransform: () => (type: unknown) => unknown
   }

   async function initializeReactRefresh(): Promise<void> {
     try {
       // @ts-expect-error - no types for react-refresh/runtime
       const runtime = (await import('react-refresh/runtime')) as { default: RefreshRuntime }
       const RefreshRuntime = runtime.default
       RefreshRuntime.injectIntoGlobalHook(window)
       window.$RefreshReg$ = RefreshRuntime.register
       window.$RefreshSig$ = RefreshRuntime.createSignatureFunctionForTransform
     } catch (err) {
       console.error('Could not initialize React Refresh:', err)
     }
   }

   declare const Pear: any

   if (typeof Pear !== 'undefined' && Pear.config?.dev) {
     void initializeReactRefresh()
   }

   void import('./index')

   export {}
   ```

5. **Create SWC configs** — see `resources/build-setup.md`

6. **Create the React root** in `src/index.tsx` — see `resources/full-example.md`

7. **Set up theme and components** — see `resources/ui-kit.md`

8. **Run the app**:
   ```bash
   bun install
   bun run dev
   ```

## Key Gotchas

### Worker Architecture (most common source of bugs)
- **Renderer is a BROWSER** — P2P, storage, and AI modules CANNOT run in the
  renderer. They crash with `ERR_UNKNOWN_URL_SCHEME` or `MODULE_NOT_FOUND`.
  Use a worker process via `pear-run`.
- **`pear.unrouted` is REQUIRED** — without it, worker JS files are served as
  web pages. Add `/dist/worker/index.js` to the `unrouted` array.
- **`Pear.worker.pipe()` is the ONLY communication channel** — do NOT use
  `process.stdout` (goes to terminal) or `process.stdin`. The pipe is on fd 3.
- **Send `workerReady` IMMEDIATELY** — before P2P DHT or model downloads.
  The UI times out after 30s waiting. Use status messages for progress.
- **All `bare-*` modules need `npm install`** — `bare-process`, `bare-fs`, etc.
  are NOT built-in. You'll get `MODULE_NOT_FOUND` without them.
- **Build scripts must compile BOTH `src/` AND `worker/`** — the worker is a
  separate SWC compilation target.

### Pear Config
- **`index.js` is the Pear entry point** — uses `pear-electron` + `pear-bridge`
- **`pear-bridge` is a required dependency** — without it, no `index.html` loading
- **`"pre": "pear-electron/pre"` and `"routes": "."`** are required — missing causes `Cannot find module '/'`
- **`pear.name` MUST be lowercase** — `"My App"` causes `ERR_INVALID_APP_NAME`
- **`pear run -d .`** uses `-d` flag (NOT `--dev`)

### Build & Imports
- **SWC outputs to `dist/src/`** — `bunx swc src -d dist` preserves the `src/` prefix. HTML references `./dist/src/live-reload.js`
- **Use `.js` extensions in ALL imports** — SWC preserves specifiers as-is
- **macOS case sensitivity** — `app.ts` and `App.tsx` collide. Use `live-reload.ts`
- **`chokidar` must be installed** for SWC `--watch`
- **Build before watch** — dev script runs `bun run build` first, then watchers + pear

### UI
- **`<pear-ctrl>`** provides native window controls — always include
- **`-webkit-app-region: drag`** on the title bar div makes it draggable
- **No `localhost`** — Pear serves files from disk via bridge, not a dev server

### Monorepo / Workspace Gotcha
- **Pear Desktop apps must NOT be npm/pnpm workspace members** — Bare runtime
  resolves modules relative to the project directory. Hoisted dependencies cause
  `MODULE_NOT_FOUND` for every package and `pear-electron/pre` timeout.
- Exclude Pear apps from workspaces and run `npm install` inside the app directory.
- See `resources/troubleshooting.md` for detailed fix steps.

### Bare Runtime
- **No `TextEncoder`** — use `charCodeAt()` or `bare-encoding`
- **No `Buffer` global** — use `Uint8Array` or `b4a`
- **No `crypto` module** — install `bare-crypto`
- **No `node:*` URL scheme** — install `bare-*` equivalents
- See `modules/bare.md` for the full API availability cheatsheet

## Distribution (Sharing with Other Machines)

**CRITICAL:** `pear stage` alone does NOT make the app available on the network.
You must seed it.

### Workflow

1. **Stage** — build and package locally:
   ```bash
   bun run stage    # builds + runs: pear stage .
   ```
   This produces a `pear://<key>` link, but nobody can fetch it yet.

2. **Seed** — serve to the P2P network (**KEEP RUNNING** while others fetch):
   ```bash
   bun run seed     # runs: pear seed .
   ```

3. **Remote machine** — fetch and run:
   ```bash
   pear run pear://<key>
   ```
   Once the remote machine caches the app, the seeder can stop.

4. **Release** — publish a versioned release:
   ```bash
   bun run release  # runs: pear release
   ```

### Recommended Scripts

```json
{
  "stage": "bun run build && pear stage .",
  "seed": "pear seed .",
  "release": "pear release"
}
```

> Without `pear seed`, remote machines will get `ERR_INVALID_MANIFEST` — there's
> no source on the network to download from.

## Validation
1. App window opens with correct background color and title bar controls (`<pear-ctrl>`)
2. Worker starts — `workerReady` message is received by the renderer (check console)
3. RPC/pipe communication works — UI sends a message, worker responds (round-trip completes)
4. P2P discovery finds peers (if using Hyperswarm: connection count > 0 with a second peer)
5. Data persists across restarts (close app, reopen, previously stored data is still there)
6. Build completes without errors (`bun run build` — both `src/` and `worker/` compile)
7. Dev mode runs all watchers and Pear concurrently (`bun run dev` starts without crashing)

## Deep Dive
- Complete working example with theme + components: read `resources/full-example.md`
- Build setup (SWC configs): read `resources/build-setup.md`
- UI component kit reference: read `resources/ui-kit.md`
- Worker pattern & init order: read `resources/worker-pattern.md`
- Troubleshooting: read `resources/troubleshooting.md`
