# `us` — The Unstoppable Stack CLI

> Scaffold P2P apps, run them past a `doctor` check, remote-control your AI
> coding sessions from your phone, and search the web locally — all from one
> binary.

```bash
npx @unstoppable-stack/cli@latest init my-app
# or install globally
npm install -g @unstoppable-stack/cli
us --help
```

- **Website:** [unstoppable.dev](https://unstoppable.dev)
- **Repo:** [unstoppable-stack/unstoppable-dev](https://github.com/unstoppable-stack/unstoppable-dev)
- **License:** MIT

---

## Table of contents

- [Install](#install)
- [Quick start](#quick-start)
- [Commands](#commands)
  - [`us init`](#us-init)
  - [`us scaffold`](#us-scaffold)
  - [`us doctor`](#us-doctor)
  - [`us remote`](#us-remote) *(opt-in, `full` profile only)*
  - [`us research`](#us-research) *(opt-in, `full` profile only)*
  - [`us search`](#us-search) *(opt-in, `full` profile only)*
- [Platforms & features](#platforms--features)
- [Build profiles](#build-profiles)
- [Environment variables](#environment-variables)
- [Troubleshooting](#troubleshooting)
- [Development](#development)

---

## Install

```bash
# Global install (recommended)
npm install -g @unstoppable-stack/cli
us --version

# Or run without installing
npx @unstoppable-stack/cli@latest <command>
```

Requires Node **20+**. Run `us doctor` after installing to verify the rest of
your environment.

---

## Quick start

### 1. Bootstrap a new project with AI rules

```bash
us init
# ? Project name: my-app
# ? AI assistant: Cursor
```

The generated project includes pre-loaded agent rules for your chosen
assistant (Claude, Cursor, OpenCode, or Codex). Open it, describe what you
want, and the AI already knows the stack.

### 2. Scaffold a specific platform

```bash
us scaffold app -p pear-desktop -n my-app -f local-ai
us scaffold app -p expo-mobile  -n my-mobile-app
us scaffold app -p node-cli     -n my-daemon -f local-ai,wallet
```

See [Platforms & features](#platforms--features) for the matrix.

### 3. Check your environment before you start

```bash
us doctor                 # check everything
us doctor -p pear-desktop # only what pear-desktop needs
us doctor --json          # machine-readable
```

### 4. Remote-control your AI session from your phone

```bash
us remote start           # background daemon
us remote pair            # print a QR — scan from the mobile app
us remote run claude      # spawn `claude` inside a session your phone can follow
```

---

## Commands

### `us init`

Interactive project bootstrap. Creates a new directory, copies a minimal
starter, wires up the AI assistant of your choice, and (optionally) runs
`npm install`.

```
us init [project-name] [options]

Options:
  -a, --assistant <assistant>  AI assistant (claude, cursor, opencode, codex, none)
  --no-install                 Skip dependency installation
```

**Example:**

```bash
us init my-app --assistant cursor
```

Output (abridged):

```
  Project created at: /path/to/my-app

  AI Assistant configured (cursor):
    ✓ .cursor/rules/...

  Next steps:
    cd my-app
    npm run dev

  Scaffold an app inside your project:
    us scaffold app -p expo-mobile -n my-app -f local-ai
```

---

### `us scaffold`

Generate a real, runnable app for a specific platform. Every generator is
exercised by the E2E suite in CI — if it's listed here, it boots.

```
us scaffold <subcommand>

Subcommands:
  app              Scaffold a new application
  list-platforms   List available platforms (JSON)
  list-features    List available features and platform compatibility (JSON)
```

#### `us scaffold app`

```
us scaffold app [options]

Options:
  -p, --platform <platform>  pear-desktop | expo-mobile | node-cli
  -n, --name <name>          Project name
  -f, --features <features>  Comma-separated: local-ai, wallet, node-sync
  -o, --output <dir>         Output directory (default: ./<name>)
  --force                    Overwrite existing output directory
```

**Examples:**

```bash
# Minimal Pear Desktop app (Hyperswarm + Hyperbee built in)
us scaffold app -p pear-desktop -n chat-app

# Pear Desktop with local AI + wallet
us scaffold app -p pear-desktop -n ai-wallet -f local-ai,wallet

# Expo Mobile with local AI and auto-register with a local Unstoppable Node
us scaffold app -p expo-mobile -n notes -f local-ai,node-sync

# Node CLI with everything
us scaffold app -p node-cli -n my-cli -f local-ai,wallet,node-sync
```

Every scaffold ships with:

- Hyperswarm + Corestore P2P networking
- Hyperbee key-value storage
- A working KV demo screen (save → fetch round-trip)
- A pre-wired agent pack for Claude / Cursor / OpenCode / Codex (when you
  ran `us init`, or via `--assistant` in the future)
- A `README.md` with run instructions for the platform

---

### `us doctor`

Check that every tool a platform needs is installed and up-to-date. Groups
findings by platform so you can see at a glance what's ready.

```
us doctor [options]

Options:
  -p, --platform <platform>  Only check tools needed for this platform
                             (pear-desktop | node-cli | expo-mobile)
  --json                     Output as JSON (for scripting / CI)
```

**Example:**

```bash
$ us doctor -p expo-mobile

  Environment Check

  + Node.js (20.19)
  + npm (10.8)
  + git (2.47)
  + Xcode command-line tools (72)
  + iOS Simulator
  + CocoaPods (1.15)
  + Maestro (mobile E2E) (2.3)
  - Unstoppable Node optional
      Optional. Install with `npm i -g unstoppable-node` to enable `node-sync`.
  + TypeScript (5.9)

  All required tools found
```

`--json` emits a structured report you can pipe into `jq` or consume from a
CI step.

---

### `us remote`

> **Opt-in.** Built into the `full` profile only; not present in the
> default `minimal` tarball published to npm. Build from source with
> `pnpm build:full` (or `US_FEAT_REMOTE=true pnpm build`) to enable.
> See [Build profiles](#build-profiles).

P2P remote control for AI coding sessions. The daemon wraps a shell command
(e.g. `claude`, `cursor-agent`, `opencode`) and streams its PTY over
Hyperswarm + SecretStream to the companion mobile app — no cloud relay,
end-to-end encrypted.

```
us remote <subcommand>

Subcommands:
  start [options]    Start the background daemon
  stop               Stop the background daemon
  pair               Enter pairing mode (show QR code for phone)
  run <cmd...>       Start a new session (spawns command via daemon)
  sessions           List all sessions managed by the daemon
  logs [session-id]  View session output logs
  phones             Show connected phones
  status             Show daemon status, paired devices, and connections
  testnet            Start a local DHT testnet for same-machine testing
  hook [options]     Output shell hook for auto-wrapping AI commands
```

**Typical flow:**

```bash
us remote start                     # one-time: start the daemon
us remote pair                      # scan the QR from the Unstoppable Remote app
us remote run claude                # now your phone can watch + type into the session
us remote sessions                  # list what's running
us remote logs <session-id>         # replay a session
us remote status                    # daemon + paired-device health
```

**Shell hook** (optional — auto-wraps common AI commands):

```bash
# ~/.zshrc
eval "$(us remote hook --commands claude,cursor-agent,opencode,codex)"
```

After sourcing, running `claude` in your terminal silently goes through
`us remote run claude` so it's always phone-streamable.

---

### `us research`

> **Opt-in.** `full` profile only — see [Build profiles](#build-profiles).

Scripted experiments — primarily used to validate the CLI itself. Most
users won't need this, but it's the fastest way to sanity-check a change to
the scaffolding or agent-pack output.

```
us research <subcommand>

Subcommands:
  run <config-path>   Run an experiment from a JSON config
  scaffold-test       Quick scaffold validation across platform × feature combos
  scaffold-matrix     Show the scaffold test matrix without running
```

**Example:**

```bash
us research scaffold-test --depth install --platform pear-desktop
us research scaffold-matrix
```

`scaffold-test` depths:

| Depth     | What it does                            | Duration |
|-----------|-----------------------------------------|----------|
| `quick`   | Scaffold only, structural check         | seconds  |
| `install` | Adds `npm install`                      | minutes  |
| `build`   | Adds platform-specific build check      | longer   |

For the full E2E suite (all platforms, all variants, up to L5 UI testing),
see [`e2e/test-scaffold.ts`](./e2e/test-scaffold.ts) and the `test:e2e:*`
scripts in [`package.json`](./package.json).

---

### `us search`

> **Opt-in.** `full` profile only — see [Build profiles](#build-profiles).

A local, Tavily-compatible web search node. Ingests URLs into a local index
and exposes a search API on `localhost:7700` so local AI agents can use
retrieval without calling out to a hosted search API.

```
us search <subcommand>

Subcommands:
  start [options]    Start the search daemon on localhost:7700
  stop               Show how to stop a running search daemon
  query <query>      Search the local index (and optionally the live web)
  ingest <url>       Index a URL into the local search index
  status             Show search node status and index statistics
```

**Example:**

```bash
us search start &
us search ingest https://docs.pears.com/
us search query "hyperbee range queries"
us search status
```

The daemon speaks a subset of the Tavily REST API on `POST /search`, so you
can swap it in wherever your agent already supports Tavily. See
[`src/commands/search.ts`](./src/commands/search.ts) for the full surface.

---

## Platforms & features

Generated via `us scaffold list-platforms` and `us scaffold list-features`.

### Platforms

| ID             | Name          | Description                                          |
|----------------|---------------|------------------------------------------------------|
| `pear-desktop` | Pear Desktop  | P2P desktop app with worker bridge + HTML UI        |
| `expo-mobile`  | Expo Mobile   | iOS/Android with Bare worklet for native P2P        |
| `node-cli`     | Node.js CLI   | P2P-enabled command line tool                       |

### Features

| ID          | Name       | Platforms                                      | Status                |
|-------------|------------|------------------------------------------------|-----------------------|
| `local-ai`  | Local AI   | `pear-desktop`, `expo-mobile`, `node-cli`      | Battle-tested (desktop, CLI); mobile: alpha |
| `wallet`    | Wallet     | `pear-desktop`, `node-cli`                     | Stub (WDK integration coming) |
| `node-sync` | Node Sync  | `node-cli`, `pear-desktop`, `expo-mobile`      | `node-cli` wired; desktop + mobile pending |

Combine features with commas: `-f local-ai,wallet`.

---

## Build profiles

The CLI supports compile-time feature flags so we can publish a lean
binary and still keep internal / integration-test tooling available
during development. Flags are injected by esbuild's `define` pass, so
disabled branches are **removed from the bundle entirely** (dead-code
elimination — not just runtime-hidden).

### Profiles

| Profile   | Commands included                            | `us --version` suffix | Use                                                           |
|-----------|----------------------------------------------|-----------------------|---------------------------------------------------------------|
| `minimal` | `init`, `scaffold`, `doctor`                 | `(minimal)`           | **Default. This is what ships on npm.**                       |
| `full`    | minimal + `remote`, `research`, `search`     | `(full)`              | Local dev, integration tests, internal builds.               |

Current published tarball (`minimal`) is ~120 KB of JS across four
chunks. The `full` build adds ~155 KB for the three opt-in commands.

### Building a profile

```bash
pnpm build             # = build:minimal  (ships on npm)
pnpm build:minimal     # explicit
pnpm build:full        # all six commands

# Run tests against a full dist (needed for us remote e2e coverage):
pnpm test:full
```

### Per-flag overrides

Every flag accepts a `true` / `false` env override on top of the profile:

```bash
# minimal + re-enable just `us search`
US_FEAT_SEARCH=true pnpm build:minimal
us --version
# => 0.2.0 (minimal(+search))
```

Available flags (see [`tsup.config.ts`](./tsup.config.ts) for defaults):

| Flag              | minimal | full  | Gates                        |
|-------------------|---------|-------|------------------------------|
| `US_FEAT_INIT`    | on      | on    | `us init`                    |
| `US_FEAT_SCAFFOLD`| on      | on    | `us scaffold` + generators   |
| `US_FEAT_DOCTOR`  | on      | on    | `us doctor`                  |
| `US_FEAT_REMOTE`  | **off** | on    | `us remote` + daemon + node-pty dep |
| `US_FEAT_RESEARCH`| **off** | on    | `us research`                |
| `US_FEAT_SEARCH`  | **off** | on    | `us search`                  |

### How it works (one-liner)

Each top-level command is wired in via a dynamic `import()` inside an
`if (US_FEAT_X)` block. esbuild replaces the identifier with a literal
`true` / `false`; when it's `false` the dead branch (and the `import()`
target inside it) is dropped, so the whole command's module tree —
including any heavyweight transitive deps like `node-pty` — never reaches
the bundle.

```ts
if (US_FEAT_REMOTE) {
  const { registerRemoteCommand } = await import('./commands/remote.js')
  registerRemoteCommand(program)
}
```

Publishing always runs `prepack` → `US_BUILD_PROFILE=minimal tsup`, so the
tarball on npm is guaranteed to be minimal regardless of what the last
local `pnpm build:full` produced.

---

## Environment variables

| Variable                   | Used by                | Purpose                                                            |
|----------------------------|------------------------|--------------------------------------------------------------------|
| `QVAC_MOCK=1`              | scaffolded Node / Pear | Skip real model loading — worker returns deterministic mock output. Used by the E2E suite. |
| `EXPO_PUBLIC_QVAC_MOCK=1`  | scaffolded Expo Mobile | Same, for the mobile bundle (must be `EXPO_PUBLIC_*` to be bundled). |
| `NPM_TOKEN`                | CI                     | Auth for private `@qvac/*` packages required by `expo-mobile` + `local-ai`. Optional; variants needing it are skipped when unset. |

---

## Troubleshooting

**`us: command not found` after `npm install -g`**
Your global npm `bin` isn't on `$PATH`. Run `npm config get prefix` — add
`<prefix>/bin` to `$PATH`, or use `npx @unstoppable-stack/cli`.

**`us doctor` says Pear is missing**
Install the runtime:
```bash
npm install -g pear
pear --version
```

**Expo Mobile scaffold: `bare-pack` fails with `Cannot find module 'crypto'`**
Already handled — the generator emits `bare-pack --defer crypto`. If you
copied the worker manually, add that flag. See
[`src/generators/expo-mobile.ts`](./src/generators/expo-mobile.ts).

**Expo Mobile / `local-ai` install fails with a `404` for `@qvac/util-transcription`**
That package is published under a private npm scope. Either:
- set `NPM_TOKEN` (and `echo "//registry.npmjs.org/:_authToken=$NPM_TOKEN" >> ~/.npmrc`), or
- skip the variant for now (`--skip-variant expo-mobile/local-ai` in `test:e2e:*`).

**Scaffold fails with `ERR_INVALID_APP_NAME`**
Pear app names allow only `a-z0-9-_/@`. If you need to include a separator
like `+` in your own naming convention, sanitize before passing to
`-n` — the `pear.name` field in the generated `package.json` must match
Pear's validator.

**Workspace hoisting swallowed `pear-electron`**
When scaffolding inside an existing pnpm workspace, platform deps can hoist
to the root. Either scaffold outside the workspace, or add the project's
`node_modules` back to the Pear app path. The `scaffold-project` skill
documents the workaround in detail.

---

## Development

This package lives inside the
[Unstoppable Stack monorepo](https://github.com/unstoppable-stack/unstoppable-dev).

```bash
git clone https://github.com/unstoppable-stack/unstoppable-dev.git
cd unstoppable-dev
pnpm install

cd packages/cli

# Build
pnpm build          # tsup → dist/

# Watch
pnpm dev

# Tests
pnpm test                   # vitest (unit + snapshots)
pnpm test:integration       # real Hyperswarm, requires network
pnpm test:e2e:ci            # full CI sweep (all platforms, mocked AI)
pnpm test:e2e:desktop:l5    # desktop + Playwright UI round-trip

# Install locally for manual testing
npm install -g .
us --version
```

Key directories:

- `src/commands/` — one file per top-level subcommand
- `src/generators/` — platform scaffolders (`pear-desktop`, `expo-mobile`, `node-cli`)
- `src/remote/` — `us remote` daemon + client
- `src/research/` — `us research` experiment runner
- `agent-pack-src/` — bundled copy of the agent pack (synced from `packages/agent-pack/src/`)
- `e2e/test-scaffold.ts` — the full end-to-end runner
- `templates/` — the starter tree copied by `us init`

See the repo's [planning/features/scaffold-e2e-testing.md](https://github.com/unstoppable-stack/unstoppable-dev/blob/main/planning/features/scaffold-e2e-testing.md)
for the testing strategy.

---

## License

MIT © The Unstoppable Stack contributors
