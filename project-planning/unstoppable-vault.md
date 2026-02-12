# Unstoppable Vault — Planning

## Concept

A Pear Desktop app that acts as a **personal sync hub** for any app built with
the Unstoppable Stack. It replicates, backs up, and keeps seeding your data —
so your apps' data is always available, even when the original app is closed.

Think of it as a **personal server that runs on your desktop** — the local
precursor to the Unstoppable Cloud.

```
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│ Coffee App   │  │ Notes App    │  │ Finance App  │
│ (Pear)       │  │ (Pear)       │  │ (Pear)       │
└──────┬───────┘  └──────┬───────┘  └──────┬───────┘
       │                 │                 │
       │  Hyperswarm     │  Hyperswarm     │  Hyperswarm
       │  replication    │  replication    │  replication
       │                 │                 │
       └────────┬────────┴────────┬────────┘
                │                 │
         ┌──────▼─────────────────▼──────┐
         │                               │
         │      Unstoppable Vault        │
         │                               │
         │  • Replicates all your apps   │
         │  • Seeds data 24/7            │
         │  • Dashboard of all apps      │
         │  • Storage management         │
         │  • Export / import            │
         │                               │
         └───────────────────────────────┘
```

**Later, this same role moves to the cloud:**

```
         ┌───────────────────────────────┐
         │                               │
         │      Unstoppable Cloud        │
         │      (Tether-hosted)          │
         │                               │
         │  • Same replication protocol  │
         │  • Always-on seeding          │
         │  • Powerful AI inference      │
         │  • Subscription-based         │
         │                               │
         └───────────────────────────────┘
```

The protocol is the same. The Vault is just a local instance. The Cloud is a
hosted instance. Apps don't need to know the difference.

---

## Why This App

1. **Validates key unproven modules:** Corestore (multi-core), Hyperdrive
   (files), multi-app replication, seeding
2. **Immediate user value:** Your data survives even if an app crashes or
   your laptop closes
3. **Stepping stone to cloud:** Same replication protocol, just hosted
4. **Cross-app discovery:** How do apps register themselves? How does the
   Vault find their data?
5. **Storage management:** How much to store, when to prune, quotas

---

## Core Features

### 1. App Discovery & Registration

When an Unstoppable Stack app starts, it announces itself on a well-known
Hyperswarm topic (e.g., `unstoppable:vault:discovery:v1`). The Vault listens
on this topic and discovers local apps.

**Registration message (app → vault):**
```json
{
  "type": "register",
  "appId": "coffee-assistant-ui",
  "appName": "Coffee Assistant",
  "version": "0.1.0",
  "cores": [
    { "key": "<hex>", "type": "hyperbee", "name": "orders" },
    { "key": "<hex>", "type": "hypercore", "name": "chat-history" }
  ],
  "drives": [
    { "key": "<hex>", "name": "attachments" }
  ]
}
```

The Vault stores this registration and starts replicating the listed cores
and drives.

**How apps opt in:**
- The Unstoppable Stack CLI could scaffold a `vault-sync.ts` module that
  handles registration automatically
- Or it's a library: `import { registerWithVault } from '@unstoppable/vault-client'`

### 2. Data Replication

The Vault replicates Hypercores, Hyperbees, and Hyperdrives from registered
apps. It acts as a **read-only mirror** — it doesn't write to the app's data,
just keeps a copy.

**Replication modes:**
- **Continuous** — Always syncing (default for active apps)
- **On-demand** — Sync only when user requests (for large drives)
- **Scheduled** — Sync at intervals (for background data)

**Storage structure:**
```
~/.unstoppable-vault/
├── apps/
│   ├── coffee-assistant-ui/
│   │   ├── cores/          # Replicated Hypercores/Hyperbees
│   │   └── drives/         # Replicated Hyperdrives
│   ├── notes-app/
│   │   ├── cores/
│   │   └── drives/
│   └── ...
├── registry.json           # Known apps and their core keys
└── config.json             # User preferences, quotas
```

### 3. Seeding (Always Available)

When the Vault is running, it seeds all replicated data back to the network.
This means:
- If App A is offline, other peers can still get App A's data from the Vault
- Your data is available 24/7 as long as the Vault is running
- The Vault acts as a **super-peer** for all your apps

### 4. Dashboard UI

