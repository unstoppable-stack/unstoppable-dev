# Idea 05: P2P AI Services Marketplace

## Status: Research | Date: 2026-03-14

---

## The Concept

A **P2P AI Services Marketplace** is a decentralized network where nodes offer AI capabilities as services and consume services from others — with optional micropayments via WDK. There is no central marketplace, no listing authority, and no middleman. Services are discovered via Hyperswarm, negotiated via RPC, paid for via WDK, and delivered over encrypted P2P channels.

Think of it as "Fiverr for AI, but P2P" — except there's no Fiverr in the middle taking a 20% cut. Providers set prices, consumers choose providers, and payment flows directly between them.

---

## Why This Matters

### The Market Opportunity

Cloud AI inference is expensive:

| Provider | Cost (per 1M tokens) | Privacy | Offline |
|----------|---------------------|---------|---------|
| OpenAI GPT-4o | $5-15 | No | No |
| Claude 3.5 | $3-15 | No | No |
| Google Gemini | $1-7 | No | No |
| Hyperspace | Tokens/staking | Partial | No |
| **P2P Marketplace** | **Peer-set pricing** | **Yes (encrypted)** | **Fallback to local** |

Many people have capable hardware sitting idle. A Mac Studio with an M2 Ultra can run 70B models but sits unused 80% of the time. The marketplace turns idle compute into income and gives consumers cheaper, more private AI services.

### The Atlas Connection

Atlas defines:
- **Capability-based service discovery** (F7)
- **Delegated AI inference** (F8) with encrypted channels
- **WDK micropayments** (F16) for P2P services
- **Capability registration and matching**

The Marketplace combines all of these into a coherent economic system.

### Who Would Use This?

**Providers (sellers):**
- GPU owners wanting passive income from idle hardware
- Teams with surplus compute offering services to partners
- AI enthusiasts who want to share their fine-tuned models

**Consumers (buyers):**
- Developers who need inference but don't have GPUs
- Mobile users who want access to large models from their phone
- Small businesses wanting AI services without cloud vendor contracts
- Privacy-conscious users who prefer paying a peer over OpenAI

---

## Architecture

### Service Catalog Model

Each provider maintains a local service catalog, advertised via Hyperswarm:

```javascript
const serviceCatalog = {
  provider: {
    publicKey: '<ed25519 public key>',
    name: 'Simon\'s GPU Node',
    hardware: { gpu: 'NVIDIA RTX 4090', vram: 24576, cpu: 'i9-14900K' },
    uptime: 0.97,
    since: 1709251200000
  },

  services: [
    {
      type: 'inference',
      model: 'qwen-3-7b',
      pricing: {
        perMillionTokens: 0.50,       // USD equivalent in crypto
        currency: 'USDT',
        minimumRequest: 0.001
      },
      specs: {
        maxContext: 32768,
        avgLatency: '800ms/first-token',
        throughput: '45 tokens/sec',
        concurrent: 2
      }
    },
    {
      type: 'embedding',
      model: 'all-MiniLM-L6-v2',
      pricing: {
        perMillionTokens: 0.05,
        currency: 'USDT'
      }
    },
    {
      type: 'transcription',
      model: 'whisper-large-v3',
      pricing: {
        perMinuteAudio: 0.02,
        currency: 'USDT'
      }
    },
    {
      type: 'vision',
      model: 'llava-1.6-7b',
      pricing: {
        perImage: 0.01,
        currency: 'USDT'
      }
    }
  ]
}
```

### Discovery Flow

```
Consumer wants: inference with >=7B model
    │
    ├── 1. Join Hyperswarm topic: "unstoppable:market:inference:v1"
    │
    ├── 2. Receive catalogs from connected providers (RPC handshake)
    │
    ├── 3. Filter: model size >= 7B, latency < 2s, uptime > 0.9
    │
    ├── 4. Sort by: price (ascending), then reputation score
    │
    └── 5. Select provider, negotiate, begin service
```

### Transaction Flow

A complete service transaction:

