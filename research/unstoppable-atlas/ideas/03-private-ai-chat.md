# Idea 03: Private AI Chat + Device Mesh

## Status: Research | Date: 2026-03-14

---

## The Concept

A **private AI chat application** that runs entirely on your devices, syncs conversations between them, and can optionally delegate inference to a trusted peer when your local hardware is too weak. It's the "unstoppable ChatGPT" — same conversational UX, but:

- All inference runs locally via QVAC (your prompts never leave your device)
- Conversation history is stored in Hypercore (append-only, cryptographically signed)
- Your devices form a **personal mesh** that auto-syncs conversations
- You can **delegate** heavy model inference to a friend's powerful GPU over an encrypted P2P channel
- Works completely offline — airplane, mountain cabin, submarine

This is the most **relatable** template. Everyone uses ChatGPT. This is "your own ChatGPT, on your own terms."

---

## Why This Matters

### The Privacy Problem

Every cloud AI chat service has the same fundamental issue: your prompts travel to someone else's server.

| Service | Who sees your prompts | Can train on your data | Works offline |
|---------|----------------------|----------------------|---------------|
| ChatGPT | OpenAI | Yes (unless opted out) | No |
| Claude | Anthropic | Depends on plan | No |
| Gemini | Google | Yes (free tier) | No |
| Hyperspace | Random inference node operator | Unknown | No |
| **Private AI Chat** | **Nobody** | **Never** | **Yes** |

For sensitive use cases — legal work, medical notes, personal therapy, trade secrets, journalism — this is not a nice-to-have. It's a requirement.

### The Atlas Connection

Atlas's Phase 1 core deliverable is exactly this: "Engine that loads models, runs inference, stores conversations locally." The Private AI Chat takes this core and wraps it in a polished UX with device sync and delegation.

### Who Would Use This?

- **Anyone who values privacy** and currently uses ChatGPT
- **Professionals** (lawyers, doctors, therapists) who handle privileged information
- **Travelers / remote workers** who need AI without reliable internet
- **Security-conscious users** who don't trust cloud providers
- **Teams** who want a shared AI chat that stays within their network

---

## Architecture

### Multi-Platform Design

The same app runs on multiple platforms, connected by a personal mesh:

```
┌─────────────────────────────────────────────────┐
│                 Personal Mesh                     │
│                                                   │
│  ┌──────────┐  ┌──────────┐  ┌──────────────┐   │
│  │  Desktop  │  │  Mobile  │  │  CLI (laptop) │   │
│  │  Pear UI  │  │  Expo    │  │  Node.js      │   │
│  │           │  │          │  │               │   │
│  │  QVAC 7B  │  │ QVAC 1B │  │  QVAC 3B     │   │
│  └─────┬─────┘  └────┬─────┘  └──────┬───────┘   │
│        │             │                │           │
│        └─────────────┼────────────────┘           │
│                      │                            │
│              Hyperswarm Mesh                      │
│           (auto-discover own devices)             │
│                      │                            │
│              Corestore Replication                 │
│           (conversations sync everywhere)         │
│                                                   │
└─────────────────────────────────────────────────┘
                       │
              (optional, explicit)
                       │
                       ▼
              ┌────────────────┐
              │  Trusted Peer  │
              │  (friend's GPU)│
              │  QVAC 70B      │
              │                │
              │  Delegated     │
              │  inference     │
              └────────────────┘
```

### Data Model

```
Corestore (personal identity)
├── chat:conversations    → HyperDB (all conversations, searchable)
├── chat:messages         → Hypercore (append-only message log)
├── chat:preferences      → Hyperbee (model prefs, themes, settings)
├── chat:models           → Hyperbee (downloaded models, cache state)
└── chat:delegates        → Hyperbee (trusted peers for delegation)
```

### Conversation Schema (HyperDB)

```javascript
const conversationSchema = {
  name: 'conversation',
  fields: {
    id: { type: 'string', required: true },
    title: { type: 'string' },
    model: { type: 'string', required: true },
    createdAt: { type: 'number', required: true },
    updatedAt: { type: 'number' },
    messageCount: { type: 'number' },
    tags: { type: 'array' },
    pinned: { type: 'boolean' }
  },
  indexes: ['createdAt', 'tags', 'pinned']
}

const messageSchema = {
  name: 'message',
  fields: {
    id: { type: 'string', required: true },
    conversationId: { type: 'string', required: true },
    role: { type: 'string', required: true },     // 'user', 'assistant', 'system'
    content: { type: 'string', required: true },
    model: { type: 'string' },
    tokens: { type: 'number' },
    latency: { type: 'number' },
    delegated: { type: 'boolean' },                // was this inference delegated?
    delegatePeer: { type: 'string' },              // public key of delegate
    createdAt: { type: 'number', required: true }
  },
  indexes: ['conversationId', 'createdAt']
}
```

---

## Personal Device Mesh

The killer feature that no cloud chat has: your conversations follow you across all your devices, synced P2P without any server.

### How It Works

1. **First device** generates a Corestore identity (keypair)
2. **Linking a new device**: scan a QR code or enter a pairing key
   - The pairing key contains the Corestore's public key + a one-time secret
   - The new device joins a private Hyperswarm topic derived from the identity
   - Corestore replication begins — all conversations sync
3. **Ongoing sync**: whenever two devices are on any network (same LAN, internet, or relay), they auto-discover and sync

### Sync Behavior

