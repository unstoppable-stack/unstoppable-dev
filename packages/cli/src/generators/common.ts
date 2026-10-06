import type { GeneratedFile, GeneratorOptions, Feature } from './types.js'

export function has(opts: GeneratorOptions, feature: Feature): boolean {
  return opts.features.includes(feature)
}

/**
 * Default LLM for scaffolded apps.
 *
 * `QWEN3_5_0_8B_MULTIMODAL_Q4_K_M` is the smallest LLM in `@qvac/sdk@0.15`'s
 * model registry (532MB, engine `llamacpp-completion`, addon `llm`). It
 * resolves to the same pinned Hugging Face revision that `tetherto/qvac-app`
 * hardcodes in its own `llm-catalog.ts` — so we get their validated model
 * without maintaining a parallel `registry://` catalog.
 *
 * Supersedes `QWEN3_600M_INST_Q4` (Qwen 3 0.6B, 382MB). That constant still
 * exists in the SDK, but Qwen 3 emits `<think>` blocks that had to be stripped
 * from the token stream by hand; Qwen 3.5 supports `reasoning_budget` instead.
 */
export const DEFAULT_LLM_CONST = 'QWEN3_5_0_8B_MULTIMODAL_Q4_K_M'
export const DEFAULT_LLM_LABEL = 'Qwen 3.5 0.8B'
export const DEFAULT_LLM_SIZE_MB = 532
export const DEFAULT_CTX_SIZE = 4096

/**
 * `modelConfig` passed to `loadModel`, as JS source (generators inline this
 * into the app they emit). Mirrors `buildLlmModelConfig` in qvac-app's
 * `core/src/services/model/model-load-config.ts`, minus the hardware-probe
 * keys (`device`, `gpu_layers`, `main-gpu`) that need a GPU probe we don't
 * scaffold.
 *
 * - `reasoning_budget: 0` disables Qwen thinking at the engine level. This is
 *   the supported replacement for putting `/no_think` in the system prompt and
 *   regex-stripping `<think>...</think>` out of the token stream — that hack
 *   leaked partial tags across chunk boundaries. Use `-1` for unlimited
 *   thinking. Valid in `modelConfig` (load) and in `generationParams`
 *   (per-completion) — verified against the SDK's `load-model` and
 *   `completion-stream` schemas.
 * - `n_discarded` enables the engine's sliding context window: on overflow it
 *   evicts the oldest ~10% instead of throwing `ContextOverflowError`. With
 *   this set, never hand-trim history — the SDK reuses its KV cache by message
 *   count, so dropping old messages forces a full re-prefill that overflows.
 *   (qvac-app ADR-2026-06-23-append-only-history.)
 */
export function llmModelConfig(indent = '    '): string {
  const i = indent
  return [
    '{',
    `${i}  ctx_size: CTX_SIZE,`,
    `${i}  // Sliding window — evict oldest ~10% on overflow instead of throwing.`,
    `${i}  n_discarded: Math.floor(CTX_SIZE / 10),`,
    `${i}  // 0 = no reasoning, -1 = unlimited. Engine-level, so no prompt hacks`,
    `${i}  // and no stripping reasoning blocks back out of the token stream.`,
    `${i}  reasoning_budget: 0,`,
    `${i}  system_prompt: 'You are a helpful assistant.',`,
    `${i}}`,
  ].join('\n')
}

/** Dependencies added by the `multi-writer` feature, shared by all platforms. */
export const MULTI_WRITER_DEPS: Record<string, string> = {
  // Pinned exact: upstream marks Autobee experimental and expects breaking
  // changes. Verified working at 1.0.10 (Node + Bare, two-writer convergence).
  autobee: '1.0.10',
  hyperdb: '^6.7.0',
  hyperschema: '^1.21.0',
}

/**
 * `schema/build.js` — declares the replicated (`@app`) and device-private
 * (`@local`) collections, then generates `schema/spec/`.
 *
 * Runs under plain Node (verified), so it can be an npm `postinstall` step
 * rather than needing the Bare toolchain.
 */
