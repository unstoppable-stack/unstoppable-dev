---
name: p2p-dev-testing
description: Set up same-machine P2P testing with local DHT bootstrap, second peer scripts, and debugging tools
allowed-tools: Read, Grep, Edit, Write, Bash(npm *), Bash(pnpm *), Bash(bun *), Bash(node *)
---

# P2P Dev Testing

## When to Use
- User is testing a P2P app on a single machine (two instances)
- User says "peers don't connect", "peers can't find each other", "connection count is 0"
- User wants to run two Pear desktop instances side by side
- User mentions "same machine testing", "local testing", "localhost P2P"

## The Problem

The **public HyperDHT cannot reliably route two peers on the same machine** to each other. Both peers appear to the DHT as the same network origin (same public IP), and the DHT's hole-punching logic doesn't handle this case. This is NOT a bug — the public DHT is designed for peers on different networks.

**Symptoms:**
- `swarm.on('connection')` never fires
- `discovery.flushed()` hangs or succeeds but 0 connections
- Heartbeat logging shows `peers: 0` indefinitely

## Fix: Local DHT Bootstrap

Run a local DHT bootstrap node that routes peers on `127.0.0.1`:

### Step 1: Create `dht-bootstrap.js` in project root

```javascript
import DHT from 'hyperdht'

const node = DHT.bootstrapper(40838, '127.0.0.1')
await node.ready()
console.log('Local DHT bootstrap running on 127.0.0.1:40838')
```

### Step 2: Configure the worker to use local bootstrap in dev

```typescript
// worker/index.ts
const LOCAL_DEV = false  // Set true for same-machine testing
const LOCAL_BOOTSTRAP = [{ host: '127.0.0.1', port: 40838 }]

const swarmOpts = LOCAL_DEV ? { bootstrap: LOCAL_BOOTSTRAP } : {}
const swarm = new Hyperswarm(swarmOpts)
```

### Step 3: Add dev scripts to `package.json`

```json
{
  "scripts": {
    "dev": "bun run build && concurrently \"npm:watch:src\" \"npm:watch:worker\" \"pear run -d .\"",
    "dev:local": "bun run build && concurrently \"npm:dht\" \"npm:watch:src\" \"npm:watch:worker\" \"pear run -d .\"",
    "dht": "node dht-bootstrap.js",
    "peer2": "bash test-peer2.sh"
  }
}
```

### Step 4: Install `hyperdht` as a dev dependency

```bash
bun add -d hyperdht
```

## Running Two Pear Instances (Second Peer Script)

**CRITICAL: Never symlink `node_modules` between Pear instances.** The `pear-electron` pre-script assumes exclusive access to its module paths. Symlinks cause `ERR_INVALID_CONFIG: pear.pre did not respond with configuration data in time`.

### Create `test-peer2.sh`

```bash
#!/bin/bash
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PEER_DIR="$SCRIPT_DIR/.peer2"

echo "Setting up second peer instance..."
rm -rf "$PEER_DIR"
mkdir -p "$PEER_DIR"

# Copy app files
cp index.js index.html package.json "$PEER_DIR/"
cp -R dist "$PEER_DIR/" 2>/dev/null
[ -d assets ] && cp -R assets "$PEER_DIR/"
[ -f .swcrc ] && cp .swcrc "$PEER_DIR/"
[ -f .npmrc ] && cp .npmrc "$PEER_DIR/"

# APFS clone node_modules (macOS) — NOT symlink
# cp -Rc creates copy-on-write clones (nearly instant, fully independent)
cp -Rc "$SCRIPT_DIR/node_modules" "$PEER_DIR/node_modules" 2>/dev/null \
  || cp -R "$SCRIPT_DIR/node_modules" "$PEER_DIR/node_modules"

echo "Starting peer2..."
cd "$PEER_DIR" && pear run -d .
```

### Usage

```bash
# Terminal 1: Start first peer with local DHT
bun run dev:local

# Terminal 2: Start second peer
bun run peer2
```

With local DHT bootstrap, two peers on the same machine connect in **under 3 seconds**.

## Debugging Checklist

When peers don't connect, check in this order:

1. **Same topic?** — Log the full topic hex on both sides and compare
2. **Same workspace/room code?** — Exact string match, case-sensitive
3. **Same machine?** — You need local DHT bootstrap (see above)
4. **DHT flushed?** — Check for `discovery.flushed()` completing
5. **Swarm flushed?** — Check `await swarm.flush()` result
6. **Firewall?** — macOS may block incoming connections on first run
7. **Double join?** — Check for redundant join calls destroying the swarm (see `core-patterns.md`)
8. **Protomux open?** — Messages sent before `onopen` are silently dropped
9. **Message handler registered?** — Must be before `workerReady` (see worker-pattern)
10. **Seeding?** — Remote machines need `pear seed .` running on the source machine

## Heartbeat Logging

Always add heartbeat logging during P2P development — discovery is async and non-deterministic:

```typescript
setInterval(() => {
  console.log(`[heartbeat] peers: ${swarm.connections.size}`)
}, 15000)
```

## Important Notes

- **Local bootstrap is dev-only.** On different machines with different public IPs, the public DHT works perfectly.
- **`discovery.flushed()` !== `swarm.flush()`.** The first means "DHT announcement sent"; the second means "all pending connection attempts resolved". Use both for reliable init.
- Add `.peer2/` to `.gitignore`.

## Deep Dive
- Full test scripts and templates: read `resources/full-setup.md`