```
1. Discovery
   Consumer ──join topic──► Hyperswarm
   Consumer ◄──catalog──── Provider

2. Negotiation
   Consumer ──req: 'quote' { model: 'qwen-3-7b', estimatedTokens: 5000 }──► Provider
   Provider ──res: { price: 0.0025, currency: 'USDT', validFor: 60000 }──► Consumer

3. Payment (WDK)
   Consumer ──create payment channel──► WDK
   Consumer ──lock escrow: 0.0025 USDT──► Payment channel

4. Service Delivery
   Consumer ──req: 'inference' { messages: [...], stream: true }──► Provider
   Provider ──stream: tokens...──► Consumer
   Provider ──res: { usage: { tokens: 4832 } }──► Consumer

5. Settlement
   Consumer ──release escrow (actual: 0.0024 based on 4832 tokens)──► Provider
   Provider ──receives payment──► WDK wallet
   Both ──update reputation──► Local HyperDB
```

### Reputation System

Trust in a decentralized marketplace requires reputation. Our system uses Hypercore's properties:

```javascript
const reputationEntry = {
  providerId: '<public key>',
  consumerId: '<public key>',
  transactionId: '<unique id>',
  serviceType: 'inference',
  rating: 4,                    // 1-5
  metrics: {
    latencyPromised: 800,
    latencyActual: 720,
    tokensRequested: 5000,
    tokensDelivered: 4832,
    completionSuccess: true
  },
  timestamp: 1710432000000,
  signature: '<consumer signs this entry>'
}
```

Reputation is stored in each node's HyperDB and replicated to peers. Properties:

- **Tamper-proof**: entries are in Hypercore (append-only, signed)
- **Local computation**: each node computes reputation scores from the data it has
- **Sybil-resistant**: reputation is tied to transaction history, not just claims
- **Eventually consistent**: different nodes may have different views, converging over time

### Reputation Score Calculation

```
score = (
  0.4 * successRate +           // % of transactions completed successfully
  0.3 * deliveryAccuracy +      // how close actual metrics are to promised
  0.2 * volumeWeight +          // more transactions = more reliable score
  0.1 * uptimeWeight            // longer uptime = bonus
)
```

---

## App Structure

```
my-ai-market/
├── src/
│   ├── index.ts               # Entry point
│   ├── provider/
│   │   ├── catalog.ts         # Service catalog management
│   │   ├── pricing.ts         # Pricing strategies
│   │   ├── server.ts          # RPC server for service requests
│   │   ├── queue.ts           # Request queue management
│   │   └── earnings.ts        # Earnings tracking
│   ├── consumer/
│   │   ├── discovery.ts       # Find providers on Hyperswarm
│   │   ├── selector.ts        # Score and select best provider
│   │   ├── client.ts          # RPC client for service requests
│   │   └── spending.ts        # Spending tracking
│   ├── payments/
│   │   ├── wallet.ts          # WDK wallet setup
│   │   ├── escrow.ts          # Payment channel / escrow
│   │   └── settlement.ts      # Post-service settlement
│   ├── reputation/
│   │   ├── store.ts           # Reputation HyperDB
│   │   ├── scorer.ts          # Calculate reputation scores
│   │   └── validator.ts       # Validate reputation entries
│   ├── p2p/
│   │   ├── swarm.ts           # Hyperswarm marketplace topics
│   │   ├── rpc.ts             # RPC protocol definitions
│   │   └── replication.ts     # Reputation data replication
│   ├── data/
│   │   ├── store.ts           # Corestore setup
│   │   ├── transactions.ts    # Transaction log (Hypercore)
│   │   └── analytics.ts       # Usage analytics
│   └── ai/
│       ├── models.ts          # QVAC model management
│       └── handlers.ts        # Service execution handlers
├── package.json
└── CLAUDE.md
```

### CLI Commands

