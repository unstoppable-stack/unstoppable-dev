# Scaffold E2E Testing Plan

> **Goal:** Every combination of `us scaffold app` produces an app that
> installs, boots, and renders the correct UI. Tests are layered so CI always
> runs the fast smoke suite, while the full local suite covers model-dependent
> flows before a release.

---

## Prerequisites: Feature Simplification

Before the test work can be finalized, the feature flags need to be simplified
(see [CLI simplification discussion](../status/README.md)). This affects the
variant matrix.

**Current features:** `p2p`, `kv-storage`, `qvac`, `autobase`

**New features:**
- `local-ai` — QVAC SDK, model loading, streaming chat UI (replaces `qvac`)
- `wallet` — WDK, payments (new, stub until WDK is validated)

**Removed as flags, included in base:**
- `p2p` — Hyperswarm + Corestore always scaffolded
- `kv-storage` — Hyperbee always scaffolded

**Removed from flags, becomes a skill:**
- `autobase` — too bespoke per app, agent skill is more appropriate

**Why this matters for testing:** The variant matrix shrinks from 16 combos to
4 per platform, which is maintainable in CI.

---

## Test Architecture

Three independent layers. Each layer catches different classes of failure.

### Layer 1 — Generator unit tests (already done)

**Location:** `packages/cli/src/__tests__/`  
**Runner:** Vitest  
**When:** Every PR, every commit, <5s  
**What it tests:**

- Generator functions produce the correct set of files
- No duplicate file paths across feature combos
- `package.json` parses as valid JSON with required fields
- Feature-conditional content is present (`testID` attributes, correct imports,
  correct `package.json` deps)
- Platform-specific invariants (e.g. `pear.type === 'desktop'`, Expo plugins array)

**What it does NOT test:** Whether the generated code actually runs. A generator
test can pass while the generated app crashes on boot.

**Files to update after feature simplification:**
- `generators.test.ts` — update combos, rename `qvac` → `local-ai`
- `pear-desktop-generator.test.ts` — same

---

### Layer 2 — Scaffold integration tests (CI-safe, no running app)

**Location:** `packages/cli/e2e/test-scaffold.ts` (existing file, extend it)  
**Runner:** `npx tsx e2e/test-scaffold.ts`  
**When:** On every PR (GitHub Actions), ~5–15 min depending on variant  
**Requires:** Node.js, npm. No Xcode, no Pear, no simulator, no model.

This layer runs the CLI, installs dependencies, and verifies the project is
structurally and syntactically correct. It uses the existing level system:

| Level | What runs | Duration (approx.) |
|-------|-----------|---------------------|
| 1 | `us scaffold app` writes files to temp dir | 2–5s |
| 2 | `npm install` resolves all dependencies | 60–120s |
| 3 | Platform-specific structural check (see below per platform) | 5–30s |

**Level 3 per platform:**

*`pear-desktop`:*  
Check that all required files exist and contain the expected content:
- `package.json` has `pear.type === "desktop"`, `pear.pre`, `pear.routes`, `pear.unrouted`
- `worker.js` contains feature-gated imports (e.g. `@qvac/sdk` for `local-ai`)
- `app/index.js` contains the correct `data-testid` sections for each feature
- `app/bridge.js` exists and references `pear-run`
- No file contains an obvious syntax error (run `node --check <file>` on each `.js`)

*`expo-mobile`:*  
- `app.json` parses correctly with Expo plugin array present
- `metro.config.js` exists
- `src/contexts/WorkletContext.tsx` exists when `local-ai` is selected
- `bare/index.js` exists when `local-ai` is selected
- TypeScript check: `npx tsc --noEmit` passes on the generated `app/index.tsx`

*`node-cli`:*  
- `src/index.ts` exists and passes `npx tsc --noEmit`
- Feature-specific manager files exist (`ai-manager.ts` for `local-ai`)
- `package.json` has correct deps for each feature

**Variant matrix for CI:**

| Platform | Variant | Features | Level |
|----------|---------|----------|-------|
| `pear-desktop` | `bare` | none | 1–3 |
| `pear-desktop` | `local-ai` | `local-ai` | 1–3 |
| `pear-desktop` | `wallet` | `wallet` | 1–3 |
| `expo-mobile` | `bare` | none | 1–3 |
| `expo-mobile` | `local-ai` | `local-ai` | 1–3 |
| `node-cli` | `bare` | none | 1–3 |
| `node-cli` | `local-ai` | `local-ai` | 1–3 |

7 variants, all CI-safe, no model needed.

---

### Layer 3 — Full E2E app tests (local only until CI runner is set up)

