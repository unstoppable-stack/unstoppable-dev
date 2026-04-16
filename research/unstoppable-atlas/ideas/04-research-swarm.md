# Idea 04: Autonomous Research Swarm

## Status: Research | Date: 2026-03-14

---

## The Concept

An **Autonomous Research Swarm** is a network of AI agents that independently run experiments, share findings with peers via P2P gossip, and collectively build a growing body of knowledge — all without a coordinator.

Each node in the swarm:
- Defines a **research domain** (e.g., "summarization quality", "code generation", "medical Q&A accuracy")
- Runs **autonomous experiments** using QVAC tool-calling models
- Publishes **findings** to a Hyperswarm topic (gossip)
- Replicates interesting results from peers into its local HyperDB
- Maintains a **leaderboard** of best results per domain
- Operates 24/7 as a background daemon

This is inspired by Hyperspace's "AGI Research Platform" where thousands of agents collaboratively train models and share results. But instead of centralized CRDT leaderboards published by HCS, our version is fully decentralized — each node maintains its own view of the swarm's collective knowledge.

---

## Why This Matters

### The Bigger Picture

AI research today is concentrated in labs with massive compute budgets. Individual developers can run models locally but can't coordinate research efforts without centralized infrastructure (cloud storage, APIs, dashboards).

The Research Swarm enables **distributed, permissionless AI research**:

- A student in Argentina, a hobbyist in Japan, and a researcher in Norway each run experiments on their hardware
- Results propagate through the swarm automatically
- The collective produces insights no single node could alone
- No lab, no budget, no permission needed

### Concrete Use Cases

| Use Case | What Agents Do |
|----------|---------------|
| **Prompt engineering research** | Test 1000s of prompt variations against a benchmark, share best-performing prompts |
| **Model comparison** | Run the same benchmark across different QVAC models, aggregate performance data |
| **Domain-specific fine-tuning data** | Generate and validate Q&A pairs for specific domains |
| **Tool-calling optimization** | Test different tool schemas and measure success rates |
| **RAG configuration research** | Compare chunk sizes, embedding models, retrieval strategies |

### The Atlas Connection

Atlas Phase 4 (Milestone 4.4) defines "Collaborative Research" with:
- Research experiment definition format
- P2P experiment sharing via gossip
- Result aggregation with CRDT-like merging
- Leaderboard tracking via HyperDB

The Research Swarm brings this forward as a standalone app template, focused purely on the research coordination protocol.

---

## Architecture

### Experiment Model

An experiment is a reproducible unit of research:

```javascript
const experiment = {
  id: 'exp-20260314-prompt-variations-042',
  domain: 'prompt-engineering',
  hypothesis: 'Chain-of-thought prompts improve accuracy on math tasks',

  config: {
    model: 'qwen-3-4b',
    benchmark: 'gsm8k-subset-100',
    variations: [
      { name: 'direct', systemPrompt: 'Answer the math question.' },
      { name: 'cot', systemPrompt: 'Think step by step, then answer.' },
      { name: 'cot-verbose', systemPrompt: 'Show all your work...' }
    ],
    metrics: ['accuracy', 'tokens_used', 'latency_ms'],
    repetitions: 3
  },

  results: null,    // filled after execution
  nodeId: '<public key>',
  timestamp: 1710432000000
}
```

### Execution Pipeline

```
Experiment Definition
    │
    ▼
Scheduler (picks next experiment from queue)
    │
    ▼
Runner
    ├── Load model (QVAC)
    ├── For each variation:
    │   ├── For each benchmark item:
    │   │   ├── Run inference
    │   │   ├── Evaluate result against expected answer
    │   │   └── Record metrics
    │   └── Aggregate variation metrics
    ├── Compare variations
    └── Produce experiment result
    │
    ▼
Publisher
    ├── Store result in local HyperDB
    ├── Append to results Hypercore (audit trail)
    └── Broadcast to Hyperswarm topic (gossip)
```

### Gossip Protocol

Results spread through the swarm via Hypercore replication, not traditional gossip messages:

```
Node A runs experiment → appends result to its Hypercore
    │
    ▼
Node A is connected to Node B (same Hyperswarm topic)
    │
    ▼
Corestore replication syncs the new entry to Node B
    │
    ▼
Node B's watcher triggers → processes new result
    ├── Validates result (re-run a sample if suspicious)
    ├── Indexes in local HyperDB
    ├── Updates local leaderboard
    └── Result is now available for Node B's peers too (transitive replication)
```

This is more robust than traditional gossip: results are cryptographically signed (Hypercore), ordered (sequence numbers), and don't require complex broadcast protocols.

### Leaderboard System

Each node maintains a local leaderboard — a materialized view over all known results:

```javascript
const leaderboardEntry = {
  domain: 'prompt-engineering',
  metric: 'accuracy',
  rank: 1,
  experimentId: 'exp-20260314-prompt-variations-042',
  variationName: 'cot',
  score: 0.87,
  model: 'qwen-3-4b',
  nodeId: '<public key of node that ran it>',
  timestamp: 1710432000000,
  reproducedBy: ['<key1>', '<key2>']   // nodes that validated this result
}
```

