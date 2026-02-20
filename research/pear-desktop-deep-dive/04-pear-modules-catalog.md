# 04 — Pear Modules Catalog

Every `pear-*` module and when you need it.

## Application Libraries

### pear-electron
**What**: Creates an Electron BrowserWindow for your Pear desktop app.
**When**: Every Pear Desktop app. This is the shell that renders your HTML.
**Usage**:
```javascript
import Runtime from "pear-electron"
const runtime = new Runtime()
const pipe = await runtime.start({ bridge })
```
**Note**: The `pre` field in `package.json` must be `"pear-electron/pre"` for the Pear global to be available in the renderer.

### pear-bridge
**What**: Creates a local HTTP bridge so Electron can load local HTML files.
**When**: Every Pear Desktop app that uses `pear-electron`.
**Usage**:
```javascript
import Bridge from "pear-bridge"
const bridge = new Bridge({ waypoint: "/index.html" })
await bridge.ready()
```
**Why**: Electron needs an HTTP server to load local content. `pear-bridge` creates one transparently.

### pear-run
**What**: Spawns a child Pear process (worker) and returns a bidirectional pipe.
**When**: Any time you need a worker process (P2P, AI, native modules).
**Usage**:
```typescript
import run from "pear-run"
const pipe = run("/dist/worker/index.js", [arg1, arg2])
pipe.write(JSON.stringify(msg) + "\n")
pipe.on("data", handler)
```
**Note**: The spawned process runs in Bare runtime with full native module access. `pear-run` uses fd 3 for the pipe (not stdin/stdout).

### pear-pipe
**What**: The worker-side counterpart of `pear-run`. Gets the pipe from the parent.
**When**: Inside a worker that was spawned by `pear-run`.
**Note**: In practice, workers use `Pear.worker.pipe()` (the Pear global API) rather than importing `pear-pipe` directly.

### pear-hotmods
**What**: Framework-agnostic live reload for `pear-electron` apps.
**When**: Dev mode only — watches file changes and reloads the UI.
**Usage**: Listed as devDependency, used with SWC's React Refresh.
**Note**: Requires `Pear.config.dev` check to only activate in dev mode.

### pear-inspect
**What**: Enables Chrome DevTools remote debugging over Hyperswarm.
**When**: Debugging deployed/production Pear apps remotely.
**Note**: Useful for debugging apps running on other machines — connects via P2P.

### pear-crasher
**What**: Crash logger for uncaught exceptions and rejections.
**When**: Production apps that need crash reporting.

### pear-message / pear-messages
**What**: Inter-app messaging via pattern-matched objects.
**When**: Multiple Pear apps need to communicate (e.g., a launcher app + worker app).
**Note**: `pear-message` sends, `pear-messages` receives.

### pear-updates
**What**: Receives notifications when the platform or app has updates.
**When**: Apps that want to show "update available" notices.

### pear-wakeups
**What**: Receives wakeup events, including `pear://` link clicks from outside the app.
**When**: Deep linking — user clicks a `pear://` link in browser and your app opens.

### pear-user-dirs
**What**: Gets paths to user-specific directories (documents, downloads, etc.).
**When**: Need to save files to standard OS locations.

## Common Libraries

### pear-drop
**What**: Reset app data (drop data, factory reset).
**When**: Settings screen with "reset app" option.

### pear-stage
**What**: Synchronizes local files to the Pear app drive for deployment.
**When**: `pear stage` CLI command (deployment pipeline).

### pear-seed
**What**: Seeds (serves) a Pear app to the network.
**When**: Making your app available to other peers after staging.

### pear-release
**What**: Sets production release version.
**When**: `pear release` CLI command.

### pear-dump
**What**: Syncs files from a pear link to a local directory.
**When**: Downloading/cloning a Pear app.

### pear-link
**What**: Parser/serializer for `pear://` links with alias resolution.
**When**: Working with Pear links programmatically.

### pear-info
**What**: Read project info from a Pear link.
**When**: Inspecting remote Pear apps.

### pear-gracedown
**What**: Graceful shutdown helper for long-running processes.
**When**: Worker processes that need clean shutdown with `pipe.autoexit = false`.

### pear-opwait
**What**: Wraps Pear operation streams into promises.
**When**: Making Pear CLI operations awaitable.

## Integration Libraries

### pear-appdrive
**What**: Read-only Hyperdrive API for app drives.
**When**: Reading files from the staged app bundle at runtime.

### pear-aliases
**What**: List of `pear://` aliases.
**When**: Resolving human-readable app names to keys.

## Summary: Minimum Dependencies for a Desktop App

| Dependency | Type | Required? |
|-----------|------|-----------|
| `pear-electron` | runtime | Yes (all desktop apps) |
| `pear-bridge` | runtime | Yes (all desktop apps) |
| `pear-run` | runtime | Yes if using workers |
| `pear-interface` | types | devDependency for TypeScript |
| `pear-hotmods` | dev | devDependency for live reload |
| `react`, `react-dom` | UI | If using React |
| `bare-process` | worker | If worker needs process info |
| `bare-fs` | worker | If worker needs file system |
| `bare-path` | worker | If worker needs path ops |
| `bare-env` | worker | If worker needs env vars |
| `bare-crypto` | worker | If worker needs crypto |