export function schemaBuilder(): GeneratedFile {
  return {
    path: 'schema/build.js',
    content: `// Regenerates ./schema/spec from the definitions below.
//   npm run build:schema
//
// Two namespaces, split by trust boundary:
//   @app   — replicated to every device in the mesh
//   @local — device-private, never leaves this machine
//
// Put credentials, tokens, device identity, and per-device derived state in
// @local. Anything in @app is visible to every peer you sync with.
//
// ESM — this package is "type": "module". Both builders ship an \`import\`
// entry, so no .cjs shim is needed.
import Hyperschema from 'hyperschema'
import HyperDB from 'hyperdb/builder'

const SCHEMA_DIR = './schema/spec/hyperschema'
const APP_DIR = './schema/spec/app'
const LOCAL_DIR = './schema/spec/local'

const schema = Hyperschema.from(SCHEMA_DIR)

// ─── @app — replicated ───────────────────────────────────────────────────────
const app = schema.namespace('app')
app.register({
  name: 'entry',
  compact: false,
  fields: [
    { name: 'key', type: 'string', required: true },
    { name: 'value', type: 'string', required: false },
    { name: 'authorId', type: 'string', required: false },
    // Optional uints decode to 0 when absent — guard with \`||\`, never \`??\`.
    { name: 'updatedAt', type: 'uint', required: false },
    // There is no replicating DELETE, so deletes are tombstones.
    { name: 'deletedAt', type: 'uint', required: false },
  ],
})

// ─── @local — device-private ─────────────────────────────────────────────────
const local = schema.namespace('local')
local.register({
  name: 'config',
  compact: false,
  fields: [
    { name: 'key', type: 'string', required: true },
    { name: 'value', type: 'string', required: false },
  ],
})

Hyperschema.toDisk(schema)

// ─── Collections + indexes ───────────────────────────────────────────────────
const appDb = HyperDB.from(SCHEMA_DIR, APP_DIR)
const appNs = appDb.namespace('app')
appNs.collections.register({
  name: 'entries',
  schema: '@app/entry',
  key: ['key'],
})
// Secondary lookups need a registered index — there is no WHERE clause.
appNs.indexes.register({
  name: 'entries-by-author',
  collection: '@app/entries',
  unique: false,
  key: ['authorId'],
})
HyperDB.toDisk(appDb)

const localDb = HyperDB.from(SCHEMA_DIR, LOCAL_DIR)
const localNs = localDb.namespace('local')
localNs.collections.register({
  name: 'config',
  schema: '@local/config',
  key: ['key'],
})
HyperDB.toDisk(localDb)

console.log('schema written to ./schema/spec')
`,
  }
}

/**
 * The multi-writer store, as JS source. Emitted as `.ts` for node-cli and
 * `.js` for pear-desktop (the Pear worker is plain ESM), so this returns the
 * body and each generator picks the path/extension.
 *
 * `specPath` is the relative import prefix to `schema/spec` from the file's
 * own location.
 */
