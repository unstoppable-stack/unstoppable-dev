---
id: pear
name: Pear Runtime
category: module
requires: [bare]
tags: [runtime, desktop, terminal, p2p]
priority: high
---

# Pear Runtime

## Overview

Pear is a peer-to-peer runtime, development, and distribution platform for
desktop and terminal apps. It stages app files into a Hypercore-backed app drive
and runs them from `pear://` links; versioning and distribution happen via DHT
seeding and sparse replication.

## Version Notes

- CLI version not pinned in local sources; docs referenced from
  docs.pears.com (2026-02-08).

## Installation

```bash
npm i -g pear
# Ensure pear bin is in PATH:
export PATH="$HOME/Library/Application Support/pear/bin:$PATH"
```

## Quick Start

```bash
mkdir my-pear-app
cd my-pear-app
pear init --yes
pear run -d .
```

## App Types

Pear supports two app types — set in `package.json` under the `pear` property:

### Desktop (GUI)

A desktop app uses `index.js` with `pear-electron` + `pear-bridge` to create
the window, and `index.html` is loaded inside that window via the bridge.

```json
{
  "pear": {
    "name": "my-app",
    "type": "desktop",
    "pre": "pear-electron/pre",
    "routes": ".",
    "gui": {
      "width": 1024,
      "height": 768,
      "minWidth": 600,
      "minHeight": 400,
      "backgroundColor": "#171817"
    }
  }
}
```

**Required config fields for desktop:**
- `"name"` — MUST be lowercase, no spaces (letters, numbers, hyphens only)
- `"pre": "pear-electron/pre"` — required pre-script for desktop apps
- `"routes": "."` — tells Pear to route all paths to current directory

**Entry point:** `index.js` at project root (runs in Bare runtime):
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

**Required dependencies:**
```json
{
  "dependencies": {
    "pear-electron": "^1.7.0",
    "pear-bridge": "^1.2.4"
  }
}
```

For the full desktop app setup (React, styled-components, SWC, bun), see the
`pear-desktop-app` skill.

### Terminal (CLI)

A terminal app runs in the Pear terminal environment (Bare runtime).

```json
{
  "pear": {
    "name": "my-tool",
    "type": "terminal"
  }
}
```

- Entry point: `index.js` (JavaScript)
- No GUI — runs in the terminal
- Has access to `Pear.*` APIs for updates and configuration
- `"name"` must also be lowercase, no spaces

## Core Concepts

- **Staging**: `pear stage <channel>` snapshots files into app storage
  (Hypercore) and outputs a `pear://` link.
- **Seeding**: `pear seed <channel|link>` announces the app on the DHT so other
  peers can replicate it.
- **Releases**: `pear release <channel|link>` marks a release point so
  `pear run <link>` loads the latest released version.

## API Reference

- `pear init [flags] <link|name> [dir]`: scaffold a new Pear app from a
  template.
- `pear run [flags] <link|dir> [...app-args]`: run a local app or `pear://`
  link. Use `-d` for dev mode (NOT `--dev`).
- `pear stage <channel|link> [dir]`: stage local changes into app storage.
- `pear seed <channel|link> [dir]`: announce and serve the staged app over the
  DHT.
- `pear release <channel|link> [dir]`: mark a release pointer for a channel.
- `pear dump <link> <dir>`: sync a `pear://` app to disk.

## Desktop Build Pipeline (Bun + SWC)

Production Pear desktop apps use **bun** as the script runner and **SWC** for
TypeScript/JSX compilation. No Webpack or Vite — Pear serves files from disk
via pear-bridge.

### Recommended scripts (package.json)

```json
{
  "scripts": {
    "dev": "bun run build && concurrently \"npm:watch\" \"pear run -d .\"",
    "build": "bun run clean && bunx swc src -d dist --source-maps",
    "watch": "bunx swc src -d dist --source-maps --watch --config-file .swcrc.dev",
    "clean": "rm -rf dist"
  }
}
```

Note: `dev` builds first with production `.swcrc`, then runs `watch` (with
`.swcrc.dev` for React Refresh) + `pear run -d .` concurrently.

### Key dependencies for desktop apps

