# Unstoppable Node — Technical Architecture

## Three Services in One App

The Node runs three independent services in its worker process, each using
a different Hyperswarm topic:

```
┌── Node Worker (Bare runtime) ──────────────────────────────┐
│                                                              │
│  ┌─────────────────┐  ┌────────────────┐  ┌──────────────┐  │
│  │  Data Sync       │  │  File Sync      │  │  AI Provider  │  │
│  │  Service         │  │  Service        │  │  Service      │  │
│  │                  │  │                 │  │               │  │
│  │  Hyperbee ✓      │  │  Hyperdrive ✓   │  │  QVAC ✓       │  │
│  │  HyperDB ✓       │  │  Localdrive     │  │  Provider     │  │
│  │  Hypercore ✓     │  │  Mirroring      │  │  Delegation   │  │
│  │                  │  │                 │  │               │  │
│  │  Topic:          │  │  Topic:         │  │  Topic:       │  │
│  │  node:data:v1   │  │  node:files:v1 │  │  node:ai:v1  │  │
│  └─────────────────┘  └────────────────┘  └──────────────┘  │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐    │
│  │  Registry (Hyperbee)                                  │    │
│  │  Tracks all registered apps, core keys, drive keys    │    │
│  └──────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────┘
```

---

## Service 1: Data Sync (Hyperbee / HyperDB / Hypercore)

### How it works

Apps register their Hypercores with the Node. The Node replicates them
using Corestore and keeps them announced on the DHT.

```
Phone App (consumer)                  Node (desktop)
┌────────────────────┐                ┌──────────────────────┐
│                    │  Hyperswarm    │                      │
│  Hyperbee          │◄─────────────►│  Corestore           │
│  (orders, 47 keys) │  replication   │  └── app-1/          │
│                    │                │      └── orders core  │
│                    │                │          (47 keys)    │
└────────────────────┘                └──────────────────────┘
```

**Registration flow:**

```typescript
// App side: register cores with the Node
// This happens in the app's worker over the discovery topic

const discoveryTopic = createTopic('unstoppable:node:data:v1')
const swarm = new Hyperswarm()
swarm.join(discoveryTopic)

swarm.on('connection', (socket) => {
  // Send registration
  socket.write(JSON.stringify({
    type: 'register',
    appId: 'coffee-assistant',
    appName: 'Coffee Assistant',
    cores: [
      {
        key: myBee.core.key.toString('hex'),
        type: 'hyperbee',
        name: 'orders',
        encoding: { key: 'utf-8', value: 'json' }
      }
    ]
  }) + '\n')

  // The Node now knows the core key and will replicate it
})
```

**Node side:**

```typescript
// Node worker: replicate registered cores

import Corestore from 'corestore'
import Hyperswarm from 'hyperswarm'

const store = new Corestore('./node-storage')
const swarm = new Hyperswarm()

// Listen for app registrations on the data topic
const dataTopic = createTopic('unstoppable:node:data:v1')
swarm.join(dataTopic)

swarm.on('connection', (socket) => {
  // Parse registration messages
  socket.on('data', (data) => {
    const msg = JSON.parse(data.toString())
    if (msg.type === 'register') {
      for (const core of msg.cores) {
        // Get (or create) a local replica of this core
        const replica = store.get({ key: Buffer.from(core.key, 'hex') })
        await replica.ready()

        // Start replicating with the app
        store.replicate(socket)

        // Also announce this core on its own topic for seeding
        const coreTopic = replica.discoveryKey
        swarm.join(coreTopic)

        // Save to registry
        await registry.put(`apps/${msg.appId}/cores/${core.name}`, {
          key: core.key,
          type: core.type,
          name: core.name,
          registeredAt: Date.now()
        })
      }
    }
  })
})
```

**For HyperDB (multi-writer):**

HyperDB manages its own set of Hypercores internally. The app registers
the HyperDB's discovery key, and the Node replicates all underlying cores:

```typescript
// App registers HyperDB
{
  type: 'register',
  cores: [{
    key: myDB.discoveryKey.toString('hex'),
    type: 'hyperdb',
    name: 'shared-notes'
  }]
}

// Node: HyperDB handles multi-core replication internally
// Just pass the stream to db.replicate()
const db = new HyperDB(store, { key: Buffer.from(coreKey, 'hex') })
db.replicate(socket)
```

---

## Service 2: File Sync (Hyperdrive)

### How it works

Apps register their Hyperdrives. The Node replicates the drive and
optionally mirrors files to a local directory for browsing/backup.

