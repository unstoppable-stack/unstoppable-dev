# Sandbox

Internal apps built for testing, validation, and learning. This folder is **gitignored** but intentionally accessible to AI agents.

## Contents

### Battle-tested apps (built during research)

| App | Platform | Key Patterns Validated |
|-----|----------|----------------------|
| `coffee-assistant/` | Node.js CLI | P2P + AI + RPC, Hyperswarm, bare-rpc, Hyperbee, QVAC tool calling |
| `coffee-assistant-ui/` | Pear Desktop | Renderer/worker split, NDJSON IPC, React + SWC, Pear config |
| `slack-p2p-copy/` | Pear Desktop | P2P messaging, Hyperswarm, real-time sync |

### CLI test builds

Apps scaffolded with `us init` for testing the CLI and agent pack. Each should include a `FEEDBACK.md`:

```
sandbox/
├── coffee-assistant/         # Battle-tested: P2P + AI CLI app
├── coffee-assistant-ui/      # Battle-tested: Pear Desktop app
├── slack-p2p-copy/           # Battle-tested: P2P messaging app
├── my-test-app/              # CLI test build (future)
│   ├── FEEDBACK.md
│   └── ...
```

## FEEDBACK.md Template

For CLI test builds, include:

```markdown
# Feedback: <app-name>

## Setup
- **CLI version**: x.x.x
- **Template**: blank / ...
- **Assistant**: cursor / claude / opencode
- **Date**: YYYY-MM-DD

## What Worked
- ...

## Issues Encountered
- ...

## Agent Pack Gaps
- Missing skill for ...
- Recipe for X was unclear about ...

## Suggestions
- ...
```

## For AI Agents

This folder is your **primary source of battle-tested knowledge**:

1. **`coffee-assistant/`** — First app built. Validates Hyperswarm, bare-rpc, Hyperbee, QVAC streaming + tool calling. Check `KNOWLEDGE_BASE_FEEDBACK.md` for agent pack improvement notes.
2. **`coffee-assistant-ui/`** — Desktop breakthrough. Check `fixes/` for the 6 critical fixes (renderer/worker split, pear.unrouted, TextEncoder, etc.).
3. **`slack-p2p-copy/`** — P2P messaging. Check `fixes/` for Hyperswarm and real-time sync patterns.
4. **CLI test builds** — Scan `*/FEEDBACK.md` for recurring agent pack issues.
