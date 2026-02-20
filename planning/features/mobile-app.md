# Unstoppable Notes — Mobile Reference App

## Purpose

Build a mobile reference app to **battle-test the Expo Bare mobile stack**.
This is the first mobile app for the Unstoppable Stack — the goal is to learn
how to set up QVAC and P2P on mobile, document every fix, and extract that
knowledge into the agent pack.

---

## Concept

A private notes app with local AI and P2P sync between devices.

- **Create and edit notes** — stored locally in SQLite
- **AI assistant** — ask questions about your notes, get summaries, search by meaning
- **P2P sync** — notes sync between your devices over Hyperswarm (no server)

---

## Stack (based on reference apps)

### From qvac-app-workbench-mobile-main:
- Expo 54 + expo-router
- `@tetherto/qvac-sdk` — QVAC for local AI inference
- `react-native-bare-kit` — bridge between React Native and Bare runtime
- `react-native-worklets` — required by bare-kit
- `zustand` — state management
- `styled-components` — UI styling
- `zod` v4 — schema validation

### From qvac-health-dev:
- `bare-pack` — bundle Bare worklets for iOS/Android targets
- `bare/` folder — Bare worklets that run P2P services (Hyperswarm, hrpc)
- `hyperswarm` — P2P networking on mobile
- `corestore` — multi-core management
- `hyperdrive` — P2P file/data replication
- `hrpc` + `hyperschema` — schema-based RPC for worklet ↔ React Native communication
- `drizzle-orm` + `@op-engineering/op-sqlite` — local SQLite database
- `expo-build-properties` — native build config
- Plugins: `withAndroidArchitecture.js`, `withAndroidNDK.js` — native platform setup

### Key mobile patterns from health app:
- **Bare worklets** are JS files in `bare/` that run on the Bare runtime (not React Native)
- **bare-pack bundles** them with: `bunx bare-pack --target ios-arm64 --target android-arm64 --linked --out bare/sync/sync.bundle.js bare/sync/server.js`
- **Communication**: worklet ↔ RN via `hrpc` (schema-based RPC) or via `react-native-bare-kit` IPC
- **Providers pattern**: each capability (LLM, Whisper, RAG, etc.) has its own React context provider

---

## Architecture

```
┌── React Native (Expo) ─────────────────────────────┐
│                                                      │
│  app/                                                │
│  ├── (tabs)/                                         │
│  │   ├── notes/          # Notes list + editor       │
│  │   └── chat/           # AI chat about notes       │
│  ├── settings.tsx        # Model selection, sync     │
│  └── _layout.tsx         # Providers wrapper         │
│                                                      │
│  services/                                           │
│  ├── db/                 # Drizzle + SQLite          │
│  ├── ai/                 # QVAC SDK wrapper          │
│  └── sync/               # bare-kit IPC to worklet   │
│                                                      │
│  providers/                                          │
│  ├── QvacProvider.tsx    # Model loading + chat       │
│  └── SyncProvider.tsx    # P2P sync status            │
│                                                      │
└────────────┬─────────────────────────────────────────┘
             │  react-native-bare-kit (IPC)
             │
┌────────────▼─────────────────────────────────────────┐
│  Bare Worklet (bare/sync/)                           │
│                                                      │
│  server.js                                           │
│  ├── Hyperswarm — join sync topic                    │
│  ├── Corestore — manage note cores                   │
│  ├── hrpc — schema-based RPC with React Native       │
│  └── Replication — sync notes between devices        │
│                                                      │
│  Bundled with: bare-pack → sync.bundle.js            │
│  Targets: ios-arm64, android-arm64                   │
└──────────────────────────────────────────────────────┘
```

---

## Phase 1: Hello World (validate the toolchain)

**Goal:** Expo app that runs a Bare worklet and communicates with it.

| # | Task | Details |
|---|------|---------|
| 1 | Create new Expo project | `npx create-expo-app unstoppable-notes` |
| 2 | Add react-native-bare-kit | Follow workbench's setup. Add expo-build-properties, plugins. |
| 3 | Create a minimal Bare worklet | `bare/hello/server.js` that responds to a ping |
| 4 | Bundle with bare-pack | `bunx bare-pack --target ios-arm64 --linked --out bare/hello/hello.bundle.js bare/hello/server.js` |
| 5 | Call worklet from React Native | Use bare-kit IPC to send "ping", receive "pong" |
| 6 | Run on iOS simulator | Verify end-to-end |

**This is the highest-risk phase.** If this works, we've proven the mobile toolchain.

---

## Phase 2: Local Notes + AI

**Goal:** Notes CRUD + QVAC chat (no P2P yet).

| # | Task | Details |
|---|------|---------|
| 1 | Set up Drizzle + op-sqlite | Schema: notes table (id, title, content, createdAt, updatedAt) |
| 2 | Build notes list screen | List all notes, create new, delete |
| 3 | Build note editor screen | Edit title + content, auto-save |
| 4 | Add QvacProvider | Copy pattern from workbench. Load a small model (1B-3B). |
| 5 | Build AI chat screen | Chat about your notes. System prompt includes note context. |
| 6 | Model download UX | Progress bar, model selection in settings |