Leaderboards are **eventually consistent** — different nodes might have slightly different views depending on which results have replicated to them. This is fine because:
- Results are immutable (append-only Hypercore)
- The leaderboard converges as replication catches up
- Any node can independently verify any result

---

## App Structure

```
my-research-swarm/
├── src/
│   ├── index.ts               # Entry point + daemon
│   ├── experiments/
│   │   ├── definition.ts      # Experiment schema + validation
│   │   ├── scheduler.ts       # Queue management, priority
│   │   ├── runner.ts          # Execute experiment against QVAC
│   │   ├── evaluator.ts       # Compare results to expected answers
│   │   └── templates/         # Pre-built experiment templates
│   │       ├── prompt-comparison.ts
│   │       ├── model-benchmark.ts
│   │       └── rag-config-test.ts
│   ├── swarm/
│   │   ├── gossip.ts          # Hyperswarm topic management
│   │   ├── replication.ts     # Corestore replication + watchers
│   │   └── validation.ts      # Verify peer results (sample re-run)
│   ├── data/
│   │   ├── store.ts           # Corestore namespaces
│   │   ├── results.ts         # HyperDB for experiment results
│   │   ├── leaderboard.ts     # Materialized leaderboard view
│   │   └── benchmarks.ts      # Built-in benchmark datasets
│   ├── ai/
│   │   ├── inference.ts       # QVAC wrapper
│   │   └── tools.ts           # Tool-calling definitions
│   └── cli/
│       ├── run.ts             # `swarm run <experiment>`
│       ├── status.ts          # `swarm status`
│       ├── leaderboard.ts     # `swarm leaderboard`
│       └── peers.ts           # `swarm peers`
├── experiments/               # User-defined experiments (YAML)
│   └── my-prompt-test.yaml
├── benchmarks/                # Local benchmark datasets
│   └── gsm8k-subset.json
├── package.json
└── CLAUDE.md
```

### CLI Commands

```bash
# Run experiments
swarm start                              # Start daemon (runs experiments continuously)
swarm run ./experiments/my-test.yaml     # Run a specific experiment
swarm queue                              # View experiment queue
swarm pause                              # Pause experiment execution

# Results
swarm results                            # List recent results (local + replicated)
swarm results <experiment-id>            # Detailed result view
swarm leaderboard                        # View current leaderboard
swarm leaderboard --domain prompt-eng    # Filter by domain

# Swarm
swarm peers                              # Connected research peers
swarm peers invite <key>                 # Invite peer to swarm
swarm topics                             # Active research topics
swarm join <topic>                       # Join a research topic

# Validation
swarm validate <experiment-id>           # Re-run an experiment to verify
```

### Experiment Definition (YAML)

```yaml
name: cot-vs-direct-math
domain: prompt-engineering
hypothesis: Chain-of-thought improves math accuracy on small models

model: qwen-3-4b
benchmark: gsm8k-subset-100

variations:
  - name: direct
    system_prompt: "Answer the math question with just the number."
  - name: chain-of-thought
    system_prompt: "Think through this step by step, then give the final answer."
  - name: few-shot-cot
    system_prompt: "Here are some examples..."
    few_shot_examples: 3

metrics:
  - accuracy
  - avg_tokens
  - avg_latency_ms

repetitions: 3
timeout_per_item: 30000
```

---

## What Makes This Different

| Aspect | Hyperspace AGI Research | Academic Labs | Our Research Swarm |
|--------|------------------------|--------------|-------------------|
| Coordinator | HCS (centralized) | Lab server | None (P2P) |
| Who participates | Registered nodes | Lab members | Anyone with hardware |
| Results storage | CRDT on HCS | Cloud/paper | Hypercore (local + replicated) |
| Reproducibility | Unknown | Manual | Built-in (re-run + verify) |
| Cost | Token staking | Grants / cloud bills | Zero (local compute) |
| Privacy | Results public on network | Within lab | You choose what to share |
| Hardware | Pooled GPU cluster | Lab cluster | Heterogeneous (laptop, desktop, Pi) |

---

## Progressive Complexity

```
Level 1: Run local experiments with pre-built templates     ← scaffolded
Level 2: Write custom experiments (YAML)
Level 3: Join a swarm topic and share results
Level 4: Replicate and validate peer results
Level 5: Build custom leaderboards per domain
Level 6: Automated experiment generation (meta-research)
Level 7: Pipeline experiments (output of one feeds next)
```

---

## Open Questions

1. **Result validation cost** — Re-running an experiment to validate takes compute. How do we balance trust vs. verification? Maybe validate only top leaderboard entries?
2. **Benchmark standardization** — For results to be comparable, benchmark datasets must be identical. Ship common benchmarks in the template? Allow custom but warn about comparability?
3. **Experiment spam** — In a public swarm, a node could flood with low-quality experiments. Rate limiting per peer key? Minimum quality threshold?
4. **Hardware normalization** — A result on an M2 Max is different from a Raspberry Pi. Should metrics be hardware-normalized, or just report raw numbers with hardware context?
5. **Domain coordination** — Who decides which domains exist? Emergent (anyone creates a topic) or curated (community-agreed list)? Probably emergent with the ability to ignore irrelevant domains.
