# P2P Dev Testing — Full Setup

Complete files for same-machine P2P testing. Copy these into your project.

---

## `dht-bootstrap.js`

```javascript
import DHT from 'hyperdht'

const node = DHT.bootstrapper(40838, '127.0.0.1')
await node.ready()
console.log('Local DHT bootstrap running on 127.0.0.1:40838')
console.log('Press Ctrl+C to stop')
```

---

## `test-peer2.sh`

```bash
#!/bin/bash
# Launch a second Pear desktop instance for same-machine P2P testing.
# Uses APFS copy-on-write clones (NOT symlinks) because pear-electron
# requires exclusive access to its module paths.

set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PEER_DIR="$SCRIPT_DIR/.peer2"

echo "=== Setting up second peer instance ==="
rm -rf "$PEER_DIR"
mkdir -p "$PEER_DIR"

# Copy essential app files
for f in index.js index.html package.json; do
  [ -f "$SCRIPT_DIR/$f" ] && cp "$SCRIPT_DIR/$f" "$PEER_DIR/"
done

# Copy build output
[ -d "$SCRIPT_DIR/dist" ] && cp -R "$SCRIPT_DIR/dist" "$PEER_DIR/"

# Copy optional files
[ -d "$SCRIPT_DIR/assets" ] && cp -R "$SCRIPT_DIR/assets" "$PEER_DIR/"
[ -f "$SCRIPT_DIR/.swcrc" ] && cp "$SCRIPT_DIR/.swcrc" "$PEER_DIR/"
[ -f "$SCRIPT_DIR/.npmrc" ] && cp "$SCRIPT_DIR/.npmrc" "$PEER_DIR/"

# CRITICAL: APFS clone node_modules — NOT symlink!
# Symlinks cause pear-electron contention (ERR_INVALID_CONFIG timeout).
# cp -Rc creates copy-on-write clones on macOS APFS (nearly instant).
echo "Cloning node_modules (APFS copy-on-write)..."
cp -Rc "$SCRIPT_DIR/node_modules" "$PEER_DIR/node_modules" 2>/dev/null \
  || cp -R "$SCRIPT_DIR/node_modules" "$PEER_DIR/node_modules"

echo "=== Starting peer 2 ==="
cd "$PEER_DIR" && pear run -d .
```

---

## Worker Configuration Pattern

```typescript
// worker/index.ts — top of file

// ── Dev/Prod DHT configuration ──
// Set LOCAL_DEV=true when testing two peers on the same machine.
// The public DHT cannot route two peers on the same IP.
const LOCAL_DEV = false
const LOCAL_BOOTSTRAP = [{ host: '127.0.0.1', port: 40838 }]

function createSwarm(): Hyperswarm {
  const opts = LOCAL_DEV ? { bootstrap: LOCAL_BOOTSTRAP } : {}
  return new Hyperswarm(opts)
}
```

---

## package.json Scripts

```json
{
  "scripts": {
    "dev": "bun run build && concurrently \"npm:watch:src\" \"npm:watch:worker\" \"pear run -d .\"",
    "dev:local": "bun run build && concurrently \"npm:dht\" \"npm:watch:src\" \"npm:watch:worker\" \"pear run -d .\"",
    "dht": "node dht-bootstrap.js",
    "peer2": "bash test-peer2.sh",
    "build": "bun run clean && bunx swc src -d dist --source-maps && bunx swc worker -d dist --source-maps",
    "watch:src": "bunx swc src -d dist --source-maps --watch --config-file .swcrc.dev",
    "watch:worker": "bunx swc worker -d dist --source-maps --watch",
    "clean": "rm -rf dist",
    "stage": "bun run build && pear stage .",
    "seed": "pear seed .",
    "release": "pear release"
  }
}
```

---

## .gitignore Additions

```
.peer2/
storage/
```

---

## Hyperbee Key Design for Messages

When storing messages in Hyperbee, use zero-padded timestamps for correct lexicographic ordering:

```typescript
// Key format: messages:<channel>:<timestamp_padded>:<author>
const key = `messages:${channel}:${String(timestamp).padStart(15, '0')}:${authorKey}`
```

Range-query a channel's messages:

```typescript
const stream = db.createReadStream({
  gte: `messages:${channel}:`,
  lt: `messages:${channel}:\xff`,
})
```

This ensures messages are always returned in chronological order regardless of which peer wrote them.
