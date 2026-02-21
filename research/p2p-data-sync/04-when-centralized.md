# When P2P Isn't Enough: Centralized Solutions

## The Honest Truth

P2P is powerful for data ownership, privacy, and censorship resistance. But some things are genuinely hard — or impossible — without some form of centralized coordination. Knowing when to reach for a server saves you from building a worse version of what a server does trivially.

---

## Case 1: Global Discovery & Search

**The problem:** You can't search data you don't have. In P2P, each node only has its own data (and what it's replicated from known peers). There's no way to "search all users."

**Example:** A model registry. You want to list all available AI models. No single peer has them all.

**The QVAC Model Registry pattern:**
```
Client                    Registry Server               Hyperdrive (P2P)
  │                            │                              │
  │── list all models ────────►│                              │
  │◄── metadata (name, size,  ─│                              │
  │    checksum, hyperdrive    │                              │
  │    key)                    │                              │
  │                            │                              │
  │── download model ─────────────────────────────────────────►│
  │◄── model file (P2P) ──────────────────────────────────────│
  │                            │                              │
  │  Centralized: discovery    │     P2P: data transfer       │
```

The QVAC SDK uses a registry to:
- List available models (`qvacModelRegistryList()`)
- Search by engine, name, quantization, type
- Get metadata (size, checksum, download URL)
- But actual model download can be via Hyperdrive (P2P)

**When you need this:**
- Public catalogs (app stores, model registries, asset libraries)
- User directories (find a user by name/email)
- Full-text search across all data
- Aggregated analytics

**Alternatives that are still decentralized:**
- **DHT-based discovery** — Hyperswarm topics let you find peers, but not search their data
- **Gossip protocols** — peers share what they know, eventually everyone has a partial index
- **Federated search** — multiple small servers, no single point of control

---

## Case 2: Always-On Availability

**The problem:** If your phone is off, nobody can get your data. P2P requires at least one online peer holding the data.

**Solutions spectrum:**
```
Pure P2P            Vault (local)         Cloud (hosted)
─────────────────────────────────────────────────────────
• Data on device    • Desktop always on    • Server always on
• Offline = gone    • Seeds your data      • Seeds your data
• Free              • Free (your HW)       • Subscription
• Max privacy       • Good privacy         • Trust provider
```

**The Vault pattern** is the sweet spot:
- It's your own device, so privacy is preserved.
- It replicates your cores read-only — it can serve data but can't modify it.
- From the protocol's perspective, it's just another peer.
- Transitioning from Vault to Cloud is just changing which machine runs the seeder.

**When you NEED always-on:**
- Mobile apps (phones go offline constantly)
- Multi-device sync (desktop is off when phone needs data)
- Sharing data with peers who weren't online when you published
- Apps that need to push notifications (can't push to an offline device)

---

## Case 3: Authentication & Identity

**The problem:** P2P has key-based identity (public keys), but no user-friendly identity layer. "Who is `abc123def456...`?"

**P2P can handle:**
- Key-based auth (you prove you hold a secret key)
- Web of trust (peers vouch for each other)
- Capability-based access (share a read key to grant access)

**P2P struggles with:**
- "Log in with email/password"
- "Find user by name"
- Account recovery (lost your key? gone.)
- Revoking access after a key leak

**Keet's approach:**
- 24-word seed phrase for identity (like crypto wallets)
- No email, no phone number
- QR code for device linking
- Accept the trade-off: lose your seed phrase, lose your identity

**For the Unstoppable Stack:**
- The Vault can store identity locally (seed phrase or key pair)
- Device linking via secure QR code exchange
- No centralized user directory (unless you choose to add one)
- Recovery: either backup your seed, or use Vault-to-Vault sync

---

## Case 4: Coordination & Ordering

**The problem:** Some operations need a global order or a coordinator.

**P2P handles this with:**
- **Autobase** — linearizes concurrent writes via causal DAG + indexer quorum
- Works without a server, but requires a majority of indexers to be online for signed checkpoints

**When you still need a server:**
- **Financial transactions** — double-spend prevention needs atomic global ordering
- **Auctions/bidding** — "who bid first?" needs a timestamp authority
- **Rate limiting** — P2P can't enforce global rate limits
- **Access control changes** — revoking a user in real-time across all peers

**The WDK (Wallet Development Kit)** will likely need some server-side component for:
- Transaction broadcasting to the blockchain
- Balance verification
- Payment routing

---

## Case 5: Heavy Computation

**The problem:** Some computations are too heavy for a user's device.

**P2P solution — Delegated inference (QVAC):**
```js
// Consumer (phone) delegates to Provider (desktop/cloud)
const modelId = await loadModel({
  modelSrc: QWEN_3_1_7B_INST_Q4_0,
  modelType: 'llm',
  delegate: {
    topic: providerTopicHex,
    providerPublicKey: providerPubKey,
    timeout: 5_000,
    fallbackToLocal: true
  }
})
```

This is P2P computation delegation — no server needed if you run the Vault.

**When you need a server:**
- GPU-intensive tasks that no local device can handle
- Training (not just inference)
- When the user doesn't have a Vault or desktop

---

## Decision Framework

Ask these questions:

| Question | Yes → | No → |
|----------|-------|------|
| Does the user own all the data? | P2P (Hypercore) | Consider hybrid |
| Do multiple users write? | Autobase | Single Hypercore |
| Must data be available 24/7? | Add Vault/Cloud seeder | Pure P2P ok |
| Need global search? | Centralized index | P2P sufficient |
| Need user-friendly identity? | Add identity layer | Key-based ok |
| Heavy computation? | Delegate (QVAC) or Cloud | Local ok |
| Financial transactions? | Needs blockchain/server | P2P ok |

---

## The Unstoppable Stack's Position

```
                    CENTRALIZED ◄─────────────────────────► P2P

Data storage        ░░░░░░░░░░░░░░░░░░░░░░░░░█████████████  Hypercore/Hyperbee
File storage        ░░░░░░░░░░░░░░░░░░░░░░░░░█████████████  Hyperdrive
Multi-writer        ░░░░░░░░░░░░░░░░░░░░░░████████████████  Autobase
Availability        ░░░░░░░░░░░░░████████████████████░░░░░  Vault (hybrid)
AI inference        ░░░░░░░░░░░░░░██████████████████░░░░░░  QVAC delegate
Discovery           ░░░░░░░░░░████████████████████████████  Hyperswarm DHT
Identity            ░░░░░░░░░░░░░░░░░░██████████████░░░░░░  Key-based + seed
Model registry      ████████████████░░░░░░░░░░░░░░░░░░░░░░  Centralized API
Payments            ██████████████░░░░░░░░░░░░░░░░░░░░░░░░  WDK + blockchain
Search              ████████████████░░░░░░░░░░░░░░░░░░░░░░  Centralized index
```

The stack is heavily P2P for data and files, with strategic centralization for discovery (model registry, search) and availability (Vault/Cloud).
