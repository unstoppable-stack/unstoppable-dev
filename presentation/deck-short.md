# The Unstoppable Stack — Presentation (17 slides, ~10 min)

## Narrative Arc

1. **The World of Vibe-Coding** (personal story)
2. **The Problem** (AI fails with our stack)
3. **The Insight** (teach the AI — Unstoppable Stack)
4. **Proof** (journey from 50+ prompts to 2)
5. **Strategy** (how knowledge is built, Vault, Cloud, business)
6. **The Ask**

---

## Slide 1 — Title

**The Unstoppable Stack**
AI-native tooling for building apps with Holepunch P2P + QVAC AI + WDK Wallet

Simon Iribarren

---

## Slide 2 — Vibe-Coding Has Changed Everything

- I've been building apps with AI assistants — the speed is unreal
- Yoga Studio app for my mom in Chile: class management, attendance, payments. Built in hours.
- Personal Finance app: expenses, income, Bitcoin tracking. Same approach.
- AI is incredibly good at React, Next.js, Postgres, Stripe...
- Any developer can build a centralized full-stack app in minutes.

---

## Slide 3 — But Not With Our Stack

Then I tried Holepunch + QVAC + WDK. Same AI falls apart.

**P2P / Platform:**
- Doesn't know which libraries to pick — dozens of Holepunch modules, AI can't find the simplest path
- Node / Bare incompatibilities — uses Node APIs that don't exist in Bare runtime
- Can't set up a Pear Desktop app — worker process, React, TypeScript, build pipeline
- Wrong package versions — guesses versions that don't exist

**AI / QVAC:**
- Doesn't handle context overflow — hits token limits, no trimming strategy
- Streaming done wrong — drops chunks, breaks UI updates
- Think tags not handled — raw `<think>` tags leak into user UI
- Vision, TTS, transcription? — hasn't even been tried, more trial & error ahead

> "If developers can vibe-code with any stack but can't with ours — they won't adopt our technologies."

---

## Slide 4 — The Adoption Risk

Comparison table:

|                        | Centralized (React/AWS)  | Our Stack (Holepunch/QVAC/WDK) |
|------------------------|--------------------------|--------------------------------|
| AI builds correctly?   | Yes, effortlessly        | No, constant errors            |
| Time to working app    | Minutes                  | Hours of debugging             |
| Infrastructure needed  | Servers ($50-5K/mo)      | None                           |
| Adoption trend         | Accelerating             | At risk                        |

- Our stack has structural advantages — no servers, no infra costs, private by default
- But none of that matters if AI can't help developers use it
- Every day AI gets better at centralized — the gap widens

---

## Slide 5 — The Idea

> What if we could teach AI how to use our stack correctly?

A structured, battle-tested knowledge base that any AI assistant can use to build Holepunch + QVAC + WDK apps.

```
npx create-unstoppable-app
```

---

## Slide 6 — How I Proved It Works (Part 1 — CLI)

I built the same app — **Coffee Assistant** — multiple times.

### CLI App — 3 attempts before it worked
- Two P2P terminal apps with AI: Hyperswarm + bare-rpc + QVAC + Hyperbee
- **Attempt 1:** Complete failure. AI couldn't set up P2P.
- **Attempt 2:** Partial. Got stuck on RPC + streaming.
- **Attempt 3:** Finally working after dozens of prompts and heavy debugging.
- After getting it working, asked AI to **identify reusable modules** — extract patterns for other apps.
- This became the first seed of the agent pack knowledge.

---

## Slide 7 — How I Proved It Works (Part 2 — Desktop)

### Desktop App — Attempt 1
- Same app as Pear Desktop + React UI.
- Setting up Pear was **extremely difficult**. Had to point AI to the QVAC Workbench app as reference just to get the project scaffolded.
- Most devs won't have a reference app to copy from.
- At least the AI could **reuse the P2P logic** from the CLI — that knowledge carried over.
- This time, better process — **documenting every fix** as I went, extracting patterns systematically.

### Desktop App — Attempt 2
- Fresh project. Agent pack loaded with all extracted knowledge.
- **1 prompt to plan. 1 prompt to confirm.**
- Fully working app. Decent React UI. **Zero debugging.**
- **It felt like magic.**

---

## Slide 8 — The Result

| Without the Unstoppable Stack      | With the Unstoppable Stack         |
|------------------------------------|------------------------------------|
| **5 attempts** (3 CLI + 1 desktop) | **2 prompts** (plan + confirm)     |
| Dozens of prompts each             | Zero errors                        |
| Constant debugging                 | Working app with UI. Felt like magic. |

> This is the difference between "our stack is too hard" and "this is the easiest way to build a P2P app."

---

## Slide 9 — How the Knowledge Is Built

Not docs from docs. **Patterns extracted from real, working apps.**

```
Build real app → hit bugs → document every fix → extract into agent pack
                                    ↓
                  Scaffold fresh project → vibe-code same app
                                    ↓
                    Works first try? → Knowledge validated ✓
                    Fails?          → Fix gaps, repeat
```