```
App (Pear Desktop)                    Node
┌────────────────────┐                ┌──────────────────────┐
│                    │  Hyperswarm    │                      │
│  Hyperdrive        │◄─────────────►│  Hyperdrive (replica) │
│  /photos/          │  replication   │  /photos/            │
│  /docs/            │                │  /docs/              │
│  256 MB            │                │  256 MB              │
└────────────────────┘                │                      │
                                      │  Localdrive (mirror)  │
                                      │  ~/.node/files/      │
                                      │  └── app-1/photos/   │
                                      │  └── app-1/docs/     │
                                      └──────────────────────┘
```

**Node side:**

```typescript
import Hyperdrive from 'hyperdrive'
import Localdrive from 'localdrive'
import { Mirror } from 'mirror-drive'

// Replicate the app's drive
const drive = new Hyperdrive(store, Buffer.from(driveKey, 'hex'))
await drive.ready()

// Mirror to local filesystem for browsing
const local = new Localdrive(`./node-storage/files/${appId}`)
const mirror = new Mirror(drive, local)
await mirror.done()

// Watch for changes and re-mirror
drive.watch('/', () => {
  const m = new Mirror(drive, local)
  m.done()
})
```

**Selective sync:**

For large drives, users can choose what to sync:

```json
{
  "appId": "photo-app",
  "driveSync": {
    "mode": "selective",
    "include": ["/thumbnails/**", "/*.json"],
    "exclude": ["/originals/**"]
  }
}
```

---

## Service 3: AI Provider (QVAC Delegated Inference)

### How it works

This is the most exciting part. QVAC already has **built-in delegated
inference** using Hyperswarm. The Node just needs to run `startQVACProvider()`
and apps can delegate to it with `loadModel({ delegate: {...} })`.

```
Phone App                              Node (Desktop)
┌────────────────────────┐             ┌───────────────────────────┐
│                        │             │                           │
│  loadModel({           │  P2P        │  startQVACProvider({      │
│    delegate: {         │◄───────────►│    topic: 'node:ai:v1'   │
│      topic,            │  Hyperswarm │  })                       │
│      providerPublicKey │             │                           │
│    }                   │             │  Loaded models:           │
│  })                    │             │  • QWEN_3_1_7B (7B) ✓    │
│                        │             │  • LLAMA_3_2_3B (3B) ✓   │
│  completion({          │  streaming  │                           │
│    modelId,            │────────────►│  Runs inference locally   │
│    history: [...]      │             │  Streams tokens back      │
│    stream: true        │◄────────────│                           │
│  })                    │  tokens     │  GPU: RTX 4090            │
│                        │             │  RAM: 32 GB               │
└────────────────────────┘             └───────────────────────────┘
```

**The magic:** From the app's perspective, the API is identical. The same
`completion()` call works whether running locally or delegated. The only
difference is the `delegate` option in `loadModel()`.

### Node side (provider):

```typescript
import { startQVACProvider, loadModel } from '@qvac/sdk'

// Start the QVAC provider on a known topic
const AI_TOPIC = createTopic('unstoppable:node:ai:v1')
const topicHex = Buffer.from(AI_TOPIC).toString('hex')

const provider = await startQVACProvider({
  topic: topicHex,
  firewall: {
    mode: 'allow',
    publicKeys: registeredAppKeys  // Only allow registered apps
  }
})

// Pre-load powerful models (desktop has more RAM/GPU)
await loadModel({
  modelSrc: QWEN_3_1_7B_INST_Q4,
  modelType: 'llm',
  modelConfig: { contextSize: 8192, tools: true }
})

console.log('AI Provider ready')
console.log('Public key:', provider.publicKey)
console.log('Topic:', topicHex)

// That's it — QVAC handles incoming inference requests automatically
```

### App side (consumer — e.g., phone app):

```typescript
import { loadModel, completion } from '@qvac/sdk'

// Connect to the Node's AI provider
const modelId = await loadModel({
  modelSrc: QWEN_3_1_7B_INST_Q4,   // Request a 7B model
  modelType: 'llm',
  delegate: {
    topic: nodeTopicHex,
    providerPublicKey: nodePublicKey,
    timeout: 10_000,
    fallbackToLocal: true  // If Node is offline, use local 3B model
  }
})

// Use it exactly like a local model — same API
const result = completion({
  modelId,
  history: [{ role: 'user', content: 'Analyze this receipt...' }],
  stream: true
})

for await (const token of result.tokenStream) {
  process.stdout.write(token)
}
```

### Key capabilities:

| Feature | How |
|---------|-----|
| **More powerful models** | Desktop loads 7B/13B, phone delegates instead of running 1B/3B |
| **Fallback to local** | `fallbackToLocal: true` — if Node offline, use on-device model |
| **Firewall** | Only registered apps can use the provider |
| **Streaming** | Tokens stream back in real-time over P2P |
| **Tool calling** | Works transparently — tools defined on consumer, inference on provider |
| **Multiple models** | Node can load several models, consumers pick which one |

### The path from Node to Cloud:

