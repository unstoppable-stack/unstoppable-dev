# 03 — Bare Runtime Constraints

## What is Bare?

Bare is a **minimal JavaScript runtime** by Holepunch. It's the engine that runs Pear worker processes (and Pear Terminal apps). Unlike Node.js, it ships with almost nothing built-in — you install what you need as npm packages.

Key differences from Node.js:
- No built-in `fs`, `path`, `os`, `crypto`, `net`, etc. — install `bare-fs`, `bare-path`, `bare-os`, etc.
- No `Buffer` global — use `Uint8Array` or `b4a` package
- No Web APIs (`TextEncoder`, `URL`, `fetch`, `crypto.subtle`) — these are browser-only
- No `process` global — install `bare-process`
- Supports ES2022+ JavaScript natively
- `console.log/error/warn` available (via `bare-console`)

## Available APIs

### Standard JavaScript (Always Available)

```
Uint8Array, ArrayBuffer, DataView, Float32Array, etc.
Map, Set, WeakMap, WeakSet
Promise, async/await
setTimeout, setInterval, clearTimeout, clearInterval
JSON.parse, JSON.stringify
Math, Date, RegExp, Error
structuredClone (ES2022)
globalThis
```

### Bare Built-in Globals

```
Bare.version           // Bare runtime version
Bare.argv              // Command-line arguments
Bare.platform          // "darwin", "linux", "win32"
Bare.arch              // "x64", "arm64"
Bare.pid               // Process ID
Bare.exit(code)        // Exit the process
Bare.on("exit", fn)    // Exit event
```

### Pear Globals (Available in Pear Context)

```
Pear.config            // App configuration (from package.json pear field)
Pear.config.dev        // Boolean: running in dev mode
Pear.config.storage    // App storage directory path
Pear.worker.pipe()     // Communication pipe (workers only)
Pear.teardown(fn)      // Register cleanup handler
Pear.exit()            // Exit the Pear app
Pear.key               // App's public key (null in dev)
```

### Installable `bare-*` Modules

| Module | Purpose | Install |
|--------|---------|---------|
| `bare-process` | Process info, argv, env, exit | `npm i bare-process` |
| `bare-os` | OS info (platform, arch, hostname, homedir) | `npm i bare-os` |
| `bare-fs` | File system operations (read, write, mkdir, stat) | `npm i bare-fs` |
| `bare-path` | Path manipulation (join, resolve, dirname, basename) | `npm i bare-path` |
| `bare-crypto` | Cryptographic primitives (randomBytes, hash) | `npm i bare-crypto` |
| `bare-net` | TCP networking | `npm i bare-net` |
| `bare-tls` | TLS/SSL connections | `npm i bare-tls` |
| `bare-buffer` | Buffer compatibility (wraps Uint8Array) | `npm i bare-buffer` |
| `bare-encoding` | String encoding/decoding (utf8, hex, base64) | `npm i bare-encoding` |
| `bare-env` | Environment variables | `npm i bare-env` |
| `bare-console` | Console output (usually auto-included) | `npm i bare-console` |
| `bare-subprocess` | Spawn child processes | `npm i bare-subprocess` |
| `bare-ffmpeg` | FFmpeg bindings for audio/video | `npm i bare-ffmpeg` |

## NOT Available in Bare (Common Pitfalls)

### Browser APIs (Crash in Worker)

```javascript
// ALL OF THESE CRASH IN BARE:
new TextEncoder()         // ReferenceError: TextEncoder is not defined
new TextDecoder()         // ReferenceError: TextDecoder is not defined
new URL("https://...")    // ReferenceError: URL is not defined
fetch("https://...")      // ReferenceError: fetch is not defined
crypto.randomUUID()       // ReferenceError: crypto is not defined
btoa("hello")            // ReferenceError: btoa is not defined
atob("aGVsbG8=")         // ReferenceError: atob is not defined
new Blob([])             // ReferenceError: Blob is not defined
```

