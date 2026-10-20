import { defineConfig } from 'tsup'
import { readFileSync } from 'node:fs'

// Single source of truth for the CLI version. Injected as a build-time
// constant so `us --version` can never drift from package.json (it did:
// package.json said 0.3.0 while us.ts hardcoded 0.2.0).
const pkgVersion = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf8'),
).version as string

// -----------------------------------------------------------------------------
// Build profiles
// -----------------------------------------------------------------------------
// Each profile is a fixed set of on/off decisions for the CLI's top-level
// command surfaces. The flag literals are injected via esbuild's `define` so
// the gated `if (US_FEAT_X) { await import(...) }` branches become
// `if (false)` at parse time and the whole dependency subtree gets DCE'd.
//
// Shipping default = `minimal`. Ship the smallest, most-audited surface; flip
// individual flags on (or build the `full` profile) for internal use and
// integration tests.
//
// Per-flag env overrides are honoured (e.g. `US_FEAT_REMOTE=true pnpm build`).

type Flag =
  | 'US_FEAT_INIT'
  | 'US_FEAT_SCAFFOLD'
  | 'US_FEAT_DOCTOR'
  | 'US_FEAT_REMOTE'
  | 'US_FEAT_RESEARCH'
  | 'US_FEAT_SEARCH'
  | 'US_FEAT_NODE'
  | 'US_FEAT_MEMORY'

type ProfileName = 'minimal' | 'full'

const PROFILES: Record<ProfileName, Record<Flag, boolean>> = {
  // Ships the core preview. Plugin management is registered in both profiles.
  minimal: {
    US_FEAT_INIT: true,
    US_FEAT_SCAFFOLD: true,
    US_FEAT_DOCTOR: true,
    US_FEAT_REMOTE: false,
    US_FEAT_RESEARCH: false,
    US_FEAT_SEARCH: false,
    // Personal Node/runtime 0.6 is deferred from the core public preview.
    // Keep the command available in full/internal builds until its packaging,
    // trust, resource, and replication-status gates pass.
    US_FEAT_NODE: false,
    // Memory is also outside the focused public-preview contract.
    US_FEAT_MEMORY: false,
  },
  // Everything we've built. Used for `pnpm dev`, integration tests, and
  // internal installs that need `us remote` / `us research` / `us search`.
  full: {
    US_FEAT_INIT: true,
    US_FEAT_SCAFFOLD: true,
    US_FEAT_DOCTOR: true,
    US_FEAT_REMOTE: true,
    US_FEAT_RESEARCH: true,
    US_FEAT_SEARCH: true,
    US_FEAT_NODE: true,
    US_FEAT_MEMORY: true,
  },
}

function resolveProfile(): { name: string; flags: Record<Flag, boolean> } {
  const raw = (process.env.US_BUILD_PROFILE ?? 'minimal').trim()
  if (raw !== 'minimal' && raw !== 'full') {
    throw new Error(
      `Unknown US_BUILD_PROFILE="${raw}". Expected one of: minimal, full`,
    )
  }
  const flags = { ...PROFILES[raw] }

  // Per-flag env overrides (`US_FEAT_REMOTE=true pnpm build`). We only read
  // flags that exist in the profile table so a typo loudly fails typecheck
  // below rather than silently no-op'ing.
  for (const key of Object.keys(flags) as Flag[]) {
    const override = process.env[key]
    if (override === undefined) continue
    if (override !== 'true' && override !== 'false') {
      throw new Error(
        `Invalid ${key}="${override}". Expected "true" or "false".`,
      )
    }
    flags[key] = override === 'true'
  }

  // Name becomes "minimal+remote" etc. if flags were overridden so that
  // `us --version` reports something useful.
  const overrides = (Object.keys(flags) as Flag[]).filter(
    (k) => flags[k] !== PROFILES[raw][k],
  )
  const name = overrides.length
    ? `${raw}(${overrides.map((k) => `${flags[k] ? '+' : '-'}${k.replace('US_FEAT_', '').toLowerCase()}`).join(',')})`
    : raw

  return { name, flags }
}

const { name: profileName, flags } = resolveProfile()

// `define` wants string values (they're injected verbatim into the source).
const define: Record<string, string> = {
  __US_BUILD_PROFILE__: JSON.stringify(profileName),
  __US_VERSION__: JSON.stringify(pkgVersion),
}
for (const [k, v] of Object.entries(flags)) define[k] = v ? 'true' : 'false'

// Entry points that are only relevant when specific flags are on.
const entry = ['src/us.ts']
if (flags.US_FEAT_REMOTE) {
  entry.push('src/remote/daemon-entry.ts', 'src/remote/test-client.ts')
}

// Log once so users grepping CI logs can confirm what they built.
// eslint-disable-next-line no-console
console.log(`[tsup] profile=${profileName} flags=${JSON.stringify(flags)}`)

export default defineConfig({
  entry,
  format: ['esm'],
  dts: true,
  clean: true,
  // Full-profile-only runtime packages stay external. Several contain native
  // modules or CommonJS internals that cannot be safely folded into the ESM
  // bundle. They are development dependencies and are absent from the
  // published minimal install.
  external: [
    '@extractus/article-extractor',
    '@hyperswarm/testnet',
    '@mozilla/readability',
    'b4a',
    'compact-encoding',
    'corestore',
    'duck-duck-scrape',
    'fastify',
    'hyperbee',
    'hypercore',
    'hypercore-crypto',
    'hyperdht',
    'hyperdrive',
    'hyperswarm',
    'jsdom',
    'node-pty',
    'qrcode-terminal',
  ],
  define,
})