```json
{
  "dependencies": {
    "pear-electron": "^1.7.0",
    "pear-bridge": "^1.2.4"
  },
  "devDependencies": {
    "@swc/cli": "^0.7.0",
    "@swc/core": "^1.3.0",
    "chokidar": "^4.0.3",
    "concurrently": "^9.0.0",
    "pear-hotmods": "^1.0.0",
    "pear-interface": "^1.0.0"
  }
}
```

### SWC output structure

`bunx swc src -d dist` preserves the directory structure:
`src/live-reload.ts` → `dist/src/live-reload.js`. All file references must
account for the `src/` prefix inside `dist/`.

## Integration with Other Modules

- Pear apps are built on Bare, so P2P code can use Hyperswarm, Hypercore,
  Hyperbee, and Hyperdrive directly.
- QVAC integrates via a Pear terminal "engine" process and a Pear desktop UI,
  typically connected with `pear-run` and `pear-pipe`.
- Desktop apps can combine GUI (React UI) with a Bare worker process for
  heavy P2P/AI operations.

## Common Patterns

```bash
# Development
bun run dev                # Build + watch + open Pear window
pear run -d .              # Run desktop app in dev mode (standalone)
```

```bash
# Stage and seed a dev channel
pear stage dev
pear seed dev
```

```bash
# Release a production channel
pear stage production
pear release production
pear seed production
```

```bash
# Run a staged but unreleased version for preview
pear run --checkout=staged pear://<app-key>
```

## Desktop UI Pattern

The proven stack for Pear desktop UI (used by QVAC Workbench):

- **React 19** + **styled-components** for component UI
- **SWC** for fast TypeScript/JSX compilation
- **bun** for running builds and scripts
- **zustand** for state management (optional)
- Dark theme with `#171817` background, accent colors

Entry points:
```js
// index.js — Pear native entry (runs in Bare, NOT compiled by SWC)
import Runtime from 'pear-electron'
import Bridge from 'pear-bridge'
const bridge = new Bridge({ waypoint: '/index.html' })
// ...
```

```html
<!-- index.html — web entrypoint loaded by the bridge -->
<div id="bar"><pear-ctrl></pear-ctrl></div>
<div id="root"></div>
<script src="./dist/src/live-reload.js" type="module"></script>
```

Window controls bar with drag region:
```css
#bar {
  -webkit-app-region: drag;
  height: 24px;
  position: fixed;
  top: 0; left: 0; right: 0;
  z-index: 9999;
}
#root { height: 100%; padding-top: 24px; }
```

## Pitfalls & Gotchas

- **`pear run -d .`** — use `-d` flag, NOT `--dev`.
- **`pear.name` must be lowercase** — no spaces or uppercase. Causes
  `ERR_INVALID_APP_NAME`.
- **Desktop apps require `index.js`** with `pear-electron` + `pear-bridge` —
  without the bridge, `index.html` won't load.
- **`"pre": "pear-electron/pre"` and `"routes": "."`** are required in pear
  config for desktop apps — missing them causes `Cannot find module '/'`.
- **`pear-bridge` is a required dependency** — not just `pear-electron`.
- Apps are not reachable by other peers until you run `pear seed` and keep it
  running.
- `pear run` on remote peers prompts for trust; use `--no-ask` to decline
  unknown keys in automation.
- Release pointers override staged content; use `--checkout=staged` to preview
  unreleased changes.
- Set `pear.gui.backgroundColor` to match your theme to avoid flash of white.
- Use `bun` (not npm scripts) for builds — it's significantly faster.
- Don't use Vite or Webpack — Pear serves files from disk, not a dev server.
- SWC compiles per-file (no bundling); ES module imports resolve at runtime.
- **Use `.js` extensions in all imports** — SWC preserves import specifiers as-is.
- **macOS case sensitivity** — don't have files that differ only by case (e.g.,
  `app.ts` and `App.tsx`). Use `live-reload.ts` for the bootstrap file.
- **`chokidar`** must be in devDependencies for SWC `--watch` to work.

## Resources

- https://docs.pears.com/guide/starting-a-pear-desktop-project.html
- https://docs.pears.com/guide/making-a-pear-desktop-app.html
- https://docs.pears.com/guide/starting-a-pear-terminal-project.html
- https://docs.pears.com/guide/sharing-a-pear-app.html
- https://docs.pears.com/guide/releasing-a-pear-app.html
- https://docs.pears.com/reference/configuration.html
- https://docs.pears.com/reference/cli.html