The agent pack today:
- 12 module docs, 10 skills, 18 recipes
- 8 reusable TypeScript components
- Pinned verified package versions
- Real error messages → real fixes
- Works with Claude Code, Cursor, OpenCode

---

## Slide 10 — Stack Coverage

Track every capability across 4 categories:

| Category   | Battle-tested | Total | Coverage |
|------------|---------------|-------|----------|
| Platform   | 3             | 9     | 33%      |
| QVAC (AI)  | 6             | 17    | 35%      |
| P2P & Data | 7             | 15    | 47%      |
| WDK        | 0             | 6     | 0%       |
| **Total**  | **16**        | **47**| **39%**  |

After 7 more reference apps → **81%** battle-tested.

---

## Slide 11 — The Opportunity: Unstoppable Vault

A desktop app that syncs with any Unstoppable Stack app:

| Service       | What it does                                          |
|---------------|-------------------------------------------------------|
| Data Sync     | Replicates Hyperbees, HyperDBs — always backed up    |
| File Sync     | Replicates Hyperdrives — files seeded 24/7            |
| AI Provider   | Runs 7B+ models — phone apps delegate inference P2P   |

```
Phone (1B model) ──── P2P delegation ────►  Desktop Vault (7B model)
                 ◄──── streams tokens ────
If Vault offline → falls back to on-device model automatically
```

---

## Slide 12 — Vault → Cloud (Same Protocol)

| Vault (Free)                    | Cloud (Subscription)            |
|---------------------------------|---------------------------------|
| Your desktop                    | Tether-hosted                   |
| Your GPU (7-13B models)         | H100 GPUs (70B+ models)         |
| Your storage                    | Unlimited storage, always on    |
| Free forever                    | USDt via WDK                   |

```javascript
// App code is identical. Just swap topic + key.
loadModel({
  delegate: { topic: vaultOrCloudTopic, providerPublicKey: vaultOrCloudKey }
})
```

---

## Slide 13 — Business Model

```
Developer                            Tether Cloud
  builds app ──────────────────►  runs inference
  (zero servers, zero infra)        stores data / seeds files
  ◄──── revenue share ──────────  charges subscription in USDt (WDK)
                                          ▲
                                          │ USDt
                                        Users
```

- Builders pay $0 for infrastructure
- Users pay in USDt for more power
- Builders get revenue share
- More apps → more users → more USDt utility

---

## Slide 14 — Phases

| # | Phase                 | Status   |
|---|-----------------------|----------|
| 1 | Toolchain — CLI + Agent Pack + Website | ✅ Done |
| 2 | Vault — Personal sync hub + AI delegation | 🟣 Designed |
| 3 | Auth — Local-first identity across apps | Planned |
| 4 | Cloud + Subscriptions — Hosted Vault, USDt | Vision |

Each phase unlocks the next. The foundation exists today.

---

## Slide 15 — The Vision

A factory of unstoppable apps — powered by our infrastructure.

```
              APP BUILDERS
    ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌─────┐
    │Coffee│ │ Chat │ │Notes │ │Voice │ │ ... │
    └──┬───┘ └──┬───┘ └──┬───┘ └──┬───┘ └──┬──┘
       │        │        │        │        │
       └────────┴────────┴────────┴────────┘
        [ HOLEPUNCH P2P ] [ QVAC AI ] [ WDK WALLET ]
               Deploy to: Pear | App Store | Play Store | Web
                              │
                     ▼ users connect ▼
                              │
    ┌─────────────────┐              ┌─────────────────┐
    │ Unstoppable     │  UNSTOPPABLE │ Unstoppable     │
    │ Vault           │◄──── AUTH ──►│ Cloud           │
    │                 │  same id,    │                 │
    │ Your desktop    │  same proto  │ Tether-hosted   │
    │ Free forever    │              │ Subscription    │
    │ AI (7B), backup │              │ AI (70B+), 24/7 │
    └─────────────────┘              └─────────────────┘
              │                               │
              └───── USDt subscriptions ──────┘
                     → revenue share to builders
```

- Builders create apps with QVAC + WDK + Holepunch inside
- Deploy to Pear, App Store, Play Store, or Web
- Users connect to their **Vault** (free) or upgrade to **Cloud** (subscription)
- **Unstoppable Auth** — same identity, same protocol across both
- Subscriptions in USDt → revenue share back to app builders

---

## Slide 16 — The Ask

1. **Continue building** — 7 reference apps to reach 81% stack coverage
2. **Build the Vault** — bridges to Cloud, validates 7 stack gaps at once
3. **Collaborate with Holepunch** — joint effort on docs + Auth
4. **Launch unstoppable.dev** — public beta

---

## Slide 17 — Demo / Closing

> One prompt to plan. One prompt to build.

```
npx create-unstoppable-app
```

**That's the unstoppable stack.**
