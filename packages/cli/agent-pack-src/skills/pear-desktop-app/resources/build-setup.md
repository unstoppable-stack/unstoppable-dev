# Build Setup — SWC + Bun for Pear Desktop Apps

Pear desktop apps use SWC to compile TypeScript/JSX to JavaScript. Bun runs the
build scripts. No Webpack, no Vite — Pear serves files from disk via
pear-bridge, not a dev server.

## Why SWC + Bun?

- **SWC**: Fast TypeScript/JSX compilation, React Refresh support in dev mode
- **Bun**: Fast package manager and script runner, battle-tested with Pear apps
- **No bundler needed**: Pear resolves ES module imports from `node_modules/`
  directly — each file compiles independently

## How the Entry Point Works

Pear desktop apps have a two-layer entry:

1. **`index.js`** (project root) — runs in Pear/Bare runtime, creates the
   desktop window using `pear-electron` + `pear-bridge`
2. **`index.html`** — loaded by the bridge inside the Electron window, loads
   the compiled React app via `<script src="./dist/src/live-reload.js">`

`index.js` is NOT compiled by SWC — it runs directly in Bare. Only files in
`src/` are compiled.

## SWC Output Directory Structure

**Important**: `bunx swc src -d dist` preserves the source directory structure:

```
src/live-reload.ts  →  dist/src/live-reload.js
src/index.tsx       →  dist/src/index.js
src/App.tsx         →  dist/src/App.js
src/styles/theme.ts →  dist/src/styles/theme.js
```

The `src/` prefix is preserved inside `dist/`. All file references (HTML script
tags, import paths) must account for this.

## File: `.swcrc` (production)

```json
{
  "jsc": {
    "parser": {
      "syntax": "typescript",
      "tsx": true
    },
    "transform": {
      "react": {
        "runtime": "automatic"
      }
    },
    "target": "es2022"
  },
  "module": {
    "type": "es6"
  }
}
```

## File: `.swcrc.dev` (development — React Refresh enabled)

```json
{
  "jsc": {
    "parser": {
      "syntax": "typescript",
      "tsx": true
    },
    "transform": {
      "react": {
        "runtime": "automatic",
        "development": true,
        "refresh": true
      }
    },
    "target": "es2022"
  },
  "module": {
    "type": "es6"
  }
}
```

## File: `tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "outDir": "dist",
    "rootDir": "src",
    "declaration": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

## Scripts Explained

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

| Script | What it does |
|---|---|
| `bun run dev` | Builds once (prod config), then watches for changes + runs Pear |
| `bun run build` | Production build (uses default `.swcrc`) |
| `bun run watch` | SWC watch mode with React Refresh (uses `.swcrc.dev`) |
| `bun run clean` | Removes `dist/` |

**Key detail:** The `dev` script builds with production `.swcrc` first to get a
clean initial build, then `watch` takes over with `.swcrc.dev` for React
Refresh during development.

**`npm:watch`** is concurrently's shorthand for running the `watch` script. It's
equivalent to `"bun run watch"` but is the idiomatic concurrently pattern.

## How Dev Mode Works

1. `bun run dev` triggers:
   - `build` — compiles all `src/` to `dist/src/` using `.swcrc` (production)
   - `concurrently` runs both:
     - `watch` — SWC recompiles on file changes using `.swcrc.dev` (React Refresh)
     - `pear run -d .` — opens the app window in dev mode

2. The `src/live-reload.ts` bootstrap initializes React Refresh when in dev mode
   and dynamically imports `./index`.

3. Pear auto-reloads when it detects file changes in the project directory.

## Import Extensions

**All `.ts`/`.tsx` imports MUST use `.js` extensions:**

```ts
// WRONG — will fail at runtime
import { App } from './App'
import { darkTheme } from './styles/theme'
import type { MenuItem } from './types.ts'

// CORRECT — .js extensions resolve to compiled output
import { App } from './App.js'
import { darkTheme } from './styles/theme.js'
import type { MenuItem } from './types.js'
```

SWC compiles per-file and preserves import specifiers exactly as written. At
runtime, the browser resolves `.js` files. Using `.ts` or bare (no extension)
imports will cause module resolution failures.

## macOS Case Sensitivity

macOS uses a case-insensitive filesystem by default. SWC compiles each file
independently, so `src/app.ts` and `src/App.tsx` would both output to
`dist/src/app.js` / `dist/src/App.js` — the same file. One overwrites the other.

**Rule:** Never have two files in the same directory that differ only by case.
Name the bootstrap file `live-reload.ts` (not `app.ts`) to avoid collision
with `App.tsx`.

## Pear Stage Configuration

For distribution, configure which files to include/exclude:

```json
{
  "pear": {
    "stage": {
      "entrypoints": [
        "/dist/src/live-reload.js",
        "/index.html",
        "/index.js"
      ],
      "prefetch": [
        "/assets",
        "/index.html"
      ],
      "ignore": [
        ".git",
        "node_modules/.package-lock.json",
        "node_modules/*/*.md",
        "node_modules/*/LICENSE",
        "node_modules/*/test",
        "src",
        "*.log",
        ".swcrc*",
        "tsconfig.json"
      ]
    }
  }
}
```

## Adding Path Aliases (Optional)

If your project grows and you want `@/` imports:

In `.swcrc` and `.swcrc.dev`, add to `jsc`:
```json
{
  "jsc": {
    "baseUrl": "./",
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

In `tsconfig.json`:
```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  }
}
```

## Gotchas

- **Don't use Vite/Webpack** — Pear serves files from disk via pear-bridge
- **SWC compiles per-file** — no bundling. ES module imports resolve at runtime
- **`react-refresh`** must be in `devDependencies` for SWC dev mode to work
- **`chokidar`** must be in `devDependencies` for SWC `--watch` to work
- **`pear-interface`** provides TypeScript types for `Pear.*` APIs
- **`dist/` must be gitignored** — it's generated output
- **`index.js` at project root is NOT compiled** — it runs in Bare, not the
  browser. Only `src/` files are compiled by SWC
- Use `-d` not `--dev` with `pear run`
- Always use `.js` extensions in imports, even in `.ts` source files
