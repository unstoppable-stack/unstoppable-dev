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
npx create-unstoppable-app
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

## Slide 19: Roadmap — What's Next

**Currently validated:**
Pear Desktop, Bare Runtime, Hyperswarm, bare-rpc, Hyperbee, QVAC (chat + tools)

**Next apps to build (to validate remaining modules):**

| App | Validates |
|-----|-----------|
| P2P File Sync | Hyperdrive, Corestore |
| Collaborative Notes | HyperDB, multi-writer, offline-first |
| Encrypted Chat | SecretStream, Protomux |
| Mobile P2P App | Expo Bare, bare-pack |
| Payment App | WDK Wallet |

Each app follows the same loop: build → find bugs → fix knowledge → validate.

---

## Slide 20: The Bigger Picture — Today

**Today:** Developers struggle to build with Holepunch + QVAC + WDK.

**With the Unstoppable Stack:**

1. Run `npx create-unstoppable-app`
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
Phase 2 (next)    → Unstoppable Auth: Local-first identity
Phase 3 (future)  → Unstoppable Subscriptions: Cloud services for P2P apps
```

---

## Slide 22: Unstoppable Auth

Today, every app reinvents authentication. And most P2P apps have
no authentication at all.

**Unstoppable Auth** is a local-first identity system:

- Identity lives on your device (keypair-based, no email/password)
- Works across apps built with the stack
- Device linking and recovery (no seed phrases)
- Optional verification (prove you're the same person across apps)

**For developers:** Add `unstoppable-auth` to your app → users get identity
for free. No auth server. No database of passwords.

**For users:** One identity across all unstoppable apps. Their data,
their keys, their control.

---

## Slide 23: Unstoppable Subscriptions — The Business Model

Here's where it gets interesting.

P2P apps are powerful but limited by the device:
- Small AI models (3B) instead of powerful ones (70B+)
- Storage limited to local disk
- Files only available when the device is online

**Unstoppable Subscriptions** remove these limits:

| Free (local-only) | Subscriber |
|--------------------|-----------|
| On-device AI (3B models) | Cloud inference (70B+ models) |
| Local storage only | Cloud-backed data persistence |
| Files available when online | Files always seeded & available |
| Basic features | Premium features per app |

---

## Slide 24: How It Works — Zero Infrastructure for Builders

This is the key insight: **app builders don't need any servers.**

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

1. Developer builds an app using the stack (free, no servers needed)
2. Users use the app for free (local-only mode)
3. Users who want more power subscribe (paid via WDK / USDt)
4. Tether provides the cloud services (inference, storage, seeding)
5. **Revenue is shared with the app builder**

**The builder never provisions a server. Never manages billing.
Never runs infrastructure. They just build the app.**

---

## Slide 25: The Flywheel

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

## Slide 26: The Full Stack Vision

| Layer | What | Who |
|-------|------|-----|
| **Apps** | Health, Finance, AI Workbench, Community, ... | Developers (anyone) |
| **Toolchain** | CLI, Agent Pack, Website | unstoppable.dev |
| **Identity** | Unstoppable Auth (local-first, cross-app) | Tether / Holepunch |
| **Cloud Services** | Inference, storage, file seeding | Tether |
| **Payments** | Subscriptions, revenue share | WDK + USDt |
| **Foundation** | Holepunch P2P + QVAC AI + WDK Wallet | Tether + Holepunch |

**From the bottom up:**
- Holepunch provides the P2P foundation
- QVAC provides local AI
- WDK provides payments
- The Unstoppable Stack makes it all accessible
- Subscriptions make it sustainable
- Developers get rewarded
- Users get unstoppable apps

---

## Slide 27: Why This Matters for Tether

- **Developer adoption** — AI-native tooling removes the #1 barrier
- **Ecosystem growth** — More apps = more users = more USDt utility
- **Recurring revenue** — Subscriptions for cloud inference, storage, seeding
- **USDt integration** — Every subscription payment uses USDt via WDK
- **Competitive advantage** — No other P2P stack has AI tooling OR a business model for builders
- **The AI shift** — We ride the wave instead of fighting it
- **Brand** — Tether as a developer platform, not just a stablecoin

---

## Slide 28: The Ask

1. **Support to continue building** — 5 more reference apps to validate
   the full stack
2. **Collaboration with Holepunch** — Joint effort on documentation and
   Unstoppable Auth design
3. **Launch unstoppable.dev** — Public beta with the CLI and agent pack
4. **Explore cloud services** — Define the subscription tiers and
   revenue share model
5. **Community** — Discord/Telegram for early adopters

---

## Slide 29: One More Thing

> *Demo: Scaffold a project, open in Cursor, type one prompt,
> watch a P2P desktop app appear*

"Build me a P2P encrypted chat app with no servers."

**That's the unstoppable stack.**
