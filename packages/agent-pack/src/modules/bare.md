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

Bare is a small, modular JavaScript runtime for desktop and mobile. It provides
V8 bindings via libjs and async I/O via libuv. Unlike Node.js, Bare has a
**minimal core** — most APIs come from installable `bare-*` npm packages.

Pear uses Bare as its underlying runtime. When you run `pear run`, your code
executes in the Bare runtime. Desktop app **workers** (started via `pear-run`)
also run in Bare.

## Version Notes

- Bare runtime version not pinned in local sources.
- Mobile tooling: `bare-pack` 1.5.1, `react-native-bare-kit` 0.11.5.

## Installation

```bash
npm i -g bare
```

## Quick Start

```js
// hello.mjs
console.log('Hello from Bare')
```

```bash
bare hello.mjs
```

## Core Concepts

- **Minimal runtime**: Most APIs come from `bare-*` npm packages.
- **Embedding**: C API (`include/bare.h`) for embedding Bare on mobile/desktop.
- **Suspension**: `Bare.suspend()` / `Bare.resume()` for mobile lifecycle.
- **Module system**: CJS/ESM via `bare-module`.

---

## CRITICAL: API Availability Cheatsheet

Bare is NOT Node.js and is NOT a browser. Many APIs you take for granted are
**not available**. This is the #1 source of bugs in Pear desktop app workers.

### Available in Bare (standard JavaScript)

These work out of the box with no imports:

| API | Notes |
|-----|-------|
| `Uint8Array`, `ArrayBuffer`, `DataView` | Standard typed arrays |
| `Int8Array`, `Int16Array`, `Float32Array`, etc. | All typed arrays |
| `setTimeout`, `setInterval`, `clearTimeout`, `clearInterval` | Timers |
| `console.log`, `console.error`, `console.warn` | Via bare-console |
| `Promise`, `async/await` | Standard |
| `Map`, `Set`, `WeakMap`, `WeakSet` | Standard collections |
| `JSON.parse`, `JSON.stringify` | Standard |
| `Math`, `Date`, `RegExp` | Standard |
| `String.prototype.charCodeAt()` | Use for string→bytes |
| `Array.from`, `Object.keys`, etc. | Standard |
| `queueMicrotask` | Standard |

### NOT Available in Bare (will crash)

These exist in Node.js and/or browsers but **do NOT exist in Bare**:

| API | Error You'll See | Use Instead |
|-----|------------------|-------------|
| `TextEncoder` / `TextDecoder` | `ReferenceError: TextEncoder is not defined` | `charCodeAt()` or install `bare-encoding` |
| `Buffer` | `ReferenceError: Buffer is not defined` | `Uint8Array` or install `bare-buffer`, or use `b4a` |
| `crypto` / `webcrypto` | `Cannot find module 'crypto'` | Install `bare-crypto` |
| `URL` / `URLSearchParams` | `ReferenceError: URL is not defined` | Manual parsing or `bare-url` |
| `fetch` / `Request` / `Response` | Not available | Install `bare-fetch` |
| `process` (global) | Not a global — must import | `import process from 'bare-process'` |
| `__dirname` / `__filename` | Not available | `import.meta.url` |
| `require()` | CJS only with bare-module | Use ESM `import` |
| `node:net`, `node:os`, `node:path`, etc. | `ERR_UNKNOWN_URL_SCHEME` | Install `bare-net`, `bare-os`, `bare-path` |

### Common Bare-Compatible Alternatives

**String to bytes (topic creation):**
```typescript
// ✗ WRONG — TextEncoder crashes in Bare
const encoder = new TextEncoder()
const bytes = encoder.encode(str)

// ✓ CORRECT — works everywhere
const buf = new Uint8Array(32)
for (let i = 0; i < str.length; i++) {
  buf[i % 32] ^= str.charCodeAt(i) & 0xff
}
```