```
┌─────────────────────────────────────────────────────┐
│  Unstoppable Vault                           ─ □ ✕  │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Connected Apps (3)                    Storage: 2.1GB│
│                                                     │
│  ┌───────────────────────────────────────────────┐  │
│  │ ☕ Coffee Assistant          Online   124 MB  │  │
│  │    Orders: 47  │  Chat history: 1,203 msgs   │  │
│  │    Last sync: 2 min ago                       │  │
│  │    [Pause] [Export] [Remove]                   │  │
│  └───────────────────────────────────────────────┘  │
│                                                     │
│  ┌───────────────────────────────────────────────┐  │
│  │ 📝 Collaborative Notes       Online   856 MB  │  │
│  │    Notes: 23  │  Shared with: 2 peers         │  │
│  │    Last sync: just now                        │  │
│  │    [Pause] [Export] [Remove]                   │  │
│  └───────────────────────────────────────────────┘  │
│                                                     │
│  ┌───────────────────────────────────────────────┐  │
│  │ 💰 Finance Tracker           Offline  312 MB  │  │
│  │    Transactions: 891  │  Seeding to 0 peers   │  │
│  │    Last sync: 3 hours ago                     │  │
│  │    [Pause] [Export] [Remove]                   │  │
│  └───────────────────────────────────────────────┘  │
│                                                     │
│  ──────────────────────────────────────────────     │
│  Seeding: 3 apps  │  Peers connected: 5            │
│  Upload: 12 KB/s  │  Download: 0 KB/s              │
│                                                     │
│  [+ Add App Manually]  [Settings]  [Export All]     │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### 5. Export / Import

- **Export:** Package an app's data into a portable archive (zip of Hypercores).
  Useful for migration, sharing, or manual backup.
- **Import:** Restore from an export, or manually add a core key to start
  replicating a remote app's data.

### 6. Storage Management

- **Per-app quotas** — Limit how much each app can use
- **Total quota** — Limit total Vault storage
- **Auto-prune** — Remove oldest data when quota exceeded (for Hypercores)
- **Selective sync** — For Hyperdrives, only sync certain file types/folders
- **Storage stats** — Per-app breakdown of storage usage

---

## Architecture

```
┌── Renderer (React UI) ──────────────┐
│                                      │
│  Dashboard                           │
│  ├── App list (status, size, sync)   │
│  ├── Per-app detail view             │
│  ├── Settings (quotas, prefs)        │
│  └── Export/Import UI                │
│                                      │
│  worker-bridge/ (NDJSON pipe)        │
│                                      │
└──────────────┬───────────────────────┘
               │
┌──────────────▼───────────────────────┐
│  Worker (Bare runtime)               │
│                                      │
│  ├── Discovery service               │
│  │   └── Listens on vault topic      │
│  │   └── Handles app registration    │
│  │                                   │
│  ├── Replication engine              │
│  │   └── Corestore per app           │
│  │   └── Hyperswarm per core/drive   │
│  │   └── Continuous sync             │
│  │                                   │
│  ├── Seeding service                 │
│  │   └── Keeps all cores announced   │
│  │   └── Responds to replication     │
│  │                                   │
│  ├── Storage manager                 │
│  │   └── Quotas, stats, pruning      │
│  │                                   │
│  └── Registry (Hyperbee)             │
│      └── Known apps + core keys      │
│      └── Sync history                │
│                                      │
└──────────────────────────────────────┘
```

---

## Stack Modules Exercised

| Module | How It's Used | Status in Agent Pack |
|--------|-------------|---------------------|
| **Pear Desktop** | Main app (renderer + worker) | Battle-tested |
| **Corestore** | One store per app, namespace isolation | Docs only → validates |
| **Hyperswarm** | Discovery topic + per-core replication | Battle-tested |
| **Hypercore** | Direct replication of app cores | Docs only → validates |
| **Hyperbee** | Registry storage + app KV data | Battle-tested |
| **Hyperdrive** | Replicate app file storage | Docs only → validates |
| **Worker bridge** | UI ↔ replication engine | Battle-tested |

**This single app validates 3 of the biggest gaps:** Corestore, Hyperdrive, and standalone Hypercore replication.

---

## Protocol: Vault Discovery

A simple protocol that any Unstoppable Stack app can implement to be
discoverable by the Vault.

### Discovery Topic

All apps and Vaults join:
```typescript
const VAULT_TOPIC = createTopic('unstoppable:vault:discovery:v1')
```

### Messages (NDJSON over Hyperswarm connection)

**App → Vault: Register**
```json
{
  "type": "register",
  "appId": "coffee-assistant-ui",
  "appName": "Coffee Assistant",
  "version": "0.1.0",
  "capabilities": ["hyperbee", "hypercore"],
  "cores": [
    {
      "key": "abc123...",
      "type": "hyperbee",
      "name": "orders",
      "encoding": { "key": "utf-8", "value": "json" }
    }
  ],
  "drives": []
}
```

**Vault → App: Ack**
```json
{
  "type": "registered",
  "vaultId": "def456...",
  "replicating": ["abc123..."]
}
```

**Vault → App: Status**
```json
{
  "type": "syncStatus",
  "coreKey": "abc123...",
  "length": 1203,
  "byteLength": 124000,
  "peers": 2
}
```

**App → Vault: Heartbeat** (periodic)
```json
{
  "type": "heartbeat",
  "appId": "coffee-assistant-ui",
  "uptime": 3600
}
```

### SDK for App Builders

```typescript
// In any Unstoppable Stack app's worker:
import { registerWithVault } from '@unstoppable/vault-client'

