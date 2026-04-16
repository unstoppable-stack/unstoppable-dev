# Unstoppable Remote Coder — Planning

## Concept

A **mobile app that turns your phone into a P2P remote controller for AI coding assistants** running on your dev machine. Control Claude Code, Cursor, OpenCode, Codex, or the Unstoppable Agent — from anywhere. Selected project files sync to your phone over Holepunch P2P protocols so you can review code, diffs, and AI output on the go.

No cloud relay. No centralized server. Your phone talks directly to your dev machine over Hyperswarm.

```
┌─────────────────────────┐         ┌──────────────────────────────────────┐
│  📱 Phone (Expo Bare)   │         │  💻 Dev Machine                      │
│                         │         │                                      │
│  • See AI session live  │◄──P2P──►│  Terminal (iTerm / Warp / any)       │
│  • Send prompts/cmds    │         │  ┌──────────────────────────────┐    │
│  • Approve file changes │         │  │ us remote -- claude          │    │
│  • Browse synced files  │         │  │                              │    │
│  • Review diffs         │         │  │  Thin PTY wrapper that tees  │    │
│  • Voice-to-prompt      │         │  │  your AI session over P2P    │    │
│  • MCP client           │         │  │  while keeping your normal   │    │
│                         │         │  │  terminal experience intact  │    │
│                         │         │  └──────────────────────────────┘    │
└─────────────────────────┘         └──────────────────────────────────────┘
         ▲                                    ▲
         │              Hyperswarm            │
         └────────────────────────────────────┘
              No cloud. No relay server.
              Direct P2P (with DHT holepunching)
```

The desktop side is **not a separate daemon**. It's a thin CLI wrapper (`us remote`)
that you run in your normal terminal. It wraps whatever AI assistant you're using,
acting as a PTY proxy that both displays locally (your terminal stays your terminal)
and streams over Hyperswarm to your phone.

---

## Why This App

1. **Real problem** — Developers leave long-running AI tasks (refactors, multi-file edits, test suites) and want to monitor/steer from their phone. Every major coding AI now has some remote control story (Claude Code /rc, Termly, MobileCLI, Remote Codetrol) but they all rely on centralized relay servers or local-network-only.

2. **Unstoppable differentiator** — P2P via Hyperswarm means it works across networks without a relay server. Your dev machine and phone find each other via the DHT, holepunch through NATs, and communicate directly. No third party sees your code.

3. **Validates the mobile stack** — Battle-tests Expo Bare + bare-kit + Hyperswarm on mobile (same toolchain gap as Unstoppable Notes but with a more immediately useful app).

4. **Composable with the ecosystem** — The file sync layer uses Hyperdrive (same as Node). The session protocol could be extended for multi-device collaboration. The MCP client capability opens up tool integration.

5. **Unique in market** — No existing app combines: P2P transport + multi-assistant support + file sync + MCP client. Each competitor does 1-2 of these.

---

## Competitive Landscape

| App | Transport | Assistants | File Sync | MCP | Open Source | Price |
|-----|-----------|-----------|-----------|-----|-------------|-------|
| **Claude Code /rc** | Cloud relay | Claude Code only | No | No | No | Subscription |
| **Termly** | Cloud relay (E2E encrypted) | All terminal AIs | No | No | Yes (MIT) | Free |
| **Remote Codetrol** | Local network / VPN | Claude, Codex, Gemini | Diffs only | No | No | Paid |
| **MobileCLI** | Local network (WebSocket) | All terminal AIs | File browser (Pro) | No | Yes | Freemium |
| **Moshi (SSH app)** | SSH/Mosh | Any terminal | No | No | No | Paid |
| **Systemprompt** | Cloud | Via MCP servers | No | Yes (client) | No | Free |
| **Unstoppable Remote Coder** | **P2P (Hyperswarm)** | **All (extensible)** | **P2P (Hyperdrive)** | **Yes** | **Yes** | **Free** |

### Our Edges
- **No relay / no cloud** — works across networks without trusting a third party
- **Real file sync** — not just a file browser, but bidirectional P2P file replication
- **MCP client built in** — connect to any MCP server from your phone
- **Multi-assistant** — not locked to one vendor
- **Open source** — part of the Unstoppable Stack, extensible by the community

---

## Reference Apps Studied

