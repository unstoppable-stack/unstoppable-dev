---
id: verified-versions
name: Verified Package Versions
category: core
priority: high
---

# Verified Package Versions

Battle-tested package versions from the Coffee Assistant UI project and the
QVAC Workbench reference app. **Always use these versions** when generating
`package.json` files — do not guess or use `latest`.

Last verified: 2026-02-08

---

## Pear Desktop (Core)

| Package | Version | Purpose |
|---------|---------|---------|
| `pear-electron` | `^1.7.0` | Desktop window runtime (creates Chromium window) |
| `pear-bridge` | `^1.2.4` | Loads `index.html` inside the Pear window |
| `pear-run` | `^1.0.7` | Spawns Bare worker processes from the renderer |
| `pear-hotmods` | `^1.0.0` | Dev only — live reload for `pear-electron` UI apps |
| `pear-interface` | `^1.0.0` | Dev only — TypeScript stubs for Pear globals |

## P2P & Data

| Package | Version | Purpose |
|---------|---------|---------|
| `hyperswarm` | `^4.16.0` | Peer discovery via DHT topics |
| `hypercore` | `^11.24.0` | Append-only log (foundation) |
| `hyperbee` | `^2.27.3` | Key-value store on Hypercore |
| `bare-rpc` | `^1.1.0` | RPC over duplex streams |

## Bare Runtime Modules

These are **npm packages** — they must be installed explicitly. Unlike Node.js,
Bare has no built-in standard library. If you `import` a `bare-*` module without
installing it, you'll get `MODULE_NOT_FOUND`.

| Package | Version | Purpose |
|---------|---------|---------|
| `bare-process` | `^4.2.2` | `process` equivalent (pid, argv, env, exit) |
| `bare-fs` | `^4.5.0` | File system operations |
| `bare-path` | `^3.0.0` | Path manipulation |
| `bare-crypto` | `^1.13.0` | Cryptographic primitives |
| `bare-encoding` | `^1.0.0` | TextEncoder / TextDecoder for Bare |
| `bare-buffer` | `^3.4.1` | Buffer implementation for Bare |
| `bare-subprocess` | `^5.1.4` | Child process spawning |
| `bare-env` | `^3.0.0` | Environment variable access |
| `bare-net` | `^2.2.0` | TCP / IPC sockets |
| `bare-console` | `^6.1.0` | Console API |
| `bare-os` | (match workbench) | OS info (platform, arch, homedir) |

## AI (QVAC)

| Package | Version | Purpose |
|---------|---------|---------|
| `@qvac/sdk` | `^0.6.0` | Local AI inference SDK |
| `zod` | `^4.0.0` | Schema validation for tool definitions |

## UI (React + styled-components)

| Package | Version | Purpose |
|---------|---------|---------|
| `react` | `^19.1.0` | UI framework |
| `react-dom` | `^19.1.0` | DOM renderer |
| `styled-components` | `^6.1.0` | CSS-in-JS styling |
| `zustand` | `^5.0.8` | State management (optional) |

## Build Tooling (devDependencies)

| Package | Version | Purpose |
|---------|---------|---------|
| `@swc/cli` | `^0.7.0` | SWC command-line compiler |
| `@swc/core` | `^1.3.0` | SWC core (TypeScript/JSX → JS) |
| `chokidar` | `^4.0.3` | File watcher — **required** for SWC `--watch` |
| `concurrently` | `^9.0.0` | Run multiple scripts in parallel |
| `react-refresh` | `^0.17.0` | React Fast Refresh for HMR |
| `typescript` | `^5.0.0` | Type checking (not used for compilation) |
| `@types/react` | `^19.1.0` | React type definitions |
| `@types/react-dom` | `^19.1.0` | React DOM type definitions |

---

## Reference: Complete package.json for a Pear Desktop App with Worker

This is the minimal `package.json` for a Pear desktop app that uses a Bare
worker for P2P and/or AI operations:

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
    "pear-electron": "^1.7.0",
    "pear-bridge": "^1.2.4",
    "pear-run": "^1.0.7",
    "react": "^19.1.0",
    "react-dom": "^19.1.0",
    "styled-components": "^6.1.0"
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

### Adding P2P (Hyperswarm + bare-rpc):

```json
"dependencies": {
  "hyperswarm": "^4.16.0",
  "bare-rpc": "^1.1.0",
  "bare-process": "^4.2.2"
}
```

### Adding Storage (Hypercore + Hyperbee):

```json
"dependencies": {
  "hypercore": "^11.24.0",
  "hyperbee": "^2.27.3"
}
```

### Adding AI (QVAC):

```json
"dependencies": {
  "@qvac/sdk": "^0.6.0",
  "zod": "^4.0.0"
}
```