**Location:** `packages/cli/e2e/test-scaffold.ts` (extend existing levels 4–5)  
**When:** Manually before a release, or on a dedicated self-hosted runner  
**Requires:** Varies per platform (see below)

This layer actually launches the app and interacts with the UI.

---

## Platform E2E Details

---

### Pear Desktop — Level 4: Worker spawn test

**Why this approach:** `worker.js` is plain Node.js. It communicates over
`process.stdin` / `process.stdout` as newline-delimited JSON (NDJSON). We can
test it in isolation without launching Electron or the `pear` CLI. This is fast,
reliable, and works anywhere Node.js runs.

**How it works:**

```
Test harness                    worker.js
────────────                    ─────────
spawn(node, [worker.js])
write NDJSON to stdin  ──────►  parse command
                       ◄──────  emit NDJSON to stdout
read stdout, assert
```

**What to assert:**

1. Worker emits `{ type: 'workerReady' }` within 1s of spawn
2. Worker emits `{ type: 'init-complete' }` (or feature-specific ready events)
   within 5s
3. For `p2p` (base): emits `{ type: 'status', service: 'p2p', status: 'ready' }`
4. For `kv-storage` (base): emits `{ type: 'status', service: 'storage', status: 'ready' }`
5. For `local-ai` (with `QVAC_MOCK=1`): emits `{ type: 'status', service: 'ai',
   status: 'ready' }` within 500ms
6. For `local-ai` (with mock): send `{ type: 'chat', history: [{role:'user',
   content:'hello'}] }` → receive `chat-token` events + `chat-done`
7. Worker exits cleanly on `{ type: 'shutdown' }` — no hanging processes

**Problem:** `worker.js` uses `Pear.worker.pipe()` and `Pear.config.storage`
from the Pear runtime globals. These don't exist when running with plain `node`.

**Solution:** The generator should produce a testable worker. Two options:

*Option A — Test harness shim (preferred, no generator change):*  
Write a small `worker-test-harness.js` that injects the `Pear` global before
importing `worker.js`:

```js
// packages/cli/e2e/worker-harness.js
import { createRequire } from 'module'
import { Duplex } from 'stream'
import os from 'os'
import path from 'path'

// Inject Pear global
const mockPipe = new Duplex({ read() {}, write(chunk, _, cb) { cb() } })
globalThis.Pear = {
  worker: { pipe: () => mockPipe },
  config: { storage: path.join(os.tmpdir(), 'us-e2e-worker-storage') },
  exit: () => process.exit(0),
}

// Now import the worker
await import(process.argv[2])
```

The test spawns `node worker-harness.js /path/to/worker.js`, pipes NDJSON, reads
responses.

*Option B — Generator produces a thin testability layer:*  
The generated `worker.js` detects `process.env.WORKER_TEST_MODE=1` and uses
`process.stdin` / `process.stdout` directly instead of `Pear.worker.pipe()`.
This makes the worker self-contained for testing but adds runtime code to the
generated file.

**Recommendation: Option A.** Keeps generated code clean. The harness file
lives in `packages/cli/e2e/` and is never shipped to users.

**Duration:** ~5–10s per variant. Runs locally and in CI (no display needed).

---

### Pear Desktop — Level 5: Playwright Electron UI test

**Requires:** `pear` CLI installed, display (macOS or Linux with Xcode).

This level tests the rendered HTML UI — the feature cards, status indicators,
and interactive elements.

**Tool:** `@playwright/test` with `_electron` API.

**Problem:** `pear run -d .` launches a custom Electron fork (`pear-electron`),
not vanilla Electron. Playwright's `_electron.launch()` expects a path to an
Electron binary. It's unclear whether it works with the Pear runtime out of the
box.

**Approach:** Use `pear run --dev .` and connect Playwright to the running
Chromium DevTools Protocol port. Pear Desktop uses Chromium under the hood.
If `pear run` supports `--remote-debugging-port`, Playwright can connect with
`chromium.connectOverCDP()`. This needs to be validated in a spike.

**If CDP connection works:**