export function multiWriterStoreSource(specPath: string, typed: boolean): string {
  const t = (s: string) => (typed ? s : '')
  return `import Autobee from 'autobee'
import HyperDB from 'hyperdb'
import b4a from 'b4a'
import AppSpec from '${specPath}/app/index.js'
import LocalSpec from '${specPath}/local/index.js'

const encode = (op${t(': any')}) => b4a.from(JSON.stringify(op))
const decode = (buf${t(': any')}) => JSON.parse(b4a.toString(buf))

/**
 * Build the replicated view. MUST be synchronous — Autobee assigns
 * \`view = open(bee)\` without awaiting and hands the same value to apply.
 * \`bee2\` is the hyperbee2 constructor, which is what an Autobee view is.
 */
function open(bee${t(': any')}) {
  return { db: HyperDB.bee2(bee, AppSpec, { autoUpdate: true }) }
}

/**
 * Merge ops into the view. Runs on every device over the same linearized
 * order, so it must be deterministic: no Date.now(), no randomness, no I/O.
 */
async function apply(nodes${t(': any')}, view${t(': any')}, host${t(': any')}) {
  for (const node of nodes) {
    const op = decode(node.value)

    if (op.type === 'add-writer') {
      await host.addWriter(b4a.from(op.key, 'hex'))
      continue
    }

    if (op.type === 'upsert') {
      const existing = await view.db.get('@app/entries', { key: op.doc.key })
      // Optional uints decode to 0, not null — \`||\`, never \`??\`.
      // NOTE: comparing wall-clock stamps across devices is only safe here
      // because it is a tiebreak of last resort. For anything where losing a
      // write matters, use a hybrid logical clock — clocks on different
      // devices are not comparable. See the p2p-conflict-resolution recipe.
      if (existing && (op.doc.updatedAt || 0) < (existing.updatedAt || 0)) continue
      await view.db.insert('@app/entries', op.doc)
      await view.db.flush()
    }
  }
}

export async function createStore(store${t(': any')}, storagePath${t(': string')}, bootstrapKey${t(': any')} = null) {
  const autobee = new Autobee(store, bootstrapKey, { open, apply })
  await autobee.ready()

  // Device-private. Separate engine, separate file, never replicated.
  const local = HyperDB.rocks(\`\${storagePath}/local\`, LocalSpec)

  const authorId = autobee.local.key.toString('hex').slice(0, 8)

  return {
    autobee,
    local,

    /**
      * Database key — share so other devices can join.
      *
      * On the device that CREATED the database this equals \`writerKey\`,
      * because the creator's own core roots the base. On every device that
      * JOINED, the two differ — and passing the wrong one to \`addWriter\`
      * fails silently (no error, the peer just never becomes writable).
      */
    get key() { return autobee.key.toString('hex') },
    /** This device's writer key — another device passes it to addWriter. */
    get writerKey() { return autobee.local.key.toString('hex') },
    /** False until an existing writer promotes this device. */
    get writable() { return autobee.writable },

    /**
     * Accepts any JSON-serializable value, like the default Hyperbee store
     * (valueEncoding: 'json'). The hyperschema field is a string, so the
     * value is JSON-encoded on write and decoded on read — passing an object
     * straight through would crash compact-encoding's string preencode.
     */
    async put(key${t(': string')}, value${t(': unknown')}) {
      if (!autobee.writable) throw new Error('Not yet a writer — ask a peer to add this device')
      await autobee.append(encode({
        type: 'upsert',
        doc: { key, value: JSON.stringify(value ?? null), authorId, updatedAt: Date.now(), deletedAt: 0 },
      }))
    },

    async get(key${t(': string')}) {
      await autobee.update()
      const row = await autobee.view.db.get('@app/entries', { key })
      // Tombstones stay in the view; filter them on read.
      if (!row || (row.deletedAt || 0) > 0) return null
      return row.value == null ? null : JSON.parse(row.value)
    },

    async del(key${t(': string')}) {
      const row = await autobee.view.db.get('@app/entries', { key })
      if (!row) return
      await autobee.append(encode({
        type: 'upsert',
        doc: { ...row, deletedAt: Date.now(), updatedAt: Date.now() },
      }))
    },

    /**
     * Index queries take RANGES — \`{ authorId: x }\` on its own silently
     * matches every row instead of erroring, so always give both bounds.
     */
    async listByAuthor(author${t(': string')}) {
      await autobee.update()
      const rows = await autobee.view.db
        .find('@app/entries-by-author', { gte: { authorId: author }, lte: { authorId: author } })
        .toArray()
      // Tombstones live in the view; filter them here so this agrees with
      // get(), and decode values the same way.
      return rows
        .filter((r${t(': any')}) => !(r.deletedAt || 0))
        .map((r${t(': any')}) => ({ ...r, value: r.value == null ? null : JSON.parse(r.value) }))
    },

    /** Promote another device. Pass ITS writerKey, not its database key. */
    async addWriter(writerKeyHex${t(': string')}) {
      await autobee.append(encode({ type: 'add-writer', key: writerKeyHex }))
    },

    async setLocal(key${t(': string')}, value${t(': string')}) {
      await local.insert('@local/config', { key, value })
      await local.flush()
    },

    async getLocal(key${t(': string')}) {
      const row = await local.get('@local/config', { key })
      return row ? row.value : null
    },

    async close() {
      await local.close()
      await autobee.close()
    },
  }
}
`
}

export function tsconfig(): GeneratedFile {
  return {
    path: 'tsconfig.json',
    content: JSON.stringify({
      compilerOptions: {
        target: 'ES2022',
        module: 'ESNext',
        moduleResolution: 'bundler',
        esModuleInterop: true,
        strict: true,
        skipLibCheck: true,
        outDir: 'dist',
        rootDir: 'src',
        declaration: true,
        resolveJsonModule: true,
        isolatedModules: true,
      },
      include: ['src'],
      exclude: ['node_modules', 'dist'],
    }, null, 2)
  }
}

export function gitignore(): GeneratedFile {
  return {
    path: '.gitignore',
    content: [
      'node_modules/',
      'dist/',
      '.pear/',
      '*.log',
      '.env',
      '.env.local',
      '.DS_Store',
      '',
    ].join('\n')
  }
}