### Node.js Built-ins (Crash in Worker)

```javascript
// ALL OF THESE CRASH IN BARE:
import fs from "fs"           // MODULE_NOT_FOUND
import path from "path"       // MODULE_NOT_FOUND
import crypto from "crypto"   // MODULE_NOT_FOUND
import net from "node:net"    // MODULE_NOT_FOUND
import os from "os"           // MODULE_NOT_FOUND
import { Buffer } from "buffer"  // MODULE_NOT_FOUND (use bare-buffer)
```

### Browser APIs (Crash in Renderer When Used with Node Modules)

```javascript
// IN THE RENDERER, you CAN use TextEncoder, URL, fetch, etc.
// BUT you CANNOT import bare-* or node:* modules.
// If you transitively import one (via barrel exports), it crashes.

import { something } from "../lib/index.js"  // If index.js re-exports a P2P module → CRASH
```

## Workarounds for Common Needs

### String to Bytes (No TextEncoder)

```typescript
// WRONG — TextEncoder doesn't exist in Bare
const bytes = new TextEncoder().encode(str)

// RIGHT — pure JS
function stringToBytes(str: string): Uint8Array {
  const buf = new Uint8Array(str.length)
  for (let i = 0; i < str.length; i++) {
    buf[i] = str.charCodeAt(i) & 0xff
  }
  return buf
}

// RIGHT — using b4a (Holepunch buffer utility)
import b4a from "b4a"
const bytes = b4a.from(str, "utf-8")
```

### Hash / Random Bytes (No crypto)

```typescript
// WRONG — crypto is a Node.js built-in
import crypto from "crypto"
const hash = crypto.createHash("sha256").update(data).digest()

// RIGHT — bare-crypto
import { randomBytes, createHash } from "bare-crypto"
const hash = createHash("sha256").update(data).digest()
const random = randomBytes(32)
```

### Environment Variables

```typescript
// WRONG — process.env is a Node.js feature
const apiKey = process.env.API_KEY

// RIGHT — bare-env
import env from "bare-env"
const apiKey = env.API_KEY
```

### File System

```typescript
// WRONG — fs is a Node.js built-in
import fs from "fs"

// RIGHT — bare-fs
import fs from "bare-fs"
```

### Path Operations

```typescript
// WRONG — path is a Node.js built-in
import path from "path"

// RIGHT — bare-path
import path from "bare-path"
```

## The `b4a` Package

`b4a` (Buffer for All) is the Holepunch utility for buffer operations. It works across Node.js, Bare, and browsers:

```typescript
import b4a from "b4a"

b4a.from("hello", "utf-8")    // Create buffer from string
b4a.toString(buf, "hex")       // Buffer to hex string
b4a.alloc(32)                  // Allocate zeroed buffer
b4a.concat([buf1, buf2])       // Concatenate buffers
b4a.equals(buf1, buf2)         // Compare buffers
b4a.isBuffer(value)            // Type check
```

Use `b4a` instead of `Buffer` for cross-runtime compatibility.

## Module Resolution in Bare

Bare uses standard ESM module resolution. Some things to know:

1. **No `__dirname` / `__filename`** — Use `import.meta.url` instead
2. **No `require()`** — ESM only (`import`/`export`)
3. **File extensions required** — `import "./foo.js"` not `import "./foo"`
4. **No JSON imports by default** — Use `bare-fs` to read JSON files
5. **`node_modules` resolution works** — npm packages resolve normally

## Overrides for React Native / Mobile Packages

When building for desktop, some dependencies (from mobile-focused packages) need to be nullified:

```json
{
  "overrides": {
    "react-native-bare-kit": "npm:empty-npm-package@1.0.0",
    "expo-file-system": "npm:empty-npm-package@1.0.0",
    "expo": "npm:empty-npm-package@1.0.0",
    "react-native": "npm:empty-npm-package@1.0.0"
  }
}
```

This prevents desktop builds from pulling in mobile-only native dependencies.