```ts
// e2e/pear-desktop-playwright.ts
const pearProcess = spawn('pear', ['run', '--dev', '--remote-debugging-port=9222', '.'])
await sleep(3000) // wait for app to start
const browser = await chromium.connectOverCDP('http://localhost:9222')
const page = browser.contexts()[0].pages()[0]

// Assert base UI
await page.waitForSelector('[data-testid="worker-status"]:has-text("✅ Ready")')
await page.waitForSelector('[data-testid="docs-section"]')

// Assert feature sections
if (features.includes('local-ai')) {
  await page.waitForSelector('[data-testid="ai-section"]')
  await page.waitForSelector('[data-testid="load-ai-btn"]')
  // With QVAC_MOCK=1:
  await page.click('[data-testid="load-ai-btn"]')
  await page.waitForSelector('[data-testid="chat-input"]')
  await page.fill('[data-testid="chat-input"]', 'hello')
  await page.click('[data-testid="chat-send-btn"]')
  await page.waitForSelector('[data-testid="chat-messages"] .bubble-assistant')
}
```

**If CDP doesn't work with Pear's Electron fork:**  
Fall back to visual screenshot diffing or accept that Level 5 for desktop
requires a manual check. Worker spawn test (Level 4) gives enough confidence
for CI.

**This level is deferred** until the CDP connection approach is validated in a
spike. Not blocking the initial release.

---

### Expo Mobile — Levels 3–5: xcodebuild + Maestro

**Requires:**
- Level 3: Xcode command-line tools (`xcode-select --install`)
- Level 4+: iOS Simulator runtime, Maestro CLI (`brew install mobile-dev-inc/tap/maestro`)

**Level 3 — xcodebuild:**

After `npm install` (which runs `postinstall` → `npx bare-pack` → `npx expo prebuild`):

```bash
xcodebuild \
  -workspace ios/<AppName>.xcworkspace \
  -scheme <AppName> \
  -configuration Debug \
  -sdk iphonesimulator \
  -arch arm64 \
  -derivedDataPath ios/build \
  build
```

Expected output contains `BUILD SUCCEEDED`. Timeout: 10 min.

This is currently the most expensive step. Options to speed it up:
- Use `xcodebuild -parallelizeTargets`
- Cache the DerivedData between runs (GitHub Actions cache on `ios/build/`)
- Only run xcodebuild on the `local-ai` variant (heaviest) and skip it for `bare`

**Level 4 — Boot simulator and install app:**

```bash
# Get simulator UDID
xcrun simctl list devices available -j | grep "iPhone 16"

# Boot
xcrun simctl boot <UDID>

# Wait for booted state
xcrun simctl bootstatus <UDID> -b

# Install the .app from DerivedData
xcrun simctl install booted ios/build/Build/Products/Debug-iphonesimulator/<AppName>.app

# Launch Metro bundler (background process)
npx expo start --port 8081 &
sleep 8
```

**Level 5 — Maestro flow:**

Maestro flows are generated at runtime from the variant's feature list. They
live in a temp `.maestro/` dir in the project folder. The `generateMaestroFlow()`
function in `test-scaffold.ts` already exists and generates correct YAML.

**Current Maestro flow (existing, already good):**

```yaml
appId: com.unstoppable.<appname>
---
- launchApp
- extendedWaitUntil:
    visible: "<appname>"
    timeout: 30000
- assertVisible: "Unstoppable Stack · Expo Mobile"
- assertVisible: "Docs — unstoppable.dev"

# P2P section (if p2p / always in new base)
- assertVisible: "P2P Network"

# KV Storage section (always in new base)
- assertVisible: "KV Storage"
- tapOn:
    id: "kv-key-input"
- inputText: "e2e-key"
- tapOn:
    id: "kv-value-input"
- inputText: "hello from e2e"
- tapOn:
    id: "kv-save-btn"
- assertVisible: 'Saved "e2e-key"'
- tapOn:
    id: "kv-fetch-btn"
- assertVisible: '"e2e-key"'

# AI section (local-ai feature only)
- assertVisible: "AI Assistant"
- assertVisible:
    id: "load-ai-btn"
# QVAC mock: tap and wait for chat input
# Only runs when QVAC_MOCK=1 is set
- tapOn:
    id: "load-ai-btn"
- extendedWaitUntil:
    visible:
      id: "chat-input"
    timeout: 5000
- tapOn:
    id: "chat-input"
- inputText: "hello"
- tapOn:
    id: "chat-send-btn"
- extendedWaitUntil:
    visible: "Mock:"
    timeout: 5000

# Relaunch test
- stopApp
- launchApp
- extendedWaitUntil:
    visible: "<appname>"
    timeout: 30000
```

**Note on QVAC in Maestro:** The Maestro flow should gate the AI tap/chat
steps on a `QVAC_MOCK` env var check. This can be done by generating two
separate flow sections and composing them, or by having the test runner pass
`--env QVAC_MOCK=1` to Maestro when running in mock mode.

---

### Node CLI — Level 3: Process spawn test

**Requires:** Node.js, tsx.

