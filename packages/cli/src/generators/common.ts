import { manifest } from '../compatibility/index.js'
import type { GeneratedFile, GeneratorOptions, Feature } from './types.js'

export function has(opts: GeneratorOptions, feature: Feature): boolean {
  return opts.features.includes(feature)
}

// Model identity and configuration come from the compatibility manifest.
export const DEFAULT_LLM_CONST = manifest.model.constant
export const DEFAULT_LLM_LABEL = manifest.model.label
export const DEFAULT_LLM_SIZE_MB = manifest.model.sizeMB
export const DEFAULT_CTX_SIZE = manifest.model.config.ctx_size

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
 * QVAC 0.21 rejects n_discarded. Desktop requests use bounded recent history
 * and a latest-message-only retry on ContextOverflowError before any output.
 */
export function llmModelConfig(indent = '    '): string {
  return JSON.stringify(manifest.model.config, null, 2).replaceAll('\n', '\n' + indent)
}

/** Dependencies added by the `multi-writer` feature, shared by all platforms. */
export const MULTI_WRITER_DEPS: Record<string, string> = manifest.profiles['pear-desktop'].featureDependencies['multi-writer']

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
    // Writer sequence for diagnostics, not wall-clock time or conflict ordering.
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

const encode = (op${t(': any')}) => {
  const value = b4a.from(JSON.stringify({ version: 1, ...op }))
  if (value.byteLength > 65536) throw new Error('Operation exceeds 64 KiB')
  return value
}
const checkKey = (key${t(': string')}) => {
  if (typeof key !== 'string' || key.length === 0 || key.length > 512) throw new Error('Key must contain 1-512 characters')
}
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
 * order, so it must be deterministic: no wall clock, randomness or external I/O.
 */
async function apply(nodes${t(': any')}, view${t(': any')}, host${t(': any')}) {
  for (const node of nodes) {
    // Reject malformed immutable log entries deterministically. Never let one
    // invalid operation prevent the rest of a writer's log from applying.
    if (!node.value || node.value.byteLength > 65536) continue
    let op${t(': any')}
    try { op = decode(node.value) } catch { continue }
    if (!op || typeof op !== 'object' || Array.isArray(op) || (op.version !== undefined && op.version !== 1)) continue
    // Earlier scaffolds emitted unversioned upserts, including tombstones.
    // Preserve their data under the same source authorization and log order.
    if (op.version === undefined && op.type === 'upsert' && Number.isSafeInteger(op.doc?.deletedAt) && op.doc.deletedAt > 0) op.type = 'delete'
    // Autobee's node.key is the authenticated writer; authorId in a payload
    // is not an identity. Only the founding writer may change membership.
    const writer = b4a.toString(node.key, 'hex')
    if (op.type === 'add-writer' || op.type === 'remove-writer') {
      if (writer !== b4a.toString(host.key, 'hex')) continue
      if (typeof op.key !== 'string' || !/^[a-f0-9]{64}$/.test(op.key)) continue
      if (op.type === 'add-writer') await host.addWriter(b4a.from(op.key, 'hex'), { isIndexer: false })
      else if (op.key !== writer) await host.removeWriter(b4a.from(op.key, 'hex'))
      continue
    }
    if (op.type !== 'upsert' && op.type !== 'delete') continue
    if (!op.doc || typeof op.doc.key !== 'string' || op.doc.key.length === 0 || op.doc.key.length > 512) continue
    if (op.type === 'upsert') {
      if (typeof op.doc.value !== 'string') continue
      try { JSON.parse(op.doc.value) } catch { continue }
    }
    // Ordered operations win in the linearized view. Device wall clocks never
    // decide winners. Reordering can change provisional state until confirmed.
    await view.db.insert('@app/entries', {
      key: op.doc.key,
      value: op.type === 'delete' ? '' : op.doc.value,
      authorId: writer,
      updatedAt: node.length,
      deletedAt: op.type === 'delete' ? 1 : 0,
    })
    await view.db.flush()
  }
}

export async function createStore(store${t(': any')}, storagePath${t(': string')}, bootstrapKey${t(': any')} = null) {
  const autobee = new Autobee(store, bootstrapKey, { open, apply, optimistic: false, close: async (view${t(': any')}) => { await view.db.close() } })
  await autobee.ready()

  // Device-private. Separate engine, separate file, never replicated.
  const local = HyperDB.rocks(\`\${storagePath}/local\`, LocalSpec)


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
    /** False until the founding writer promotes this device. */
    get writable() { return autobee.writable },

    /**
     * Accepts any JSON-serializable value, like the default Hyperbee store
     * (valueEncoding: 'json'). The hyperschema field is a string, so the
     * value is JSON-encoded on write and decoded on read — passing an object
     * straight through would crash compact-encoding's string preencode.
     */
    async put(key${t(': string')}, value${t(': unknown')}) {
      checkKey(key)
      if (!autobee.writable) throw new Error('Not yet a writer — ask a peer to add this device')
      await autobee.append(encode({
        type: 'upsert',
        doc: { key, value: JSON.stringify(value ?? null) },
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
      checkKey(key)
      if (!autobee.writable) throw new Error('Not yet a writer — ask a peer to add this device')
      await autobee.append(encode({ type: 'delete', doc: { key } }))
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

    /** Only the founding device can change writers; readers cannot self-promote. */
    async addWriter(writerKeyHex${t(': string')}) {
      if (!b4a.equals(autobee.local.key, autobee.key)) throw new Error('Only the founding writer can manage membership')
      if (!/^[a-f0-9]{64}$/.test(writerKeyHex)) throw new Error('Writer key must be 32-byte lowercase hex')
      await autobee.append(encode({ type: 'add-writer', key: writerKeyHex }))
    },

    async removeWriter(writerKeyHex${t(': string')}) {
      if (!b4a.equals(autobee.local.key, autobee.key)) throw new Error('Only the founding writer can manage membership')
      if (!/^[a-f0-9]{64}$/.test(writerKeyHex) || writerKeyHex === autobee.key.toString('hex')) throw new Error('Invalid writer removal')
      await autobee.append(encode({ type: 'remove-writer', key: writerKeyHex }))
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
