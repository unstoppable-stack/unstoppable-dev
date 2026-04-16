# The Unstoppable Stack — Presentation Deck

**Audience:** Product Managers → CEO
**Duration:** ~15 minutes + Q&A
**Tone:** Personal story → Problem → Solution → Impact

---

## Slide 1: Title

**The Unstoppable Stack**
*Making Tether's developer tools accessible to everyone*

Simon Iribarren

---

## Slide 2: It Started with My Mom

When I was in Chile, I saw my mom struggling to manage her yoga studio.

- Who attended which class?
- Who paid?
- Scheduling, reminders, everything

She's not great with technology. She needed something simple.

So I decided to **vibe-code** her an app.

> *Photo opportunity: yoga studio, or a simple mockup of the app*

---

## Slide 3: The Power of Vibe-Coding

I built a functional studio management app surprisingly fast using Claude.

Not production-ready, but it worked. And it hit me:

**AI-assisted coding has become incredibly powerful.**

If I could build this in a few hours, what else could I build?

---

## Slide 4: A Finance App

Next idea: a personal finance app.

- Track expenses
- Track income
- Even track my 0.00002 BTC

Same approach — vibe-code with Claude, iterate fast.

Two apps in days, not weeks. The potential was obvious.

---

## Slide 5: El Salvador — The Pillars of Society

At the Tether event in El Salvador, the presentation about the
**stable pillars of society** resonated deeply.

People need foundations for stability. And I thought:

**What if we could give people those pillars as free, private,
unstoppable apps?**