```bash
# Provider mode
market serve                              # Start serving your catalog
market catalog                            # View/edit your service catalog
market catalog add inference qwen-3-7b    # Add a service
market pricing set inference 0.50         # Set price per million tokens
market earnings                           # View earnings summary
market earnings withdraw                  # Withdraw to external wallet

# Consumer mode
market search inference --model-min 7b    # Find inference providers
market search transcription               # Find transcription providers
market providers                          # List discovered providers
market provider <key> --details           # View provider details + reputation

# Wallet
market wallet create                      # Create WDK wallet
market wallet balance                     # Check balance
market wallet fund                        # Fund wallet (receive address)

# Reputation
market reputation <key>                   # View a peer's reputation
market reputation self                    # View your own reputation

# Analytics
market stats                              # Usage statistics
market stats --provider                   # Provider-side stats
market stats --consumer                   # Consumer-side stats
```

---

## Economic Model

### Pricing Discovery

Unlike centralized marketplaces, there's no global price list. Prices emerge from competition:

```
Provider A: inference @ $0.50/M tokens (RTX 4090, fast)
Provider B: inference @ $0.30/M tokens (M2 Max, medium)
Provider C: inference @ $0.80/M tokens (RTX 4090, fast, high reputation)
```

Consumers see all available providers and choose based on price, speed, reputation, and trust. Market forces drive efficient pricing.

### Revenue Scenarios

| Scenario | Hardware | Services | Estimated Monthly Revenue |
|----------|----------|----------|--------------------------|
| Hobbyist | M2 MacBook Pro | Inference (3B) 4h/day | $5-15 |
| Enthusiast | RTX 4090 desktop | Inference (7B) + embedding 12h/day | $30-80 |
| Power user | Dual RTX 4090 | Full stack 24/7 | $100-300 |
| Small team | 3x GPU machines | Multi-model serving 24/7 | $300-1000 |

These are illustrative — actual revenue depends on demand and competition.

### Payment Channels

For frequent interactions, WDK payment channels reduce per-transaction overhead:

```
1. Consumer opens channel with Provider (one on-chain tx)
2. Multiple service requests flow through the channel
3. Each request adjusts the channel balance (off-chain)
4. Channel closes when either party wants (one on-chain tx)

Result: 100 inference requests = 2 on-chain transactions instead of 100
```

---

## What Makes This Different

| Aspect | Cloud AI APIs | Hyperspace | Our Marketplace |
|--------|-------------|-----------|-----------------|
| Middleman | OpenAI/Google | HCS coordinators | **None** |
| Fee | Provider markup | Token burn | **Direct peer-to-peer** |
| Privacy | Provider sees all | Node sees prompts | **Encrypted channel** |
| Payment | Credit card | Crypto staking | **WDK self-custodial** |
| Discovery | DNS/URL | HCS registry | **Hyperswarm DHT** |
| Trust | Brand reputation | Fraud proofs | **P2P reputation** |
| Shutdown risk | API deprecation | Token governance | **None** |

---

## Progressive Complexity

```
Level 1: Local inference (no marketplace, just QVAC)         ← scaffolded
Level 2: Provider mode (serve inference to peers, free)
Level 3: Consumer mode (discover and use peer services, free)
Level 4: WDK wallet integration
Level 5: Paid services with escrow
Level 6: Reputation system
Level 7: Payment channels for efficiency
Level 8: Multi-service catalog (inference + embedding + vision + transcription)
```

---

## Open Questions

1. **Cold start problem** — A marketplace with no providers is useless, and vice versa. Bootstrap with free services first, then layer in payments?
2. **Price manipulation** — A provider could offer artificially low prices to gain reputation, then raise them. Reputation decay or recent-weighted scoring helps.
3. **Payment disputes** — If a consumer says the result was bad but the provider says it was fine, who arbitrates? Multi-party escrow? Third-party validator peer?
4. **Legal considerations** — Running inference as a paid service may have regulatory implications (money transmission, data processing). Per-jurisdiction analysis needed.
5. **Minimum viable payment** — What's the smallest WDK payment that makes sense? If gas fees on some chains are $0.50, paying $0.001 for an inference doesn't work. Need low-fee chains or L2 solutions.
6. **Free tier vs. paid** — Should providers always charge, or should there be a "community mode" where capable nodes donate spare compute? Both models should coexist.
