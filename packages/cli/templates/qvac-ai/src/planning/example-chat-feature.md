# Feature: P2P Chat

## Goal
Build a simple P2P chat feature where users can send messages to each other without a central server. Messages are stored locally and synced between connected peers.

## Modules Required
- **hyperswarm**: For peer discovery and establishing P2P connections
- **hyperdb**: For storing and syncing chat messages between peers
- **hypercore**: Foundation for HyperDB (included automatically)

## Implementation Steps

### Phase 1: Data Model
- [ ] Define chat message schema (author, content, timestamp, id)
- [ ] Set up HyperDB with a collection for messages
- [ ] Create basic CRUD operations (insert, query messages)

### Phase 2: P2P Networking
- [ ] Initialize Hyperswarm for peer discovery
- [ ] Define a topic for the chat room
- [ ] Handle peer connections and disconnections
- [ ] Set up HyperDB replication over peer connections

### Phase 3: UI Integration
- [ ] Create message input component
- [ ] Create message list component
- [ ] Handle real-time message updates
- [ ] Show online/offline peer status

### Phase 4: Testing
- [ ] Test with 2 peers on same network
- [ ] Test message persistence (restart and see messages)
- [ ] Test message sync when new peer joins
- [ ] Test graceful handling of peer disconnection

## Patterns to Use
- **p2p-data-sync**: For syncing messages via HyperDB
- **offline-first-app**: Messages work offline, sync when peers connect

## Code Structure
```
src/
├── data/
│   ├── chat-schema.ts      # Message schema definition
│   └── chat-store.ts       # HyperDB setup and operations
├── p2p/
│   ├── swarm.ts           # Hyperswarm setup
│   └── replication.ts     # Handle DB replication
└── ui/
    ├── MessageList.tsx    # Display messages
    └── MessageInput.tsx   # Send messages
```

## Testing Strategy

1. **Local Development**: Use two terminal windows running the same app
2. **Verify Sync**: Send message from instance 1, see it appear in instance 2
3. **Verify Persistence**: Close both instances, restart, messages still there
4. **Verify Offline**: Disconnect network, send messages, they queue locally then sync when reconnected

## References
- HyperDB docs: [research/output/modules/hyperdb.md]
- Hyperswarm docs: [research/output/modules/hyperswarm.md]
- P2P Sync recipe: [research/output/recipes/p2p-data-sync.md]