Apps that:
- Run on their devices (not someone else's server)
- Keep their data private
- Work offline
- Can't be shut down or censored

---

## Slide 6: The Pillars — As Apps

| Pillar | App Concept | Stack |
|--------|-------------|-------|
| **Health** | QVAC Health — private health tracking with local AI | QVAC + Pear |
| **Intelligence** | QVAC Workbench — local AI assistant, no cloud | QVAC + Pear |
| **Finance** | Personal finance — expenses, income, Bitcoin | WDK + Pear |
| **Community** | Studio/sports app — find places to work out, join classes | Hyperswarm + Pear |

All built on Holepunch (P2P) + QVAC (local AI) + WDK (payments).

All **unstoppable**.

---

## Slide 7: AI Already Wins — For Centralized Apps

AI coding assistants are already **incredibly good** at building
traditional apps.

```
"Build me a SaaS dashboard with auth, Stripe, and a Postgres database"
```

→ Claude / Cursor produces a working app in minutes.
→ React, Next.js, AWS, Vercel — the AI knows these inside out.

**Centralized development has never been easier.**

---

## Slide 8: Our Stack Gets Left Behind

But ask that same AI to build with Holepunch + QVAC + WDK:

```
"Build me a P2P desktop app with local AI and encrypted storage"
```

→ P2P modules crash in the browser (wrong process)
→ `TextEncoder is not defined` (Bare ≠ Node.js)
→ Worker communication fails (wrong pipe)
→ Wrong package versions (AI guesses)
→ Hours of debugging before anything works

**The AI doesn't know our stack.**

And if the AI can't build with it, developers won't choose it —
no matter how good the underlying technology is.

---

## Slide 9: The Existential Risk

This isn't just an inconvenience. It's an **existential risk** for
our developer ecosystem.

| | Centralized (React/Next.js/AWS) | Our Stack (Holepunch/QVAC/WDK) |
|---|---|---|
| AI can build it? | Yes, effortlessly | No, constant errors |
| Time to working app | Minutes | Hours of debugging |
| Developer experience | Smooth | Frustrating |
| Infrastructure needed | Servers (AWS, Vercel) | None — but devs don't know that |
| Adoption trend | Accelerating (AI makes it easier) | At risk (AI makes alternatives easier) |

Every day that AI gets better at centralized development and worse
(relatively) at ours — the gap widens.

> **If we don't make AI work with our stack, AI will make our stack
> irrelevant.**

But there's a flip side...

---

## Slide 9b: The Opportunity — Flip the Advantage

If we solve the AI knowledge problem, our stack has a **structural
advantage** over centralized:

| | Centralized | Unstoppable Stack |
|---|---|---|
| Servers needed | Yes (AWS/Vercel/GCP) | **None** |
| Monthly infra costs | $50-$5,000+/month | **$0** |
| DevOps / maintenance | Ongoing | **None** |
| Privacy | Data on someone's server | **Data on user's device** |
| Works offline | No | **Yes** |
| Can be shut down | Yes | **No** |

**With AI handling the complexity, developers get all the benefits of
P2P with none of the pain.**

They don't need to maintain servers. They don't need to pay for hosting.
They just build the app, and it runs on the user's device.

And for users who want more — cloud backup, powerful AI models, always-on
file storage — that's where **Unstoppable Subscriptions** come in.

**We don't just catch up to centralized. We surpass it.**

---

## Slide 10: The Solution — unstoppable.dev

**The Unstoppable Stack** is a toolchain that makes it easy to vibe-code
apps using Holepunch + QVAC + WDK.

Three components:

```
┌─────────────────────────────────────────────────┐
│                unstoppable.dev                   │
│                                                  │
│  1. CLI          2. Agent Pack     3. Website    │
│  Scaffolds       Battle-tested     Docs &        │
│  projects        AI knowledge      community     │
│  in seconds      for Claude,       hub           │
│                  Cursor,                          │
│                  OpenCode                         │
└─────────────────────────────────────────────────┘
```

---

## Slide 11: The CLI

```bash
us init
```

```
? Project name: my-health-app
? AI assistant: Cursor
? Template: Blank Project
```

In 10 seconds you have:
- A scaffolded project
- AI rules configured for your editor
- All the knowledge the AI needs to build with our stack

---

## Slide 12: The Agent Pack — The Secret Sauce

This is what makes it work. A structured knowledge base that teaches AI
assistants how to use our stack correctly.

```
Agent Pack
├── 12 Module docs      (Pear, Bare, Hyperswarm, QVAC, WDK, ...)
├── 10 Skills           (P2P RPC, Desktop App, Chat App, ...)
├── 17 Recipes          (Tool calling, file sharing, encryption, ...)
├── 8 Components        (Reusable TypeScript code)
├── Verified versions   (Pinned, working package versions)
└── Troubleshooting     (Real errors → real fixes)
```

Works with **Claude Code**, **Cursor**, and **OpenCode**.

---

## Slide 13: Knowledge Acquisition — How We Build It

The knowledge isn't written from docs. It's **extracted from real apps.**

```
  Build a real app
        │
        ▼
  Hit bugs & gaps ──────► Document every fix
        │                       │
        ▼                       ▼
  Fix and ship app       Extract into Agent Pack
        │                       │
        ▼                       ▼
  Working app            Battle-tested knowledge
        │                       │
        └───────┬───────────────┘
                ▼
        Scaffold new project
        Vibe-code same app
        using ONLY agent pack
                │
                ▼
        Works? ── No ──► Fix gaps, repeat
          │
          Yes
          │
          ▼
        Knowledge is validated ✓
```

---

## Slide 14: The Validation Loop in Practice

**App 1: Coffee Assistant (CLI)**
- Two terminal apps: AI barista + order management
- Exercised: Hyperswarm, bare-rpc, Hyperbee, QVAC tool calling
- Found: bare-rpc has a non-obvious low-level API, Zod v4 required

**App 2: Coffee Assistant (Desktop UI)**
- Same concept, rebuilt as Pear Desktop apps with React
- **Found 6 critical bugs** in our knowledge:
  - P2P modules crash in the renderer (need a worker process)
  - Worker files served as web pages (need `pear.unrouted`)
  - `TextEncoder` doesn't exist in Bare runtime
  - Communication fails without `Pear.worker.pipe()`
  - Worker timeouts without early `workerReady` signal
  - `bare-*` modules must be explicitly installed

All 6 fixes were extracted into the agent pack.

**Result:** After the update, the same app was built with just **2 prompts**
and **zero errors**.

---

## Slide 15: From 6 Bugs to 0 Bugs

| Metric | Before Agent Pack | After Agent Pack |
|--------|-------------------|------------------|
| Prompts to build Coffee Assistant UI | 50+ | 2 |
| Setup errors encountered | 6 critical | 0 |
| Time to working app | Hours of debugging | Minutes |
| Developer frustration | High | None |

**This is the difference between "our stack is too hard" and
"this is the easiest way to build a P2P app."**

---

## Slide 16: What's in the Agent Pack (Detail)

### Modules — "What is this and how do I use it?"
Each Holepunch/Tether module documented with API reference, gotchas,
and Bare-compatible code examples.

### Skills — "Build this specific thing"
Step-by-step guides with full working code:
- Pear Desktop App (with worker pattern)
- P2P RPC communication
- QVAC Chat with tool calling
- Offline-first storage
- File sharing, encryption, payments

### Recipes — "How do I do this one thing?"
Focused patterns: kv-cache, NDJSON messaging, topic creation, etc.

### Components — "Copy-paste this into your project"
Battle-tested TypeScript: chat session, model manager, swarm manager, etc.

### Verified Versions — "These packages actually work together"
Pinned versions from working apps. No guessing.

### Troubleshooting — "I see this error, what do I do?"
Real error messages → real solutions. Copy-pasted from actual debugging.

---

## Slide 17: Multi-Tool Support

The same knowledge base generates configs for every major AI coding tool:

| Tool | Format | What Gets Generated |
|------|--------|-------------------|
| **Claude Code** | `.claude/` + `CLAUDE.md` | Rules, skills with resources, hooks |
| **Cursor** | `.cursor/rules/*.mdc` | Description-triggered rules, glob-scoped modules |
| **OpenCode** | `opencode.json` + `.opencode/` | Skills, agents (planner, P2P expert, AI expert) |

Developers use their preferred tool. The knowledge adapts.

---

## Slide 18: The Website — unstoppable.dev

Landing page + documentation hub.

- **Getting Started** — From zero to running app in 3 steps
- **Module Docs** — Links to all Holepunch & Tether documentation
- **Showcase** — Community projects (coming soon)

Positions Tether as a developer platform, not just a token.

---

## Slide 19: Roadmap — Stack Coverage

We track knowledge across 4 categories. Each must be battle-tested:

```
                    Battle-tested    Docs only    Not covered
  Platform          ███░░░░░░        3/9
  QVAC (AI)         ██████░░░░░      6/17
  P2P & Data        ███████░░░░░░░░  7/15
  WDK (Payments)    ░░░░░░           0/6
                    ─────────────────────────
  Total             21/54  (39%)
```

**What's validated:** Pear Desktop, Bare Runtime, Hyperswarm, bare-rpc,
Hyperbee, QVAC chat + streaming + tool calling

**What's next — by category:**

| Category | Key gaps to fill |
|----------|-----------------|
| **Platform** | Pear Terminal, Expo Bare (mobile), pear stage/release |
| **QVAC** | Vision, Transcription, RAG/Embeddings, Delegated Inference, TTS |
| **P2P** | HyperDB + multi-writer, Hyperdrive, SecretStream, Protomux |
| **WDK** | Everything — wallet creation, send/receive, payment flows |

7 planned reference apps will take coverage from **39% → 81%**.

---

## Slide 20: The Bigger Picture — Today

**Today:** Developers struggle to build with Holepunch + QVAC + WDK.

**With the Unstoppable Stack:**

1. Run `us init`
2. Open in Cursor / Claude / OpenCode
3. Say "Build me a P2P encrypted chat with local AI"
4. Get a working app

**This is how we get adoption.**

Not by writing more docs. Not by hoping developers figure it out.
By making AI do the hard part for them.

---

## Slide 21: The Vision — Beyond the Toolchain

But the Unstoppable Stack isn't just a developer tool.

It's the foundation for a **platform**.

```
Phase 1 (now)     → Toolchain: CLI + Agent Pack + Website
Phase 2 (next)    → Unstoppable Node: Personal sync + AI hub
Phase 3           → Unstoppable Auth: Local-first identity
Phase 4 (future)  → Unstoppable Cloud: Hosted services + subscriptions
```

---

## Slide 22: Unstoppable Node — The Bridge to Cloud

Before the cloud, there's a simpler step: a desktop app that syncs with
**any app** built with the Unstoppable Stack.

```
┌──────────┐  ┌──────────┐  ┌──────────┐
│ Coffee   │  │ Notes    │  │ Finance  │
│ App      │  │ App      │  │ App      │
└────┬─────┘  └────┬─────┘  └────┬─────┘
     │             │             │
     └──────┬──────┴──────┬──────┘
            │  Hyperswarm │
     ┌──────▼─────────────▼──────┐
     │                           │
     │    Unstoppable Node      │
     │                           │
     │  Data Sync (Hyperbee,     │
     │    HyperDB, Hypercore)    │
     │  File Sync (Hyperdrive)   │
     │  AI Provider (QVAC)       │
     │                           │
     └───────────────────────────┘
```

Three services in one app:

---

## Slide 23: Node — What It Does

**1. Data Sync** — Replicates your apps' Hyperbees, HyperDBs, and Hypercores.
Your data is backed up and always available, even when the original app is closed.

**2. File Sync** — Replicates Hyperdrives. Your files are seeded 24/7.
Other peers can access them even when your app is offline.

**3. AI Provider** — This is the exciting one.

QVAC has **built-in P2P delegation**. The Node runs `startQVACProvider()`
with powerful models (7B, 13B). Your phone app calls
`loadModel({ delegate: { topic, providerPublicKey } })`.

```
Phone (1B model)              Desktop Node (7B model)
┌─────────────────┐           ┌──────────────────────┐
│                 │   P2P     │                      │
│  "Analyze this" │──────────►│  Runs 7B model       │
│                 │           │  Streams tokens back  │
│  Gets 7B-quality│◄──────────│                      │
│  response       │  tokens   │  GPU: RTX 4090       │
└─────────────────┘           └──────────────────────┘
```

**Same API.** The app calls `completion()` exactly the same way whether
running locally or delegated. If the Node is offline, `fallbackToLocal: true`
uses the on-device model.

---

## Slide 24: From Node to Cloud — Same Protocol

The Node is your **personal cloud**. The actual Cloud is the **hosted version**.

```
         Node (your PC)             Cloud (Tether)
        ┌──────────────┐            ┌──────────────┐
        │ 7B model     │            │ 70B+ model   │
        │ 1 TB storage │            │ Unlimited    │
        │ Your network │            │ Always on    │
        │ Free         │            │ Subscription │
        └──────┬───────┘            └──────┬───────┘
               │                           │
               │    Same protocol:         │
               │    delegate: {            │
               │      topic,              │
               │      providerPublicKey   │
               │    }                      │
               │                           │
               └───────────┬───────────────┘
                           │
                   Apps don't change.
                   Just swap topic + key.
```

**The app code is identical.** Users start with the free Node.
When they want more power, they upgrade to the Cloud subscription.
The developer changes nothing.

---

## Slide 25: Unstoppable Auth

For all of this to work across apps, users need an identity.

**Unstoppable Auth** — a local-first identity system:

- Keypair-based (no email, no password, no auth server)
- Works across all apps built with the stack
- Device linking and recovery
- The Node and Cloud know who you are across apps

**For developers:** One line — `import { auth } from '@unstoppable/auth'`
**For users:** One identity across all their unstoppable apps.

---

## Slide 26: Unstoppable Subscriptions — The Business Model

P2P apps are powerful but limited by the device.
**Subscriptions** remove those limits:

| | Free (Node) | Subscriber (Cloud) |
|---|---|---|
| **AI** | Your desktop GPU (3B-13B) | Tether GPUs (70B+) |
| **Data** | Backed up locally | Cloud-replicated, always on |
| **Files** | Seeded when Node is running | Seeded 24/7 |
| **Cost** | Free | USDt subscription via WDK |

---

## Slide 27: How It Works — Zero Infrastructure for Builders

The key insight: **app builders don't need any servers.**

```
┌──────────────┐                    ┌──────────────────────┐
│  App Builder  │                    │  Unstoppable Cloud   │
│              │   builds app        │  (run by Tether)     │
│  Uses the    │   with the stack    │                      │
│  Unstoppable │ ──────────────────► │  • Inference (QVAC)  │
│  Stack       │                     │  • Data backup       │
│              │   ◄──── revenue ─── │  • File seeding      │
│              │   share from subs   │  • Subscription mgmt │
└──────────────┘                     └──────────────────────┘
                                              ▲
                                              │ subscription
                                              │ payment (USDt)
                                     ┌────────┴───────┐
                                     │     Users       │
                                     │  Pay for more   │
                                     │  powerful apps   │
                                     └────────────────┘
```

1. Developer builds an app using the stack (free, no servers)
2. Users get the free Node for local sync + AI delegation
3. Users who want more power subscribe to the Cloud (USDt via WDK)
4. Tether provides the infrastructure
5. **Revenue is shared with the app builder**

**The builder never provisions a server. They just build the app.**

---

## Slide 28: The Flywheel

```
  Better tooling (Unstoppable Stack)
           │
           ▼
  More developers build apps
           │
           ▼
  More apps in the ecosystem
           │
           ▼
  More users discover unstoppable apps
           │
           ▼
  More subscribers (revenue)
           │
           ├──► Revenue share → more developers
           │
           └──► Fund better tooling, more models, more storage
                     │
                     └──► Back to top ↑
```

And every subscription payment flows through **USDt + WDK**.

---

## Slide 29: The Full Stack Vision

| Layer | What | Phase |
|-------|------|-------|
| **Apps** | Health, Finance, AI Workbench, Community, ... | Now (devs build) |
| **Toolchain** | CLI, Agent Pack, Website | Phase 1 (done) |
| **Node** | Personal sync + AI delegation hub | Phase 2 (next) |
| **Identity** | Unstoppable Auth (local-first, cross-app) | Phase 3 |
| **Cloud** | Hosted Node: inference, storage, seeding | Phase 4 |
| **Payments** | Subscriptions + revenue share via WDK + USDt | Phase 4 |
| **Foundation** | Holepunch P2P + QVAC AI + WDK Wallet | Exists today |

Each phase unlocks the next:
- **Toolchain** → developers can build apps
- **Node** → users can sync and get better AI locally
- **Auth** → identity works across apps
- **Cloud** → subscriptions, revenue, ecosystem

---

## Slide 30: Why This Matters for Tether

- **Developer adoption** — AI-native tooling removes the #1 barrier
- **Ecosystem growth** — More apps = more users = more USDt utility
- **Recurring revenue** — Cloud subscriptions for inference, storage, seeding
- **USDt integration** — Every payment uses USDt via WDK
- **Competitive advantage** — No other P2P stack has AI tooling, a personal
  sync hub, OR a business model for builders
- **The AI shift** — We ride the wave instead of fighting it
- **Progressive path** — Node (free, local) → Cloud (paid, hosted).
  Users upgrade naturally as they need more power
- **Brand** — Tether as a developer platform, not just a stablecoin

---

## Slide 31: The Ask

1. **Continue building** — 7 reference apps to validate the full stack
   (39% → 81% coverage)
2. **Build the Node** — Personal sync + AI delegation app, the stepping
   stone to the Cloud
3. **Collaboration with Holepunch** — Joint effort on docs and Auth design
4. **Launch unstoppable.dev** — Public beta with CLI and agent pack
5. **Explore Cloud services** — Subscription tiers and revenue share model
6. **Community** — Discord/Telegram for early adopters

---

## Slide 32: One More Thing

> *Demo: Scaffold a project, open in Cursor, type one prompt,
> watch a P2P desktop app appear*

"Build me a P2P encrypted chat app with no servers."

**That's the unstoppable stack.**