const vault = await registerWithVault({
  appId: 'my-app',
  appName: 'My App',
  cores: [
    { key: myBee.core.key, type: 'hyperbee', name: 'data' }
  ]
})

// That's it. The Vault will start replicating.

vault.on('synced', (core) => {
  console.log(`Vault synced: ${core.name}`)
})
```

---

## Ideas for Extra Features

### Data Browser

The Vault could let you browse the data of any synced app:
- View Hyperbee key/value pairs
- Browse Hyperdrive files
- View Hypercore log entries
- Search across all apps

This is powerful for debugging and understanding what your apps store.

### Sync Between Devices

Run the Vault on multiple devices. They sync with each other:
```
Laptop Vault ←──── P2P ────→ Desktop Vault
     ↕                            ↕
  App A, App B               App A, App C
```

Both Vaults have all data from all apps on both devices.

### Notifications

- "Coffee Assistant hasn't synced in 24 hours"
- "Notes App storage is at 90% of quota"
- "New peer discovered for Finance Tracker"

### App Health Monitoring

Track uptime, sync frequency, error rates per app. Surface issues before
the user notices.

### Selective Restore

If an app loses its data (corrupted storage, reinstall), the Vault can
restore it:

```
Vault has: orders (Hyperbee, 47 entries)
App reports: orders (Hyperbee, 0 entries — fresh install)
Vault: "Restore from backup? [Yes] [No]"
```

This happens automatically via Hypercore replication — the app just needs
to use the same core key, and the Vault's copy will replicate back.

---

## Development Phases

### Phase 1: Basic Replication
- [ ] Pear Desktop app (renderer + worker)
- [ ] Vault discovery topic
- [ ] Manual app registration (paste core keys)
- [ ] Corestore-based replication engine
- [ ] Basic dashboard (app list, sync status)
- [ ] Hyperbee registry for known apps

### Phase 2: Auto-Discovery
- [ ] Vault discovery protocol over Hyperswarm
- [ ] Automatic app registration
- [ ] SDK/library for app builders (`@unstoppable/vault-client`)
- [ ] Heartbeat / online status
- [ ] Hyperdrive replication

### Phase 3: Management
- [ ] Storage quotas and stats
- [ ] Export / import
- [ ] Per-app detail view with data browser
- [ ] Selective sync for Hyperdrives
- [ ] Notifications

### Phase 4: Multi-Device
- [ ] Vault-to-Vault sync
- [ ] Device linking
- [ ] Conflict resolution (if any)

### Phase 5: Transition to Cloud
- [ ] Same protocol, hosted by Tether
- [ ] Subscription-based access
- [ ] Delegated QVAC inference
- [ ] Always-on seeding

---

## Name Ideas

| Name | Vibe |
|------|------|
| **Unstoppable Vault** | Secure, permanent, your data fortress |
| **Unstoppable Hub** | Central point, connects everything |
| **Unstoppable Sync** | What it does |
| **Unstoppable Keep** | Medieval — your data is protected |
| **Pear Vault** | Ties to Pear ecosystem |
| **The Bunker** | Underground, resilient, unstoppable |
| **Hyperbase** | Home base for all your Hypercores |

---

## Estimated Effort

- **Phase 1:** 1-2 weeks (basic replication + dashboard)
- **Phase 2:** 1-2 weeks (auto-discovery + SDK)
- **Phase 3:** 1 week (management features)
- **Phase 4:** 1-2 weeks (multi-device)
- **Phase 5:** Separate project (cloud infrastructure)

Phase 1-2 is the MVP. That alone validates Corestore, Hyperdrive, and
standalone Hypercore replication — three of the biggest agent pack gaps.
