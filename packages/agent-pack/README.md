# Unstoppable Stack Plugin

Build truly unstoppable apps with P2P protocols, local AI inference, and crypto payments.

This is both the canonical **agent pack** source (serving Claude, Cursor, and OpenCode) and a **Cursor plugin** distributable via the [Cursor Marketplace](https://cursor.com/marketplace).

## What's Included

| Component | Count | Description |
|-----------|-------|-------------|
| **Rules** | 38 | Core principles, module docs, and recipe patterns (.mdc files) |
| **Skills** | 17 | Guided implementation workflows organized by tier |
| **Agents** | 1 | Specialized `unstoppable-dev` agent for P2P app development |
| **Commands** | 3 | `scaffold-p2p-app`, `add-qvac`, `add-p2p-sync` |
| **Hooks** | 1 | Auto-format TypeScript/JS files after edits |

## Skill Organization

Skills are organized into tiers that match a natural development flow: pick a platform, then add capabilities.

### Platform Setup (`setup-*`)

Start here. Each scaffolds a complete project for a specific runtime.

| Skill | Runtime | Status |
|-------|---------|--------|
| `/setup-pear-desktop` | Pear Desktop (React + SWC + worker) | Battle-tested |
| `/setup-pear-terminal` | Pear Terminal (headless P2P service) | Docs only |
| `/setup-node-cli` | Node.js CLI (simplest path) | Battle-tested |
| `/setup-mobile-app` | Expo + Bare (React Native mobile) | Docs only |

### P2P & Networking (`add-p2p-*`)

Add peer-to-peer capabilities. Start with `add-p2p-networking`, then layer on features.

| Skill | What it adds | Status |
|-------|-------------|--------|
| `/add-p2p-networking` | Hyperswarm peer discovery + connections | Battle-tested |
| `/add-p2p-rpc` | Request/response RPC via bare-rpc | Battle-tested |
| `/add-p2p-sync` | Hypercore data replication | Battle-tested |
| `/add-encrypted-channels` | SecretStream + Protomux encryption | Docs only |

### Data & Storage

Add data persistence. Choose based on your data model.

| Skill | What it adds | Status |
|-------|-------------|--------|
| `/add-kv-storage` | Hyperbee KV store (offline-first) | Partial |
| `/add-database` | HyperDB structured DB (multi-writer) | Docs only |
| `/add-file-storage` | Hyperdrive P2P file storage | Docs only |

### AI Capabilities (`add-ai-*`)

Add local AI inference. Independent from P2P — works without networking.

| Skill | What it adds | Status |
|-------|-------------|--------|
| `/add-ai-chat` | QVAC chat + streaming + tool calling | Battle-tested |
| `/add-ai-vision` | QVAC multimodal image analysis | Docs only |
| `/add-ai-transcription` | QVAC Whisper speech-to-text | Docs only |
| `/add-ai-rag` | QVAC embeddings + RAG search | Docs only |

### Payments

| Skill | What it adds | Status |
|-------|-------------|--------|
| `/add-wallet` | WDK crypto wallet + payments | Unvalidated |

### DevEx

| Skill | What it adds | Status |
|-------|-------------|--------|
| `/setup-local-testing` | Same-machine P2P testing + local DHT | Battle-tested |

## Dependency Flow

```
setup-pear-desktop ──┐
setup-pear-terminal ─┤
setup-node-cli ──────┤
setup-mobile-app ────┘
         │
         ├──→ add-p2p-networking ──→ add-p2p-rpc
         │                      ├──→ add-p2p-sync
         │                      ├──→ add-encrypted-channels
         │                      └──→ add-kv-storage / add-database / add-file-storage
         │
         ├──→ add-ai-chat ──→ add-ai-vision
         │               ├──→ add-ai-transcription
         │               └──→ add-ai-rag
         │
         ├──→ add-wallet
         │
         └──→ setup-local-testing
```

## Plugin Structure

```
.cursor-plugin/plugin.json    # Plugin manifest
src/
├── core/          # Always-on rules: architecture, principles, versions
├── modules/       # Per-module documentation (Hyperswarm, QVAC, Pear, etc.)
├── recipes/       # Task-oriented patterns (P2P RPC, tool calling, RAG, etc.)
├── skills/        # Tiered skills with SKILL.md + resources/
├── hooks/         # Legacy hook definitions
└── components/    # Reusable TypeScript components for scaffolding
agents/            # Custom agent configurations
commands/          # Agent-executable commands
hooks/hooks.json   # Cursor plugin hook definitions
```

## Development

```bash
pnpm convert-plugin   # Convert frontmatter to Cursor plugin format
pnpm sync             # Sync from research repos
```

## License

MIT