export function readme(opts: GeneratorOptions): GeneratedFile {
  const multiWriter = has(opts, 'multi-writer')
  const baseFeatures = [
    '- **P2P Networking** — Hyperswarm for peer discovery and connections',
    multiWriter
      ? '- **Multi-Writer Storage** — Autobee + HyperDB; every device reads and writes'
      : '- **KV Storage** — Hyperbee for persistent local key-value data',
  ]
  const optionalFeatures = opts.features.flatMap((f) => {
    switch (f) {
      case 'local-ai':
        return [`- **Local AI** — QVAC SDK for local inference after the initial model download (~${DEFAULT_LLM_SIZE_MB} MB)`]
      case 'wallet':
        return ['- **Wallet** — WDK wallet integration (stub — coming soon)']
      case 'node-sync':
        return ['- **Node Sync** — Register data with the Personal Node alpha for P2P replication']
      case 'node-host':
        return ['- **Node Host** — Expose a capability other apps can pair with and call']
      // multi-writer is reflected in baseFeatures above (it replaces the
      // default KV store rather than adding to it).
      default:
        return []
    }
  })
  const features = [...baseFeatures, ...optionalFeatures].join('\n')

  const platformName = {
    'pear-desktop': 'Pear Desktop',
    'expo-mobile': 'Expo Mobile (iOS/Android)',
    'node-cli': 'Node.js CLI',
  }[opts.platform]

  const multiWriterSection = multiWriter
    ? `

## Multi-Writer Sync

Data lives in an [Autobee](https://www.npmjs.com/package/autobee) — a
multi-writer Hyperbee — with [HyperDB](https://www.npmjs.com/package/hyperdb)
collections on top. Every device can write; writes converge on reconnect.

Two namespaces, split by trust boundary:

| Namespace | Engine | Replicated? |
|---|---|---|
| \`@app\` | \`HyperDB.bee2\` over Autobee | Yes — every peer sees it |
| \`@local\` | \`HyperDB.rocks\` | No — device-private |

Put credentials, device identity, and per-device derived state in \`@local\`.

### Adding a second device

A joining device is **read-only** until an existing writer promotes it:

1. Device A prints its **database key**. Device B starts with
   \`BOOTSTRAP_KEY=<that key>\` to join.
2. Device B prints its **writer key**.
3. Device A promotes it: \`await db.addWriter('<B writer key>')\`.
4. Device B flips to writable and its writes now replicate.

> The database key and the writer key are different things. On the device that
> created the database they happen to be equal, which makes this easy to get
> wrong — passing a database key to \`addWriter\` fails silently.

### Changing the schema

Edit \`schema/build.js\`, then:

\`\`\`bash
npm run build:schema
\`\`\`

\`schema/spec/\` is generated — do not edit it by hand. It is rebuilt on
\`npm install\` via \`postinstall\`.`
    : ''

  const nodeSyncSection = opts.features.includes('node-sync')
    ? `

## Connecting to the Personal Node alpha

This app can register its data with a compatible Personal Node alpha for P2P
replication. Registration is not a verified copy or a complete backup. The
Personal Node is deferred from the core preview, and the app keeps working
locally when it is unavailable.`
    : ''

  const gettingStarted = gettingStartedFor(opts)

  return {
    path: 'README.md',
    content: `# ${opts.projectName}

Built with the **Unstoppable Stack** — P2P, local-first, no servers.

## Platform

${platformName}

## Features

${features}

${gettingStarted}${multiWriterSection}${nodeSyncSection}

## Project Structure

See \`planning/\` for architecture decisions and feature plans.
`
  }
}

function gettingStartedFor(opts: GeneratorOptions): string {
  if (opts.platform === 'expo-mobile') {
    return `## Getting Started

\`\`\`bash
npm install
npm run ios       # iOS simulator (or: npm run android)
\`\`\`

The first run takes 3–5 minutes — it generates the native \`ios/\` and
\`android/\` projects, runs \`pod install\`, and builds a real binary that
links \`react-native-bare-kit\` and the QVAC SDK's native modules. After
that, you can iterate on JavaScript with \`npm run start\` (Metro only,
~2s reloads). You only need to redo \`npm run ios\` when you change a
native dependency or a config plugin.

### Why not Expo Go?

This app uses **custom native modules** (\`react-native-bare-kit\` for the
P2P worklet, \`@qvac/sdk\` for local AI). Expo Go is a fixed shell app
that only ships Expo's stock modules — it physically cannot load
BareKit. If you open the dev URL in Expo Go you'll see:

\`\`\`
[Invariant Violation: TurboModuleRegistry.getEnforcing(...): 'BareKit'
 could not be found.]
\`\`\`

Always launch via \`npm run ios\` / \`npm run android\` so the native build
includes everything.

### On a physical device

\`\`\`bash
npx expo run:ios --device       # iOS — pick your connected iPhone
npx expo run:android --device   # Android — physical device
\`\`\`

QVAC inference (LLM completion) **only works on physical devices** —
\`llamacpp\` doesn't support iOS Simulator or Android Emulator. The UI
will load on simulators but \`Load Assistant\` blocks GPU mode there.
Toggle to CPU mode to experiment, or set \`EXPO_PUBLIC_QVAC_MOCK=1\` to
test the chat UI flow without real inference.`
  }
  return `## Getting Started

\`\`\`bash
npm install
npm run dev
\`\`\``
}

export function planningReadme(): GeneratedFile {
  return {
    path: 'planning/README.md',
    content: `# Planning

Architecture decisions, feature plans, and project documentation.

## What Goes Here

- **Architecture decisions** — Record important technical choices
- **Feature plans** — Break down features before implementing
- **Design docs** — Document system design and data flows
`
  }
}
