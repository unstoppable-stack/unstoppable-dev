# Unstoppable Remote Coder — Status

**Phase:** 1 (MVP — P2P pairing + session viewer)
**Status:** Desktop CLI implemented, mobile app scaffolded
**Last updated:** 2026-03-18

## Summary

A P2P mobile remote controller for AI coding assistants. Your phone connects directly to your dev machine over Hyperswarm — no cloud relay. The desktop side is a thin CLI wrapper (`us remote`) that wraps AI tools in your existing terminal.

## What's Implemented

### Desktop CLI (`packages/cli/src/remote/` + `src/commands/remote.ts`)
- [x] `us remote wrap <cmd...>` — PTY wrapper that streams session over Hyperswarm
- [x] `us remote pair` — QR code generation + Hyperswarm pairing flow
- [x] `us remote status` — Show paired devices and connection info
- [x] `us remote devices` — Manage trusted devices (add/remove)
- [x] `us remote hook` — Shell hook for auto-wrapping AI commands
- [x] Config persistence (`~/.unstoppable/remote/config.json`)
- [x] NDJSON protocol over SecretStream (encrypted)
- [x] Trusted device management (keypair exchange)

### Mobile App (`packages/remote-app/`)
- [x] Expo 54 + expo-router project scaffold
- [x] Bare P2P worklet (`bare/p2p/index.js`) — Hyperswarm client
- [x] P2P service layer (`services/p2p.ts`) — IPC bridge
- [x] Zustand stores (connection state, sessions)
- [x] Home screen (connection card, sessions list)
- [x] QR scanner screen (camera + manual entry fallback)
- [x] Session viewer screen (terminal output + input bar)
- [x] UI components (TerminalOutput, InputBar, StatusBadge)
- [x] Dark theme with Unstoppable Stack branding

### Not Yet Done
- [ ] Native build (requires `npx expo prebuild` + Xcode)
- [ ] bare-pack bundle generation (needs native dependencies installed)
- [ ] End-to-end test (desktop → phone connection)
- [ ] Tmux attach mode implementation
- [ ] File sync via Hyperdrive (Phase 2)

## Next Up

1. **Native build + end-to-end test** — Run `npm install` + `npx expo prebuild` + build on device (Medium)
2. **Tmux attach mode** — `us remote attach <session>` for existing sessions (Small)
3. **Phase 2: File sync** — Hyperdrive-based selective file sync (Large)
4. **Phase 3: Voice input** — Speech-to-text for prompts (Medium)

## Architecture

```
Desktop                              Phone
──────                               ─────
us remote -- claude                  Expo Bare app
  │                                    │
  ├─ PTY proxy (spawns claude)         ├─ React Native UI (screens)
  ├─ Hyperswarm server                 ├─ Zustand stores
  ├─ NDJSON protocol                   ├─ P2P service (IPC bridge)
  └─ SecretStream (encrypted)          └─ Bare worklet (Hyperswarm client)
       │                                    │
       └──────── P2P (Hyperswarm) ──────────┘
```