---

## Phase 3: P2P Sync

**Goal:** Notes sync between devices over Hyperswarm.

| # | Task | Details |
|---|------|---------|
| 1 | Create sync worklet | `bare/sync/server.js` with Hyperswarm + Corestore |
| 2 | Define hrpc schema | `bare/sync/schema.js` — RPC methods: addNote, getNote, listNotes, sync |
| 3 | Bundle sync worklet | bare-pack for all targets |
| 4 | Create SyncProvider | React context that communicates with the worklet |
| 5 | Wire sync to notes DB | When a note is created/edited locally, push to Hypercore. When sync receives a note, upsert to SQLite. |
| 6 | Test between two devices | Create note on device A, verify it appears on device B |

---

## What This Validates

| Item | Status Before | Status After |
|------|--------------|-------------|
| React Native + Bare worklet | Docs only | Battle-tested |
| `bare-pack` bundling | Not covered | Battle-tested |
| `react-native-bare-kit` | Not covered | Battle-tested |
| Bare suspension/resume | Not covered | Battle-tested |
| Hyperswarm on mobile | Not covered | Battle-tested |
| QVAC on mobile | Not covered | Battle-tested |
| iOS build pipeline | Not covered | Battle-tested |

**7 items from "not covered" → "battle-tested" in one app.**

---

## Reference Files to Study

### Workbench (simpler — QVAC setup)
| File | What to learn |
|------|---------------|
| `package.json` | Deps and versions that work together |
| `contexts/QvacProvider.tsx` | Model loading, completion, streaming pattern |
| `stores/useSettingsStore.ts` | Model settings, hyperdrive key |
| `app/(drawer)/thread/[id].tsx` | Chat UI with streaming |
| `plugins/withAndroidArchitecture.js` | Android native config |
| `app.json` | Expo config for bare-kit |

### Health App (complex — P2P + bare-pack)
| File | What to learn |
|------|---------------|
| `package.json` | Full deps for P2P mobile (bare-pack, hyperswarm, corestore, hrpc) |
| `bare/backup/server.js` | How a Bare worklet does P2P (Hyperswarm + backup sharing) |
| `bare/backup/schema.js` | hrpc schema definition (RPC between worklet and RN) |
| Scripts `gen:bundle:*` | bare-pack commands for all targets |
| `plugins/withAndroidArchitecture.js` | ARM architecture config |
| `plugins/withAndroidNDK.js` | NDK version pinning |
| `plugins/withModelDownloadService.js` | Background model download service |
| `app/_layout.tsx` | Provider nesting pattern (LLM, Whisper, RAG, etc.) |
| `.cursor/rules/main.mdc` | Coding guidelines for mobile (good patterns) |

---

## AI Assistant Prompt

Use this prompt to start building with your AI assistant:

```
I'm building "Unstoppable Notes" — a mobile app with local AI and P2P sync.

Stack:
- Expo 54 + expo-router + TypeScript
- @tetherto/qvac-sdk for local AI inference
- react-native-bare-kit + bare-pack for Bare runtime worklets
- Hyperswarm for P2P sync (runs in Bare worklet)
- Drizzle ORM + op-sqlite for local SQLite
- styled-components for UI
- zustand for state management

I have two reference apps to base this on:
1. reference-apps/qvac-workbench-mobile/ — Shows QVAC setup on Expo (QvacProvider, model loading, streaming chat)
2. reference-apps/qvac-health/ — Shows bare-pack worklets, Hyperswarm on mobile, hrpc schemas, P2P sync

Architecture:
- React Native layer: notes UI, AI chat, settings
- Bare worklet layer: P2P sync via Hyperswarm + Corestore
- Communication: hrpc (schema-based RPC) via react-native-bare-kit

IMPORTANT: Before writing any code:
1. Study both reference apps to understand the exact setup
2. Propose the project structure and list all files to create
3. Start with Phase 1 (hello world — validate toolchain) before adding features

CRITICAL — Documentation requirement:
Throughout the entire build process, you MUST maintain a `fixes/` folder
in the project root that documents every step, fix, and gotcha as we go.
For each issue encountered, create a markdown file like `fixes/01-bare-kit-setup.md`
with:
- What we were trying to do
- What went wrong (error message, unexpected behavior)
- What the fix was
- Why it works (the gap between docs and reality)

Also maintain a `BUILD-LOG.md` at the project root that tracks:
- Each phase and what was accomplished
- Dependencies and their exact versions that work together
- Platform-specific issues (iOS vs Android)
- Performance observations (model size limits, memory, etc.)

This documentation is the primary output of this project — it feeds directly
back into the Unstoppable Stack agent pack so future developers don't hit
the same issues. The working app is secondary to the knowledge we extract.

Phase 1: Get a Bare worklet running and communicating with React Native
Phase 2: Add notes CRUD (Drizzle + SQLite) + QVAC AI chat
Phase 3: Add P2P sync via Bare worklet (Hyperswarm + Corestore)

Start with Phase 1.
```
