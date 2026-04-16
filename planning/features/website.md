# Website Planning — unstoppable.dev

## Design Direction

**Vibe:** Dark, developer-focused, GitHub-style with bold typography.

**Inspired by:**
- **opencode.ai** — Clean, action-first landing page with a terminal install command front-and-center, feature checkmarks, FAQ accordion, social proof numbers
- **tether.io** — Bold hero copy, pillar-based module showcase, "numbers speak louder" stats, confident brand voice
- **qvac.tether.io** — Dark theme, code-first, dramatic "Local AI. Infinite Intelligence. No Compromise." energy

**Stack:** Next.js 14+ (App Router), Tailwind CSS, shadcn/ui

---

## Pages (POC Scope)

### 1. Landing Page (`/`)

```
┌─────────────────────────────────────────────┐
│  Navbar: Logo | Getting Started | Docs |    │
│          Showcase | [GitHub] [Get Started]   │
├─────────────────────────────────────────────┤
│  HERO                                       │
│  "Build Unstoppable Apps"                   │
│  P2P. Local AI. Crypto Payments.            │
│  No servers. No gatekeepers.                │
│                                             │
│  ┌─────────────────────────────────────┐    │
│  │ $ npm install -g @unstoppable-stack/cli │    │
│  └─────────────────────────────────────┘    │
│  [Get Started]  [View on GitHub]            │
│                                             │
│  built with Holepunch & Tether technology   │
├─────────────────────────────────────────────┤
│  VALUE PILLARS (3 cards)                    │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐    │
│  │ P2P by   │ │ Local AI │ │ Crypto   │    │
│  │ Default  │ │ Private  │ │ Payments │    │
│  └──────────┘ └──────────┘ └──────────┘    │
├─────────────────────────────────────────────┤
│  POWERED BY                                 │
│                                             │
│  [Holepunch logo]     [Tether logo]         │
│                                             │
│  ┌─────────┐ ┌─────────┐ ┌─────┐ ┌─────┐  │
│  │ Pear    │ │ P2P     │ │QVAC │ │ WDK │  │
│  │ Runtime │ │ Stack   │ │     │ │     │  │
│  └─────────┘ └─────────┘ └─────┘ └─────┘  │
├─────────────────────────────────────────────┤
│  HOW IT WORKS (3 steps)                     │
│  1. Install the CLI                         │
│  2. Scaffold your app                       │
│  3. Vibe-code with your AI assistant        │
├─────────────────────────────────────────────┤
│  STACK MODULES GRID                         │
│  Pear [HP] | Bare [HP] | Hyperswarm [HP]   │
│  HyperDB [HP] | Hyperdrive [HP] |          │
│  QVAC [T] | WDK Wallet [T] | Expo Bare[HP]│
├─────────────────────────────────────────────┤
│  CTA                                        │
│  "Start building unstoppable apps today"    │
│  [Get Started]                              │
├─────────────────────────────────────────────┤
│  FOOTER                                     │
│  Built on [Holepunch logo] & [Tether logo]  │
│  Links | GitHub | Twitter                   │
└─────────────────────────────────────────────┘
```

### 2. Getting Started (`/getting-started`)
- Prerequisites (Node.js 20+)
- Install CLI: `npm install -g @unstoppable-stack/cli`
- Interactive flow walkthrough (choose AI assistant)
- Terminal output preview
- "Next steps" — open editor, start building

### 3. Documentation (`/docs`)
- Overview: What is the Unstoppable Stack
- Module sub-pages (`/docs/[module]`): Pear, Bare, Hyperswarm, HyperDB, Hyperdrive, QVAC, WDK, Expo Bare
  - Each: what it does, when to use it, quick-start snippet, link to official docs
- CLI reference (`/docs/cli`)
- Agent Pack overview (`/docs/agent-pack`)
- POC: skeleton pages with placeholders are acceptable

### 4. Showcase (`/showcase`)
- Grid layout for projects built with the stack
- POC: "Coming soon" placeholder with CTA to submit a project

### 5. Blog (`/blog`) — deferred to Phase 2

---

## Partner / Stack References

### Parent Brands (logos in "Powered By" section + footer)

| Brand | Site | Role |
|-------|------|------|
| **Holepunch** | https://holepunch.to/ | P2P infrastructure provider |
| **Tether** | https://tether.io/ | AI + Payments provider |

### Technology Cards (in "Powered By" section + docs)

| Technology | One-liner | Official Site |
|------------|-----------|---------------|
| **Pear Runtime** | Zero-infrastructure P2P apps for Desktop, Terminal & Mobile | https://docs.pears.com/ |
| **Holepunch P2P** | Hypercore, Hyperswarm, HyperDB, Hyperdrive — the modular P2P stack | https://docs.holepunch.to/ |
| **QVAC** | Local AI inference. Private, cross-platform, P2P native. | https://qvac.tether.io/ |
| **WDK Wallet** | Self-custodial Bitcoin & Tether wallet toolkit | https://wallet.tether.io/ |

### Where Logos Appear

1. **Landing hero** — subtle "built with Holepunch & Tether" below install command
2. **Powered By section** — parent brand logos + 4 technology cards with links
3. **Stack modules grid** — each module tagged with parent badge (HP or T)
4. **Docs module pages** — parent technology logo at top, link to official docs
5. **Footer** — "Built on technology by" + Holepunch + Tether logos

### Logo Assets (store in `packages/website/public/logos/`)

- `holepunch.svg` — from holepunch.to
- `pear.svg` — from docs.pears.com
- `qvac.svg` — from qvac.tether.io
- `wdk.svg` — from wallet.tether.io
- `tether.svg` — from tether.io

---

## Layout & Components

| Component | Description |
|-----------|-------------|
| **Navbar** | Logo + links (Home, Getting Started, Docs, Showcase) + GitHub link + "Get Started" CTA |
| **Footer** | Links, partner logos, GitHub, socials |
| **Hero** | Full-width dark section, terminal-style code block |
| **ValueCard** | Icon + title + description |
| **TechCard** | Logo + name + one-liner + external link |
| **ModuleCard** | Icon + name + one-liner + parent badge, links to docs |
| **StepCard** | Number + icon + title + description |
| **CodeBlock** | Syntax-highlighted, copy-to-clipboard |
| **DocsSidebar** | Left sidebar navigation for `/docs` |

---

## Design Tokens

- **Background**: Near-black (`#0a0a0a`)
- **Surface**: Slightly lighter (`#141414`)
- **Border**: Subtle (`#262626`)
- **Text primary**: White (`#fafafa`)
- **Text secondary**: Gray (`#a1a1aa`)
- **Accent**: Vibrant green/teal (TBD — aligned with "unstoppable" energy)
- **Code blocks**: Dark surface with syntax colors
- **Typography**: Geist Sans (body) + Geist Mono (code)

---

## Technical Notes

- Next.js App Router with static generation (most pages are static)
- MDX for docs pages (easy to author, supports components)
- shadcn/ui for UI primitives (Button, Card, Tabs, Accordion)
- Responsive / mobile-friendly from day 1
- Deploy to Vercel (or static export)

---

## POC Scope vs Later

### Build Now (POC)
- Landing page — fully polished
- Getting Started — complete guide
- Docs skeleton — overview + module stubs
- Showcase — "coming soon" placeholder

### Defer to Phase 2
- Full module docs content
- Blog
- Cloud services dashboard
- Docs search
- Interactive CLI demo
