---
name: add-p2p-sync
description: Add peer-to-peer data synchronization to an existing project
  using Hyperswarm discovery and Corestore replication
---

# Add P2P Sync

Add peer-to-peer data synchronization to the current project.

## Steps

1. Install P2P dependencies:
   ```bash
   pnpm add hyperswarm corestore hypercore-crypto
   ```

2. Ask the user:
   - What data needs syncing (database, files, or custom append-only log)
   - Discovery method: shared topic, invite key, or both
   - Read-only or read-write replication

3. Create `src/p2p/swarm.ts` with:
   - Hyperswarm instance with topic-based discovery
   - Connection handler that sets up Corestore replication
   - Proper error handling for peer disconnection
   - Graceful shutdown on process exit

4. If using HyperDB or Hyperbee, configure the data layer in `src/data/store.ts`

5. Wire replication: on every new connection, call `store.replicate(socket)`

6. Add peer count tracking and connection/disconnection logging

7. Test locally with two instances using different storage directories