```
Phone creates a conversation at 9:00 AM (on mobile data)
    → Syncs to laptop when both are on home WiFi at 6:00 PM
    → Laptop continues the conversation
    → Syncs back to phone immediately (still on same network)
    → Next morning, phone has the full conversation on the train (offline)
```

The underlying mechanism is Hypercore replication — each message is appended to a core, and replication happens automatically whenever two devices connect via Hyperswarm.

### Conflict-Free by Design

Hypercore is append-only. Messages from different devices get different sequence numbers. The conversation view merges by `createdAt` timestamp. No merge conflicts possible.

---

## Delegated Inference

When your device can't run a large model (phone, old laptop), you can delegate to a trusted peer:

### Delegation Flow

```
Phone (can only run 1B model, needs 7B quality)
    │
    ├── Check local delegate registry (Hyperbee)
    │   Found: Desktop (public key: abc...) has Qwen-3-7B
    │
    ├── Connect to Desktop via Hyperswarm (encrypted)
    │
    ├── RPC request: {
    │     type: 'inference',
    │     model: 'qwen-3-7b',
    │     messages: [...conversationHistory],
    │     stream: true
    │   }
    │
    ├── Stream tokens back over SecretStream
    │
    └── Display in chat UI as they arrive
        (message marked as "delegated to Desktop")
```

### Trust Levels for Delegation

| Level | Who | How It's Established | What They See |
|-------|-----|---------------------|---------------|
| **Own devices** | Your laptop, desktop | Shared Corestore identity | Full conversation context |
| **Trusted peer** | Friend, colleague | Explicit key exchange | Only the messages in the request |
| **None** | Don't delegate | Default for unknown peers | Nothing |

The default scaffolded app only supports Level 1 (own devices). The agent pack includes a skill for adding trusted peer delegation.

---

## App Structure (CLI Template)

```
my-private-chat/
├── src/
│   ├── index.ts              # Entry point
│   ├── chat/
│   │   ├── engine.ts         # Chat engine (manages conversations)
│   │   ├── completion.ts     # QVAC inference wrapper
│   │   └── delegation.ts     # Delegate to peer if needed
│   ├── p2p/
│   │   ├── mesh.ts           # Personal device mesh
│   │   ├── pairing.ts        # Device pairing flow
│   │   └── delegate.ts       # Delegation RPC handlers
│   ├── data/
│   │   ├── store.ts          # Corestore setup
│   │   ├── conversations.ts  # Conversation CRUD (HyperDB)
│   │   └── messages.ts       # Message append/read (Hypercore)
│   ├── models/
│   │   ├── manager.ts        # Model download + selection
│   │   └── hardware.ts       # Hardware detection
│   └── ui/                   # (varies by platform)
│       ├── terminal.ts       # CLI chat interface (readline)
│       └── desktop/          # Pear Desktop React UI
├── package.json
└── CLAUDE.md
```

### CLI Mode

```bash
# Start chatting immediately
chat

# Manage conversations
chat list                       # List all conversations
chat continue <id>              # Continue a conversation
chat search "quantum physics"   # Search across conversations
chat export <id> --format md    # Export conversation

# Model management
chat models list                # Available models
chat models pull --auto         # Download best model for hardware
chat models switch qwen-3-7b   # Switch active model

# Device mesh
chat devices list               # List linked devices
chat devices pair               # Generate pairing QR/key
chat devices link <key>         # Link this device to mesh

# Delegation
chat delegate add <peer-key>    # Trust a peer for delegation
chat delegate list              # List trusted delegates
```

---

## UX Details That Matter

### First Run Experience

```
$ chat

  Welcome to Private AI Chat!

  Detecting hardware... Apple M2, 16GB RAM
  Recommended model: Qwen 3 4B (Q4 quantization)

  Downloading model... [████████████░░░░] 62% (1.2 GB / 2.1 GB)

  ✓ Model ready. Your AI runs 100% locally.
  ✓ No data leaves this device. Ever.

  You: Hello, who are you?

  AI: I'm your private AI assistant running locally on your
      Mac. I'm powered by Qwen 3 4B. Your conversations are
      stored only on this device and are fully encrypted.
      How can I help you?
```

### Conversation Metadata in UI

Each message subtly shows where it was processed:

```
You: Explain quantum entanglement in simple terms

AI (local · Qwen 3 4B · 1.2s): Quantum entanglement is when two
particles become connected in such a way that...

You: Now explain it with the math

AI (delegated · Desktop · Qwen 3 7B · 2.1s): The mathematical
formalism of quantum entanglement begins with...
```

---

## Progressive Complexity

```
Level 1: Single-device chat with local inference          ← scaffolded
Level 2: Conversation history with search
Level 3: Multiple model support and hot-switching
Level 4: Personal device mesh (sync conversations)
Level 5: Trusted peer delegation
Level 6: RAG integration (chat over your documents)
Level 7: Desktop UI with Pear
Level 8: Mobile companion app
```

---

## Open Questions

1. **Conversation-level encryption** — Should individual conversations be encrypted at rest (beyond OS-level disk encryption)? For high-security users this matters.
2. **Model recommendation engine** — How smart should auto-model-selection be? Factor in query complexity, available VRAM, battery level (mobile)?
3. **Delegation UX** — When delegation happens, should the user explicitly approve each time, or is it automatic once a delegate is trusted? Probably configurable.
4. **Message size limits for delegation** — Sending full conversation history to a delegate means they see all context. Should we support sending only the last N messages?
5. **Cross-platform Pear/Expo parity** — How much UI code can be shared between Pear Desktop and Expo Mobile? React is common, but layouts and interactions differ.
