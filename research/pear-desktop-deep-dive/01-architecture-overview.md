# 01 — Pear Desktop Architecture Overview

## The Two-Process Model

Every non-trivial Pear Desktop app runs as **two processes**:

```
┌─────────────────────────────────┐
│  RENDERER (Chromium / Electron) │  ← index.html + index.js
│  - React, DOM, CSS              │  ← runs via pear-electron
│  - Browser APIs only            │  ← NO node:*, NO bare-*
│  - Communicates via Pipe        │
└────────────┬────────────────────┘
             │ NDJSON over pear-run pipe
┌────────────▼────────────────────┐
│  WORKER (Bare Runtime)          │  ← worker/index.ts
│  - P2P: Hyperswarm, RPC        │  ← runs in Bare JS runtime
│  - AI: @qvac/sdk               │  ← full native module access
│  - Storage: Hyperbee, HyperDB  │  ← bare-fs, bare-process, etc.
│  - Communicates via Pipe        │
└─────────────────────────────────┘
```

This is **not optional** for apps that use P2P, AI, or native modules. The renderer is a browser — it cannot import `node:net`, `bare-process`, `hyperswarm`, or `@qvac/sdk`.

## Entry Points

A Pear Desktop app has four key files at its root:

### 1. `index.js` — Main Process Bootstrap

The main entry point that Pear loads first. It creates the Electron shell and bridges to the HTML:

```javascript
import Runtime from "pear-electron"
import Bridge from "pear-bridge"

const bridge = new Bridge({ waypoint: "/index.html" })
await bridge.ready()

const runtime = new Runtime()
const pipe = await runtime.start({ bridge })
pipe.on("close", () => Pear.exit())

Pear.teardown(() => pipe.destroy())
```

Key dependencies:
- **`pear-electron`** — Creates the Electron BrowserWindow
- **`pear-bridge`** — Local HTTP bridge so Electron can load your HTML

### 2. `index.html` — UI Shell

Standard HTML that loads your compiled frontend. Must include the `<pear-ctrl>` custom element for window controls:

```html
<body>
  <div id="bar"><pear-ctrl></pear-ctrl></div>
  <div id="root"></div>
  <script src="./dist/src/live-reload.js" type="module"></script>
</body>
```

The `-webkit-app-region: drag` CSS on the bar div enables window dragging on macOS/Windows.

### 3. `worker/index.ts` — Backend Process

Runs in the Bare runtime. Has access to:
- All `bare-*` modules (bare-fs, bare-process, bare-crypto, etc.)
- Holepunch P2P modules (hyperswarm, hypercore, hyperbee)
- QVAC SDK for AI inference
- Communication with renderer via `Pear.worker.pipe()`

### 4. `package.json` — Pear Configuration

The `pear` field in `package.json` configures the entire runtime:

```json
{
  "pear": {
    "name": "my-app",
    "type": "desktop",
    "pre": "pear-electron/pre",
    "routes": ".",
    "unrouted": [
      "/dist/worker/index.js"
    ],
    "gui": {
      "width": 1224,
      "height": 808,
      "minWidth": 800,
      "minHeight": 600,
      "backgroundColor": "#151517",
      "hideable": true,
      "closeHides": true
    },
    "stage": {
      "entrypoints": [
        "/dist/worker/index.js",
        "/index.html",
        "/index.js"
      ],
      "prefetch": [
        "/assets",
        "/index.html"
      ],
      "ignore": [
        "src",
        "worker",
        ".git",
        ".cursor",
        "node_modules/.package-lock.json",
        "node_modules/*/*.md"
      ]
    },
    "links": [
      "https://huggingface.co/*"
    ]
  }
}
```

### Critical Config Fields

| Field | Purpose | Gotcha |
|-------|---------|--------|
| `type` | `"desktop"` for GUI apps, `"terminal"` for CLI | Determines which runtime shell loads |
| `pre` | Preload script (always `"pear-electron/pre"` for desktop) | Missing = no Pear global in renderer |
| `routes` | Which files are web-routable (served to browser) | `"."` = everything. Workers MUST be excluded! |
| `unrouted` | Files excluded from web routing | **Required for workers** — see Fix 003 |
| `gui` | Window dimensions, background color, behavior | `closeHides: true` = app hides instead of quitting |
| `stage.entrypoints` | Files included in the staged app bundle | Must include all entry points (worker + HTML + JS) |
| `stage.ignore` | Files excluded from staging | Source files, dev configs, large node_modules assets |
| `links` | Allowed external URLs | CSP-like allowlist for fetch/navigation |

## Build Pipeline

The workbench uses SWC (not Webpack/Vite/esbuild) for transpilation:

```
src/         →  SWC  →  dist/src/        (renderer code)
worker/      →  SWC  →  dist/worker/     (worker code)
```

Build command:
```bash
bunx swc src -d dist --source-maps && \
bunx swc worker -d dist --source-maps
```

Dev mode (concurrent build + watch + run):
```bash
concurrently \
  "bunx swc src -d dist --source-maps --watch --config-file .swcrc.dev" \
  "bunx swc worker -d dist --source-maps --watch" \
  "pear run -d ."
```

The `-d` flag in `pear run` enables dev mode (hot reload, DevTools).

## Directory Structure (Production App)

```
my-pear-app/
├── index.html              # UI shell
├── index.js                # Main process bootstrap
├── package.json            # Pear config + dependencies
├── .swcrc                  # SWC config (prod, minified)
├── .swcrc.dev              # SWC config (dev, React Refresh)
├── src/                    # Renderer source (React)
│   ├── live-reload.ts      # React Refresh + app import
│   ├── index.ts            # App entry (createRoot, render)
│   ├── pages/              # Route-level components
│   ├── components/         # Reusable UI
│   ├── hooks/              # Custom React hooks
│   ├── store/              # Zustand stores + workerClient
│   ├── types/              # TypeScript declarations
│   └── utils/              # Helpers
├── worker/                 # Worker source (Bare runtime)
│   ├── index.ts            # Worker entry point
│   ├── WorkerManager.ts    # Pipe wrapper
│   ├── schemas/            # Zod message schemas
│   ├── handlers/           # Message handlers
│   ├── services/           # Business logic
│   ├── router/             # Message router
│   ├── types/              # Worker-specific types
│   └── utils/              # Worker utilities
├── dist/                   # Compiled output (SWC)
│   ├── src/                # Compiled renderer
│   └── worker/             # Compiled worker
└── node_modules/           # Dependencies
```