The Node CLI generator produces `src/index.ts` that boots, logs status lines,
and waits for `SIGINT`. Test by spawning it and reading stdout.

**What to assert:**

```
stdout contains: "Starting <project-name>..."
stdout contains: "P2P swarm started"          (always, since p2p is base)
stdout contains: "Storage ready"              (always, since kv is base)
stdout contains: "AI ready"                   (only with local-ai feature, uses mock)
stdout contains: "<project-name> is running"
process exits cleanly on SIGINT
```

**Implementation:**

```ts
async function testNodeCliVariant(variant: Variant): Promise<StepResult> {
  const proc = spawn('npx', ['tsx', 'src/index.ts'], {
    cwd: projectDir,
    env: { ...process.env, QVAC_MOCK: '1' },
  })

  const output = await collectOutputFor(proc, 10_000) // 10s timeout

  assert(output.includes('P2P swarm started'))
  assert(output.includes('Storage ready'))
  if (variant.features.includes('local-ai')) {
    assert(output.includes('AI ready'))
  }
  assert(output.includes('is running'))

  proc.kill('SIGINT')
  await waitForExit(proc, 3000)
}
```

**Duration:** ~3–5s per variant. Runs in CI with no special requirements.

---

## QVAC Mock Mode

This is the key enabler for testing the full AI chat path without a real model.

### Specification

When `QVAC_MOCK=1` is set in the environment, the generated app skips model
loading and uses fake responses instead.

### Pear Desktop — `worker.js` changes

In the generated `worker.js`, wrap the QVAC init and chat handler:

```js
// Before (generated today):
let modelId = null
try {
  modelId = await loadModel({ modelSrc: LLAMA_3_2_1B_INST_Q4_0, ... })
  send({ type: 'status', service: 'ai', status: 'ready', modelId })
} catch (err) {
  send({ type: 'status', service: 'ai', status: 'error', error: err.message })
}

// After (with mock mode):
const MOCK_AI = process.env.QVAC_MOCK === '1'

let modelId = null
if (MOCK_AI) {
  await new Promise(r => setTimeout(r, 100))
  modelId = 'mock-model'
  send({ type: 'status', service: 'ai', status: 'ready', modelId })
} else {
  try {
    modelId = await loadModel({ modelSrc: LLAMA_3_2_1B_INST_Q4_0, ... })
    send({ type: 'status', service: 'ai', status: 'ready', modelId })
  } catch (err) {
    send({ type: 'status', service: 'ai', status: 'error', error: err.message })
  }
}
```

Chat handler:

```js
case 'chat': {
  if (!modelId) { send({ type: 'chat-error', error: 'Model not loaded' }); break }
  if (MOCK_AI) {
    const last = msg.history[msg.history.length - 1]
    const reply = `Mock: ${last?.content ?? '(empty)'}`
    for (const char of reply) {
      send({ type: 'chat-token', token: char })
      await new Promise(r => setTimeout(r, 10))
    }
    send({ type: 'chat-done' })
    break
  }
  const result = completion({ modelId, history: msg.history, stream: true })
  for await (const token of result.tokenStream) {
    send({ type: 'chat-token', token })
  }
  send({ type: 'chat-done' })
  break
}
```

### Expo Mobile — `bare/index.js` changes

The Bare worklet does not inherit `process.env`. Environment variables need to
be passed in via the IPC init message.

The `WorkletContext.tsx` already sends an init message to start the worklet. Extend it to include a `mock` flag:

```ts
// WorkletContext.tsx — when starting the worklet:
await rpc.request(CMD_INIT, { mock: __DEV__ && process.env.EXPO_PUBLIC_QVAC_MOCK === '1' })
```

In `bare/index.js`, the init handler stores the mock flag:

```js
let mockMode = false

rpc.respond(CMD_INIT, async (req) => {
  mockMode = req.body?.mock ?? false
  // ... rest of init
})

rpc.respond(CMD_LOAD_MODEL, async (req) => {
  if (mockMode) {
    await sleep(100)
    return { ok: true }
  }
  // real model load
})

rpc.respond(CMD_CHAT, async (req) => {
  if (mockMode) {
    return { ok: true, text: `Mock: ${req.body.messages.at(-1)?.content ?? ''}` }
  }
  // real inference
})
```

### Node CLI — `ai-manager.ts` changes

```ts
// ai-manager.ts
export async function setupAI() {
  if (process.env.QVAC_MOCK === '1') {
    console.log('AI ready (mock mode)')
    return {
      chat: async (history: Message[]) => `Mock: ${history.at(-1)?.content}`,
      cleanup: async () => {},
    }
  }
  // real QVAC setup
}
```

