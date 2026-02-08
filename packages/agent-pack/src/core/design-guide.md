---
id: design-guide
name: Design Guide
category: core
priority: high
---

# Designing Desktop and Mobile Apps with the Unstoppable Stack

## Design Goals
- Local-first: core functionality must work without network access.
- P2P sync: replication is opportunistic, not required to use the app.
- Trust boundaries: isolate AI inference and P2P IO from UI threads.
- Progressive delivery: stage, seed, release separately; do not block on global distribution.

## Desktop App Architecture (Pear)
**Pattern: UI + Engine**
- UI: Pear desktop app (HTML/React).
- Engine: Pear terminal app running QVAC, storage, and P2P.
- Bridge: `pear-run` + `pear-pipe` duplex stream with newline-delimited JSON.

**Why**
- Keeps long-running inference and networking off the UI thread.
- Enables stronger crash isolation and simpler restarts.

**Key design points**
- Model lifecycle: load once, reuse per thread, unload on app exit.
- Streaming: stream tokens to the UI and update visible text incrementally.
- Persistence: use local storage (Zustand + file storage) or Hyperbee for shared state.

## Mobile App Architecture (Expo + Bare)
**Pattern: RN UI + Bare worklet backend**
- UI: React Native (Expo Router or standard).
- Backend: Bare worklet bundle, started via `react-native-bare-kit`.
- Bridge: `bare-rpc` over Worklet IPC.

**Why**
- Bare provides UDP and low-level networking required by Hyperswarm.
- Worklet keeps heavy tasks off the JS UI thread.

**Key design points**
- Use a background task queue for inference or long-running processing.
- Android model downloads should run in a foreground service with progress notifications.
- Hot reload is limited for Bare-dependent code; rebuild on backend changes.

## Data Modeling and Sync
- Use Hypercore for append-only event logs (chat history, activity logs).
- Use Hyperbee for key-value state (settings, indexed entities).
- Use Hyperdrive for file sharing or large assets (models, user files).
- Use HyperDB when you need schema + indexed queries and are ok with a build step.

## UX Patterns for P2P and Local AI
- Show offline state clearly; allow actions even when offline.
- Use explicit progress states for model downloads and inference start.
- Use optimistic UI for writes; sync in background.
- Provide per-thread or per-project contexts to control model parameters.

## Security and Trust
- Do not leak Hypercore keys in UI logs; treat keys as capabilities.
- Use `@hyperswarm/secret-stream` for encrypted application protocols.
- Gate unknown `pear://` links with explicit trust prompts.
- Store secrets in OS keychains or a secure store; never in localStorage.

## Example Layouts
**Desktop LLM Workbench**
- Left: project list + threads
- Center: chat
- Right: model config + system prompt
- Background: QVAC engine, separate Pear terminal app

**Mobile Health App**
- Home: metrics dashboard
- Quick Log: background task queue for inference
- Downloads: foreground service for model updates
- Networking: Hyperdrive + Hyperswarm for data sync
