---
name: add-file-storage
description: P2P file storage and sharing using Hyperdrive.
when_to_use: User wants to store, share, or sync files between peers using a P2P filesystem with local mirroring.
paths: ["src/files/**", "src/storage/**"]
version: "2026-04-14"
---

# Add File Storage (Hyperdrive)

## When to Use
- User wants to store or share files between peers
- User mentions "files", "upload", "download", "drive", "mirror", "file sync"
- User needs a P2P filesystem that syncs across devices

## Prerequisites
- Hyperdrive, Corestore, and Hyperswarm installed

> **CRITICAL — Pear Desktop Apps:** Hyperdrive, Corestore, and Hyperswarm
> CANNOT run in the renderer (browser context). They MUST run in a **worker
> process** started by embedded `pear-runtime`. See the `setup-pear-desktop` skill →
> `resources/worker-pattern.md`.

## Steps

1. **Install dependencies**:
   ```bash
   npm i hyperdrive corestore hyperswarm localdrive
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

## Critical Rules
- **Use Hyperdrive for files, not HyperDB or Hyperbee** — Hyperdrive is purpose-built for file storage with streaming, metadata, and directory structure
- **Handle large files with streaming** — use `drive.createReadStream()` / `drive.createWriteStream()` instead of `drive.put()` for files that may be large
- **Use `localdrive` for filesystem import/export** — pair with `mirror-drive` to mirror between local filesystem and Hyperdrive
- **Replicate `store` not `drive`** — always call `store.replicate(conn)`, not `drive.replicate()`. Corestore handles multiplexed replication
- **Always `await drive.ready()`** before any operations — accessing `drive.key` or `drive.discoveryKey` before ready returns `null`
- **Writer must keep seeding** — readers can only download while the writer (or another seeder) is online and connected
- **Don't forget to close the drive** — call `drive.close()` and `store.close()` on shutdown to flush pending writes

## Validation
1. [ ] `npm i hyperdrive corestore hyperswarm localdrive` installs without errors
2. [ ] `await drive.ready()` resolves and `drive.key` is a valid 32-byte buffer
3. [ ] Put a file: `await drive.put('/hello.txt', Buffer.from('world'))` succeeds
4. [ ] Get a file: `await drive.get('/hello.txt')` returns the correct content
5. [ ] List directory: `await drive.list('/')` returns entries including `/hello.txt`
6. [ ] Replication works: writer puts files, reader joins swarm with writer's key and reads the files
7. [ ] Streaming works: `drive.createReadStream('/large.bin')` delivers data in chunks
8. [ ] Mirror works: `localdrive` + `mirror-drive` syncs a local folder to/from the Hyperdrive

## Deep Dive
- Full writer/reader example: read `resources/full-example.md`
- Troubleshooting: read `resources/troubleshooting.md`

## Bundled integration references

For app ownership and runtime boundaries, load only the relevant [foundation](../unstoppable-foundations/SKILL.md), [module](../unstoppable-modules/SKILL.md), or [recipe](../unstoppable-recipes/SKILL.md) reference. Bundled links resolve from this skill; app paths resolve from the selected target.