### Termly (termly.dev)
- CLI bridge (`npm install -g @termly-dev/cli`) that mirrors terminal AI sessions to phone
- AES-256-GCM encryption, Diffie-Hellman key exchange
- QR code pairing, speech-to-code
- **What we take:** QR pairing UX, speech-to-code concept, universal assistant support

### Remote Codetrol (remotecodetrol.ai)
- Mac server + iOS client, local network + Tailscale
- File-by-file diffs, code review, workflow bots
- mTLS authentication
- **What we take:** diff review UX, workflow/bot concept, permission model

### MobileCLI (mobilecli.app)
- Rust daemon + iOS app, WebSocket on local network
- Full terminal streaming with ANSI support, file browser + editor
- Push notifications for tool approvals
- **What we take:** terminal streaming approach, push notification for approvals, file editor UX

### Claude Code Remote Control
- Official feature (`claude remote-control` / `/rc`)
- Cloud relay, E2E encrypted, QR code
- Monitor, send instructions, approve changes
- **What we take:** approval flow UX, session lifecycle patterns

### Moshi (kyutai.org — voice AI)
- Full-duplex voice interaction, 200ms latency
- Multiple implementations (PyTorch, MLX, Rust)
- **What we take:** low-latency voice input for prompts, on-device speech processing idea

### Systemprompt MCP Client
- Voice-controlled MCP client on mobile
- OAuth authentication, multiple MCP server support
- **What we take:** MCP client UX on mobile, voice-to-MCP-call pattern

---

## Core Features

### 1. P2P Session Bridge (CLI Wrapper)

A thin CLI wrapper that runs AI assistants inside a PTY proxy. You keep using your
normal terminal (iTerm, Warp, Terminal.app, Alacritty — whatever). The wrapper
transparently tees the session over Hyperswarm to your phone.

**Three usage modes, from lightest to most integrated:**

```bash
# Mode 1: Wrap — run your AI tool through the wrapper (recommended)
us remote -- claude              # wraps claude, streams over P2P
us remote -- opencode            # works with any terminal AI
us remote -- codex               # anything that runs in a terminal

# Mode 2: Attach — hook into an existing tmux/screen session
us remote attach my-session      # streams an existing tmux session

# Mode 3: Hook — auto-detect AI tools in your shell (zero-friction)
eval "$(us remote hook)"         # add to .zshrc/.bashrc
# now any `claude`, `opencode`, `codex` invocation is auto-wrapped
```

**Other commands:**
```bash
us remote pair                   # Show QR code for phone pairing
us remote status                 # Show connected devices
us remote devices                # Manage trusted devices
```

**How the PTY wrapper works:**
- Allocates a pseudo-terminal (PTY) and spawns your AI tool inside it
- Your terminal sees the normal output (colors, formatting, interactive prompts)
- Simultaneously, output is streamed over the Hyperswarm channel to connected phones
- Input from the phone is written to the PTY stdin (like typing remotely)
- No separate background process — it lives and dies with your terminal session

**The hook mode** installs shell functions that detect known AI commands and
auto-wrap them. If you run `claude` it becomes `us remote -- claude` transparently.
You can allowlist/blocklist which commands get wrapped.

**Session capabilities (all modes):**

| Assistant | View Output | Send Input | Approve Changes | Notes |
|-----------|------------|-----------|----------------|-------|
| Claude Code | ✅ | ✅ | ✅ (parse approval prompts) | Best experience |
| OpenCode | ✅ | ✅ | ✅ | Full terminal |
| Codex CLI | ✅ | ✅ | ✅ | Full terminal |
| Unstoppable Agent | ✅ | ✅ | ✅ (native protocol) | Richest integration |
| Any terminal AI | ✅ | ✅ | ⚠️ (generic) | Universal fallback |

### 2. P2P File Sync (Hyperdrive)

Selected files/folders from the project sync to your phone via Hyperdrive, so you can browse and review code without the full repo.

**User selects what to sync:**
```
# In .unstoppable/remote.json
{
  "sync": {
    "include": ["src/**", "*.md", "package.json", "tsconfig.json"],
    "exclude": ["node_modules/**", "dist/**", ".git/**"],
    "maxSize": "50MB"
  }
}
```

**What you see on the phone:**
- Syntax-highlighted code viewer
- File tree with git status indicators
- Diff viewer (before/after AI changes)
- Markdown preview
- Search across synced files

