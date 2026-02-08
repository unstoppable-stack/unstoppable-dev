---
name: file-sharing
description: Add P2P file sharing using Hyperdrive with local filesystem mirroring
allowed-tools: Read, Grep, Edit, Write, Bash(npm *), Bash(pnpm *)
---

# P2P File Sharing

## When to Use
- User wants to share files between peers
- User mentions "upload", "download", "file transfer", or "drive"
- User needs a P2P filesystem that syncs across devices

## Prerequisites
- Hyperdrive, Corestore, and Hyperswarm installed

## Steps

1. **Install dependencies**:
   ```bash
   pnpm add hyperdrive corestore hyperswarm localdrive
   ```

2. **Create drive module** in `src/files/drive.ts`:
   - Initialize Corestore + Hyperdrive
   - Set up Hyperswarm and replicate store on connection
   - Mirror local directory to/from drive

3. **Create sharing logic**:
   - Writer: mirror local folder → Hyperdrive, share key
   - Reader: join with key, mirror Hyperdrive → local folder

4. **Wire into app** with progress callbacks

## Quick Implementation

```ts
import Hyperdrive from 'hyperdrive'
import Corestore from 'corestore'
import Hyperswarm from 'hyperswarm'

const store = new Corestore('./storage')
const drive = new Hyperdrive(store)
await drive.ready()

const swarm = new Hyperswarm()
swarm.on('connection', conn => store.replicate(conn))
swarm.join(drive.discoveryKey)
```

## Key Gotchas
- Replicate `store` (not `drive`) over connections
- Use `localdrive` + `mirror-drive` for filesystem mirroring
- Writer must keep seeding for readers to receive updates
- Call `await drive.ready()` before any operations

## Deep Dive
- Full writer/reader example: read `resources/full-example.md`
- Troubleshooting: read `resources/troubleshooting.md`
