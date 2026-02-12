# Website (unstoppable.dev)

**Goal:** Developer-facing site with polished landing, getting started, docs, showcase.

**Current state:** Next.js app exists with base pages and components. Needs polish.

**Key files:**
- `packages/website/src/app/page.tsx` — Landing
- `packages/website/src/app/getting-started/page.tsx` — Guide
- `packages/website/src/app/docs/page.tsx` — Docs
- `project-planning/Website Planning.md` — Wireframes + design tokens

---

## Pages Status

| Page | Exists | Status |
|------|--------|--------|
| Landing (`/`) | Yes | Needs hero, Powered By, How It Works sections |
| Getting Started (`/getting-started`) | Yes | Needs full content |
| Docs (`/docs`) | Yes | Needs module sub-pages |
| Showcase (`/showcase`) | Yes | Placeholder — "coming soon" |

---

## Next Up

| # | Task | Details | Effort |
|---|------|---------|--------|
| 1 | **Landing hero** | Terminal install command, bold copy, CTA buttons | Medium |
| 2 | **Powered By section** | Holepunch + Tether logos, 4 tech cards | Medium |
| 3 | **How It Works section** | 3-step flow with visual cards | Small |
| 4 | **Getting Started content** | Full guide: prerequisites → install → scaffold → run | Medium |
| 5 | **Docs module stubs** | Sub-page per module, placeholder content OK | Medium |

---

## Blocked / Dependencies

- Logo assets needed (Holepunch, Tether, Pear, QVAC, WDK)
- Full module docs deferred until agent pack content is mature
- Showcase depends on real apps

---

## Recently Completed

| Date | Task |
|------|------|
| 2026-02 | Website planning doc with wireframes |
| 2026-02 | Next.js app scaffolded (App Router, Tailwind, shadcn/ui) |
| 2026-02 | Components: navbar, footer, code-block, typing-prompt |