```
TODAY                          TOMORROW
┌──────────────┐               ┌──────────────┐
│ Node        │               │ Cloud         │
│ (your PC)    │               │ (Tether)      │
│              │               │               │
│ 7B model     │               │ 70B+ model    │
│ 32 GB RAM    │               │ H100 GPU      │
│ Your network │               │ Always on     │
│ Free         │               │ Subscription  │
└──────────────┘               └──────────────┘
       │                              │
       │  Same protocol:              │
       │  delegate: {                 │
       │    topic,                    │
       │    providerPublicKey         │
       │  }                           │
       │                              │
       └──────────┬───────────────────┘
                  │
          App doesn't need to change.
          Just point to a different topic + key.
```

---

## Discovery Protocol (all three services)

Apps discover the Node (and the Node discovers apps) over a single
Hyperswarm topic. Then services are negotiated:

```
App                                    Node
 │                                      │
 │──── connect on node:discover:v1 ───►│
 │                                      │
 │◄─── { type: 'nodeHello',      ─────│
 │       services: {                    │
 │         data: true,                  │
 │         files: true,                 │
 │         ai: {                        │
 │           publicKey: '...',          │
 │           topic: '...',              │
 │           models: ['QWEN_7B',...]    │
 │         }                            │
 │       }                              │
 │     }                                │
 │                                      │
 │──── { type: 'register',        ─────►│
 │       appId: 'my-app',              │
 │       services: ['data', 'ai'],     │
 │       cores: [...],                 │
 │       drives: [...]                 │
 │     }                                │
 │                                      │
 │◄─── { type: 'registered',      ─────│
 │       replicating: [...],           │
 │       aiConfig: {                   │
 │         providerPublicKey: '...',   │
 │         topic: '...'               │
 │       }                             │
 │     }                                │
 │                                      │
 │  App now knows:                      │
 │  - Node is replicating its data    │
 │  - Node's AI provider topic + key  │
 │  - Can call loadModel({delegate})   │
 │                                      │
```

The app gets back the `providerPublicKey` and `topic` it needs to call
`loadModel({ delegate: { topic, providerPublicKey } })`. No manual
configuration needed.

---

## SDK: `@unstoppable/node-client`

A small library that app builders add to their worker:

```typescript
import { connectToNode } from '@unstoppable/node-client'

// One call — registers data, files, and gets AI provider config
const node = await connectToNode({
  appId: 'my-app',
  appName: 'My App',
  cores: [
    { core: myBee.core, type: 'hyperbee', name: 'data' }
  ],
  drives: [
    { drive: myDrive, name: 'files' }
  ],
  ai: true  // Request AI delegation capability
})

// node.ai is ready to use
if (node.ai) {
  const modelId = await loadModel({
    modelSrc: QWEN_3_1_7B_INST_Q4,
    modelType: 'llm',
    delegate: node.ai  // { topic, providerPublicKey }
  })
}

// Node is now replicating cores and drives in the background
node.on('syncStatus', (status) => {
  console.log(`Synced: ${status.coreName} (${status.length} entries)`)
})
```

---

## Dashboard Messages (Worker → UI)

```typescript
// Worker sends these to the React UI via NDJSON pipe

// App list
{ type: 'apps', apps: [
  { id: 'coffee', name: 'Coffee Assistant', status: 'online', storage: 124000, cores: 2, lastSync: 1707000000 },
  { id: 'notes', name: 'Notes', status: 'offline', storage: 856000, cores: 1, lastSync: 1706990000 }
]}

// Sync progress
{ type: 'syncProgress', appId: 'coffee', coreName: 'orders', synced: 47, total: 47 }

// AI provider status
{ type: 'aiStatus', running: true, models: ['QWEN_3_1_7B_INST_Q4'], activeInferences: 1, totalInferences: 234 }

// Storage stats
{ type: 'storageStats', total: 2100000000, perApp: { coffee: 124000000, notes: 856000000 } }

// Peer connections
{ type: 'peers', total: 5, perApp: { coffee: 2, notes: 3 } }
```

---

## What This Validates

| Module | Usage | Current Status |
|--------|-------|---------------|
| **Corestore** | One store per app, namespace isolation, multi-core replication | Docs only → battle-tested |
| **Hyperdrive** | Replicate drives, mirror to local, selective sync | Docs only → battle-tested |
| **Hypercore** | Direct replication (not just via Hyperbee) | Partial → battle-tested |
| **QVAC Delegated Inference** | startQVACProvider + loadModel delegate | Docs only → battle-tested |
| **HyperDB** | Multi-writer replication through Node | Docs only → battle-tested |
| **Cross-app discovery** | Hyperswarm topic for app registration | Not covered → battle-tested |
| **Localdrive + Mirror** | File mirroring for backup/browsing | Not covered → battle-tested |

**This single app could move 7 items from "not validated" to "battle-tested."**
