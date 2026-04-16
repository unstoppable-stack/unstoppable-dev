# Website (unstoppable.dev)

**Goal:** Developer-facing site with polished landing, getting started, docs, roadmap, showcase.

**Current state:** All major pages complete. Landing, Getting Started, Docs, and Roadmap fully built with Node/Search/Agent coverage. Showcase is a placeholder.

**Key files:**
- `packages/website/src/app/page.tsx` — Landing
- `packages/website/src/app/getting-started/page.tsx` — Guide
- `packages/website/src/app/docs/page.tsx` — Docs
- `packages/website/src/app/roadmap/page.tsx` — Roadmap
- `packages/website/src/app/showcase/page.tsx` — Showcase
- `planning/features/website.md` — Wireframes + design tokens

---

## Pages Status

| Page | Exists | Status |
|------|--------|--------|
| Landing (`/`) | Yes | Complete — hero, value pillars (4), powered by, how it works (4 steps), modules grid, Node architecture, ecosystem, CTA |
| Getting Started (`/getting-started`) | Yes | Complete — prerequisites, install, scaffold (platforms + features), vibe-code, connect to Node, what's next |
| Docs (`/docs`) | Yes | Complete — products (Node, Search, Agent), modules (P2P, Data, AI, Mobile), quick links |
| Roadmap (`/roadmap`) | Yes | Complete — workstreams, phases timeline, Node architecture, stack coverage with progress bars |
| Showcase (`/showcase`) | Yes | Placeholder — "coming soon" with GitHub submission link |

---

## Next Up

| # | Task | Details | Effort |
|---|------|---------|--------|
| 1 | **Logo assets** | Real Holepunch + Tether logos instead of letter placeholders | Small |
| 2 | **SEO / meta tags** | Open Graph images, Twitter cards | Small |
| 3 | **Showcase content** | Populate with reference apps once stable | Medium |
| 4 | **Per-module doc pages** | Deep docs per module when agent pack content matures | Large |

---

## Blocked / Dependencies

- Logo assets needed (Holepunch, Tether, Pear, QVAC, WDK)
- Per-module deep docs deferred until agent pack content is mature
- Showcase depends on real community apps

---

## Recently Completed

| Date | Task |
|------|------|
| 2026-03-27 | Docs page: products section (Node, Search, Agent), expanded modules (Hypercore, Corestore, SecretStream, Hyperbee), fixed quick links |
| 2026-03-27 | Getting Started: platforms + features, `us scaffold` command, Step 4 (Connect to Node), Codex added |
| 2026-03-27 | Landing: 4th value pillar (Node), Step 4 (Connect to Node), Node architecture section with 4 services, ecosystem cards, Node typing prompts |
| 2026-03-27 | Roadmap page: workstreams, phases timeline, Node architecture, coverage progress bars |
| 2026-03-27 | Navbar + footer: Roadmap link added |
| 2026-02 | Website planning doc with wireframes |
| 2026-02 | Next.js app scaffolded (App Router, Tailwind, shadcn/ui) |
| 2026-02 | Components: navbar, footer, code-block, typing-prompt |