**Sync is real P2P:**
- Uses Hyperdrive (same as Node)
- Selective replication — only syncs matching files
- Real-time updates when files change on the dev machine
- Read-only on phone by default, optionally writable

### 3. AI Session Viewer

The core screen — a live view of what your AI assistant is doing.

```
┌─────────────────────────────────────────────┐
│  ← Sessions           Coffee Refactor   ⋯   │
├─────────────────────────────────────────────┤
│                                             │
│  🤖 Claude Code                    12:34 PM │
│  ┌─────────────────────────────────────┐    │
│  │ Refactoring order-service.ts...     │    │
│  │                                     │    │
│  │ Reading src/services/order.ts       │    │
│  │ Editing src/services/order.ts       │    │
│  │ +42 -18 lines                       │    │
│  │                                     │    │
│  │ Running tests...                    │    │
│  │ ✓ 12 passed  ✗ 1 failed            │    │
│  │                                     │    │
│  │ Fixing test: order.test.ts:45       │    │
│  └─────────────────────────────────────┘    │
│                                             │
│  ┌─────────────────────────────────────┐    │
│  │ ⚠️  Approve changes?               │    │
│  │                                     │    │
│  │ src/services/order.ts  (+42 -18)    │    │
│  │ src/tests/order.test.ts (+5 -2)     │    │
│  │                                     │    │
│  │  [View Diff]  [✓ Approve] [✗ Deny] │    │
│  └─────────────────────────────────────┘    │
│                                             │
├─────────────────────────────────────────────┤
│  💬 Send a message...              🎤  📎  │
└─────────────────────────────────────────────┘
```

**Features:**
- Live streaming of AI output (formatted, not raw terminal)
- Collapsible tool call sections (file reads, shell commands)
- Inline diff previews for file changes
- Approval/denial buttons for pending changes
- Send follow-up instructions via text or voice
- Session history (scroll back through the conversation)

### 4. MCP Client

Connect to MCP servers from your phone — making your phone a universal AI tool interface.

**Use cases:**
- Query a database MCP server from your phone
- Check GitHub issues/PRs via GitHub MCP server
- Monitor Sentry errors
- Run custom MCP tools

**How it works:**
- MCP servers run on the dev machine (or anywhere reachable)
- The daemon proxies MCP connections over the P2P channel
- Phone app renders MCP tool UIs dynamically
- Results displayed in a chat-like interface

### 5. Voice-to-Prompt

Speak instructions to your AI assistant — especially useful when mobile.

- On-device speech recognition (Whisper via QVAC if available, or system speech API)
- Voice commands: "approve all changes", "run the tests", "explain this error"
- Optional wake word for hands-free operation
- Transcription shown before sending (edit before submit)

### 6. Notifications

