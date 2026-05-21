# Unstoppable Node Desktop

Pear Desktop dashboard for the [Unstoppable Node](../node/). This is the
same node daemon as `unstoppable-node` but with a graphical control panel:

- See which apps are paired, what cores and drives they're syncing
- Watch peer connections come and go in real time
- Toggle the AI provider on/off (via `--ai` / `--ai-mock` launch flags)
- Unpair apps you no longer want to replicate

## Running

```bash
# One-time install inside the monorepo
pnpm install

# Launch the dashboard (CLI daemon can be stopped first)
pnpm --filter unstoppable-node-desktop dev
```

The dashboard binds to the same local discovery topic as `unstoppable-node`,
so paired apps from either mode will connect to this daemon.

## Flags

Launch flags are picked up from `Pear.config.args`:

- `--ai` — load a real QVAC model and advertise `services.ai = true`
- `--ai-mock` — echo-mode AI provider, useful for UI development

## Architecture

```
┌─ Pear Desktop app (unstoppable-node-desktop) ───┐
│                                                 │
│  ┌─ Renderer (index.html + app/index.js) ─┐    │
│  │                                        │    │
│  │  Live status UI, paired apps, log view │    │
│  │                                        │    │
│  └────────────────┬───────────────────────┘    │
│                   │ Pear.worker.pipe() (NDJSON) │
│  ┌────────────────┴───────────────────────┐    │
│  │                                        │    │
│  │  Bare worker (worker.js)               │    │
│  │  ┌────────────────────────────────┐    │    │
│  │  │ NodeDaemon (from packages/node)│    │    │
│  │  │  - Corestore                   │    │    │
│  │  │  - Hyperswarm (discovery)      │    │    │
│  │  │  - Hyperswarm (replication)    │    │    │
│  │  │  - AIProvider (optional)       │    │    │
│  │  └────────────────────────────────┘    │    │
│  └────────────────────────────────────────┘    │
└─────────────────────────────────────────────────┘
```

The worker embeds `NodeDaemon` directly and forwards its events (plus a
periodic status snapshot) to the renderer over a newline-delimited JSON
pipe. UI commands (`unpair`, `refresh-status`, `shutdown`) travel back
the same way.

## Status

- Phase 1 (the basics) ✓
  - App list with unpair, live peer/core/drive counts, event log
- Phase 2 (future)
  - Graphs for bandwidth and replication progress
  - Model picker UI for AI provider
  - Pair approval flow (today pairing is always accepted)
