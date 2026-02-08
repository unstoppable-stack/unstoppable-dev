---
name: pear-desktop-app
description: Scaffold a Pear desktop app with React, styled-components, dark theme, and bun build pipeline
allowed-tools: Read, Grep, Edit, Write, Bash(npm *), Bash(pnpm *), Bash(bun *)
---

# Pear Desktop App

## When to Use
- User wants to build a desktop application
- User mentions "desktop app", "GUI", "window", "visual UI", "Pear desktop"
- User wants a graphical interface for their P2P/AI/data app
- User is building something that needs a window with UI elements

## Prerequisites
- `pear` CLI installed globally (`npm i -g pear`)
- `bun` installed (https://bun.sh — used for builds and scripts)
- Pear bin in PATH: `export PATH="$HOME/Library/Application Support/pear/bin:$PATH"`

## Architecture Overview

A Pear desktop app uses `index.js` + `pear-bridge` to create the window, and
`index.html` as the web entrypoint loaded via the bridge:

```
my-app/
├── index.js            # Pear native entry — creates window via pear-electron + pear-bridge
├── index.html          # HTML entrypoint — loaded by bridge, loads compiled React
├── package.json        # Must have pear.type: "desktop" + pear.gui + pre + routes
├── .swcrc              # SWC config for production builds
├── .swcrc.dev          # SWC config for dev builds (React Refresh)
├── src/
│   ├── live-reload.ts  # Bootstrap: React Refresh init + dynamic import of ./index
│   ├── index.tsx       # React root — mounts to #root
│   ├── App.tsx         # Main app component
│   ├── styles/
│   │   ├── theme.ts    # Dark/light theme tokens
│   │   └── GlobalStyles.ts  # CSS reset + global styles
│   ├── components/     # Reusable UI components
│   └── pages/          # Page-level components
├── dist/               # SWC output (gitignored) — mirrors src/ structure
└── assets/             # Static assets (fonts, images)
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
       "dev": "bun run build && concurrently \"npm:watch\" \"pear run -d .\"",
       "build": "bun run clean && bunx swc src -d dist --source-maps",
       "watch": "bunx swc src -d dist --source-maps --watch --config-file .swcrc.dev",
       "clean": "rm -rf dist"
     },
     "dependencies": {
       "react": "^19.1.0",
       "react-dom": "^19.1.0",
       "styled-components": "^6.1.0",
       "pear-electron": "^1.7.0",
       "pear-bridge": "^1.2.4"
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

   **Critical script patterns:**
   - `"dev"` — builds first with production config, THEN runs watch + pear concurrently
   - `pear run -d .` — use `-d` flag (NOT `--dev`) for dev mode
   - `"npm:watch"` — concurrently shorthand for the `watch` script
   - `"watch"` uses `.swcrc.dev` for React Refresh, `"build"` uses default `.swcrc`

   **Required devDependency:**
   - `"chokidar"` — required by `@swc/cli` for `--watch` mode

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

- **`index.js` is the Pear entry point** — it uses `pear-electron` + `pear-bridge` to create the desktop window and load `index.html` via the bridge
- **`pear-bridge` is a required dependency** — without it, the window cannot load `index.html`
- **`"pre": "pear-electron/pre"` and `"routes": "."`** are required in pear config — missing them causes `Cannot find module '/'`
- **`pear.name` MUST be lowercase** — no spaces, no uppercase. `"My App"` causes `ERR_INVALID_APP_NAME`. Use `"my-app"` instead
- **`pear run -d .`** uses the `-d` flag (NOT `--dev`) for dev mode
- **SWC outputs to `dist/src/`** — `bunx swc src -d dist` preserves the `src/` directory inside `dist/`. HTML must reference `./dist/src/live-reload.js`
- **macOS case sensitivity** — `app.ts` and `App.tsx` compile to the same output file on case-insensitive filesystems. Use `live-reload.ts` for bootstrap
- **`chokidar` must be installed** as a devDependency for SWC `--watch` to work
- **Build before watch** — the dev script runs `bun run build` first (production config), then starts watch (dev config) + pear concurrently
- **Use `.js` extensions in all imports** — SWC preserves import specifiers as-is. Write `import { Foo } from './types.js'` even in `.ts` source files, because the compiled `.js` file needs to resolve the `.js` extension at runtime
- **`<pear-ctrl>`** provides native window controls — always include it in `index.html`
- **`-webkit-app-region: drag`** on the title bar div makes it draggable
- **No `localhost`** — Pear serves files from disk via the bridge, not a dev server

## Deep Dive
- Complete working example with theme + components: read `resources/full-example.md`
- Build setup (SWC configs): read `resources/build-setup.md`
- UI component kit reference: read `resources/ui-kit.md`
- Troubleshooting: read `resources/troubleshooting.md`
