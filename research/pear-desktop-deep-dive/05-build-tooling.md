# 05 — Build Tooling

## Why SWC (Not Vite/Webpack/esbuild)

Pear Desktop apps use **SWC** for transpilation instead of bundlers. The reasons:

1. **No bundling needed** — Pear resolves modules at runtime (like Node.js), so you don't need to bundle into a single file.
2. **React JSX/TSX** — SWC transpiles TypeScript + JSX to plain JavaScript.
3. **Speed** — SWC is written in Rust, faster than Babel/tsc.
4. **React Refresh** — SWC supports React Fast Refresh for hot reloading in dev.
5. **File-to-file compilation** — Each `.ts`/`.tsx` file becomes a `.js` file. Module resolution works at runtime.

## SWC Configuration

### Production (`.swcrc`)

```json
{
  "minify": true,
  "jsc": {
    "parser": {
      "syntax": "typescript",
      "tsx": true
    },
    "minify": {
      "mangle": true,
      "compress": {
        "unused": true
      }
    },
    "transform": {
      "react": {
        "runtime": "automatic",
        "development": false,
        "refresh": false
      }
    },
    "target": "es2022",
    "baseUrl": "./",
    "paths": {
      "@/*": ["./src/*"],
      "@/worker/*": ["./worker/*"]
    }
  },
  "module": {
    "type": "es6"
  }
}
```

### Development (`.swcrc.dev`)

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
    "target": "es2022",
    "baseUrl": "./",
    "paths": {
      "@/*": ["./src/*"],
      "@/worker/*": ["./worker/*"]
    }
  },
  "module": {
    "type": "es6"
  }
}
```

Key differences:
- Dev enables `react.refresh: true` (needed for hot reloading)
- Dev enables `react.development: true` (better error messages)
- Prod enables minification with mangling and dead code elimination

## Build Scripts

```json
{
  "scripts": {
    "build": "bunx swc src -d dist --source-maps && bunx swc worker -d dist --source-maps",
    "watch:src": "bunx swc src -d dist --source-maps --watch --config-file .swcrc.dev",
    "watch:worker": "bunx swc worker -d dist --source-maps --watch",
    "dev": "bun run build && concurrently \"npm:watch:src\" \"npm:watch:worker\" \"pear run -d .\"",
    "clean:dist": "rm -rf dist"
  }
}
```

The build compiles two separate directories:
- `src/` → `dist/src/` (renderer code)
- `worker/` → `dist/worker/` (worker code)

## Live Reload

### React Refresh Setup

The entry point (`src/live-reload.ts`) initializes React Refresh in dev mode:

```typescript
async function initializeReactRefresh() {
  const runtime = await import("react-refresh/runtime")
  const RefreshRuntime = runtime.default
  RefreshRuntime.injectIntoGlobalHook(window)
  window.$RefreshReg$ = RefreshRuntime.register
  window.$RefreshSig$ = RefreshRuntime.createSignatureFunctionForTransform
}

if (globalThis.Pear && Pear.config.dev) {
  await initializeReactRefresh()
}

// Import the actual app
await import("./index")
```

This requires:
- `react-refresh` as devDependency
- SWC configured with `refresh: true` in dev mode
- `pear-hotmods` (optional, for full file watching)

### Dev Mode Detection

```typescript
const isDev = globalThis.Pear?.config?.dev === true
```

Pear sets `config.dev = true` when running with `pear run -d .`.

## Staging and Deployment

### Staging (Preparing for Distribution)

```bash
pear stage .
```

This:
1. Reads `pear.stage.entrypoints` to know what files to include
2. Reads `pear.stage.ignore` to know what to skip
3. Copies everything else into a Hyperdrive
4. Outputs a `pear://` link

### Stage Configuration

```json
{
  "pear": {
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
        "node_modules/*/*.md",
        "node_modules/*/LICENSE",
        "node_modules/*/test"
      ]
    }
  }
}
```

Important:
- `entrypoints` lists files that Pear needs to parse for dependencies
- `prefetch` lists files to eagerly download from peers
- `ignore` reduces the app bundle size by excluding dev files

### Release

```bash
pear release pear://YOUR_APP_KEY --release 1
```

Sets a specific version as the production release.

### Seeding

After staging, the app must be seeded (kept online) for others to download:

```bash
pear seed pear://YOUR_APP_KEY
```

## TypeScript Configuration

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "noEmit": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"],
      "@/worker/*": ["./worker/*"]
    }
  },
  "include": ["src/**/*", "worker/**/*"]
}
```

Note: `noEmit: true` because SWC handles compilation, not tsc. TypeScript is only used for type checking (`tsc --noEmit`).

## Patching Dependencies

Some npm packages need patches to work in Bare runtime. The workbench uses `bun patch`:

```json
{
  "patchedDependencies": {
    "uuid@11.1.0": "patches/uuid@11.1.0.patch",
    "langsmith@0.4.7": "patches/langsmith@0.4.7.patch",
    "@langchain/textsplitters@1.0.1": "patches/@langchain%2Ftextsplitters@1.0.1.patch"
  }
}
```

Common issues that require patches:
- Packages using `crypto` instead of `bare-crypto`
- Packages using `Buffer` instead of `Uint8Array`
- Packages importing `node:*` modules
