# Feature Profiles — Build-Time Exclusion

## Problem

The CLI ships dev-only commands (`search`, `remote`, `research`) and the Node has planned services (AI Provider, Search) that are only needed during internal development and testing. When we publish the CLI to npm or deploy the Node, these should not be present at all — not hidden behind a flag, but literally absent from the build.

## Design: Two Entry Points

Each package has two entry points:

- **Production entry** — what gets published. Core features only.
- **Dev entry** — what we use locally. Imports the production entry and adds dev commands/services on top.

This is a build-time split, not a runtime toggle. The dev code is never bundled into the published package.

---

## CLI (`packages/cli/`)

### Current state

`src/us.ts` registers everything:

```
us init        ← core
us scaffold    ← core
us doctor      ← core
us search      ← dev only
us remote      ← dev only
us research    ← dev only
```

### After

**`src/us.ts`** — Production entry (published as `us` binary):

```typescript
import { Command } from 'commander'
import { registerInitCommand } from './commands/init.js'
import { registerScaffoldCommand } from './commands/scaffold.js'
import { registerDoctorCommand } from './commands/doctor.js'

const program = new Command()
program.name('us').description('The Unstoppable Stack CLI').version('0.2.0')

registerInitCommand(program)
registerScaffoldCommand(program)
registerDoctorCommand(program)

program.parse()
```

**`src/us-dev.ts`** — Dev entry (local use only):

```typescript
import { Command } from 'commander'
import { registerInitCommand } from './commands/init.js'
import { registerScaffoldCommand } from './commands/scaffold.js'
import { registerDoctorCommand } from './commands/doctor.js'
import { registerSearchCommand } from './commands/search.js'
import { registerRemoteCommand } from './commands/remote.js'
import { registerResearchCommand } from './commands/research.js'

const program = new Command()
program.name('us').description('The Unstoppable Stack CLI (dev)').version('0.2.0-dev')

registerInitCommand(program)
registerScaffoldCommand(program)
registerDoctorCommand(program)
registerSearchCommand(program)
registerRemoteCommand(program)
registerResearchCommand(program)

program.parse()
```

### Build scripts

```json
{
  "scripts": {
    "build": "tsup src/us.ts --format esm",
    "build:dev": "tsup src/us-dev.ts src/remote/daemon-entry.ts src/remote/test-client.ts --format esm --external node-pty",
    "dev": "tsup src/us-dev.ts src/remote/daemon-entry.ts src/remote/test-client.ts --format esm --watch --external node-pty"
  },
  "bin": {
    "us": "./dist/us.js"
  }
}
```

### Workflow

| Action | Entry | What's available |
|--------|-------|-----------------|
| `npm publish` / `npm install -g` | `us.ts` → `dist/us.js` | `init`, `scaffold`, `doctor` |
| Local dev: `pnpm dev` | `us-dev.ts` → `dist/us-dev.js` | Everything |
| Local testing | `npx tsup src/us-dev.ts --format esm && npm i -g .` | Everything (needs bin override — see below) |

For local testing with all commands, temporarily point `bin` at the dev build:

```bash
# Build dev entry
npx tsup src/us-dev.ts --format esm --external node-pty

# Override bin temporarily (or use a symlink)
node dist/us-dev.js search start
```

Or add a second binary name for dev:

```json
{
  "bin": {
    "us": "./dist/us.js",
    "us-dev": "./dist/us-dev.js"
  }
}
```

The `us-dev` binary is excluded from `"files"` in package.json so it never ships to npm. Only `dist/us.js` is included.

### npm publish safety

The `"files"` field already controls what ships. We can be explicit:

```json
{
  "files": [
    "dist/us.js",
    "dist/us.js.map",
    "templates",
    "agent-pack-src"
  ]
}
```

This ensures `dist/us-dev.js`, `dist/remote/`, and `dist/search/` are never published even if they exist in `dist/`.

---

## Node (`packages/node/`)

### Current state

`src/index.js` starts the Node with hardcoded services: `{ data: true, files: false, ai: false }`.

The Node doesn't have search or AI services yet — they're planned. But we should set up the pattern now.

### After

**`src/index.js`** — Production entry (published as `unstoppable-node` binary):

```javascript
// Starts with core services only: data sync + file sync
const services = { data: true, files: true, ai: false, search: false }
const node = new NodeDaemon(storagePath, { ...opts, services })
```

**`src/index-dev.js`** — Dev entry (local use):

```javascript
// Starts with all services enabled
const services = { data: true, files: true, ai: true, search: true }
const node = new NodeDaemon(storagePath, { ...opts, services })
```

Additionally, accepts `--services` flag for granular control:

```bash
# Dev: all services
node src/index-dev.js

# Dev: pick specific services
node src/index-dev.js --services data,files,search

# Production: always core only
unstoppable-node start
```

### NodeDaemon changes

The `NodeDaemon` class already takes `opts` and sends `services` in `pairAccepted`. We just need to:

1. Store `this.services` from opts
2. Only start service handlers that are enabled
3. Reject messages for disabled services with a clear error

```javascript
constructor(storagePath, opts = {}) {
  super()
  this.services = {
    data: true,
    files: true,
    ai: false,
    search: false,
    ...opts.services
  }
}
```

When AI Provider or Search are implemented, they check `this.services.ai` / `this.services.search` before starting.

### Build scripts

```json
{
  "scripts": {
    "start": "node src/index.js",
    "start:dev": "node src/index-dev.js",
    "dev": "node --watch src/index-dev.js"
  },
  "bin": {
    "unstoppable-node": "./src/index.js"
  }
}
```

---

## What counts as "dev only"

| Component | Category | Reason |
|-----------|----------|--------|
| `us search` | Dev | Experimental P2P search, not stable |
| `us remote` | Dev | P2P remote coder for dev workflow |
| `us research` | Dev | Internal experiment runner |
| Node: AI Provider | Dev | Requires QVAC, resource-heavy, not validated |
| Node: Search | Dev | Experimental, depends on `us search` |

### Graduation path

When a dev feature is stable enough for production:
1. Move its `register*Command` call from `us-dev.ts` to `us.ts`
2. Enable the service in `index.js` (Node)
3. Update this doc

---

## Implementation

| # | Task | Where | Effort |
|---|------|-------|--------|
| 1 | Split `us.ts` → `us.ts` (core) + `us-dev.ts` (all) | `packages/cli/src/` | Small |
| 2 | Update `package.json` build scripts and files field | `packages/cli/package.json` | Small |
| 3 | Create `index-dev.js` for Node, wire services config | `packages/node/src/` | Small |
| 4 | Update project rules (CLAUDE.md, .cursor/rules) for new build workflow | Root | Small |
| **Total** | | | **~1-2 hours** |

---

## Developer Workflow After

```bash
# ── Local development (all features) ──
cd packages/cli
pnpm dev                        # watches us-dev.ts
npx tsup src/us-dev.ts --format esm --external node-pty
npm install -g .                # installs as 'us' (us-dev.js via bin override)
us search start                 # works
us remote pair                  # works
us research run test.json       # works

# ── Publishing (core only) ──
cd packages/cli
pnpm build                      # builds us.ts only
npm publish                     # ships init, scaffold, doctor
# search, remote, research are not in the bundle

# ── Node local dev ──
cd packages/node
npm run dev                     # runs index-dev.js with all services
                                # AI Provider + Search available

# ── Node production ──
npm install -g unstoppable-node
unstoppable-node start          # runs index.js — data + files only
```