**Hashing (topic creation):**
```typescript
// ✗ WRONG — Node.js crypto doesn't exist in Bare
import crypto from 'crypto'
const hash = crypto.createHash('sha256').update(namespace).digest()

// ✓ CORRECT — use charCodeAt XOR-folding for topics
export function createTopic(namespace: string): Uint8Array {
  const buf = new Uint8Array(32)
  for (let i = 0; i < namespace.length; i++) {
    buf[i % 32] ^= namespace.charCodeAt(i) & 0xff
  }
  return buf
}
```

**Buffer operations:**
```typescript
// ✗ WRONG — Buffer is not a global in Bare
const buf = Buffer.from('hello')

// ✓ CORRECT — use b4a (works in Bare, Node.js, and browsers)
import b4a from 'b4a'
const buf = b4a.from('hello')
```

---

## bare-* Modules: Must Be Installed as npm Packages

Unlike Node.js where `process`, `fs`, `path` are built-in, in Bare they are
**separate npm packages** that must be explicitly installed:

```bash
# Install the ones you need:
bun add bare-process bare-fs bare-path bare-os
```

If you forget to install one, you'll get:
```
MODULE_NOT_FOUND: Cannot find module 'bare-process' imported from 'pear://dev/dist/worker/index.js'
```

### Dependency Checklist

When writing a Bare worker, add these to `dependencies` in `package.json`:

| If you need... | Install |
|----------------|---------|
| `process.exit()`, `process.argv`, `process.env` | `bare-process@^4.2.2` |
| File system (`readFile`, `writeFile`, `mkdir`) | `bare-fs@^4.5.0` |
| Path manipulation (`join`, `resolve`, `dirname`) | `bare-path@^3.0.0` |
| OS info (`platform`, `arch`, `homedir`) | `bare-os` |
| Crypto (`randomBytes`, hash functions) | `bare-crypto@^1.13.0` |
| TextEncoder / TextDecoder | `bare-encoding@^1.0.0` |
| Buffer class | `bare-buffer@^3.4.1` |
| TCP / IPC sockets | `bare-net@^2.2.0` |
| Child process spawning | `bare-subprocess@^5.1.4` |
| Environment variables | `bare-env@^3.0.0` |

See `core/verified-versions.md` for exact version numbers.

---

## API Reference

- CLI: `bare [flags] <filename> [...args]` (`--eval`, `--print`, `--inspect`).
- JS: `Bare.suspend()`, `Bare.resume()` lifecycle hooks.
- Module system: CJS/ESM via `bare-module`.

## Integration with Other Modules

- **Pear** uses Bare as the runtime binary under the hood.
- **Workers** in Pear desktop apps run in the Bare runtime (NOT in the browser).
- P2P modules (Hyperswarm, Hypercore, Hyperbee) work in Bare.
- QVAC SDK runs in Bare (NOT in the browser renderer).
- Mobile apps use Bare with `react-native-bare-kit` and `bare-pack`.

## Common Patterns

```js
// Import bare-* modules (must be installed via npm)
import process from 'bare-process'
import fs from 'bare-fs'
import path from 'bare-path'

// Run P2P logic in a Bare worker
import Hyperswarm from 'hyperswarm'
const swarm = new Hyperswarm()
```

```bash
# Bundle Bare backend for mobile
npx bare-pack --target ios --target android --linked --out app/app.bundle.mjs backend/backend.mjs
```

## Pitfalls & Gotchas

- **No built-in Node.js stdlib** — install `bare-*` modules instead.
- **No `TextEncoder`** — use `charCodeAt()` or install `bare-encoding`.
- **No `Buffer` global** — use `Uint8Array` or `b4a`.
- **No `crypto` module** — install `bare-crypto`.
- **No `process` global** — `import process from 'bare-process'` (and install it).
- **No `node:*` URL scheme** — these are Node.js-only and will fail with `ERR_UNKNOWN_URL_SCHEME`.
- Mobile apps require bundling with `bare-pack` and a Worklet host.
- **All `bare-*` modules are npm packages** — they MUST be in your `package.json`.

## Resources

- https://docs.pears.com/reference/bare-overview.html
- https://github.com/holepunchto/bare
- https://github.com/holepunchto/bare-pack
