# Atlas → Unstoppable Stack: App Ideas

## Context

The original [Unstoppable Atlas research](../README.md) envisions a local-first P2P AI agent network — a "personal AI infrastructure" that contrasts with distributed compute pools like Hyperspace. This document explores how those Atlas concepts translate into **concrete app templates** that the Unstoppable Stack CLI (`us`) can scaffold, and the agent pack can guide developers through.

The key insight from Atlas: **every node is a sovereign unit** — it runs AI locally, stores data locally, and optionally connects to peers for sync, delegation, and collaboration. This maps naturally to the Unstoppable Stack's module system.

## Ideas

| # | Idea | Core Atlas Concept | Stack Modules |
|---|------|--------------------|---------------|
| 01 | [Unstoppable Bots](./01-unstoppable-bots.md) | Capability nodes + P2P service mesh | Hyperswarm, RPC, QVAC, HyperDB |
| 02 | [P2P Knowledge Mesh](./02-p2p-knowledge-mesh.md) | Shared knowledge bases + selective replication | QVAC (embeddings), HyperDB, Hypercore, Hyperdrive |
| 03 | [Private AI Chat + Device Mesh](./03-private-ai-chat.md) | Local-first inference + personal device sync | QVAC, Hyperswarm, Hypercore, Corestore |
| 04 | [Autonomous Research Swarm](./04-research-swarm.md) | Collaborative research agents + gossip | QVAC (tool calling), Hyperswarm, HyperDB, RPC |
| 05 | [P2P AI Services Marketplace](./05-ai-services-marketplace.md) | Capability discovery + delegated inference + payments | Hyperswarm, RPC, QVAC, WDK, HyperDB |

## How These Map to the CLI

Each idea can become a **CLI template**:

```bash
us init my-bot --template bot-network
us init my-brain --template knowledge-mesh
us init my-chat --template private-ai-chat
us init my-swarm --template research-swarm
us init my-market --template ai-services
```

The agent pack skills then guide the AI assistant through implementing the app's specific features, pulling from the right modules (Hyperswarm for networking, QVAC for inference, HyperDB for storage, etc.).

## Evaluation Criteria

| Criterion | Why It Matters |
|-----------|---------------|
| **Showcases the stack** | Uses multiple Unstoppable Stack modules together |
| **Local-first** | Works fully offline, P2P enhances but isn't required |
| **Scaffoldable** | Can be bootstrapped by the CLI in minutes |
| **Agent-guidable** | AI assistant can incrementally add features |
| **Relatable** | Developers understand the use case immediately |
| **Differentiated** | Can't be easily built with centralized tools |