---

## File Structure

```
packages/cli/
├── src/
│   ├── generators/
│   │   ├── types.ts              # Feature type: 'local-ai' | 'wallet'
│   │   ├── pear-desktop.ts       # + QVAC_MOCK=1 in worker.js
│   │   ├── expo-mobile.ts        # + mock flag via IPC init
│   │   └── node-cli.ts           # + QVAC_MOCK in ai-manager.ts
│   └── __tests__/
│       ├── generators.test.ts    # updated combos (bare, local-ai, wallet)
│       └── pear-desktop-generator.test.ts
│
└── e2e/
    ├── test-scaffold.ts          # main runner (update variants + add node-cli)
    ├── worker-harness.js         # NEW: Pear global shim for worker.js testing
    └── playwright/               # NEW: deferred — Pear Desktop Level 5
        └── pear-desktop.spec.ts
```

---

## Running Tests

### CI (fast, automatic)

```bash
# Runs on every PR — no special requirements
npx tsx e2e/test-scaffold.ts --platform pear-desktop --level 3
npx tsx e2e/test-scaffold.ts --platform expo-mobile --level 2   # install only, no xcode
npx tsx e2e/test-scaffold.ts --platform node-cli --level 3
```

Estimated CI time: ~5 min (parallel across platforms).

For a macOS-only runner with Xcode installed:
```bash
npx tsx e2e/test-scaffold.ts --platform expo-mobile --level 3
```
Adds ~10 min for xcodebuild.

### Local smoke (no models, ~10 min)

```bash
# Scaffold + install + structural checks on everything
npx tsx e2e/test-scaffold.ts --level 3

# Single variant quick check
npx tsx e2e/test-scaffold.ts --platform pear-desktop --variant bare --level 2
```

### Local worker test (no display, ~2 min)

```bash
# Test the Pear Desktop worker in isolation
npx tsx e2e/test-scaffold.ts --platform pear-desktop --level 4
```

### Local full E2E with mocked AI (~20–40 min, needs Xcode + Maestro + simulator)

```bash
# All variants, full Maestro UI test with mock AI
QVAC_MOCK=1 npx tsx e2e/test-scaffold.ts --platform expo-mobile --level 5

# Single variant
QVAC_MOCK=1 npx tsx e2e/test-scaffold.ts --platform expo-mobile --variant local-ai --level 5
```

### Local full E2E with real AI (requires model downloaded, ~1h+)

```bash
npx tsx e2e/test-scaffold.ts --platform expo-mobile --level 5
# (QVAC_MOCK not set — uses real model)
```

---

## Implementation Order

| # | Task | Effort | Unblocks |
|---|------|--------|----------|
| 1 | **Feature simplification** — rename `qvac`→`local-ai`, remove `p2p`/`kv-storage`/`autobase` flags, include P2P+KV in base, add `wallet` stub | Medium | Everything below |
| 2 | **Update generator unit tests** — new combos, new feature names | Small | CI green |
| 3 | **QVAC mock mode in generators** — `worker.js`, `bare/index.js`, `ai-manager.ts` | Medium | Level 4–5 tests |
| 4 | **Node CLI Level 3** — add node-cli to test runner, spawn + stdout assert | Small | CI covers node-cli |
| 5 | **Worker harness** — `e2e/worker-harness.js`, add Level 4 to desktop test runner | Medium | Desktop Level 4 |
| 6 | **Update Maestro flows** — add KV test to base (not gated on feature), add mock-gated AI chat steps | Small | Mobile Level 5 with mock |
| 7 | **Update CI workflow** — GitHub Actions matrix with all 3 platforms at Level 3 | Small | Automated CI |
| 8 | *(deferred)* **Playwright Level 5 for desktop** — CDP spike, implement if viable | Large | — |

---

## Open Questions

1. **Does `pear run --remote-debugging-port` work?** Needed for Playwright
   Level 5. Requires a spike with the current `pear-electron` version.

2. **Can xcodebuild run in GitHub Actions free tier?** macOS runners are 10x
   more expensive. Level 3 xcodebuild for mobile may need to be nightly-only
   or on a self-hosted runner.

3. **Bare worklet env var passing:** The `EXPO_PUBLIC_QVAC_MOCK` approach for
   Expo relies on Expo's public env var injection at bundle time. Verify this
   works with `bare-pack` bundles (which are separate from the Metro bundle).
   Alternative: pass mock flag in the RPC init message always and control it
   from `WorkletContext.tsx` based on `__DEV__`.
