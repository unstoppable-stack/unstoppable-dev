# Platform / Runtime Roadmap

## Pear Desktop

| Item | Status | Agent Pack File | Notes |
|------|--------|----------------|-------|
| Renderer/worker split | Battle-tested | modules/pear.md, skills/pear-desktop-app/ | Core architecture pattern |
| pear config (type, pre, routes, gui) | Battle-tested | skills/pear-desktop-app/SKILL.md | All fields documented |
| `pear.unrouted` for workers | Battle-tested | skills/pear-desktop-app/ | Critical fix from coffee-ui |
| `Pear.worker.pipe()` communication | Battle-tested | resources/worker-pattern.md | Full bridge code |
| `Pear.teardown()` lifecycle | Battle-tested | core/patterns.md | Cleanup pattern |
| pear-electron + pear-bridge | Battle-tested | skills/pear-desktop-app/SKILL.md | Window creation |
| pear-run (worker spawning) | Battle-tested | resources/worker-pattern.md | Worker startup |
| pear-hotmods (dev HMR) | Battle-tested | resources/build-setup.md | Dev mode |
| `pear-ctrl` (window controls) | Battle-tested | resources/ui-kit.md | Native titlebar |
| React + styled-components UI | Battle-tested | resources/ui-kit.md | UI framework |
| SWC build (src + worker) | Battle-tested | resources/build-setup.md | Dual compilation |
| `pear run -d .` dev mode | Battle-tested | skills/pear-desktop-app/SKILL.md | Dev flag |
| `pear stage` / `pear release` | Docs only | modules/pear.md | Not tested in real workflow |
| `pear seed` (distribution) | Docs only | modules/pear.md | Not tested |
| `pear dump` (export) | Not covered | — | — |

### Next: Build an app that tests `pear stage` → `pear release` → `pear seed` flow

---

## Pear Terminal

| Item | Status | Agent Pack File | Notes |
|------|--------|----------------|-------|
| Terminal app basics | Not covered | — | No worker needed (all Bare) |
| `pear.type: "terminal"` config | Not covered | — | Simpler than desktop |
| stdin/stdout interaction | Not covered | — | Direct pipe, no renderer |
| Terminal app + P2P | Partial | — | coffee-assistant ran as Node, not Pear terminal |

### Next: Convert coffee-assistant CLI to a proper Pear terminal app

---

## CLI (Node.js)

| Item | Status | Agent Pack File | Notes |
|------|--------|----------------|-------|
| Node.js P2P app | Battle-tested | — | coffee-assistant used Node directly |
| Hyperswarm in Node.js | Battle-tested | modules/hyperswarm.md | Works same as Bare |
| QVAC in Node.js | Battle-tested | modules/qvac.md | Works out of the box |

### No additional work needed — Node.js CLI apps work well

---

## Mobile (Expo Bare)

| Item | Status | Agent Pack File | Notes |
|------|--------|----------------|-------|
| React Native + Bare worklet | Docs only | modules/expo-bare.md | From official docs |
| `bare-pack` bundling | Not covered | — | iOS/Android targets |
| `react-native-bare-kit` | Not covered | — | Bridge between RN and Bare |
| Bare suspension/resume | Not covered | — | Mobile lifecycle |
| Hyperswarm on mobile | Not covered | — | May have NAT issues |
| QVAC on mobile | Not covered | — | Device-dependent (RAM/GPU) |
| iOS build pipeline | Not covered | — | Xcode integration |
| Android build pipeline | Not covered | — | Gradle integration |

### Next: Build a mobile P2P app — highest effort, most unknowns

### Reference material available:
- `reference-apps/qvac-workbench-mobile/` — Tether's mobile QVAC reference app
- QVAC docs: `sdk/tutorials/expo.mdx` — Expo tutorial

---

## Electron (non-Pear)

| Item | Status | Agent Pack File | Notes |
|------|--------|----------------|-------|
| Electron + QVAC | Not covered | — | Alternative desktop path |

### Reference material available:
- QVAC docs: `sdk/tutorials/electron.mdx` — Electron tutorial
- `reference-apps/qvac-workbench-desktop/` — Uses Pear, not Electron

### Low priority — Pear is the primary desktop runtime
