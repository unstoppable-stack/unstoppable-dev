# Unstoppable Node Desktop

Pear Desktop dashboard for the [Unstoppable Node](../node/). This is the
same node daemon as `unstoppable-node` but with a graphical control panel:

- See which apps are paired, what cores and drives they're syncing
- Watch peer connections come and go in real time
- Toggle the AI provider on/off (via `--ai` / `--ai-mock` launch flags)
- Unpair apps you no longer want to replicate
- Use the system tray menu to show or quit the dashboard

## Running

```bash
# One-time install inside the monorepo
pnpm install

# Launch the dashboard (CLI daemon can be stopped first)
pnpm --filter unstoppable-node-desktop dev
```

The dashboard binds to the same local discovery topic as `unstoppable-node`,
so paired apps from either mode will connect to this daemon.

The tray menu is enabled when Pear/Electron supports it. It exposes Show and
Quit actions; close-to-tray is intentionally not enabled yet because Linux tray
support varies by desktop environment.

When pair approvals are pending, supported desktop environments show an app
badge with the pending request count. Config can also enable a short generated
sound and best-effort window restore for pair requests; both are off by default.

## Flags

Launch flags are picked up from `Pear.config.args`:

- `--ai` — load a real QVAC model and advertise `services.ai = true`
- `--ai-mock` — echo-mode AI provider, useful for UI development

## Smoke Testing

```bash
npm run test:smoke
NODE_SMOKE_RUNS=20 NODE_SMOKE_TOPIC=default BARE_BIN=node npm run test:smoke
```

`NODE_SMOKE_TOPIC=isolated` is the default and injects a fresh topic for CI.
`NODE_SMOKE_TOPIC=default` leaves `UNSTOPPABLE_NODE_TOPIC` unset so the headless
daemon and demo client use the real machine-local discovery topic.

## Architecture

```
┌─ Pear Desktop app (unstoppable-node-desktop) ───┐
│                                                 │
│  ┌─ Renderer (index.html + app/index.js) ─┐    │
│  │                                        │    │
│  │  Live status UI, paired apps, log view │    │
│  │                                        │    │
│  └────────────────┬───────────────────────┘    │
│                   │ pear-pipe NDJSON stream      │
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
pipe. UI commands (`unpair`, `refresh-status`, `shutdown`, config updates,
quota changes, backup/import, and trust decisions) travel back
the same way.

## Status

- Phase 1 (the basics) ✓
  - App list with unpair, live peer/core/drive counts, persistent event log
  - Pair approval modal, trust registry, promote/forget controls
  - Config tab, AI controls, storage quotas, backup/import, tray menu
- Phase 2 (future)
  - Graphs for bandwidth and replication progress
  - Richer model picker UI for QVAC provider
  - Close-to-tray and richer tray status controls
