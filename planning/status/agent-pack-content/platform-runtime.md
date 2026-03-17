# Platform / Runtime — Content Status

**10 battle-tested, 1 docs-only, 1 partial** out of 12 items.

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

## Mobile (Expo Bare) — BATTLE-TESTED (via codex-mobile-slack-p2p-2)

| Item | Status | Agent Pack File |
|------|--------|----------------|
| React Native + Bare worklet | Battle-tested | skills/setup-mobile-app/SKILL.md |
| `bare-pack` bundling | Battle-tested | skills/setup-mobile-app/SKILL.md |
| `react-native-bare-kit` (Worklet + IPC + bare-rpc) | Battle-tested | skills/setup-mobile-app/SKILL.md |
| pnpm addon linking | Battle-tested | skills/setup-mobile-app/SKILL.md |
| QVAC on mobile (runtime split) | Battle-tested | recipes/qvac-mobile-expo.mdc |
| iOS CocoaPods addon embedding | Battle-tested | skills/setup-mobile-app/SKILL.md |
| Storage paths (absolute via expo-file-system) | Battle-tested | skills/setup-mobile-app/SKILL.md |
| Bare suspension/resume | Docs only | Not yet battle-tested |
| Hyperswarm on mobile | Battle-tested | codex-mobile-slack-p2p-2 P2P chat |
| Android build pipeline | Partial | Scripts exist but not device-tested |

### Next Up

| # | Task | Effort |
|---|------|--------|
| 1 | Battle-test Android device build end-to-end | Medium |
| 2 | Test Bare suspend/resume on backgrounded mobile app | Medium |
| 3 | Update modules/expo-bare.md with battle-tested findings | Small |

### Reference Material

- `reference-apps/qvac-workbench-mobile/` — Tether's mobile reference
- `sandbox/codex-mobile-slack-p2p-2/` — Battle-tested Expo + Bare + QVAC + P2P app
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
