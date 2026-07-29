# Unstoppable Node Desktop

Pear Desktop home for a user's **Personal Node**. It runs the same daemon as
`unstoppable-node`, with a control panel intended to make protection and local
AI understandable without requiring protocol knowledge:

- See which apps are protected and whether protection is active or paused
- Review each app's storage use and choose a human-readable storage limit
- Allow or block AI access per app and turn local AI on or off globally
- Inspect technical details only when needed
- Remove apps that should no longer connect
- Use the system tray menu to show or quit the dashboard

## Running

```bash
# One-time install inside the monorepo
pnpm install

# Launch the dashboard (CLI daemon can be stopped first)
pnpm --filter unstoppable-node-desktop dev
```

The dashboard binds to the same machine-local discovery topic as
`unstoppable-node`, so apps on this computer connect without setup. Discovery
across a phone or second computer requires an explicit shared topic; a safe
end-user device-linking flow is not implemented yet.

The tray menu is enabled when Pear/Electron supports it. It exposes Show,
Pause All, Resume All, and Quit actions. Closing the dashboard hides it to the tray on supported desktop
platforms; Linux keeps normal close behavior because tray support varies by
desktop environment.

When app approvals are pending, supported desktop environments show an app
badge with the pending request count. Advanced settings can enable a short generated
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
  - Protected-app list with plain-language state and expandable technical details
  - Permission modal with least-privilege capability summaries
  - Advanced settings, AI controls, storage limits, settings export/import, tray menu
- Phase 2 (future)
  - QR/device-code linking for phones and additional computers
  - Encrypted app-data backup, restore, retention, and delete controls
  - Graphs for bandwidth and replication progress
  - Richer model picker UI for QVAC provider
  - Close-to-tray and richer tray status controls
