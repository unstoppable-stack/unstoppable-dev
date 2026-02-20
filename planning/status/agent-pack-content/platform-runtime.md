# Platform / Runtime — Content Status

**3 battle-tested, 0 docs-only, 6 not covered** out of 9 items.

---

## Pear Desktop — DONE

| Item | Status | Agent Pack File |
|------|--------|----------------|
| Renderer/worker split | Battle-tested | skills/pear-desktop-app/ |
| pear config (type, pre, routes, gui) | Battle-tested | skills/pear-desktop-app/SKILL.md |
| Bare runtime (API surface, bare-* deps) | Battle-tested | modules/bare.md |

No further work needed. Well covered by coffee-assistant-ui.

---

## Pear Terminal — NOT COVERED

| Item | Status | Notes |
|------|--------|-------|
| Terminal app basics | Not covered | No worker needed (all Bare) |
| `pear.type: "terminal"` config | Not covered | Simpler than desktop |
| stdin/stdout interaction | Not covered | Direct pipe, no renderer |
| Terminal app + P2P | Partial | coffee-assistant ran as Node, not Pear |

### Next Up

| # | Task | Effort |
|---|------|--------|
| 1 | Convert coffee-assistant CLI to a proper Pear terminal app | Medium |
| 2 | Document differences from desktop (no renderer, no worker bridge) | Small |

---

## Mobile (Expo Bare) — NOT COVERED — TOP PRIORITY

| Item | Status | Notes |
|------|--------|-------|
| React Native + Bare worklet | Docs only | modules/expo-bare.md |
| `bare-pack` bundling | Not covered | iOS/Android targets |
| `react-native-bare-kit` | Not covered | RN ↔ Bare bridge |
| Bare suspension/resume | Not covered | Mobile lifecycle |
| Hyperswarm on mobile | Not covered | NAT issues? |
| QVAC on mobile | Not covered | Device-dependent (RAM/GPU) |
| iOS build pipeline | Not covered | Xcode integration |
| Android build pipeline | Not covered | Gradle integration |

### Next Up — Building "Unstoppable Notes" mobile reference app

Full plan: `planning/features/mobile-app.md`

| # | Task | Effort |
|---|------|--------|
| 1 | **Phase 1: Validate toolchain** — Expo + bare-kit + bare-pack hello world | Large |
| 2 | **Phase 2: Notes + AI** — Drizzle/SQLite CRUD + QvacProvider chat | Large |
| 3 | **Phase 3: P2P sync** — Bare worklet with Hyperswarm + Corestore | Large |
| 4 | **Extract knowledge** — Rewrite modules/expo-bare.md with battle-tested findings | Medium |
| 5 | **Create mobile skill** — New skill for agent pack: mobile-p2p-app | Medium |

### Reference Material

- `reference-apps/qvac-workbench-mobile/` — Tether's mobile reference
- `research/qvac-docs/sdk/tutorials/expo.mdx` — Official Expo tutorial

---

## Pear Seeding / Distribution — DOCS ONLY

| Item | Status | Notes |
|------|--------|-------|
| `pear stage` / `pear release` | Docs only | Not tested in real workflow |
| `pear seed` (distribution) | Docs only | Not tested |
| `pear dump` (export) | Not covered | — |

### Next Up

| # | Task | Effort |
|---|------|--------|
| 1 | Test `pear stage` → `pear release` → `pear seed` flow with coffee-assistant-ui | Medium |

---

## Electron — LOW PRIORITY

| Item | Status | Notes |
|------|--------|-------|
| Electron + QVAC | Not covered | Alternative desktop path |

Reference: `research/qvac-docs/sdk/tutorials/electron.mdx`

Low priority — Pear is the primary desktop runtime.