- Push notification when AI needs approval
- Notification when a long-running task completes
- Notification on errors/failures
- Configurable per session (don't spam during active monitoring)

---

## Architecture

### Desktop Side (`us remote` CLI wrapper)

The desktop side is **not a separate daemon**. It's a wrapper process that lives
inside your terminal session. When you run `us remote -- claude`, a single process
handles everything:

```
┌── Your Terminal (iTerm / Warp / any) ─────────────────────────────┐
│                                                                    │
│  $ us remote -- claude                                             │
│                                                                    │
│  ┌── us remote (PTY wrapper process) ─────────────────────────┐   │
│  │                                                             │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │   │
│  │  │ PTY Proxy     │  │ File Sync    │  │ MCP Proxy    │     │   │
│  │  │               │  │ (Hyperdrive) │  │ (optional)   │     │   │
│  │  │ Spawns AI     │  │              │  │              │     │   │
│  │  │ tool in PTY,  │  │ Watches cwd, │  │ Connects to  │     │   │
│  │  │ displays      │  │ syncs files  │  │ local MCP    │     │   │
│  │  │ locally AND   │  │ matching     │  │ servers,     │     │   │
│  │  │ streams to    │  │ patterns to  │  │ proxies over │     │   │
│  │  │ phone         │  │ phone via    │  │ P2P channel  │     │   │
│  │  │               │  │ Hyperdrive   │  │              │     │   │
│  │  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘     │   │
│  │         │                 │                  │              │   │
│  │         └────────┬────────┴────────┬─────────┘              │   │
│  │                  │                 │                         │   │
│  │         ┌────────▼─────────────────▼──────────┐             │   │
│  │         │  P2P Transport (Hyperswarm)          │             │   │
│  │         │                                      │             │   │
│  │         │  • Encrypted channel (SecretStream)   │             │   │
│  │         │  • Hyperdrive replication             │             │   │
│  │         │  • Finds phone via stored keypair     │             │   │
│  │         └──────────────────────────────────────┘             │   │
│  │                                                             │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                    │
│  (Your terminal looks and behaves exactly as normal)               │
└────────────────────────────────────────────────────────────────────┘
```

**Key design decisions:**
- No background daemon — process starts when you wrap a command, ends when the command exits
- File sync starts from cwd and uses `.unstoppable/remote.json` for include/exclude patterns
- Multiple terminals can each run `us remote -- <tool>` — phone sees all active sessions
- Keypair stored in `~/.unstoppable/remote/` — pairing is one-time, reconnection is automatic
- Tmux attach mode reads from an existing session (read-only capture, input via tmux send-keys)

### Mobile App (Expo Bare)

```
┌── React Native (Expo) ─────────────────────────────────┐
│                                                         │
│  Screens:                                               │
│  ├── Sessions List      # All active AI sessions        │
│  ├── Session Viewer     # Live AI output + controls     │
│  ├── File Browser       # Synced project files          │
│  ├── Diff Viewer        # Review file changes           │
│  ├── MCP Tools          # Browse + invoke MCP tools     │
│  ├── Pair Device        # QR code scanner               │
│  └── Settings           # Sync config, notifications    │
│                                                         │
│  Services:                                              │
│  ├── SessionService     # RPC calls to daemon           │
│  ├── FileService        # Read from local Hyperdrive    │
│  ├── McpService         # MCP tool invocation           │
│  ├── VoiceService       # Speech-to-text                │
│  └── NotificationSvc    # Push notification mgmt        │
│                                                         │
│  Providers:                                             │
│  ├── P2PProvider        # Hyperswarm connection state   │
│  ├── SessionProvider    # Active sessions context       │
│  └── SyncProvider       # File sync state               │
│                                                         │
└────────────┬────────────────────────────────────────────┘
             │  react-native-bare-kit (IPC)
             │
┌────────────▼────────────────────────────────────────────┐
│  Bare Worklet (bare/p2p/)                               │
│                                                         │
│  ├── Hyperswarm — connect to dev machine                │
│  ├── SecretStream — encrypted transport                 │
│  ├── Hyperdrive — receive synced files                  │
│  ├── RPC — session control protocol                     │
│  └── hrpc — schema-based IPC with React Native          │
│                                                         │
│  Bundled with bare-pack for ios-arm64 + android-arm64   │
└─────────────────────────────────────────────────────────┘
```

### Protocol: Remote Coder RPC

Messages between phone and daemon over the encrypted Hyperswarm channel:

```typescript
// Session management
{ type: 'sessions:list' }
{ type: 'sessions:list:response', sessions: Session[] }
{ type: 'session:subscribe', sessionId: string }
{ type: 'session:output', sessionId: string, data: OutputChunk }
{ type: 'session:input', sessionId: string, text: string }
{ type: 'session:approve', sessionId: string, changeId: string }
{ type: 'session:deny', sessionId: string, changeId: string }

// File sync
{ type: 'sync:config', include: string[], exclude: string[] }
{ type: 'sync:status', files: number, size: number, syncing: boolean }
{ type: 'file:changed', path: string, diff: string }

// MCP proxy
{ type: 'mcp:servers:list' }
{ type: 'mcp:tools:list', serverId: string }
{ type: 'mcp:tool:call', serverId: string, tool: string, args: object }
{ type: 'mcp:tool:result', callId: string, result: object }

// Device management
{ type: 'pair:request', publicKey: string, deviceName: string }
{ type: 'pair:accept', publicKey: string }
{ type: 'heartbeat' }
```

---

## Pairing Flow

Secure device pairing without a centralized server:

```
Dev Machine                              Phone
─────────────                            ─────
1. `us remote pair`
2. Generate ephemeral Hyperswarm topic
3. Display QR code (topic + daemon pubkey)
                                    4. Scan QR code
                                    5. Join topic via Hyperswarm
                                    6. Connect + send phone pubkey
7. Receive phone pubkey
8. Exchange keys via SecretStream
9. Store phone pubkey in trusted devices
                                   10. Store daemon pubkey
11. Both join permanent topic
    (derived from shared keypair)
                                   12. Connected! ✅

Future connections:
- Both join the permanent topic automatically
- SecretStream verifies identity via stored keys
- No QR needed again (unless re-pairing)
```

---

## Stack Modules Exercised

| Module | How It's Used | Status in Agent Pack |
|--------|---------------|----------------------|
| **Hyperswarm** | Device discovery + P2P transport | Battle-tested |
| **SecretStream** | Encrypted channel between devices | Docs only → validates |
| **Hyperdrive** | Selective file sync to phone | Docs only → validates |
| **RPC (hrpc)** | Session control protocol + worklet IPC | Battle-tested |
| **Bare (worklet)** | P2P networking on mobile | Docs only → validates |
| **bare-kit** | Bridge between React Native and Bare | Docs only → validates |
| **bare-pack** | Bundle worklet for mobile targets | Not covered → validates |
| **QVAC (optional)** | On-device speech-to-text | Battle-tested |

**This app validates 4 previously unvalidated modules** (SecretStream, Hyperdrive on mobile, bare-kit, bare-pack) while building something immediately useful.

---

## Development Phases

### Phase 1: P2P Pairing + Session Viewer (MVP)

**Goal:** Phone shows live output from one AI session on the dev machine.

| # | Task | Details | Effort |
|---|------|---------|--------|
| 1 | `us remote` CLI wrapper | PTY proxy that spawns AI tool and tees output | Medium |
| 2 | Hyperswarm P2P channel | Wrapper joins topic, accepts phone connections | Small |
| 3 | QR code pairing (`us remote pair`) | Generate + display QR, exchange keypairs | Small |
| 4 | Expo Bare app scaffold | Expo + bare-kit + bare-pack setup | Medium |
| 5 | P2P worklet | Bare worklet connects to wrapper via Hyperswarm | Medium |
| 6 | Session viewer screen | Live streaming output with basic formatting | Medium |
| 7 | Send input | Text input on phone → piped to AI session PTY stdin | Small |
| 8 | Tmux attach mode | `us remote attach <session>` for existing sessions | Small |

**Deliverable:** `us remote -- claude` → scan QR on phone → see output live → type a follow-up instruction.

### Phase 2: File Sync + Diff Review

**Goal:** Selected project files sync to phone, review AI-made changes.

| # | Task | Details | Effort |
|---|------|---------|--------|
| 1 | Hyperdrive file watcher | Daemon watches project, populates Hyperdrive with matching files | Medium |
| 2 | Selective replication | Only replicate files matching include/exclude patterns | Medium |
| 3 | Mobile file browser | File tree, syntax highlighting, search | Medium |
| 4 | Diff viewer | Side-by-side or unified diff view for changed files | Medium |
| 5 | Change approval flow | Approve/deny pending changes from the phone | Small |
| 6 | Sync config UI | Settings screen to configure include/exclude patterns | Small |

**Deliverable:** Browse project files on phone, see diffs when AI makes changes, approve or deny.

### Phase 3: Multi-Session + Voice

**Goal:** Manage multiple AI sessions, voice input.

| # | Task | Details | Effort |
|---|------|---------|--------|
| 1 | Multi-session management | Track multiple active AI sessions, switch between them | Medium |
| 2 | Session list screen | Overview of all sessions with status badges | Small |
| 3 | Voice-to-prompt | Speech recognition → text → send to session | Medium |
| 4 | Push notifications | Notify on approval needed, task complete, errors | Medium |
| 5 | Assistant plugins | Plugin system for detecting/bridging different AI assistants | Medium |

**Deliverable:** Monitor 3 AI sessions at once, speak a prompt, get notified when tasks complete.

### Phase 4: MCP Client + Polish

**Goal:** Universal MCP tool access from phone, production polish.

| # | Task | Details | Effort |
|---|------|---------|--------|
| 1 | MCP proxy in daemon | Daemon connects to local MCP servers, proxies over P2P | Medium |
| 2 | MCP tool browser | List available tools per server | Small |
| 3 | MCP tool invocation UI | Dynamic form generation for tool parameters | Medium |
| 4 | MCP result display | Render tool results (JSON, markdown, images) | Medium |
| 5 | Onboarding flow | First-launch experience, daemon install instructions | Small |
| 6 | Offline resilience | Handle disconnections gracefully, queue actions, reconnect | Medium |
| 7 | Multi-device pairing | Pair multiple phones/tablets to one daemon | Small |

**Deliverable:** Full MCP client on your phone, polished UX, handles network hiccups.

### Phase 5: Advanced (Future)

- **Collaborative mode** — Multiple developers pair to same daemon, see each other's sessions
- **Cloud relay fallback** — Optional relay for when holepunching fails (via Unstoppable Cloud)
- **Tablet layout** — Split view: session viewer + file browser side by side
- **Node integration** — Remote Coder as a Node-connected app for data persistence
- **Unstoppable Agent native** — Run the Unstoppable Agent directly from the phone (with QVAC)

---

## Tech Stack

### Mobile App
- **Framework:** Expo 54 + expo-router + TypeScript
- **P2P Runtime:** react-native-bare-kit + bare-pack
- **P2P Networking:** Hyperswarm (in Bare worklet)
- **File Sync:** Hyperdrive (in Bare worklet)
- **IPC:** hrpc + hyperschema (worklet ↔ React Native)
- **State:** zustand
- **UI:** React Native + styled-components (or Tamagui)
- **Syntax Highlighting:** react-native-syntax-highlighter or similar
- **Speech:** expo-speech or QVAC Whisper (if available)
- **Notifications:** expo-notifications

### Desktop CLI Wrapper (`us remote`)
- **Language:** TypeScript (Node.js) — part of the `us` CLI package
- **PTY:** node-pty (spawn AI tool in pseudo-terminal, tee output)
- **P2P:** Hyperswarm + SecretStream
- **File Sync:** Hyperdrive + chokidar (watch cwd for changes)
- **MCP:** @modelcontextprotocol/sdk (connect to local MCP servers)
- **QR Code:** qrcode-terminal (for pairing)
- **Tmux integration:** tmux capture-pane / send-keys (for attach mode)

### Shared
- **Protocol:** Custom RPC over SecretStream (NDJSON messages)
- **Encryption:** SecretStream (Noise protocol) — built into Hyperswarm
- **Schema:** hrpc + hyperschema for type-safe RPC

---

## Name Ideas

| Name | Vibe |
|------|------|
| **Unstoppable Remote** | Clear, functional |
| **Unstoppable Remote Coder** | Descriptive, says what it does |
| **Unstoppable Pilot** | You're piloting your AI from anywhere |
| **Unstoppable Deck** | Like a command deck / bridge |
| **Unstoppable Link** | The P2P link between your devices |
| **Pear Remote** | Ties to Pear ecosystem |
| **HyperControl** | Hyper- prefix, control concept |
| **The Bridge** | You're bridging phone ↔ dev machine |

---

## Estimated Effort

| Phase | Scope | Effort |
|-------|-------|--------|
| Phase 1 | P2P pairing + session viewer | 2-3 weeks |
| Phase 2 | File sync + diff review | 2 weeks |
| Phase 3 | Multi-session + voice | 1-2 weeks |
| Phase 4 | MCP client + polish | 2 weeks |
| **Total MVP (Phase 1-2)** | | **4-5 weeks** |
| **Full app (Phase 1-4)** | | **7-9 weeks** |

Phase 1 alone is a usable product — see your AI session from your phone and send it instructions.

---

## Open Questions

1. **Structured vs raw output** — The PTY wrapper captures raw ANSI output. Should we also parse structured output (e.g., detect "Approve changes?" prompts from Claude Code) for richer phone UI, or just stream raw terminal?
2. **Cursor integration** — Cursor runs in VSCode, not a terminal. Background agent mode may have an API. Worth investigating separately or skip for v1?
3. **NAT traversal reliability** — How often does Hyperswarm holepunching fail? Do we need a relay fallback for v2?
4. **File sync granularity** — Full Hyperdrive or something lighter for read-only file browsing? Hyperdrive gives us future write-back capability.
5. **Hook mode safety** — The shell hook auto-wraps AI commands. How to avoid wrapping unintended commands? Allowlist approach?
6. **Android testing** — We have iOS patterns from reference apps. Android bare-kit support status?
7. **Multiple sessions** — When multiple terminals each run `us remote -- <tool>`, how does the phone discover them? Shared Hyperswarm topic with session multiplexing, or one topic per session?
